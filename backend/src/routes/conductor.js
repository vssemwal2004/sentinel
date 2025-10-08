import express from 'express';
import Ride from '../models/Ride.js';
import Bus from '../models/Bus.js';
import { authRequired, role } from '../utils/auth.js';

const router = express.Router();

router.post('/rides', authRequired, role(['conductor','admin']), async (req,res,next) => {
  try {
    const { type, origin, destination, busId } = req.body;
    if(!type || !origin || !destination || !busId) return res.status(400).json({ error: 'Missing fields (type, origin, destination, busId required)' });
    let bus = null;
    bus = await Bus.findById(busId);
    if(!bus) return res.status(404).json({ error: 'Bus not found' });
    if(bus.activeRide) return res.status(400).json({ error: 'Bus already assigned to a ride'});
    const expectedBusType = type === 'intra' ? 'Intra-City' : 'Inter-City';
    if(bus.type && bus.type !== expectedBusType) return res.status(400).json({ error: `Bus type mismatch. Expected ${expectedBusType}` });
    const ride = await Ride.create({ type, origin, destination, conductor: req.user._id, bus: bus?._id, busNumber: bus?.number, seatsTotal: bus?.seats });
    if(bus){
      bus.activeRide = ride._id;
      await bus.save();
    }
    res.json({ ride });
  } catch (e) { next(e); }
});

router.post('/rides/:id/passengers', authRequired, role(['conductor','admin']), async (req,res,next) => {
  try {
    const { name, userId, method = 'cash', paid = false } = req.body;
    const ride = await Ride.findById(req.params.id);
    if(!ride) return res.status(404).json({ error: 'Ride not found'});
    if(String(ride.conductor) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden'});
    ride.passengers.push({ name, user: userId || null, method, paid });
    await ride.save();
    req.app.get('io').to(`ride:${ride._id}`).emit('ride:update', { rideId: ride._id, passengers: ride.passengers });
    res.json({ ride });
  } catch (e) { next(e); }
});

router.patch('/rides/:id/location', authRequired, role(['conductor','admin']), async (req,res,next) => {
  try {
    const { lat, lng, etaMinutes } = req.body;
    const ride = await Ride.findById(req.params.id);
    if(!ride) return res.status(404).json({ error: 'Ride not found'});
    if(String(ride.conductor) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden'});
    ride.busLocation = { lat, lng, updatedAt: new Date() };
    if(typeof etaMinutes === 'number') ride.etaMinutes = etaMinutes;
    await ride.save();
    req.app.get('io').to(`ride:${ride._id}`).emit('ride:update', { rideId: ride._id, busLocation: ride.busLocation, etaMinutes: ride.etaMinutes });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.patch('/rides/:rideId/passengers/:index/pay', authRequired, role(['conductor','admin']), async (req,res,next) => {
  try {
    const { rideId, index } = req.params;
    const ride = await Ride.findById(rideId);
    if(!ride) return res.status(404).json({ error: 'Ride not found'});
    if(String(ride.conductor) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden'});
    if(!ride.passengers[index]) return res.status(404).json({ error: 'Passenger not found'});
    ride.passengers[index].paid = true;
    await ride.save();
    req.app.get('io').to(`ride:${ride._id}`).emit('ride:update', { rideId: ride._id, passengers: ride.passengers });
    res.json({ ride });
  } catch (e) { next(e); }
});

router.patch('/rides/:id/counter', authRequired, role(['conductor','admin']), async (req,res,next) => {
  try {
    const { id } = req.params;
    const { value } = req.body; // absolute value
    const ride = await Ride.findById(id);
    if(!ride) return res.status(404).json({ error: 'Ride not found'});
    if(String(ride.conductor) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden'});
    if(typeof value === 'number' && value >= 0) ride.capacityCounter = value;
    await ride.save();
    req.app.get('io').to(`ride:${ride._id}`).emit('ride:update', { rideId: ride._id, capacityCounter: ride.capacityCounter });
    res.json({ ride });
  } catch (e) { next(e); }
});

// Endpoint for conductor to get available buses (unassigned)
router.get('/buses/available', authRequired, role(['conductor','admin']), async (req,res,next) => {
  try {
    const { rideType } = req.query; // 'intra' | 'inter'
  let query = { activeRide: { $exists: false } };
    if(rideType === 'intra') query.type = 'Intra-City';
    if(rideType === 'inter') query.type = 'Inter-City';
    const buses = await Bus.find(query, 'number name seats type routeName');
    res.json({ buses });
  } catch (e) { next(e); }
});

export default router;
