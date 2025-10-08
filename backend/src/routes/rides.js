import express from 'express';
import Ride from '../models/Ride.js';
import Bus from '../models/Bus.js';
import { authRequired } from '../utils/auth.js';

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
    let seatCode;
    if(ride.type === 'inter') {
      if(!req.body.seatCode) return res.status(400).json({ error: 'seatCode required for inter-city booking' });
      const bus = await Bus.findById(ride.bus, 'seatsQr');
      if(!bus) return res.status(400).json({ error: 'Bus data unavailable' });
      const valid = bus.seatsQr.some(s=>s.code === req.body.seatCode);
      if(!valid) return res.status(400).json({ error: 'Invalid seat code' });
      const taken = ride.passengers.find(p=>p.seatCode === req.body.seatCode);
      if(taken) return res.status(400).json({ error: 'Seat already taken'});
      seatCode = req.body.seatCode;
    }
    ride.passengers.push({ user: req.user._id, name: req.user.name, method: req.body.method || 'online', paid: req.body.method === 'online', seatCode });
    await ride.save();
    req.app.get('io').to(`ride:${ride._id}`).emit('ride:update', { rideId: ride._id, passengers: ride.passengers });
    res.json({ ride });
  } catch (e) { next(e); }
});

export default router;
