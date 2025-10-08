import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function AdminDashboard(){
  const [conductors,setConductors] = useState([]);
  const [file,setFile] = useState(null);
  const [importResult,setImportResult] = useState(null);
  const [busFile,setBusFile] = useState(null);
  const [busResult,setBusResult] = useState(null);
  const [buses,setBuses] = useState([]);
  const [newConductor,setNewConductor] = useState({ name:'', email:'', phone:'', password:'' });
  const [newBus,setNewBus] = useState({ number:'', name:'', seats:'', type:'Intra-City', routeName:'' });
  const [creating,setCreating] = useState(false);
  // removed bulk download state since single QR per bus
  const [downloadingBus,setDownloadingBus] = useState(null);

  async function load(){
    const d = await api.listConductors();
    setConductors(d.conductors);
    const b = await api.listBuses();
    setBuses(b.buses);
  }

  useEffect(()=>{ load(); },[]);

  async function upload(){
    if(!file) return;
    const res = await api.importConductors(file);
    setImportResult(res);
    await load();
  }

  async function uploadBuses(){
    if(!busFile) return;
    const res = await api.importBuses(busFile);
    setBusResult(res);
    await load();
  }

  async function createConductor(){
    setCreating(true);
    try { await api.createConductor(newConductor); setNewConductor({ name:'', email:'', phone:'', password:'' }); await load(); } finally { setCreating(false); }
  }

  async function createBus(){
    setCreating(true);
    try { await api.createBus(newBus); setNewBus({ number:'', name:'', seats:'', type:'Intra-City', routeName:'' }); await load(); } finally { setCreating(false); }
  }

  // bulk download removed

  async function downloadBusQrs(bus){
    setDownloadingBus(bus._id);
    try {
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api');
      const url = `${base}/admin/buses/qr/download?busId=${bus._id}`;
      const res = await fetch(url, { credentials: 'include' });
      if(!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
  a.download = `bus-${bus.number}-qr.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setDownloadingBus(null); }
  }

  return <div className="p-6 space-y-4">
    <h1 className="text-2xl font-bold">Admin Dashboard</h1>
    <div className="border p-4 rounded space-y-2">
      <h2 className="font-semibold">Import Conductors CSV</h2>
      <input type="file" accept=".csv" onChange={e=>setFile(e.target.files[0])} />
      <button onClick={upload} className="bg-blue-600 text-white px-3 py-1 rounded">Upload</button>
      {importResult && <div className="text-sm">
        <p>Imported: {importResult.imported}</p>
        <details className="mt-2"><summary className="cursor-pointer">Credentials</summary>
          <ul className="list-disc ml-6">
            {(importResult.credentials||[]).map((c,i)=><li key={i}>{c.email} / {c.password}</li>)}
          </ul>
        </details>
      </div>}
    </div>
    <div className="border p-4 rounded space-y-2">
      <h2 className="font-semibold">Create Conductor (Single)</h2>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="border p-2" placeholder="Name" value={newConductor.name} onChange={e=>setNewConductor(c=>({...c,name:e.target.value}))} />
        <input className="border p-2" placeholder="Email" value={newConductor.email} onChange={e=>setNewConductor(c=>({...c,email:e.target.value}))} />
        <input className="border p-2" placeholder="Phone" value={newConductor.phone} onChange={e=>setNewConductor(c=>({...c,phone:e.target.value}))} />
        <input className="border p-2" type="password" placeholder="Password" value={newConductor.password} onChange={e=>setNewConductor(c=>({...c,password:e.target.value}))} />
      </div>
      <button disabled={creating} onClick={createConductor} className="bg-green-600 disabled:opacity-50 text-white px-3 py-1 rounded">Save Conductor</button>
    </div>
    <div className="border p-4 rounded space-y-2">
      <h2 className="font-semibold">Import Buses CSV</h2>
      <input type="file" accept=".csv" onChange={e=>setBusFile(e.target.files[0])} />
      <button onClick={uploadBuses} className="bg-blue-600 text-white px-3 py-1 rounded">Upload</button>
      {busResult && <div className="text-sm">
        <p>Imported: {busResult.imported}</p>
        {busResult.skipped?.length>0 && <p>Skipped: {busResult.skipped.join(', ')}</p>}
      </div>}
    </div>
    <div className="border p-4 rounded space-y-2">
      <h2 className="font-semibold">Create Bus (Single)</h2>
      <div className="grid gap-2 md:grid-cols-3">
        <input className="border p-2" placeholder="Number" value={newBus.number} onChange={e=>setNewBus(b=>({...b,number:e.target.value}))} />
        <input className="border p-2" placeholder="Name" value={newBus.name} onChange={e=>setNewBus(b=>({...b,name:e.target.value}))} />
        <input className="border p-2" placeholder="Seats" value={newBus.seats} onChange={e=>setNewBus(b=>({...b,seats:e.target.value}))} />
        <select className="border p-2" value={newBus.type} onChange={e=>setNewBus(b=>({...b,type:e.target.value}))}>
          <option value="Intra-City">Intra-City</option>
          <option value="Inter-City">Inter-City</option>
        </select>
        <input className="border p-2" placeholder="Route Name" value={newBus.routeName} onChange={e=>setNewBus(b=>({...b,routeName:e.target.value}))} />
      </div>
      <button disabled={creating} onClick={createBus} className="bg-green-600 disabled:opacity-50 text-white px-3 py-1 rounded">Save Bus</button>
    </div>
    <div>
      <h2 className="font-semibold mb-2">Conductors</h2>
      <ul className="space-y-1 text-sm">
        {conductors.map(c=> <li key={c._id} className="border p-2 rounded">{c.name} - {c.email}</li>)}
      </ul>
    </div>
    <div>
      <h2 className="font-semibold mb-2">Buses</h2>
      <ul className="space-y-1 text-sm">
        {buses.map(b=> <li key={b._id} className="border p-2 rounded space-y-1">
          <div className="flex justify-between">
            <span className="font-medium">{b.number}{b.name? ` - ${b.name}`:''}</span>
            <span className="text-xs">{b.activeRide? 'On Ride':'Idle'}</span>
          </div>
          <div className="text-xs text-gray-600 flex flex-wrap gap-2">
            <span>{b.seats} seats</span>
            {b.type && <span>{b.type}</span>}
            {b.routeName && <span>Route: {b.routeName}</span>}
            {b.qrCodeValue && <span>QR Ready</span>}
          </div>
          <button onClick={()=>downloadBusQrs(b)} disabled={downloadingBus===b._id} className="text-xs bg-purple-500 text-white px-2 py-1 rounded disabled:opacity-50">
            {downloadingBus===b._id? 'Preparing...' : 'Download QR PNG'}
          </button>
        </li>)}
      </ul>
    </div>
  </div>;
}
