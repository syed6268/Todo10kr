import { google } from "googleapis";
import { config, assertGoogleOAuth } from "../config/env.js";
import { getStoredTokens, saveTokens } from "../data/tokenStore.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export function createOAuthClient() {
  assertGoogleOAuth();
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

export function getAuthUrl() {
  const oAuth2Client = createOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code) {
  const oAuth2Client = createOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  saveTokens(tokens);
  return tokens;
}

function getAuthenticatedClient() {
  const oAuth2Client = createOAuthClient();
  const stored = getStoredTokens();

  if (stored) {
    oAuth2Client.setCredentials(stored);
    return oAuth2Client;
  }

  if (config.google.refreshToken) {
    oAuth2Client.setCredentials({ refresh_token: config.google.refreshToken });
    return oAuth2Client;
  }

  return null;
}

export function isAuthenticated() {
  return Boolean(getAuthenticatedClient());
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function formatTimeFromISO(iso) {
  const d = new Date(iso);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export async function fetchTodaysEvents() {
  const auth = getAuthenticatedClient();
  if (!auth) {
    const err = new Error("Not authenticated with Google Calendar");
    err.code = "NOT_AUTHENTICATED";
    throw err;
  }

  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.events.list({
    calendarId: config.google.calendarId,
    timeMin: startOfTodayISO(),
    timeMax: endOfTodayISO(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = response.data.items || [];

  return items
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      id: e.id,
      title: e.summary || "(no title)",
      startTime: formatTimeFromISO(e.start.dateTime),
      endTime: formatTimeFromISO(e.end.dateTime),
      startISO: e.start.dateTime,
      endISO: e.end.dateTime,
      location: e.location || null,
      source: "gcal",
    }));
}
