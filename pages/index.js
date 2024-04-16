import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
export default function IndexPage() {
  const router = useRouter();
  console.log("kaif", process.env.GOOGLE_CLIENT_ID);
  const { data, status } = useSession();
  if (status === 'loading') return <h1> loading... please wait</h1>;
  if (status === 'authenticated') {
    return (
      <div className='flex flex-col justify-center items-center gap-4'>
        <h1> hi {data.user.name}</h1>
        <img src={data.user.image} alt={data.user.name + ' photo'}  className='w-[200px]'/>
        <button onClick={signOut} className='bg-[#ffbaba] text-black rounded-lg p-3 uppercase hover:opacity-95'>sign out</button>
        <button onClick={()=> router.push("/live-chart")} className='bg-[#5be068] text-white rounded-lg p-3 uppercase hover:opacity-95'>Go to Dashboard</button>
      </div>
    );
  }
  return (
    <div>
      <button onClick={() => signIn('google')} className='bg-[#a2fbab] text-white rounded-lg p-3 uppercase hover:opacity-95'>sign in with gooogle</button>
    </div>
  );
}