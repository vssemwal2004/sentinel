import { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';

export default function UserDashboard() {
  const [tab,setTab] = useState('intra');
  const [rides,setRides] = useState([]);
  const [userLoc,setUserLoc] = useState(null); // { lat, lng }
  const [geoAllowed,setGeoAllowed] = useState(null); // null unknown, true granted, false denied
  const pollRef = useRef(null);
  const [query,setQuery] = useState({ origin:'', destination:'' });

  useEffect(()=>{ load(); },[tab]);

  // Poll rides periodically when we have user location (for fresher ETA)
  useEffect(()=>{
    if(pollRef.current){ clearInterval(pollRef.current); pollRef.current=null; }
    pollRef.current = setInterval(()=>{ load(false); }, 15000);
    return ()=>{ if(pollRef.current) clearInterval(pollRef.current); };
  },[tab, userLoc]);

  async function load(showLoading=true){
    const params = { type: tab };
    if(query.origin) params.origin = query.origin;
    if(query.destination) params.destination = query.destination;
    const d = await api.listRides(params);
    setRides(d.rides);
  }

  function requestLocation(){
    if(!navigator.geolocation){ setGeoAllowed(false); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      setGeoAllowed(true);
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, err=>{
      console.warn('Geolocation denied', err);
      setGeoAllowed(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
  }

  // Try once on mount (silent)
  useEffect(()=>{ requestLocation(); },[]);

  function haversineKm(a,b){
    if(!a || !b) return null;
    const R=6371;
    const dLat=(b.lat-a.lat)*Math.PI/180;
    const dLng=(b.lng-a.lng)*Math.PI/180;
    const la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180;
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function etaToUserMinutes(ride){
    if(!userLoc || !ride.busLocation?.lat) return null;
    const bus = { lat: Number(ride.busLocation.lat), lng: Number(ride.busLocation.lng) };
    if(Number.isNaN(bus.lat) || Number.isNaN(bus.lng)) return null;
    const distKm = haversineKm(bus, userLoc);
    if(distKm==null) return null;
    const speed = ride.type==='inter'? 55 : 30; // km/h heuristics
    return Math.max(1, Math.round(distKm / speed * 60));
  }

  return <div className="p-4 space-y-4">
    <h1 className="text-2xl font-bold">User Dashboard</h1>
    <div className="flex gap-4">
      <button className={tab==='intra'? 'font-bold':''} onClick={()=>setTab('intra')}>Intra-City</button>
      <button className={tab==='inter'? 'font-bold':''} onClick={()=>setTab('inter')}>Inter-City</button>
    </div>
    <div className="flex gap-2">
      <input className="border p-2" placeholder="Origin" value={query.origin} onChange={e=>setQuery(q=>({...q,origin:e.target.value}))} />
      <input className="border p-2" placeholder="Destination" value={query.destination} onChange={e=>setQuery(q=>({...q,destination:e.target.value}))} />
      <button className="bg-blue-500 text-white px-3" onClick={load}>Search</button>
    </div>
    <div className="flex items-center gap-3 text-sm">
      {geoAllowed===true && userLoc && <span className="text-green-600">Location active ({userLoc.lat.toFixed(4)}, {userLoc.lng.toFixed(4)})</span>}
      {geoAllowed===false && <span className="text-red-600">Location denied</span>}
      <button onClick={requestLocation} className="border px-2 py-1 rounded">{geoAllowed? 'Refresh Location':'Enable Location'}</button>
    </div>
    <ul className="space-y-2">
      {rides.map(r=> {
        const etaUser = etaToUserMinutes(r);
        return <li key={r._id} className="border p-3 rounded flex justify-between items-center">
          <div>
            <p className="font-semibold">{r.origin} → {r.destination}</p>
            <p className="text-xs space-x-2">
              <span>Conductor: {r.conductor?.name || '—'}</span>
              <span>| {r.type==='inter' ? 'Inter-City':'Intra-City'}</span>
              {etaUser && <span className="text-blue-600">| ETA to you: {etaUser} min</span>}
              {(!etaUser && r.busLocation?.lat && geoAllowed===true) && <span>| Calculating...</span>}
            </p>
          </div>
          <Link to={`/ride/${r._id}`} className="text-blue-600 underline text-sm">View</Link>
        </li>;
      })}
    </ul>
  </div>;
}
