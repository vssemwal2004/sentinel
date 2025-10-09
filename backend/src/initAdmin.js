import User from './models/User.js';
import bcrypt from 'bcryptjs';

export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const pass = process.env.ADMIN_PASSWORD;
  if(!email || !pass) return;
  let admin = await User.findOne({ email });
  if(!admin) {
    const passwordHash = await bcrypt.hash(pass, 10);
    admin = await User.create({ name: 'Admin', email, passwordHash, role: 'admin' });
    console.log('Admin user created');
  }
}
