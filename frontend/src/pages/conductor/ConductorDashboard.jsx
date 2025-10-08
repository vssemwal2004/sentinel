import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { io } from 'socket.io-client';

let sockets = {};

export default function ConductorDashboard(){
  const [rides,setRides] = useState([]);
  const [form,setForm] = useState({ type:'intra', origin:'', destination:'' });
  const [selected,setSelected] = useState(null);
  const [newPassenger,setNewPassenger] = useState('');
  const [location,setLocation] = useState({ lat:'', lng:'', etaMinutes:'' });
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
    const payload = { ...form, busId };
    const d = await api.createRide(payload);
    setForm({ type:'intra', origin:'', destination:'' });
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

  async function updateLocation(){
    if(!selected) return;
    const payload = { lat: parseFloat(location.lat), lng: parseFloat(location.lng), etaMinutes: parseInt(location.etaMinutes) };
    await api.updateLocation(selected, payload);
    await refreshSelected();
  }

  const current = rides.find(r=>r._id===selected);

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
        <div className="border p-3 rounded space-y-2">
          <h3 className="font-semibold">Update Location & ETA</h3>
          <input className="border p-1 w-full" placeholder="Latitude" value={location.lat} onChange={e=>setLocation(l=>({...l,lat:e.target.value}))} />
          <input className="border p-1 w-full" placeholder="Longitude" value={location.lng} onChange={e=>setLocation(l=>({...l,lng:e.target.value}))} />
            <input className="border p-1 w-full" placeholder="ETA Minutes" value={location.etaMinutes} onChange={e=>setLocation(l=>({...l,etaMinutes:e.target.value}))} />
          <button onClick={updateLocation} className="bg-purple-600 text-white px-3 py-1 rounded">Update</button>
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
