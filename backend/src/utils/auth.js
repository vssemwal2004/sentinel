import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
}

export async function authRequired(req, res, next) {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if(!token) return res.status(401).json({ error: 'Auth required'});
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    const user = await User.findById(payload.id);
    if(!user) return res.status(401).json({ error: 'Invalid user'});
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export function role(required) {
  return (req, res, next) => {
    if(!req.user || (Array.isArray(required) ? !required.includes(req.user.role) : req.user.role !== required)) {
      return res.status(403).json({ error: 'Forbidden'});
    }
    next();
  };
}
