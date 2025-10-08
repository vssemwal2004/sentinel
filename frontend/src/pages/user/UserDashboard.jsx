import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';

export default function UserDashboard() {
  const [tab,setTab] = useState('intra');
  const [rides,setRides] = useState([]);
  const [query,setQuery] = useState({ origin:'', destination:'' });

  useEffect(()=>{ load(); },[tab]);

  async function load(){
    const params = { type: tab };
    if(query.origin) params.origin = query.origin;
    if(query.destination) params.destination = query.destination;
    const d = await api.listRides(params);
    setRides(d.rides);
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
    <ul className="space-y-2">
      {rides.map(r=> <li key={r._id} className="border p-3 rounded flex justify-between items-center">
        <div>
          <p className="font-semibold">{r.origin} → {r.destination}</p>
          <p className="text-xs">Conductor: {r.conductor?.name} {r.type==='inter' ? '| Inter-City' : '| Intra-City'}</p>
        </div>
        <Link to={`/ride/${r._id}`} className="text-blue-600 underline text-sm">View</Link>
      </li>)}
    </ul>
  </div>;
}
