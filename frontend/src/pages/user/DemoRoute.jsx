import { useState, useEffect, useRef } from 'react';
import LiveRideMap from '../../components/Map/LiveRideMap.jsx';

// Simple demo page: shows static origin/destination, adds a button to request user location
export default function DemoRoute(){
  // Static route
  const origin = { lat: 28.6139, lng: 77.2090 }; // New Delhi
  const destination = { lat: 28.4595, lng: 77.0266 }; // Gurugram

  // User location
  const [userLoc,setUserLoc] = useState(null);
  const [geoDenied,setGeoDenied] = useState(false);
  const [showRoute,setShowRoute] = useState(false);

  // Simulation state
  const [running,setRunning] = useState(true);
  const [progress,setProgress] = useState(0); // 0..1 fraction along line
  const startRef = useRef(Date.now());
  const lastUpdateRef = useRef(Date.now());
  const speedKmh = 35; // simulated average speed

  // Haversine for distance
  function haversineKm(a,b){ const R=6371; const dLat=(b.lat-a.lat)*Math.PI/180; const dLng=(b.lng-a.lng)*Math.PI/180; const la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180; const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
  const totalDistanceKm = haversineKm(origin, destination);
  const totalMinutes = (totalDistanceKm / speedKmh) * 60;

  // Tick animation
  useEffect(()=>{
    if(!running) return;
    const id = requestAnimationFrame(function tick(){
      const now = Date.now();
      const elapsedMin = (now - startRef.current) / 60000;
      let frac = elapsedMin / totalMinutes;
      if(frac > 1) frac = 1; if(frac < 0) frac = 0;
      setProgress(frac);
      if(frac < 1) requestAnimationFrame(tick);
    });
    return ()=> cancelAnimationFrame(id);
  },[running, totalMinutes]);

  function toggleRun(){
    if(running){ setRunning(false); }
    else {
      // resume without resetting progress -> choose new start so progress time stays
      startRef.current = Date.now() - progress * totalMinutes * 60000;
      setRunning(true);
    }
  }

  function reset(){
    startRef.current = Date.now();
    setProgress(0);
    setRunning(true);
  }

  function enableLocation(){
    if(!navigator.geolocation){ setGeoDenied(true); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setShowRoute(true);
    },()=>{ setGeoDenied(true); });
  }

  // Interpolated bus position
  const bus = (()=>{
    const lat = origin.lat + (destination.lat - origin.lat) * progress;
    const lng = origin.lng + (destination.lng - origin.lng) * progress;
    return { lat, lng };
  })();

  const remainingDistanceKm = haversineKm(bus, destination);
  const etaMinutes = Math.max(0, Math.round(remainingDistanceKm / speedKmh * 60));
  const users = userLoc? [{ userId: 'me', name: 'You', lat: userLoc.lat, lng: userLoc.lng }] : [];

  return <div className="p-4 space-y-4">
    <h1 className="text-2xl font-bold">Demo: Animated Route & Your ETA</h1>
    <p>This demo simulates a bus traveling from Delhi → Gurugram. You can pause/resume, reset, and optionally share your location to compute arrival to you.</p>
    <div className="flex flex-wrap gap-2 text-sm">
      <button onClick={toggleRun} className="bg-blue-600 text-white px-3 py-1 rounded">{running? 'Pause':'Resume'}</button>
      <button onClick={reset} className="bg-gray-600 text-white px-3 py-1 rounded">Reset</button>
      {!showRoute && <button onClick={enableLocation} className="bg-green-600 text-white px-3 py-1 rounded">Enable My Location</button>}
      {geoDenied && <span className="text-red-600 self-center">Location denied.</span>}
      <span className="self-center">Progress: {(progress*100).toFixed(1)}%</span>
      <span className="self-center">ETA: {etaMinutes} min</span>
      <span className="self-center">Remaining: {remainingDistanceKm.toFixed(2)} km</span>
    </div>
    <div className="h-72 border rounded overflow-hidden">
      <LiveRideMap origin={origin} destination={destination} bus={bus} etaMinutes={etaMinutes} users={users} />
    </div>
    {userLoc && <EtaPanel bus={bus} user={userLoc} />}
  </div>;
}

function EtaPanel({ bus, user }){
  function haversineKm(a,b){ const R=6371; const dLat=(b.lat-a.lat)*Math.PI/180; const dLng=(b.lng-a.lng)*Math.PI/180; const la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180; const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
  const dist = haversineKm(bus,user);
  const speed = 35; // match simulation speed
  const eta = Math.round(dist / speed * 60);
  return <div className="p-3 bg-gray-50 rounded text-sm">Distance to you: {dist.toFixed(2)} km | ETA: {eta} min</div>;
}
