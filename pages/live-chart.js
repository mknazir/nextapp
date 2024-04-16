'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { usePathname, useRouter } from 'next/navigation';

const Chart = ({ data, type }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (chartContainerRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        width: 1400,
        height: 600,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && data) {
      let series;

      if (type === 'candlestick') {
        series = chartRef.current.addCandlestickSeries();
      } else if (type === 'line') {
        series = chartRef.current.addLineSeries();
      } else if (type === 'bar') {
        series = chartRef.current.addBarSeries();
      } else if (type === 'area') {
        series = chartRef.current.addAreaSeries({ lineColor: '#2962FF', topColor: '#2962FF', bottomColor: 'rgba(41, 98, 255, 0.28)' });
      } else if (type === 'heikinashi') {
        series = chartRef.current.addCandlestickSeries();
      }

      let previousTimestamp = 0;
      const dataArray = data.reduce((accumulator, candle) => {
        const timestamp = new Date(candle[0]).getTime();
        const adjustedTimestamp = isNaN(timestamp) || timestamp <= previousTimestamp ? previousTimestamp + 1000 : timestamp;

        if (adjustedTimestamp !== previousTimestamp) {
          const newTime = (adjustedTimestamp + (5.5 * 60 * 60 * 1000)) / 1000;

          if (type === 'candlestick' || type === 'bar' || type === 'heikinashi') {
            accumulator.push({
              time: newTime,
              open: parseFloat(candle[1]), // Open
              high: parseFloat(candle[2]), // High
              low: parseFloat(candle[3]), // Low
              close: parseFloat(candle[4]), // Close
            });
          } else if (type === 'line' || type === 'area') {
            accumulator.push({
              time: newTime,
              value: parseFloat(candle[1])
            });
          }

          previousTimestamp = adjustedTimestamp;
        }

        return accumulator;
      }, []);

      dataArray.sort((a, b) => a.time - b.time);

      series.setData(dataArray);

      chartRef.current.applyOptions({
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        grid: {
          vertLines: {
            visible: false,
          },
          horzLines: {
            visible: false,
          },
        },
      });
    }
  }, [data, type]);



  return <div ref={chartContainerRef} />;
};

