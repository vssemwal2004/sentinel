import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'conductor', 'admin'], default: 'user' },
  conductorId: { type: String }, // For conductors referencing CSV unique id
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
