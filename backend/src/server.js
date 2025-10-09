import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import rideRoutes from './routes/rides.js';
import conductorRoutes from './routes/conductor.js';
import trafficRoutes from './routes/traffic.js';
import { verifySocketAuth } from './utils/socketAuth.js';
import { ensureAdmin } from './initAdmin.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:5173'], credentials: true }});

io.use(verifySocketAuth);

// In-memory map of user locations per ride: { [rideId]: { [userKey]: { lat,lng,name,userId,updatedAt } } }
const rideUserLocations = {};

io.on('connection', (socket) => {
  // userKey: prefer authenticated user id else socket id
  const userKey = socket.user? String(socket.user._id) : socket.id;
  const displayName = socket.user?.name || 'Guest';
  console.log('Socket connected', socket.user?.role, socket.user?.id);

  socket.on('joinRide', (rideId) => {
    socket.join(`ride:${rideId}`);
    // On join send current user locations for that ride if any
    if(rideUserLocations[rideId]) {
      socket.emit('ride:userLocations', { rideId, users: Object.values(rideUserLocations[rideId]) });
    }
  });
  socket.on('leaveRide', (rideId) => {
    socket.leave(`ride:${rideId}`);
    if(rideUserLocations[rideId]){
      delete rideUserLocations[rideId][userKey];
      io.to(`ride:${rideId}`).emit('ride:userLocations', { rideId, users: Object.values(rideUserLocations[rideId]) });
    }
  });
  socket.on('user:location', ({ rideId, lat, lng }) => {
    if(!rideId || typeof lat !== 'number' || typeof lng !== 'number') return;
    if(!rideUserLocations[rideId]) rideUserLocations[rideId] = {};
    rideUserLocations[rideId][userKey] = { userId: socket.user? String(socket.user._id) : null, name: displayName, lat, lng, updatedAt: Date.now() };
    io.to(`ride:${rideId}`).emit('ride:userLocations', { rideId, users: Object.values(rideUserLocations[rideId]) });
  });
  socket.on('disconnect', () => {
    // Remove user from all rides
    for(const rideId of Object.keys(rideUserLocations)){
      if(rideUserLocations[rideId][userKey]){
        delete rideUserLocations[rideId][userKey];
        io.to(`ride:${rideId}`).emit('ride:userLocations', { rideId, users: Object.values(rideUserLocations[rideId]) });
      }
    }
  });

  // --- Chat channels ---
  socket.on('chat:join', (room) => {
    if(typeof room !== 'string' || !room) return;
    socket.join(`chat:${room}`);
  });
  socket.on('chat:leave', (room) => {
    if(typeof room !== 'string' || !room) return;
    socket.leave(`chat:${room}`);
  });
  socket.on('chat:message', (payload) => {
    try {
      const { room, text } = payload || {};
      if(typeof room !== 'string' || !room) return;
      if(typeof text !== 'string' || !text.trim()) return;
      const msg = {
        room,
        text: text.trim(),
        ts: Date.now(),
        user: socket.user ? { id: String(socket.user._id), name: socket.user.name, role: socket.user.role } : { id: null, name: 'Guest' }
      };
      io.to(`chat:${room}`).emit('chat:message', msg);
    } catch(e){ /* ignore */ }
  });
});

app.set('io', io);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:5173'], credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_, res) => res.json({ status: 'ok'}));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/conductor', conductorRoutes);
app.use('/api/traffic', trafficRoutes);

app.use((err, req, res, next) => { // eslint-disable-line
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error'});
});

async function start() {
  const mongo = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sentinel';
  await mongoose.connect(mongo);
  await ensureAdmin();
  const port = process.env.PORT || 4000;
  server.listen(port, () => console.log('API listening on', port));
  // Optional traffic auto-simulation (demo). Set TRAFFIC_SIM_INTERVAL_MS env (e.g., 30000)
  const intervalMs = parseInt(process.env.TRAFFIC_SIM_INTERVAL_MS || '0');
  if(intervalMs > 0){
    console.log('Traffic simulation interval enabled every', intervalMs, 'ms');
    const simulate = async ()=>{
      try {
        // Reuse the route logic by importing model directly
        const mod = await import('./models/TrafficSignal.js');
        const TrafficSignalReading = mod.default;
        const signals = [
          { signalId: 's1', name: 'Sector 62 Junction', location: { lat: 28.6203, lng: 77.3811 } },
          { signalId: 's2', name: 'Central Mall Circle', location: { lat: 28.6215, lng: 77.385 } },
          { signalId: 's3', name: 'Tech Park Gate', location: { lat: 28.6189, lng: 77.379 } }
        ];
        function computeLevel(density){ if(density < 20) return 'Smooth'; if(density < 50) return 'Moderate'; return 'Heavy'; }
        const created=[];
        for(const meta of signals){
          const entryCount = Math.floor(50 + Math.random()*100);
          const exitCount = Math.floor(40 + Math.random()*90);
          const density = entryCount - exitCount;
          const level = computeLevel(density);
            created.push(await TrafficSignalReading.create({ ...meta, entryCount, exitCount, density, level, timestamp: new Date() }));
        }
        io.emit('traffic:update', { signals: created.map(c=>({ signalId: c.signalId, name: c.name, location: c.location, entryCount: c.entryCount, exitCount: c.exitCount, density: c.density, level: c.level, timestamp: c.timestamp })) });
      } catch(e){ console.error('Traffic auto-sim error', e); }
    };
    setInterval(simulate, intervalMs);
  }
}

start();
