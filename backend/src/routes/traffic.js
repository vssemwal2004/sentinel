import express from 'express';
import TrafficSignalReading from '../models/TrafficSignal.js';
import TrafficJunction from '../models/TrafficJunction.js';
import TrafficChat from '../models/TrafficChat.js';
import { authRequired, role } from '../utils/auth.js';

const router = express.Router();

// Utility to compute level
function computeLevel(density){
  if(density < 20) return 'Smooth';
  if(density < 50) return 'Moderate';
  return 'Heavy';
}

// Get latest snapshot for each signal
router.get('/', async (req,res,next) => {
  try {
    // Aggregation: sort by timestamp desc, group by signalId picking first
    const latest = await TrafficSignalReading.aggregate([
      { $sort: { signalId: 1, timestamp: -1 } },
      { $group: { _id: '$signalId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $project: { _id: 0, signalId: 1, name: 1, location: 1, entryCount: 1, exitCount: 1, density: 1, level: 1, timestamp: 1 } }
    ]);
    res.json({ signals: latest });
  } catch(e){ next(e); }
});

// History for a signal (last N readings default 50)
router.get('/:signalId/history', async (req,res,next) => {
  try {
    const { signalId } = req.params;
    const limit = Math.min(parseInt(req.query.limit)||50, 200);
    const readings = await TrafficSignalReading.find({ signalId }).sort({ timestamp: -1 }).limit(limit).lean();
    res.json({ history: readings.reverse() }); // chronological
  } catch(e){ next(e); }
});

// Simulate one batch of readings (admin only)
router.post('/simulate', authRequired, role('admin'), async (req,res,next) => {
  try {
    // Use active junctions from DB or seed defaults if none
    let signals = await TrafficJunction.find({ active: true }).lean();
    if(signals.length === 0){
      signals = await TrafficJunction.insertMany([
        { signalId: 's1', name: 'Sector 62 Junction', location: { lat: 28.6203, lng: 77.3811 } },
        { signalId: 's2', name: 'Central Mall Circle', location: { lat: 28.6215, lng: 77.385 } },
        { signalId: 's3', name: 'Tech Park Gate', location: { lat: 28.6189, lng: 77.379 } }
      ]);
    }
    const created = [];
    for(const meta of signals){
      const entryCount = Math.floor(50 + Math.random()*100);
      const exitCount = Math.floor(40 + Math.random()*90);
      const density = entryCount - exitCount;
      const level = computeLevel(density);
      const base = { signalId: meta.signalId, name: meta.name, location: meta.location };
      const doc = await TrafficSignalReading.create({ ...base, entryCount, exitCount, density, level, timestamp: new Date() });
      created.push(doc);
    }
    // Broadcast via socket if available
    const io = req.app.get('io');
    if(io){
      io.emit('traffic:update', { signals: created.map(c=>({ signalId: c.signalId, name: c.name, location: c.location, entryCount: c.entryCount, exitCount: c.exitCount, density: c.density, level: c.level, timestamp: c.timestamp })) });
    }
    res.json({ inserted: created.length });
  } catch(e){ next(e); }
});

export default router;

// Junction CRUD (admin)
router.get('/junctions', authRequired, role('admin'), async (req,res,next)=>{
  try { const list = await TrafficJunction.find({}).lean(); res.json({ junctions: list }); } catch(e){ next(e); }
});
router.post('/junctions', authRequired, role('admin'), async (req,res,next)=>{
  try { const { signalId, name, lat, lng } = req.body; if(!signalId||!name||lat==null||lng==null) return res.status(400).json({ error:'signalId,name,lat,lng required'}); const exists = await TrafficJunction.findOne({ signalId }); if(exists) return res.status(409).json({ error:'signalId exists'}); const j = await TrafficJunction.create({ signalId, name, location:{ lat, lng } }); res.json({ junction: j }); } catch(e){ next(e); }
});
router.patch('/junctions/:id', authRequired, role('admin'), async (req,res,next)=>{
  try { const { id } = req.params; const { name, lat, lng, active } = req.body; const j = await TrafficJunction.findById(id); if(!j) return res.status(404).json({ error:'Not found'}); if(name) j.name = name; if(lat!=null && lng!=null) j.location = { lat, lng }; if(active!=null) j.active = active; await j.save(); res.json({ junction: j }); } catch(e){ next(e); }
});
router.delete('/junctions/:id', authRequired, role('admin'), async (req,res,next)=>{
  try { const { id } = req.params; const j = await TrafficJunction.findById(id); if(!j) return res.status(404).json({ error:'Not found'}); await j.deleteOne(); res.json({ ok:true }); } catch(e){ next(e); }
});

// Traffic Chat
router.get('/chat', authRequired, async (req,res,next)=>{
  try {
    const { signalId, limit=50 } = req.query;
    const q = {};
    if(signalId) q.signalId = signalId;
    const items = await TrafficChat.find(q).sort({ createdAt: -1 }).limit(Math.min(parseInt(limit)||50, 200)).lean();
    res.json({ messages: items.reverse() });
  } catch(e){ next(e); }
});
router.post('/chat', authRequired, async (req,res,next)=>{
  try {
    const { signalId, text } = req.body;
    if(!text) return res.status(400).json({ error:'text required' });
    const msg = await TrafficChat.create({ signalId: signalId || null, user: req.user._id, userName: req.user.name, text });
    const payload = { _id: msg._id, signalId: msg.signalId, userName: msg.userName, text: msg.text, createdAt: msg.createdAt };
    const io = req.app.get('io');
    if(io){ io.emit('traffic:chat', payload); }
    res.json({ message: payload });
  } catch(e){ next(e); }
});
