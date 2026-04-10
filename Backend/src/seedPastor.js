// Run from Backend folder: node src/seedPastor.js
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Load .env from Backend folder regardless of where script is run from
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in .env file.");
  console.error("   Make sure Backend/.env exists and has MONGO_URI set.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log("✅ Connected to MongoDB");

// Minimal schema - strict:false accepts any fields
const User = mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { strict: false }), "users");

const PASTOR_EMAIL    = "pastor@yachalhousegh.com"; // change after first login
const TEMP_PASSWORD   = "Growth";
const WORKER_ID       = "001";

const existing = await User.findOne({
  $or: [{ workerId: WORKER_ID }, { email: PASTOR_EMAIL }]
});

if (existing) {
  console.log("⚠️  Pastor account already exists:");
  console.log(`   Email:     ${existing.email}`);
  console.log(`   Worker ID: ${existing.workerId}`);
  console.log(`   Status:    ${existing.status}`);
  console.log("\n   To update the email, log in and change it from My Profile.");
} else {
  const hashed = await bcrypt.hash(TEMP_PASSWORD, 12);
  const pastor = await User.create({
    fullName:          "Rev Gilbert Ossei Hyeamann",
    email:             PASTOR_EMAIL,
    password:          hashed,
    role:              "pastor",
    status:            "approved",
    workerId:          WORKER_ID,
    department:        "leadership",
    mustChangePassword: true,
    approvedAt:        new Date(),
  });

  console.log("✅ Pastor account created successfully!");
  console.log("─".repeat(40));
  console.log(`   Name:      ${pastor.fullName}`);
  console.log(`   Email:     ${pastor.email}`);
  console.log(`   Worker ID: ${pastor.workerId}`);
  console.log(`   Password:  ${TEMP_PASSWORD}`);
  console.log("─".repeat(40));
  console.log("\n⚠️  IMPORTANT:");
  console.log("   1. Log in at https://yachalhousegh.com/login");
  console.log("   2. You will be asked to change your password immediately");
  console.log("   3. After login go to My Profile to update the email address");
}

await mongoose.disconnect();
console.log("\n✅ Done.");
process.exit(0);