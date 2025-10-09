import { useEffect, useState, useRef } from 'react';
import TrafficMap from '../../components/Traffic/TrafficMap.jsx';
import TrafficChart from '../../components/Traffic/TrafficChart.jsx';
import { io } from 'socket.io-client';

// Resolve API and WS endpoints from env vars with sensible defaults
const apiUrl = import.meta.env.VITE_API_URL; // full URL e.g., https://api.example.com/api
const apiOrigin = import.meta.env.VITE_API_ORIGIN; // origin only e.g., https://api.example.com
const API_BASE = apiUrl ? apiUrl.replace(/\/$/, '') : ((apiOrigin || 'http://localhost:4000').replace(/\/$/, '') + '/api');
const WS_BASE = import.meta.env.VITE_API_WS || (apiUrl ? new URL(apiUrl).origin : (apiOrigin || 'http://localhost:4000'));

export default function TrafficDashboard(){
  const [signals,setSignals] = useState([]);
  const [selected,setSelected] = useState(null);
  const [history,setHistory] = useState([]);
  const [loading,setLoading] = useState(false);
  const [risks,setRisks] = useState([]); // predicted escalations
  const [cooldowns,setCooldowns] = useState([]); // predicted improvements
  const [showHeat,setShowHeat] = useState(true);
  const riskFetchRef = useRef(0);
  const socketRef = useRef(null);
  const [chat,setChat] = useState([]);
  const [chatInput,setChatInput] = useState('');

  async function fetchSignals(){
    const res = await fetch(`${API_BASE}/traffic` , { credentials:'include'});
    const data = await res.json();
    setSignals(data.signals || []);
    if(selected){
      const found = data.signals.find(s=>s.signalId===selected.signalId);
      if(found) setSelected(found);
    }
    // After updating signals, recompute risk predictions (throttle every 3s)
    if(Date.now() - riskFetchRef.current > 3000){
      riskFetchRef.current = Date.now();
      computeRisks(data.signals || []);
    }
  }
  async function fetchHistory(sig){
    if(!sig) return;
    const res = await fetch(`${API_BASE}/traffic/${sig.signalId}/history?limit=10`, { credentials:'include' });
    const data = await res.json();
    setHistory(data.history || []);
  }
  async function simulate(){
    setLoading(true);
    const res = await fetch(`${API_BASE}/traffic/simulate`, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }});
    if(res.ok) await fetchSignals();
    setLoading(false);
  }

  async function computeRisks(list){
    if(!list || list.length===0){ setRisks([]); setCooldowns([]); return; }
    // We need the last two points per signal for simple trend forecast
  const baseUrl = API_BASE;
    try {
      const promises = list.map(sig => fetch(`${baseUrl}/traffic/${sig.signalId}/history?limit=2`, { credentials:'include'}).then(r=>r.json()).then(d=>({ sig, hist: d.history||[] })));
      const results = await Promise.all(promises);
      const riskList = [];
      const cooldownList = [];
      for(const { sig, hist } of results){
        if(hist.length < 2) continue;
        const hPrev = hist[hist.length-2];
        const hLast = hist[hist.length-1];
        const trend = hLast.density - hPrev.density; // delta over last interval
        const forecast1 = hLast.density + trend * 0.5; // one-step forecast
        const currentLevel = sig.level;
        const predictLevel = forecast1 < 20 ? 'Smooth' : (forecast1 < 50 ? 'Moderate' : 'Heavy');
        // Escalation only if predicted level rank > current level rank
        const rank = lvl => lvl==='Smooth'?0: lvl==='Moderate'?1:2;
        const confidence = Math.min(1, Math.abs(trend)/(hLast.density===0?1:hLast.density));
        if(rank(predictLevel) > rank(currentLevel)){
          riskList.push({ signalId: sig.signalId, name: sig.name, current: currentLevel, predicted: predictLevel, forecastDensity: Math.round(forecast1), trend: Math.round(trend), confidence: +confidence.toFixed(2) });
        } else if(rank(predictLevel) < rank(currentLevel)) {
          cooldownList.push({ signalId: sig.signalId, name: sig.name, current: currentLevel, predicted: predictLevel, forecastDensity: Math.round(forecast1), trend: Math.round(trend), confidence: +confidence.toFixed(2) });
        }
      }
      setRisks(riskList.sort((a,b)=> b.forecastDensity - a.forecastDensity));
      setCooldowns(cooldownList.sort((a,b)=> a.forecastDensity - b.forecastDensity));
    } catch(err){
      // Non-fatal
      console.warn('Risk compute failed', err);
    }
  }

  useEffect(()=>{ fetchSignals(); },[]);
  useEffect(()=>{ if(selected) fetchHistory(selected); },[selected]);
  useEffect(()=>{
    socketRef.current = io(WS_BASE, { transports:['websocket'], withCredentials:true });
    socketRef.current.on('traffic:update', payload => {
      if(payload?.signals){
        setSignals(prev => {
          const map = new Map(prev.map(s=>[s.signalId,s]));
          for(const s of payload.signals) map.set(s.signalId, s);
          const merged = Array.from(map.values());
          computeRisks(merged);
          return merged;
        });
      }
    });
    socketRef.current.on('traffic:chat', (msg)=>{
      setChat(prev => [...prev, msg].slice(-200));
    });
    return ()=>{ socketRef.current && socketRef.current.disconnect(); };
  },[]);

  async function loadChat(){
    const url = `${API_BASE}/traffic/chat${selected? `?signalId=${selected.signalId}`:''}`;
    const res = await fetch(url, { credentials:'include' });
    const data = await res.json();
    setChat(data.messages || []);
  }
  useEffect(()=>{ loadChat(); }, [selected]);

  async function sendChat(){
    if(!chatInput.trim()) return;
    await fetch(`${API_BASE}/traffic/chat`, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ signalId: selected?.signalId || null, text: chatInput.trim() }) });
    setChatInput('');
  }

  // Aggregate metrics
  const avgDensity = signals.length? Math.round(signals.reduce((a,b)=>a+b.density,0)/signals.length):0;
  const topCongested = [...signals].sort((a,b)=> b.density - a.density).slice(0,3);

  return <div className="p-6 space-y-6">
    <h1 className="text-2xl font-bold">Smart Traffic Intelligence Engine</h1>
    <div className="grid md:grid-cols-3 gap-4">
      <div className="p-4 border rounded bg-white"><p className="text-sm text-gray-500">Monitored Junctions</p><p className="text-2xl font-semibold">{signals.length}</p></div>
      <div className="p-4 border rounded bg-white"><p className="text-sm text-gray-500">Avg Density</p><p className="text-2xl font-semibold">{avgDensity}</p></div>
      <div className="p-4 border rounded bg-white"><p className="text-sm text-gray-500">Top Congested</p><ul className="text-xs mt-1 space-y-1">{topCongested.map(t=> <li key={t.signalId}>{t.name} ({t.density})</li>)}</ul></div>
    </div>
    <div className="flex flex-wrap gap-4 items-center">
      <button onClick={simulate} disabled={loading} className="bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50">{loading? 'Simulating...' : 'Simulate Now'}</button>
      <p className="text-xs text-gray-500">Auto refresh every 5s. Click a marker to view trend.</p>
      <label className="flex items-center gap-1 text-xs cursor-pointer select-none"><input type="checkbox" checked={showHeat} onChange={e=>setShowHeat(e.target.checked)} /> Heatmap</label>
    </div>
    {(risks.length>0 || cooldowns.length>0) && <div className="grid md:grid-cols-2 gap-4">
      {risks.length > 0 && <div className="p-4 border rounded bg-amber-50 border-amber-300">
        <p className="font-semibold text-amber-800 text-sm mb-2">Potential Upcoming Congestion</p>
        <ul className="text-xs space-y-1">
          {risks.map(r=> <li key={r.signalId} className="flex justify-between">
            <span>{r.name}</span>
            <span className="text-amber-700">{r.current} → {r.predicted} ({r.forecastDensity}) • {Math.round(r.confidence*100)}%</span>
          </li>)}
        </ul>
        <p className="text-[10px] text-amber-700 mt-2">Confidence = relative recent change magnitude.</p>
      </div>}
      {cooldowns.length > 0 && <div className="p-4 border rounded bg-green-50 border-green-300">
        <p className="font-semibold text-green-800 text-sm mb-2">Likely Improvement (Cool-Down)</p>
        <ul className="text-xs space-y-1">
          {cooldowns.map(r=> <li key={r.signalId} className="flex justify-between">
            <span>{r.name}</span>
            <span className="text-green-700">{r.current} → {r.predicted} ({r.forecastDensity}) • {Math.round(r.confidence*100)}%</span>
          </li>)}
        </ul>
        <p className="text-[10px] text-green-700 mt-2">Projected easing based on downward trend.</p>
      </div>}
    </div>}
    <TrafficMap signals={signals} onSelect={(s)=> setSelected(s)} showHeat={showHeat} />
    <div className="grid md:grid-cols-2 gap-6 mt-4">
      <div className="border rounded p-3 bg-white">
        <h3 className="font-semibold mb-2">{selected? `${selected.name} — Density Trend` : 'Select a junction'}</h3>
        {selected && <TrafficChart history={history} />}
      </div>
      <div className="border rounded p-3 bg-white flex flex-col">
        <h3 className="font-semibold mb-2">Live Chat {selected? `(Focused on ${selected.name})`: ''}</h3>
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
    </div>
    {/* Trend moved into split panel with chat */}
  </div>;
}
