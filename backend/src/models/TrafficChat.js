import mongoose from 'mongoose';

const trafficChatSchema = new mongoose.Schema({
  signalId: { type: String }, // optional: null for global
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

trafficChatSchema.index({ signalId: 1, createdAt: -1 });

export default mongoose.model('TrafficChat', trafficChatSchema);
