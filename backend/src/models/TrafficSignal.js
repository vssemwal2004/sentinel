import mongoose from 'mongoose';

const trafficSignalSchema = new mongoose.Schema({
  signalId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  location: { lat: Number, lng: Number },
  entryCount: Number,
  exitCount: Number,
  density: Number,
  level: { type: String, enum: ['Smooth','Moderate','Heavy'] },
  createdAt: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now }
});

// Keep only needed indexes for querying latest per signal
trafficSignalSchema.index({ signalId: 1, timestamp: -1 });

export default mongoose.model('TrafficSignalReading', trafficSignalSchema);
