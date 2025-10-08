import express from 'express';
import Ride from '../models/Ride.js';
import Bus from '../models/Bus.js';
import { authRequired } from '../utils/auth.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/', async (req,res,next) => {
  try {
    const { type, origin, destination } = req.query;
    const query = { active: true };
    if(type) query.type = type;
    if(origin) query.origin = origin;
    if(destination) query.destination = destination;
  const rides = await Ride.find(query).populate('conductor', 'name');
    res.json({ rides });
  } catch (e) { next(e); }
});

router.get('/:id', async (req,res,next) => {
  try {
  const ride = await Ride.findById(req.params.id).populate('conductor','name');
    if(!ride) return res.status(404).json({ error: 'Ride not found'});
    res.json({ ride });
  } catch (e) { next(e); }
});

router.post('/:id/book', authRequired, async (req,res,next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if(!ride) return res.status(404).json({ error: 'Ride not found'});
    const already = ride.passengers.find(p => String(p.user) === String(req.user._id));
    if(already) return res.status(400).json({ error: 'Already booked'});
  if(ride.type === 'intra') return res.status(403).json({ error: 'Booking not available for intra-city rides'});
    if(ride.type === 'inter') {
      const { verificationToken } = req.body;
      if(!verificationToken) return res.status(400).json({ error: 'QR verification required'});
      try {
        const payload = jwt.verify(verificationToken, process.env.JWT_SECRET || 'devsecret');
        if(payload.kind !== 'qr' || String(payload.rideId) !== String(ride._id) || String(payload.sub) !== String(req.user._id)) {
          return res.status(400).json({ error: 'Invalid verification token'});
        }
      } catch(e){
        return res.status(400).json({ error: 'Invalid or expired verification token'});
      }
    }
    ride.passengers.push({ user: req.user._id, name: req.user.name, method: req.body.method || 'online', paid: req.body.method === 'online' });
    await ride.save();
    req.app.get('io').to(`ride:${ride._id}`).emit('ride:update', { rideId: ride._id, passengers: ride.passengers });
    res.json({ ride });
  } catch (e) { next(e); }
});

// Verify bus QR for inter-city ride and issue short-lived token
router.post('/:id/verify-qr', authRequired, async (req,res,next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if(!ride) return res.status(404).json({ error: 'Ride not found'});
    if(ride.type !== 'inter') return res.status(400).json({ error: 'QR verification only for inter-city rides'});
    if(!ride.bus) return res.status(400).json({ error: 'Ride bus not set'});
    const bus = await Bus.findById(ride.bus, 'qrCodeValue number');
    if(!bus) return res.status(404).json({ error: 'Bus not found'});
  let { qr } = req.body;
  if(!qr) return res.status(400).json({ error: 'qr required'});
  // Normalize input
  qr = String(qr).trim();
  // Allow accidental lowercase by uppercasing static BUSQR prefix & bus number section when comparing.
  const norm = (val)=> typeof val === 'string' ? val.trim() : '';
  const incoming = norm(qr);
    // Handle legacy / fallback scenarios:
    // 1. Older bus documents created before qrCodeValue field -> accept pattern BUSQR:<number>[...]
    // 2. Accept base form BUSQR:<number> if stored value is BUSQR:<number>:RANDOM
    // 3. If bus.qrCodeValue missing and provided qr matches BUSQR:<number>(:...)? then persist it.
    const basePrefix = `BUSQR:${bus.number}`;
    let acceptable = [];
    if(bus.qrCodeValue) acceptable.push(bus.qrCodeValue);
    // Accept base prefix exactly if stored value starts with it (helps if user printed older version without random suffix)
    if(bus.qrCodeValue && bus.qrCodeValue.startsWith(basePrefix+':')) acceptable.push(basePrefix);
    // If no stored value, infer from provided qr if it begins with basePrefix
    if(!bus.qrCodeValue && qr.startsWith(basePrefix)) {
      bus.qrCodeValue = qr; // persist scanned value as canonical going forward
      await bus.save();
      acceptable.push(qr);
    }
    const match = acceptable.find(a=> a === incoming || (a && a.toUpperCase() === incoming.toUpperCase()));
    if(!match) {
      if(process.env.NODE_ENV !== 'production') {
        console.warn('QR mismatch debug', { provided: incoming, acceptable });
      }
      return res.status(400).json({ error: 'QR mismatch'});
    }
    const token = jwt.sign({ kind:'qr', rideId: ride._id, sub: req.user._id }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '5m' });
    res.json({ verificationToken: token });
  } catch(e){ next(e); }
});

export default router;
