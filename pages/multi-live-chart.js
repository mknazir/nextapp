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
                width: 500,
                height: 500,
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    rightOffset: 5,
                    barSpacing: 6,
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
                series = chartRef.current.addCandlestickSeries({
                    priceLineVisible: false, // This hides the red dashed line
                  });
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

const MultiLiveChart = () => {
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
    const [selectedChartType, setSelectedChartType] = useState('candlestick');

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

    const intervals = ['1m', '5m', '1d', '1M'];

    const fetchHistoricalDataForIntervals = async (coin) => {
        const endTime = Date.now();
        const historicalDataFetchPromises = intervals.map(async (interval) => {
            let limit;
            switch (interval) {
                case '1m':
                    limit = 3000;
                    break;
                case '5m':
                    limit = 1000;
                    break;
                case '1d':
                    limit = 1440;
                    break;
                case '1M':
                    limit = 30;
                    break;
                default:
                    limit = 3000;
            }

            const historicalDataUrl = `https://api.binance.com/api/v3/klines?symbol=${coin}&interval=${interval}&endTime=${endTime}&limit=${limit}`;

            try {
                const response = await fetch(historicalDataUrl);
                const result = await response.json();
                return { [interval]: result.map((candle) => [candle[0], parseFloat(candle[1]), parseFloat(candle[2]), parseFloat(candle[3]), parseFloat(candle[4])]) };
            } catch (error) {
                // console.error('Error fetching historical data:', error);
                setIsWebSocketError(true);
                return { [interval]: [] }; // Return empty array in case of error
            }
        });

        const historicalDataForIntervals = await Promise.all(historicalDataFetchPromises);
        const processedData = Object.assign({}, ...historicalDataForIntervals);

        setCoinData((prevData) => ({
            ...prevData,
            [coin]: processedData
        }));
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedTab', selectedTab);
            localStorage.setItem('displayedCoins', JSON.stringify(displayedCoins));
        }
        displayedCoins.forEach((coin) => {
            fetchHistoricalDataForIntervals(coin);
        });
    }, [selectedTab, displayedCoins]);

    useEffect(() => {
        const ws = new WebSocket('wss://stream.binance.com:9443/ws');

        ws.onopen = () => {
            setIsWebSocketError(false);

            const subscribe = {
                method: 'SUBSCRIBE',
                params: displayedCoins.map(coin => intervals.map(interval => `${coin.toLowerCase()}@kline_${interval}`)).flat(),
                id: 1,
            };
            ws.send(JSON.stringify(subscribe));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data && data.e === 'kline' && displayedCoins.includes(data.s)) {
                fetchHistoricalDataForIntervals(data.s);
            }
        };

        ws.onerror = (error) => {
            setIsWebSocketError(true);
        };

        ws.onclose = (event) => {
            setIsWebSocketError(true);
        };

        return () => {
            ws.close();
        };
    }, [displayedCoins]);

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
            <Tabs onSelect={(index, lastIndex, event) => setSelectedTab(displayedCoins[index])} className="tabContainer" style={{ width: "100%" }}>
                <div className='detailsContainer'>
                    <div>
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
                        <div className='container'>
                            <select value={selectedChartType} onChange={(e) => setSelectedChartType(e.target.value)} className='chartType'>
                                <option value="line">Line Chart</option>
                                <option value="area">Area Chart</option>
                                <option value="candlestick">Candlestick Chart</option>
                                <option value="bar">Bar Chart</option>
                                <option value="heikinashi">Heikin-Ashi Chart</option>
                            </select>
                        </div>
                        <div className='userName'>
                            <h3>{selectedChartType}</h3>
                        </div>
                        <div style={{ width: "90%", display: "flex", flexWrap: "wrap", margin: "auto", justifyContent: "center", gap: "15%" }}>
                            {intervals.map((interval) => (
                                <div key={`${coin}-${interval}`}>
                                    <h3>{interval}</h3>
                                    {(selectedChartType === 'line' || selectedChartType === 'area') && (
                                        <Chart data={coinData[coin]?.[interval]?.map((candle) => [candle[0], parseFloat(candle[4])])} type={selectedChartType} />
                                    )}
                                    {(selectedChartType === 'candlestick' || selectedChartType === 'bar') && (
                                        <Chart data={coinData[coin]?.[interval]?.map((candle) => [candle[0], parseFloat(candle[1]), parseFloat(candle[2]), parseFloat(candle[3]), parseFloat(candle[4])])} type={selectedChartType} />
                                    )}
                                    {selectedChartType === 'heikinashi' && (
                                        <Chart data={processHeikinashi(coinData[coin]?.[interval])} type={selectedChartType} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </TabPanel>
                ))}
            </Tabs>
        </div>
    );
};

export default MultiLiveChart;