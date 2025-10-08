import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { io } from 'socket.io-client';

let socket;

export default function RideDetail(){
  const { id } = useParams();
  const [ride,setRide] = useState(null);
  const [method,setMethod] = useState('online');

  useEffect(()=>{ load(); },[id]);
  useEffect(()=>{
    socket = io(import.meta.env.VITE_API_WS || 'http://localhost:4000', { transports:['websocket'] });
    socket.emit('joinRide', id);
    socket.on('ride:update', msg => { if(msg.rideId === id) load(false); });
    return ()=> { socket.emit('leaveRide', id); socket.disconnect(); };
  },[id]);

  async function load(fetchDetails=true){
    const d = await api.getRide(id);
    setRide(d.ride);
  }

  async function book(){
    await api.bookRide(id, method);
    await load();
  }

  if(!ride) return <p className="p-4">Loading...</p>;

  return <div className="p-4 space-y-4">
    <h1 className="text-xl font-bold">{ride.origin} → {ride.destination}</h1>
    <p>ETA: {ride.etaMinutes ? ride.etaMinutes + ' min' : '—'}</p>
  <p>People in bus (counter): {ride.capacityCounter}{ride.seatsTotal? ` / ${ride.seatsTotal}`:''}</p>
    <div>
      <h2 className="font-semibold">Passengers</h2>
      <ul className="text-sm list-disc ml-6">
        {ride.passengers.map((p,i)=><li key={i}>{p.name || 'Guest'} {p.paid? '✅':''}</li>)}
      </ul>
    </div>
    <div className="space-x-2">
      <select className="border p-1" value={method} onChange={e=>setMethod(e.target.value)}>
        <option value="online">Online</option>
        <option value="cash">Cash</option>
      </select>
      <button onClick={book} className="bg-green-600 text-white px-3 py-1 rounded">Book</button>
    </div>
  </div>;
}
