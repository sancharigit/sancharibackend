import mongoose from "mongoose";

const promotedRouteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    startingPrice: {
      type: Number,
    },
    image: {
      type: String, // URL to image
    },
    category: {
      type: String,
      enum: ["weekend_escape", "trending", "popular", "trending_route", "trending_now"],
      default: "trending_route",
    },
    pickup: {
      type: String,
    },
    destination: {
      type: String,
    },
    subtitle: {
      type: String,
    },
    discount: {
      type: String,
    },
    tag: {
      type: String,
    },
    duration: {
      type: String,
    },
    rating: {
      type: String,
    },
    seats: {
      type: Number,
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
