import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { io } from 'socket.io-client';

let socket;

export default function RideDetail(){
  const { id } = useParams();
  const [ride,setRide] = useState(null);
  const [method,setMethod] = useState('online');
  const [seatCode,setSeatCode] = useState('');
  function handleQrUpload(e){
    const file = e.target.files?.[0];
    if(!file) return;
    // Placeholder: In future decode QR to text. For now just show filename w/o extension.
    const base = file.name.replace(/\.[^.]+$/,'');
    setSeatCode(base);
  }
  function startCameraScan(){
    alert('Camera scan placeholder - integrate QR library (e.g., html5-qrcode)');
  }

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
    if(ride.type === 'inter' && !seatCode){
      alert('Please scan or enter the seat QR code');
      return;
    }
    const body = { method, seatCode: ride.type==='inter'? seatCode: undefined };
    await api.bookRide(id, body.method, body.seatCode);
    await load();
  }

  if(!ride) return <p className="p-4">Loading...</p>;

  return <div className="p-4 space-y-4">
    <h1 className="text-xl font-bold">{ride.origin} → {ride.destination}</h1>
    <p>ETA: {ride.etaMinutes ? ride.etaMinutes + ' min' : '—'}</p>
  <p>People in bus (counter): {ride.capacityCounter}{ride.seatsTotal? ` / ${ride.seatsTotal}`:''}</p>
    {ride.type==='inter' && <div>
      <h2 className="font-semibold">Passengers</h2>
      <ul className="text-sm list-disc ml-6">
        {ride.passengers.map((p,i)=><li key={i}>{p.name || 'Guest'} {p.seatCode? `[${p.seatCode}]`:''} {p.paid? '✅':''}</li>)}
      </ul>
    </div>}
  {ride.type === 'inter' && <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium mb-1">Seat Code (Scan QR or type)</label>
          <input className="border p-1" placeholder="BUS101-Seat12" value={seatCode} onChange={e=>setSeatCode(e.target.value)} />
        </div>
        <div className="flex flex-col text-xs gap-1">
          <label className="font-medium">QR Source</label>
          <input type="file" accept="image/*" onChange={e=>handleQrUpload(e)} className="text-xs" />
          <button type="button" onClick={()=>startCameraScan()} className="border px-2 py-1 rounded">Scan Camera</button>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Payment</label>
          <select className="border p-1" value={method} onChange={e=>setMethod(e.target.value)}>
            <option value="online">Online</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <button onClick={book} className="bg-green-600 text-white h-8 px-3 rounded self-end">Book</button>
      </div>
      <p className="text-xs text-gray-500">Seat code required. Upload a QR image or scan with camera (placeholder). Actual QR decoding to be implemented.</p>
    </div>}
    {ride.type === 'intra' && <p className="text-xs text-gray-500">Intra-City rides: booking not required; display only ETA & live counter.</p>}
  </div>;
}
