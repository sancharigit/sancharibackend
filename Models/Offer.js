import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    badge: {
      type: String, // e.g., "CITY COMMUTE", "INTER-CITY"
      required: true,
    },
    pillText: {
      type: String,
      default: "",
    },
    actionText: {
      type: String, // e.g., "LEARN MORE", "CHECK AVAILABILITY"
      default: "LEARN MORE",
    },
    targetScreen: {
      type: String, // e.g., "Outstation", "Home", or empty
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
