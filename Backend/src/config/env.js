import dotenv from "dotenv";
dotenv.config();

const requiredEnvVars = [
  { key: "MONGO_URI",         label: "MongoDB URI"         },
  { key: "JWT_SECRET",        label: "JWT Secret Key"      },
  { key: "JWT_EXPIRES_IN",    label: "JWT Expiry Duration" },
  { key: "RESEND_API_KEY",    label: "Resend API Key"      },
  { key: "RESEND_FROM_EMAIL", label: "Resend From Email"   },
  // VAPID keys are optional - push notifications disabled if missing
];

const missing = requiredEnvVars.filter(({ key }) => !process.env[key]);

if (missing.length > 0) {
  console.error("\n❌ Missing environment variables:");
  missing.forEach(({ label, key }) => {
    console.error(`   - ${label} (${key})`);
  });
  console.error("\n👉 Add the missing values in your Render environment settings.\n");
  process.exit(1);
}

export const env = {
  port:           process.env.PORT || 5000,
  mongoUri:       process.env.MONGO_URI,
  jwtSecret:      process.env.JWT_SECRET,
  jwtExpiresIn:   process.env.JWT_EXPIRES_IN || "7d",
  resendApiKey:   process.env.RESEND_API_KEY,
  resendFrom:     process.env.RESEND_FROM_EMAIL,
  clientUrl:      process.env.CLIENT_URL || "https://yachalhousegh.com",
  vapidPublicKey:  process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  nodeEnv:        process.env.NODE_ENV || "production",
  isDev:          process.env.NODE_ENV === "development",
  isProd:         process.env.NODE_ENV !== "development",
};