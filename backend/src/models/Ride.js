import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema({
  type: { type: String, enum: ['intra', 'inter'], required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  conductor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  busNumber: { type: String },
  seatsTotal: { type: Number },
  // Seat assignment structures (for inter-city rides with seat selection)
  seatAssignments: [{
    seatNumber: String, // e.g., '1A'
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    paid: { type: Boolean, default: false },
    method: { type: String, enum: ['online','cash'], default: 'online' },
    bookedAt: { type: Date, default: Date.now }
  }],
  seatMapVersion: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
  originCoords: { lat: Number, lng: Number },
  destinationCoords: { lat: Number, lng: Number },
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