const LiveChart = () => {
  const [coinData, setCoinData] = useState({});
  const [selectedTab, setSelectedTab] = useState('BTCUSDT');
  const [displayedCoins, setDisplayedCoins] = useState(['BTCUSDT', 'ETHUSDT']);
  const [userName, setUserName] = useState("");
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const selectedTabFromStorage = localStorage.getItem('selectedTab');
        const displayedCoinsFromStorage = localStorage.getItem('displayedCoins');
        const userNameFromStorage = localStorage.getItem('userName');

        if (selectedTabFromStorage !== null) {
            setSelectedTab(selectedTabFromStorage);
        }

        if (displayedCoinsFromStorage !== null) {
            setDisplayedCoins(JSON.parse(displayedCoinsFromStorage));
        }

        if (userNameFromStorage !== null) {
            setUserName(userNameFromStorage);
        }
    }
}, []);

  const [dropdownCoins, setDropdownCoins] = useState([]);
  const [newCoin, setNewCoin] = useState('');
  const [isWebSocketError, setIsWebSocketError] = useState(false);

  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [selectedChartType, setSelectedChartType] = useState('candlestick');

  const handleIntervalChange = (interval) => {
    setSelectedInterval(interval);
  };

  const fetchDropdownCoins = async () => {
    try {
      const response = await fetch('https://api3.binance.com/api/v3/ticker/price');
      const data = await response.json();
      const usdtSymbols = data
        .filter((entry) => entry.symbol.includes('USDT'))
        .map((entry) => entry.symbol);
      setDropdownCoins(usdtSymbols);
    } catch (error) {
      // console.error('Error fetching dropdown coins:', error);
    }
  };


  useEffect(() => {
    fetchDropdownCoins();
  }, []);

  const fetchHistoricalData = async () => {
    const endTime = Date.now();
    // const startTime = endTime - 300 * 60 * 1000;
    const interval = selectedInterval;
    const limit = 3000;

    const historicalDataUrl = `https://api.binance.com/api/v3/klines?symbol=${selectedTab}&interval=${interval}&endTime=${endTime}&limit=${limit}`;

    try {
      const response = await fetch(historicalDataUrl);
      const result = await response.json();
      processHistoricalData(result);
    } catch (error) {
      // console.error('Error fetching historical data:', error);
      setIsWebSocketError(true);
    }
  };

  const processHistoricalData = (data) => {
    const processedData = {
      [selectedTab]: {
        candlestick: data.map((candle) => [
          candle[0],
          parseFloat(candle[1]), // Open
          parseFloat(candle[2]), // High
          parseFloat(candle[3]), // Low
          parseFloat(candle[4]), // Close
        ]),
        line: data.map((candle) => [
          candle[0],
          parseFloat(candle[4]), // Close
        ]),
        volume: data.map((candle) => [
          candle[0],
          parseFloat(candle[5]), // Volume
        ]),
        heikinashi: processHeikinashi(data), // Delegate Heikin-Ashi calculation
      },
    };

    setCoinData((prevData) => ({
      ...prevData,
      ...processedData,
    }));
  };

  const processHeikinashi = (data) => {

    const cleanData = data.map((candle) => {
      return candle.map((value) => {
        return typeof value === 'string' ? parseFloat(value) : value;
      });
    });

    const firstOpen = (cleanData[0][1] + cleanData[0][4]) / 2;
    const firstClose = cleanData[0][4];

    return cleanData.reduce((acc, candle, i) => {
      const prevOpen = i === 0 ? firstOpen : acc[i - 1][1];
      const prevClose = i === 0 ? firstClose : acc[i - 1][4];

      const open = (prevOpen + prevClose) / 2;
      const close = (open + candle[1] + candle[2] + candle[4]) / 4;
      const high = Math.max(candle[2], open, close);
      const low = Math.min(candle[3], open, close);

      return [...acc, [candle[0], open, high, low, close]];
    }, []);
  };



  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedTab', selectedTab);
      localStorage.setItem('displayedCoins', JSON.stringify(displayedCoins));
    }
    fetchHistoricalData();
  }, [selectedTab, selectedInterval]);

  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws');

    ws.onopen = () => {
      // console.log('WebSocket connection opened');
      setIsWebSocketError(false);

      const subscribe = {
        method: 'SUBSCRIBE',
        params: [`${selectedTab.toLowerCase()}@kline_1m`],
        id: 1,
      };
      ws.send(JSON.stringify(subscribe));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data && data.e === 'kline' && data.s === selectedTab) {
        setCoinData((prevData) => {
          const updatedData = { ...prevData };

          const kline = data.k;
          const currentTime = new Date(kline.t).getTime();
          if (selectedChartType === 'candlestick' || selectedChartType === 'bar') {
            if (!updatedData.lastUpdateTime || currentTime - updatedData.lastUpdateTime >= 60000) {
              const previousCandle = updatedData[selectedTab].candlestick.slice(-1)[0];
              const previousLow = previousCandle ? previousCandle[3] : parseFloat(kline.l);
              const previousHigh = previousCandle ? previousCandle[2] : parseFloat(kline.h);
              const newCandle = [
                new Date(kline.t).toLocaleTimeString(),
                parseFloat(kline.o),
                Math.max(previousHigh, parseFloat(kline.h)),
                parseFloat(kline.c),
                Math.min(previousLow, parseFloat(kline.l)),
              ];

              updatedData[selectedTab].candlestick = enqueue(updatedData[selectedTab].candlestick, newCandle, 30);

              updatedData.lastUpdateTime = currentTime;
            }
          } else if (selectedChartType === 'line' || selectedChartType === 'area') {
            updatedData[selectedTab].line = [
              ...updatedData[selectedTab].line,
              [kline.t, parseFloat(kline.c)],
            ];
          } else {
            if (!updatedData.lastUpdateTime || currentTime - updatedData.lastUpdateTime >= 60000) {
              const previousCandle = updatedData[selectedTab].candlestick.slice(-1)[0];
              const previousLow = previousCandle ? previousCandle[3] : parseFloat(kline.l);
              const previousHigh = previousCandle ? previousCandle[2] : parseFloat(kline.h);
              const newCandle = [
                kline.t,
                parseFloat(kline.o),
                Math.max(previousHigh, parseFloat(kline.h)),
                parseFloat(kline.c),
                Math.min(previousLow, parseFloat(kline.l)),
              ];

              updatedData[selectedTab].candlestick = enqueue(updatedData[selectedTab].candlestick, newCandle, 30);

              updatedData.lastUpdateTime = currentTime;
            }
          }
          return updatedData;
        });
      }
    };

    ws.onerror = (error) => {
      // console.error('WebSocket Error:', error);
      setIsWebSocketError(true);
    };

    ws.onclose = (event) => {
      // console.log('WebSocket Closed:', event);
      setIsWebSocketError(true);
      handleWebSocketReconnect(ws);
    };

    return () => {
      ws.close();
    };
  }, [selectedTab, selectedChartType, selectedInterval]);

  const enqueue = (queue, data, limit) => {
    const newQueue = [...queue, data];
    return newQueue.length > limit ? newQueue.slice(1) : newQueue;
  };

  const handleWebSocketReconnect = (ws) => {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      ws = new WebSocket('wss://stream.binance.com:9443/ws');

      ws.onopen = () => {
        // console.log('WebSocket reconnection opened');
        setIsWebSocketError(false);

        const subscribe = {
          method: 'SUBSCRIBE',
          params: [`${selectedTab.toLowerCase()}@kline_1m`],
          id: 1,
        };
        ws.send(JSON.stringify(subscribe));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data && data.e === 'kline' && data.s === selectedTab) {
          setCoinData((prevData) => {
            const updatedData = { ...prevData };

            const kline = data.k;
            const currentTime = new Date(kline.t).getTime();

            if (selectedChartType === 'candlestick' || selectedChartType === 'bar') {
              if (!updatedData.lastUpdateTime || currentTime - updatedData.lastUpdateTime >= 60000) {
                const previousCandle =
                  updatedData[selectedTab].candlestick.slice(-1)[0];
                const previousLow = previousCandle ? previousCandle[3] : parseFloat(kline.l);
                const previousHigh = previousCandle ? previousCandle[2] : parseFloat(kline.h);
                const newCandle = [
                  kline.t,
                  Math.min(previousLow, parseFloat(kline.l)),
                  parseFloat(kline.o),
                  parseFloat(kline.c),
                  Math.max(previousHigh, parseFloat(kline.h)),
                ];

                updatedData[selectedTab].candlestick = enqueue(
                  updatedData[selectedTab].candlestick,
                  newCandle,
                  30
                );

                updatedData.lastUpdateTime = currentTime;
              }
            } else if (selectedChartType === 'line' || selectedChartType === 'area') {
              updatedData[selectedTab].line = [
                ...updatedData[selectedTab].line,
                [kline.t, parseFloat(kline.c)],
              ];
            } else {
              if (!updatedData.lastUpdateTime || currentTime - updatedData.lastUpdateTime >= 60000) {
                const previousCandle =
                  updatedData[selectedTab].candlestick.slice(-1)[0];
                const previousLow = previousCandle ? previousCandle[3] : parseFloat(kline.l);
                const previousHigh = previousCandle ? previousCandle[2] : parseFloat(kline.h);
                const newCandle = [
                  kline.t,
                  Math.min(previousLow, parseFloat(kline.l)),
                  parseFloat(kline.o),
                  parseFloat(kline.c),
                  Math.max(previousHigh, parseFloat(kline.h)),
                ];

                updatedData[selectedTab].candlestick = enqueue(
                  updatedData[selectedTab].candlestick,
                  newCandle,
                  30
                );

                updatedData.lastUpdateTime = currentTime;
              }
            }

            return updatedData;
          });
        }
      };

      ws.onerror = (error) => {
        // console.error('WebSocket Error:', error);
        setIsWebSocketError(true);
      };

      ws.onclose = (event) => {
        // console.log('WebSocket reconnection closed:', event);
        setIsWebSocketError(true);
        // Retry reconnection after a delay
        setTimeout(() => handleWebSocketReconnect(ws), 5000);
      };
    }
  };

  const handleRemoveCoin = (coinToRemove) => {
    const isConfirmed = window.confirm(`Are you sure you want to remove ${coinToRemove}?`);
    if (isConfirmed) {
      const updatedDisplayedCoins = displayedCoins.filter((coin) => coin !== coinToRemove);
      setDisplayedCoins(updatedDisplayedCoins);

      setDropdownCoins([...dropdownCoins, coinToRemove]);
    }
  };

  const addNewCoin = () => {
    const selectedCoin = newCoin.toUpperCase();
    if (selectedCoin && !displayedCoins.includes(selectedCoin)) {
      setDisplayedCoins([...displayedCoins, selectedCoin]);
      setDropdownCoins(dropdownCoins.filter((coin) => coin !== selectedCoin));
      setNewCoin('');
    }
  };

  const handleRedirect = (pathName) => {
    router.push(pathName);
  }

  return (
    <div className='coin-container'>
      {isWebSocketError && <div className="error-message">WebSocket Error. Please check your connection.</div>}
      <Tabs onSelect={(index, lastIndex, event) => setSelectedTab(displayedCoins[index])} className="tabContainer">
        <div className='detailsContainer'>
          <div style={{ margin: "20px 0px" }}>
            <input
              type="text"
              value={newCoin}
              onChange={(e) => setNewCoin(e.target.value)}
              placeholder="Search for a coin"
              list="coinSuggestions"
              className='searchInput'
            />
            {newCoin && (
              <datalist id="coinSuggestions">
                {dropdownCoins.map((coin) => (
                  <option key={coin} value={coin} />
                ))}
              </datalist>
            )}

            <button onClick={addNewCoin} className='addButton'>Add Coin</button>
          </div>
          <div>
            <button
              className={`${path === '/historic-chart' ? 'highlightButton' : 'nrmlbutton'}`}
              onClick={() => handleRedirect('/historic-chart')}
            >
              Historic Data
            </button>
            <button
              className={`${path === '/live-chart' ? 'highlightButton' : 'nrmlbutton'}`}
              onClick={() => handleRedirect('/live-chart')}
            >
              Live Data
            </button>
            <button
              className={`${path === '/multi-live-chart' ? 'highlightButton' : 'nrmlbutton'}`}
              onClick={() => handleRedirect('/multi-live-chart')}
            >
              Live Multi Chart
            </button>
            <button
              className={`${path === '/multi-historic-chart' ? 'highlightButton' : 'nrmlbutton'}`}
              onClick={() => handleRedirect('/multi-historic-chart')}
            >
              Historic Multi Chart
            </button>
          </div>

          <div>
            <h2>{userName}</h2>
          </div>
        </div>
        <TabList className="tabList">
          {displayedCoins.map((coin) => (
            <Tab key={coin} className={`tab ${selectedTab === coin ? "selectedTab" : ""}`}>
              {coin}
              <button onClick={() => handleRemoveCoin(coin)}>X</button>
            </Tab>

          ))}
        </TabList>
        {displayedCoins.map((coin) => (
          <TabPanel key={coin}>
            <div className='coin-info'>
              <h3>{coin}</h3>
              <p>
                Price:{' '}
                <span className='price'>
                  {coinData[coin]?.line[coinData[coin]?.line.length - 1]?.[1]} USDT
                </span>
                <br />
                Volume: <span className='volume'>{coinData[coin]?.volume[coinData[coin]?.volume.length - 1]?.[1]} BTC</span>
              </p>
            </div>
            <div className='container'>
              <select value={selectedChartType} onChange={(e) => setSelectedChartType(e.target.value)} className='chartType'>
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="candlestick">Candlestick Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="heikinashi">Heikin-Ashi Chart</option>
              </select>
              <div className='intervals'>
                <button
                  onClick={(e) => setSelectedInterval(e.target.value)}
                  value={"1m"}
                  style={{ backgroundColor: selectedInterval === "1m" ? "#AFE1AF" : "" }}
                >
                  1m
                </button>
                <button
                  onClick={(e) => setSelectedInterval(e.target.value)}
                  value={"3m"}
                  style={{ backgroundColor: selectedInterval === "3m" ? "#AFE1AF" : "" }}
                >
                  3m
                </button>
                <button
                  onClick={(e) => setSelectedInterval(e.target.value)}
                  value={"5m"}
                  style={{ backgroundColor: selectedInterval === "5m" ? "#AFE1AF" : "" }}
                >
                  5m
                </button>
              </div>
            </div>
            <div className='chart'>
              {selectedChartType === 'line' && (
                <Chart data={coinData[coin]?.line} type={selectedChartType} />
              )}
              {selectedChartType === 'area' && (
                <Chart data={coinData[coin]?.line} type={selectedChartType} />
              )}
              {selectedChartType === 'candlestick' && (
                <Chart data={coinData[coin]?.candlestick} type={selectedChartType} />
              )}
              {selectedChartType === 'bar' && (
                <Chart data={coinData[coin]?.candlestick} type={selectedChartType} />
              )}
              {selectedChartType === 'heikinashi' && (
                <Chart data={coinData[coin]?.heikinashi} type={selectedChartType} />
              )}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
};

export default LiveChart;