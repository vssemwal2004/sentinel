import { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api';
import { io } from 'socket.io-client';
import LiveRideMap from '../../components/Map/LiveRideMap.jsx';

let sockets = {};

export default function ConductorDashboard(){
  const [rides,setRides] = useState([]);
  const [form,setForm] = useState({ type:'intra', origin:'', destination:'', originLat:'', originLng:'', destinationLat:'', destinationLng:'' });
  const [selected,setSelected] = useState(null);
  const [newPassenger,setNewPassenger] = useState('');
  const [location,setLocation] = useState({ lat:'', lng:'', etaMinutes:'' });
  const [autoLoc,setAutoLoc] = useState(true);
  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ t:0, lat:null, lng:null });
  const [counter,setCounter] = useState('');
  const [availableBuses,setAvailableBuses] = useState([]);
  const [busId,setBusId] = useState('');

  useEffect(()=>{ load(); },[form.type]);

  async function load(){
    const d = await api.listRides({});
    setRides(d.rides);
    // fetch buses for current form.type
    const b = await api.availableBuses(form.type);
    setAvailableBuses(b.buses);
  }

  async function createRide(){
    if(!busId) { alert('Select a bus'); return; }
    const payload = { ...form, busId,
      originLat: form.originLat? parseFloat(form.originLat): undefined,
      originLng: form.originLng? parseFloat(form.originLng): undefined,
      destinationLat: form.destinationLat? parseFloat(form.destinationLat): undefined,
      destinationLng: form.destinationLng? parseFloat(form.destinationLng): undefined };
    const d = await api.createRide(payload);
  setForm({ type:'intra', origin:'', destination:'', originLat:'', originLng:'', destinationLat:'', destinationLng:'' });
    setBusId('');
    await load();
    setSelected(d.ride._id);
  }

  async function addPassenger(){
    if(!selected) return;
    await api.addPassenger(selected, { name: newPassenger, method: 'cash', paid: false });
    setNewPassenger('');
    await refreshSelected();
  }

  async function refreshSelected(){
    if(!selected) return;
    const d = await api.getRide(selected);
    setRides(rs=>rs.map(r=>r._id===selected? d.ride : r));
  }

  async function updateLocation(manual=false){
    if(!selected) return;
    if(!location.lat || !location.lng) return;
    const payload = { lat: parseFloat(location.lat), lng: parseFloat(location.lng) };
    if(manual && location.etaMinutes) payload.etaMinutes = parseInt(location.etaMinutes);
    await api.updateLocation(selected, payload);
    if(manual) await refreshSelected();
  }

  // Setup geolocation watch
  useEffect(()=>{
    if(!autoLoc){
      if(watchIdRef.current){ navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current=null; }
      return;
    }
    if(!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(pos=>{
      const { latitude, longitude } = pos.coords;
      setLocation(l=>({...l, lat: latitude.toFixed(6), lng: longitude.toFixed(6) }));
      const now = Date.now();
      const distMoved = (()=>{
        if(lastSentRef.current.lat==null) return Infinity;
        const dx = latitude - lastSentRef.current.lat;
        const dy = longitude - lastSentRef.current.lng;
        return Math.sqrt(dx*dx + dy*dy);
      })();
      if(now - lastSentRef.current.t > 7000 || distMoved > 0.0005){ // ~50m or 7s
        lastSentRef.current = { t: now, lat: latitude, lng: longitude };
        updateLocation(false);
      }
    }, err=>{
      console.warn('Geolocation error', err);
    }, { enableHighAccuracy:true, maximumAge: 5000, timeout: 10000 });
    return ()=>{ if(watchIdRef.current){ navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current=null; } };
  },[autoLoc, selected]);

  const current = rides.find(r=>r._id===selected);
  const [userMarkers,setUserMarkers] = useState([]);
  const socketRef = useRef(null);

  useEffect(()=>{
    if(!selected) return;
    if(socketRef.current) { socketRef.current.emit('leaveRide', socketRef.current.currentRide); }
    if(!socketRef.current){
      socketRef.current = io(import.meta.env.VITE_API_WS || 'http://localhost:4000', { transports:['websocket'] });
    }
    socketRef.current.currentRide = selected;
    socketRef.current.emit('joinRide', selected);
    socketRef.current.on('ride:userLocations', payload => {
      if(payload.rideId === selected) setUserMarkers(payload.users);
    });
    return ()=>{
      if(socketRef.current){ socketRef.current.emit('leaveRide', selected); }
    };
  },[selected]);

  async function updateCounter(){
    if(!selected) return;
    await api.updateCounter(selected, parseInt(counter));
    setCounter('');
    await refreshSelected();
  }

  async function markPaid(i){
    // not implemented backend per-index payment update route already exists
    // call it
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/conductor/rides/${selected}/passengers/${i}/pay`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }});
    await refreshSelected();
  }

  return <div className="p-4 grid md:grid-cols-2 gap-6">
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Conductor Dashboard</h1>
      <div className="border p-3 rounded space-y-2">
        <h2 className="font-semibold">Create Ride</h2>
        <select className="border p-1" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
          <option value="intra">Intra-City</option>
          <option value="inter">Inter-City</option>
        </select>
        <input className="border p-1 w-full" placeholder="Origin" value={form.origin} onChange={e=>setForm(f=>({...f,origin:e.target.value}))} />
        <input className="border p-1 w-full" placeholder="Destination" value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))} />
        <div className="grid grid-cols-2 gap-2">
          <input className="border p-1" placeholder="Origin Lat" value={form.originLat} onChange={e=>setForm(f=>({...f,originLat:e.target.value}))} />
          <input className="border p-1" placeholder="Origin Lng" value={form.originLng} onChange={e=>setForm(f=>({...f,originLng:e.target.value}))} />
          <input className="border p-1" placeholder="Dest Lat" value={form.destinationLat} onChange={e=>setForm(f=>({...f,destinationLat:e.target.value}))} />
          <input className="border p-1" placeholder="Dest Lng" value={form.destinationLng} onChange={e=>setForm(f=>({...f,destinationLng:e.target.value}))} />
        </div>
        <select className="border p-1 w-full" value={busId} onChange={e=>setBusId(e.target.value)}>
          <option value="">Select Bus *</option>
          {availableBuses.map(b=> <option key={b._id} value={b._id}>{b.number} - {b.seats} seats {b.type? `| ${b.type}`:''}</option>)}
        </select>
        <button onClick={createRide} className="bg-blue-600 text-white px-3 py-1 rounded">Create</button>
      </div>
      <ul className="space-y-2 max-h-72 overflow-auto">
        {rides.map(r=> <li key={r._id} className={`border p-2 rounded ${selected===r._id?'bg-blue-50':''}`} onClick={()=>setSelected(r._id)}>
          <p className="font-semibold">{r.origin} → {r.destination}</p>
          <p className="text-xs">{r.type} | Passengers: {r.passengers.length} {r.seatsTotal? `/ ${r.seatsTotal}`:''} {r.busNumber? `| Bus ${r.busNumber}`:''}</p>
        </li>)}
      </ul>
    </div>
    <div>
      {current ? <div className="space-y-4">
        <h2 className="text-xl font-semibold">Ride Detail</h2>
  <p>Route: {current.origin} → {current.destination}</p>
  {current.busNumber && <p>Bus: {current.busNumber} ({current.seatsTotal} seats)</p>}
  <p>ETA: {current.etaMinutes || '—'} min</p>
  {current.busLocation?.lat && <div className="text-xs">Current Position: {current.busLocation.lat.toFixed?current.busLocation.lat.toFixed(4):current.busLocation.lat}, {current.busLocation.lng?.toFixed?current.busLocation.lng.toFixed(4):current.busLocation.lng}</div>}
        {(current.busLocation?.lat || (current.originCoords?.lat && current.destinationCoords?.lat)) && <div className="h-56 border rounded overflow-hidden">
          <LiveRideMap origin={current.originCoords} destination={current.destinationCoords} bus={current.busLocation} etaMinutes={current.etaMinutes} users={userMarkers} />
        </div>}
        <div className="border p-3 rounded space-y-2">
          <h3 className="font-semibold">Location & ETA</h3>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={autoLoc} onChange={e=>setAutoLoc(e.target.checked)} /> Auto GPS</label>
            <span className="text-gray-500">Uses device GPS to push live position.</span>
          </div>
          <input className="border p-1 w-full" placeholder="Latitude" value={location.lat} onChange={e=>setLocation(l=>({...l,lat:e.target.value}))} disabled={autoLoc} />
          <input className="border p-1 w-full" placeholder="Longitude" value={location.lng} onChange={e=>setLocation(l=>({...l,lng:e.target.value}))} disabled={autoLoc} />
          <input className="border p-1 w-full" placeholder="Manual ETA Minutes (optional)" value={location.etaMinutes} onChange={e=>setLocation(l=>({...l,etaMinutes:e.target.value}))} />
          <div className="flex gap-2">
            <button onClick={()=>updateLocation(true)} className="bg-purple-600 text-white px-3 py-1 rounded">Send Update</button>
            {!autoLoc && <span className="text-xs text-gray-500 self-center">Manual mode: updates only when pressing button.</span>}
          </div>
        </div>
        <div className="border p-3 rounded space-y-2">
          <h3 className="font-semibold">Passengers</h3>
          <div className="flex gap-2 items-end">
            <input className="border p-1" placeholder="Counter value" value={counter} onChange={e=>setCounter(e.target.value)} />
            <button onClick={updateCounter} className="bg-indigo-600 text-white px-3 rounded">Set Counter</button>
          </div>
          <ul className="text-sm space-y-1 max-h-40 overflow-auto">
            {current.passengers.map((p,i)=><li key={i} className="flex justify-between">
              <span>{p.name || 'Guest'} {p.paid?'✅':''}</span>
              {!p.paid && <button onClick={()=>markPaid(i)} className="text-xs text-green-600 underline">Mark Paid</button>}
            </li>)}
          </ul>
          <div className="flex gap-2">
            <input className="border p-1 flex-1" placeholder="Add passenger name" value={newPassenger} onChange={e=>setNewPassenger(e.target.value)} />
            <button onClick={addPassenger} className="bg-green-600 text-white px-3 rounded">Add</button>
          </div>
        </div>
      </div> : <p>Select a ride.</p>}
    </div>
  </div>;
}
