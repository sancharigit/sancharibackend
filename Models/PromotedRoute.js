import mongoose from "mongoose";

const promotedRouteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    startingPrice: {
      type: Number,
      required: true,
    },
    image: {
      type: String, // URL to image
    },
    category: {
      type: String,
      enum: ["weekend_escape", "trending", "popular"],
      default: "weekend_escape",
    },
    pickup: {
      type: String,
      required: true,
    },
    destination: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const PromotedRoute = mongoose.model("PromotedRoute", promotedRouteSchema);

export default PromotedRoute;
