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
import { verifySocketAuth } from './utils/socketAuth.js';
import { ensureAdmin } from './initAdmin.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:5173'], credentials: true }});

io.use(verifySocketAuth);

io.on('connection', (socket) => {
  console.log('Socket connected', socket.user?.role, socket.user?.id);
  socket.on('joinRide', (rideId) => {
    socket.join(`ride:${rideId}`);
  });
  socket.on('leaveRide', (rideId) => socket.leave(`ride:${rideId}`));
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
}

start();
