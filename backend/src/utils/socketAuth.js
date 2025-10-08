import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function verifySocketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if(!token) return next(); // allow anonymous for public ride data
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    const user = await User.findById(payload.id);
    socket.user = user ? { id: user._id.toString(), role: user.role } : null;
    next();
  } catch (e) { next(); }
}
