import dotenv from "dotenv";

// Load the .env file into process.env
dotenv.config();

// List every variable we need and a human-friendly name for each
const requiredEnvVars = [
  { key: "PORT",              label: "Server Port"          },
  { key: "MONGO_URI",         label: "MongoDB URI"          },
  { key: "JWT_SECRET",        label: "JWT Secret Key"       },
  { key: "JWT_EXPIRES_IN",    label: "JWT Expiry Duration"  },
  { key: "RESEND_API_KEY",    label: "Resend API Key"       },
  { key: "RESEND_FROM_EMAIL", label: "Resend From Email"    },
  { key: "CLIENT_URL",        label: "Frontend Client URL"  },
  { key: "NODE_ENV",          label: "Node Environment"     },
];

// Check each one — collect all missing ones before stopping
const missing = requiredEnvVars.filter(
  ({ key }) => !process.env[key]
);

// If anything is missing print every missing variable then exit
if (missing.length > 0) {
  console.error("\n❌ Missing environment variables:");
  missing.forEach(({ label, key }) => {
    console.error(`   - ${label} (${key})`);
  });
  console.error("\n👉 Check your Backend/.env file and add the missing values.\n");
  // Exit with code 1 means something went wrong
  process.exit(1);
}

// Export every variable so any file can import it cleanly
// instead of typing process.env.SOMETHING every time
export const env = {
  port:           process.env.PORT,
  mongoUri:       process.env.MONGO_URI,
  jwtSecret:      process.env.JWT_SECRET,
  jwtExpiresIn:   process.env.JWT_EXPIRES_IN,
  resendApiKey:   process.env.RESEND_API_KEY,
  resendFrom:     process.env.RESEND_FROM_EMAIL,
  clientUrl:      process.env.CLIENT_URL,
  nodeEnv:        process.env.NODE_ENV,
  isDev:          process.env.NODE_ENV === "development",
  isProd:         process.env.NODE_ENV === "production",
};