import mongoose from 'mongoose';

const trafficJunctionSchema = new mongoose.Schema({
  signalId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { lat: Number, lng: Number },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('TrafficJunction', trafficJunctionSchema);
