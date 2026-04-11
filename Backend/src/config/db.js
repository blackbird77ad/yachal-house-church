import mongoose from "mongoose";
import { env } from "./env.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      // Connection pool — Render Starter has 1 vCPU, 2 connections is enough
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,     // close idle sockets after 45s
      serverSelectionTimeoutMS: 10000, // fail fast if Atlas unreachable
      heartbeatFrequencyMS: 10000,
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Reconnect on disconnect (Render restarts, Atlas failover)
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected.");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error:", err.message);
    });

  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

export default connectDB;