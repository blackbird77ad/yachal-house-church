// Run once: node src/seedPastor.js
// Creates the pastor account with Worker ID 001
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "./config/env.js";

await mongoose.connect(env.mongoUri);

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model("User", userSchema, "users");

const email = "pastor@yachalhouse.com"; // change this to real email after
const password = "YachalPastor2024!";   // change on first login
const existing = await User.findOne({ $or: [{ workerId: "001" }, { email }] });

if (existing) {
  console.log("Pastor account already exists:", existing.email, "ID:", existing.workerId);
} else {
  const hashed = await bcrypt.hash(password, 12);
  const pastor = await User.create({
    fullName: "Rev Gilbert Ossei",
    email,
    password: hashed,
    role: "pastor",
    status: "approved",
    workerId: "001",
    department: "leadership",
    mustChangePassword: true,
    approvedAt: new Date(),
  });
  console.log("Pastor created:", pastor.email, "Worker ID:", pastor.workerId);
  console.log("Temp password:", password);
  console.log("Change email and password after first login.");
}

await mongoose.disconnect();