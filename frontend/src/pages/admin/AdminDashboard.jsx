import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function AdminDashboard(){
  const [conductors,setConductors] = useState([]);
  const [file,setFile] = useState(null);
  const [importResult,setImportResult] = useState(null);

  async function load(){
    const d = await api.listConductors();
    setConductors(d.conductors);
  }

  useEffect(()=>{ load(); },[]);

  async function upload(){
    if(!file) return;
    const res = await api.importConductors(file);
    setImportResult(res);
    await load();
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
    <div>
      <h2 className="font-semibold mb-2">Conductors</h2>
      <ul className="space-y-1 text-sm">
        {conductors.map(c=> <li key={c._id} className="border p-2 rounded">{c.name} - {c.email}</li>)}
      </ul>
    </div>
  </div>;
}
