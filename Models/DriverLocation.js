import mongoose from 'mongoose';

const driverLocationSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  heading: { type: Number, default: 0 },   // degrees 0-360
  speed: { type: Number, default: 0 },      // km/h
  isOnline: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

driverLocationSchema.index({ location: '2dsphere' });
driverLocationSchema.index({ isOnline: 1 });

const DriverLocation = mongoose.model('DriverLocation', driverLocationSchema);
export default DriverLocation;
