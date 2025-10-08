import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { io } from 'socket.io-client';
import LiveRideMap from '../../components/Map/LiveRideMap.jsx';

let socket;

export default function RideDetail(){
  const { id } = useParams();
  const [ride,setRide] = useState(null);
  const [userLoc,setUserLoc] = useState(null);
  const [geoAllowed,setGeoAllowed] = useState(null);
  const [method,setMethod] = useState('online');
  const [seatCode,setSeatCode] = useState('');
  const [otherUsers,setOtherUsers] = useState([]);
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
  useEffect(()=>{ // attempt geolocation & start watch
    if(!navigator.geolocation) return;
    const success = (pos)=>{
      setGeoAllowed(true);
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLoc(loc);
      if(socket) socket.emit('user:location', { rideId: id, lat: loc.lat, lng: loc.lng });
    };
    const err = ()=> setGeoAllowed(false);
    navigator.geolocation.getCurrentPosition(success, err);
    const watchId = navigator.geolocation.watchPosition(success, err, { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
    return ()=> { if(watchId) navigator.geolocation.clearWatch(watchId); };
  },[id]);
  useEffect(()=>{
    socket = io(import.meta.env.VITE_API_WS || 'http://localhost:4000', { transports:['websocket'] });
    socket.emit('joinRide', id);
    socket.on('ride:update', msg => { if(msg.rideId === id) load(false); });
    socket.on('ride:userLocations', payload => { if(payload.rideId === id) setOtherUsers(payload.users); });
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

  function haversineKm(a,b){
    if(!a||!b) return null; const R=6371; const dLat=(b.lat-a.lat)*Math.PI/180; const dLng=(b.lng-a.lng)*Math.PI/180; const la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180; const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h));
  }
  const etaToUser = (()=>{
    if(!userLoc || !ride?.busLocation?.lat) return null;
    const bus = { lat: Number(ride.busLocation.lat), lng: Number(ride.busLocation.lng) };
    if(Number.isNaN(bus.lat)||Number.isNaN(bus.lng)) return null;
    const distKm = haversineKm(bus,userLoc);
    if(distKm==null) return null;
    const speed = ride.type==='inter'? 55 : 30;
    return Math.max(1, Math.round(distKm / speed * 60));
  })();

  if(!ride) return <p className="p-4">Loading...</p>;

  return <div className="p-4 space-y-4">
    <h1 className="text-xl font-bold">{ride.origin} → {ride.destination}</h1>
  <p>ETA (to destination): {ride.etaMinutes ? ride.etaMinutes + ' min' : '—'}</p>
  {geoAllowed!==false && etaToUser && <p className="text-sm text-blue-600">Estimated arrival to your location: {etaToUser} min</p>}
  {geoAllowed===false && <p className="text-xs text-red-600">Location access denied - can't show arrival time to you.</p>}
  <p>People in bus (counter): {ride.capacityCounter}{ride.seatsTotal? ` / ${ride.seatsTotal}`:''}</p>
    {(ride.busLocation?.lat || (ride.originCoords?.lat && ride.destinationCoords?.lat)) && <div className="h-64 border rounded overflow-hidden">
      <LiveRideMap
        origin={ride.originCoords}
        destination={ride.destinationCoords}
        bus={ride.busLocation}
        etaMinutes={ride.etaMinutes}
        users={[...(userLoc? [{ userId:'me', name:'You', lat:userLoc.lat, lng:userLoc.lng }]:[]), ...otherUsers.filter(u=>u.userId!=='me')]}
      />
    </div>}
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
