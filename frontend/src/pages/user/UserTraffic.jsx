import { useEffect, useState, useRef } from 'react';
import TrafficMap from '../../components/Traffic/TrafficMap.jsx';
import { io } from 'socket.io-client';

// Resolve API and WS endpoints from env vars with sensible defaults
const apiUrl = import.meta.env.VITE_API_URL; // full URL e.g., https://api.example.com/api
const apiOrigin = import.meta.env.VITE_API_ORIGIN; // origin only e.g., https://api.example.com
const API_BASE = apiUrl ? apiUrl.replace(/\/$/, '') : ((apiOrigin || 'http://localhost:4000').replace(/\/$/, '') + '/api');
const WS_BASE = import.meta.env.VITE_API_WS || (apiUrl ? new URL(apiUrl).origin : (apiOrigin || 'http://localhost:4000'));

export default function UserTraffic(){
  const [signals,setSignals] = useState([]);
  const [risks,setRisks] = useState([]);
  const [cooldowns,setCooldowns] = useState([]);
  const socketRef = useRef(null);
  const [showHeat,setShowHeat] = useState(true);
  const [chat,setChat] = useState([]);
  const [chatInput,setChatInput] = useState('');

  async function fetchSignals(){
    const res = await fetch(`${API_BASE}/traffic` , { credentials:'include'});
    const data = await res.json();
    setSignals(data.signals||[]);
    computePredictions(data.signals||[]);
  }
  async function computePredictions(list){
    if(!list.length){ setRisks([]); setCooldowns([]); return; }
  const promises = list.map(sig => fetch(`${API_BASE}/traffic/${sig.signalId}/history?limit=2`, { credentials:'include'}).then(r=>r.json()).then(d=>({ sig, hist: d.history||[] })));
    const results = await Promise.all(promises);
    const riskList=[], coolList=[]; const rank = l=> l==='Smooth'?0:l==='Moderate'?1:2;
    for(const { sig, hist } of results){
      if(hist.length<2) continue;
      const a=hist[hist.length-2], b=hist[hist.length-1];
      const trend = b.density - a.density; const forecast = b.density + trend*0.5;
      const predLevel = forecast < 20? 'Smooth' : (forecast < 50? 'Moderate':'Heavy');
      const conf = Math.min(1, Math.abs(trend)/(b.density===0?1:b.density));
      if(rank(predLevel) > rank(sig.level)) riskList.push({ name:sig.name, current:sig.level, predicted: predLevel, forecast: Math.round(forecast), confidence: conf });
      else if(rank(predLevel) < rank(sig.level)) coolList.push({ name:sig.name, current:sig.level, predicted: predLevel, forecast: Math.round(forecast), confidence: conf });
    }
    setRisks(riskList.sort((a,b)=> b.forecast - a.forecast));
    setCooldowns(coolList.sort((a,b)=> a.forecast - b.forecast));
  }

  useEffect(()=>{ fetchSignals(); },[]);
  useEffect(()=>{
    socketRef.current = io(WS_BASE, { transports:['websocket'], withCredentials:true });
    socketRef.current.on('traffic:update', payload => {
      if(payload?.signals){
        setSignals(prev => {
          const map = new Map(prev.map(s=>[s.signalId,s]));
          for(const s of payload.signals) map.set(s.signalId,s);
          const merged = Array.from(map.values());
          computePredictions(merged);
          return merged;
        });
      }
    });
    socketRef.current.on('traffic:chat', (msg)=> setChat(prev=>[...prev,msg].slice(-200)));
    return ()=> socketRef.current && socketRef.current.disconnect();
  },[]);

  useEffect(()=>{ loadChat(); },[]);
  async function loadChat(){
    const res = await fetch(`${API_BASE}/traffic/chat`, { credentials:'include' });
    const data = await res.json();
    setChat(data.messages || []);
  }
  async function sendChat(){
    if(!chatInput.trim()) return;
    await fetch(`${API_BASE}/traffic/chat`, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ text: chatInput.trim() }) });
    setChatInput('');
  }

  const avgDensity = signals.length? Math.round(signals.reduce((a,b)=>a+b.density,0)/signals.length):0;

  return <div className="p-4 space-y-4">
    <h1 className="text-xl font-bold">Live City Traffic</h1>
    <div className="flex gap-4 text-sm">
      <div className="p-3 border rounded bg-white">Junctions: {signals.length}</div>
      <div className="p-3 border rounded bg-white">Avg Density: {avgDensity}</div>
      <label className="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" checked={showHeat} onChange={e=>setShowHeat(e.target.checked)} /> Heatmap</label>
    </div>
    {(risks.length>0 || cooldowns.length>0) && <div className="grid md:grid-cols-2 gap-4">
      {risks.length>0 && <div className="p-3 border rounded bg-amber-50">
        <p className="font-semibold text-amber-800 text-xs mb-1">Possible Congestion Soon</p>
        <ul className="text-[11px] space-y-1">{risks.map((r,i)=><li key={i}>{r.name}: {r.current} → {r.predicted} ({r.forecast}) {Math.round(r.confidence*100)}%</li>)}</ul>
      </div>}
      {cooldowns.length>0 && <div className="p-3 border rounded bg-green-50">
        <p className="font-semibold text-green-800 text-xs mb-1">Likely Improvement</p>
        <ul className="text-[11px] space-y-1">{cooldowns.map((r,i)=><li key={i}>{r.name}: {r.current} → {r.predicted} ({r.forecast}) {Math.round(r.confidence*100)}%</li>)}</ul>
      </div>}
    </div>}
    <TrafficMap signals={signals} showHeat={showHeat} />
    <div className="border rounded p-3 bg-white flex flex-col">
      <h3 className="font-semibold mb-2">Live Traffic Chat</h3>
      <div className="flex-1 overflow-auto border rounded p-2 bg-gray-50">
        <ul className="space-y-1 text-xs">
          {chat.map((m,i)=>(<li key={m._id||i}><span className="font-medium">{m.userName||'User'}</span>: {m.text} <span className="text-[10px] text-gray-500">{new Date(m.createdAt).toLocaleTimeString()}</span></li>))}
        </ul>
      </div>
      <div className="mt-2 flex gap-2">
        <input className="border rounded p-2 text-sm flex-1" placeholder="Type a message" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=> e.key==='Enter' && sendChat()} />
        <button onClick={sendChat} className="bg-blue-600 text-white px-3 rounded">Send</button>
      </div>
    </div>
  </div>;
}
