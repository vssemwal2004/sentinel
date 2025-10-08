import { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { io } from 'socket.io-client';
import LiveRideMap from '../../components/Map/LiveRideMap.jsx';
import QrCameraScanner from '../../components/QR/QrCameraScanner.jsx';

let socket;

export default function RideDetail(){
  const { id } = useParams();
  const [ride,setRide] = useState(null);
  const [userLoc,setUserLoc] = useState(null);
  const [geoAllowed,setGeoAllowed] = useState(null);
  const [method,setMethod] = useState('online');
  const [qrValidated,setQrValidated] = useState(false);
  const [verificationToken,setVerificationToken] = useState(null);
  const [qrRaw,setQrRaw] = useState('');
  const [otherUsers,setOtherUsers] = useState([]);
  const [showScanner,setShowScanner] = useState(false);
  async function handleQrUpload(e){
    const file = e.target.files?.[0];
    if(!file) return;
    // Decode QR from image
    try {
      const bitmap = await file.arrayBuffer();
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = blobUrl;
      await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      const imageData = ctx.getImageData(0,0,canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      if(!code){ alert('No QR code detected'); return; }
      const text = code.data.trim();
      setQrRaw(text);
      const v = await api.verifyRideQr(id, text);
      setVerificationToken(v.verificationToken);
      setQrValidated(true);
    } catch(err){
      console.error(err);
      alert(err.message || 'QR decode/verify failed');
      setQrValidated(false);
      setVerificationToken(null);
    }
  }
  function startCameraScan(){
    setShowScanner(true);
  }
  function handleDecodedFromCamera(text){
    (async()=>{
      try{
        setQrRaw(text);
        const v = await api.verifyRideQr(id, text);
        setVerificationToken(v.verificationToken);
        setQrValidated(true);
        setShowScanner(false);
      }catch(err){
        alert(err.message || 'Verification failed');
        setQrValidated(false);
        setVerificationToken(null);
      }
    })();
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
    if(ride.type === 'inter' && !qrValidated){
      alert('Scan the bus QR first');
      return;
    }
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/rides/${id}/book`, {
      method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ method, verificationToken })
    });
    const data = await res.json();
    if(!res.ok){ alert(data.error || 'Booking failed'); return; }
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
        {ride.passengers.map((p,i)=><li key={i}>{p.name || 'Guest'} {p.paid? '✅':''}</li>)}
      </ul>
    </div>}
    {ride.type === 'inter' && <div className="space-y-3">
      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex flex-col text-xs gap-1 min-w-[200px]">
          <label className="font-medium">Scan / Upload Bus QR</label>
          <input type="file" accept="image/*" onChange={e=>handleQrUpload(e)} className="text-xs" />
          <input className="border p-1 text-xs" placeholder="Or paste QR text" value={qrRaw} onChange={e=>setQrRaw(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" onClick={async()=>{ if(!qrRaw) return; try { const v= await api.verifyRideQr(id, qrRaw); setVerificationToken(v.verificationToken); setQrValidated(true); setMethod('online'); } catch(err){ alert(err.message); setQrValidated(false); setVerificationToken(null);} }} className="border px-2 py-1 rounded">Verify Text</button>
            <button type="button" onClick={()=>startCameraScan()} className="border px-2 py-1 rounded">Scan Cam</button>
          </div>
          {qrValidated ? <span className="text-green-600 text-xs">QR Verified ✔ Payment Enabled</span> : <span className="text-gray-500 text-xs">Verify QR to enable payment</span>}
        </div>
        {showScanner && <div className="p-2 border rounded bg-white shadow relative">
          <QrCameraScanner
            onDecode={(t)=>handleDecodedFromCamera(t)}
            onError={(e)=>console.warn('Scanner error', e)}
            onClose={()=>setShowScanner(false)}
            facingMode="environment"
            scanIntervalMs={400}
          />
        </div>}
        {qrValidated && <div className="flex flex-col gap-1 text-xs">
          <label className="font-medium">Payment Method</label>
          <select className="border p-1 text-xs" value={method} onChange={e=>setMethod(e.target.value)}>
            <option value="online">Online</option>
            <option value="cash">Cash</option>
          </select>
          <button onClick={book} className="bg-green-600 text-white px-3 py-1 rounded mt-1">Confirm Booking</button>
        </div>}
      </div>
      {!qrValidated && <p className="text-xs text-gray-500">You must scan or verify the bus QR. Only after a successful match can payment proceed.</p>}
    </div>}
    {ride.type === 'intra' && <p className="text-xs text-gray-500">Intra-City rides: booking not required; display only ETA & live counter.</p>}
  </div>;
}
