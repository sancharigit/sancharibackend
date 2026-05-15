import mongoose from 'mongoose';

const rideHistorySchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pickup: String,
  dropoff: String,
  fare: Number,
  distance: Number,
  duration: Number,
  status: String,
  completedAt: Date,
}, { timestamps: true });

rideHistorySchema.index({ passengerId: 1, createdAt: -1 });
rideHistorySchema.index({ driverId: 1, createdAt: -1 });

const RideHistory = mongoose.model('RideHistory', rideHistorySchema);
export default RideHistory;
