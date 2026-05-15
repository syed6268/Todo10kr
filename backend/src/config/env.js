import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5001", 10),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/todo10kr",
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5001/api/auth/google/callback",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  },
  schedule: {
    dayStartHour: parseInt(process.env.DAY_START_HOUR || "8", 10),
    dayEndHour: parseInt(process.env.DAY_END_HOUR || "22", 10),
  },
};

export function assertOpenAI() {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY is not set in .env");
  }
}

export function assertGoogleOAuth() {
  const { clientId, clientSecret, redirectUri } = config.google;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in backend/.env"
    );
  }
}





