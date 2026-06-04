import mongoose from 'mongoose';

const driverOfferSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: "" 
  },
  targetRides: { 
    type: Number, 
    required: true 
  },
  bonusAmount: { 
    type: Number, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, { timestamps: true });

export default mongoose.model('DriverOffer', driverOfferSchema);
