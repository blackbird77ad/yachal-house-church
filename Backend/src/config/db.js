// db.js
// This file handles the connection between our Express server and MongoDB Atlas
// It is called once when the server starts
// If the connection fails the server stops immediately

import mongoose from "mongoose";
import { env } from "./env.js";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(env.mongoUri);
    console.log(`✅ MongoDB Connected: ${connection.connection.host}`);
    console.log(`📦 Database: ${connection.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected.");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected.");
});

export default connectDB;