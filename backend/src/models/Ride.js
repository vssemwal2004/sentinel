import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema({
  type: { type: String, enum: ['intra', 'inter'], required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  conductor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  busNumber: { type: String },
  seatsTotal: { type: Number },
  active: { type: Boolean, default: true },
  passengers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    paid: { type: Boolean, default: false },
    method: { type: String, enum: ['online', 'cash'], default: 'cash' },
    addedAt: { type: Date, default: Date.now }
  }],
  capacityCounter: { type: Number, default: 0 },
  busLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  etaMinutes: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Ride', rideSchema);
