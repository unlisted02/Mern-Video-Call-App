import mongoose from "mongoose";

const backgroundPreferenceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["none", "blur", "unsplash", "upload"],
      default: "none",
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    backgroundPreference: {
      type: backgroundPreferenceSchema,
      default: () => ({ type: "none", value: {} }),
    },
  },
  { timestamps: true } // createdAt, updatedAt
);

const User = mongoose.model("User", userSchema);

export default User;