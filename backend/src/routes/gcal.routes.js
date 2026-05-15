import { Router } from "express";
import { fetchTodaysEvents, isAuthenticated } from "../services/gcal.service.js";

const router = Router();

router.get("/events/today", async (req, res) => {
  if (!isAuthenticated()) {
    return res.status(401).json({
      error: "Not authenticated with Google Calendar",
      connectUrl: "/api/auth/google",
    });
  }

  try {
    const events = await fetchTodaysEvents();
    res.json({ events, count: events.length });
  } catch (err) {
    console.error("GCal fetch error:", err);
    res.status(500).json({ error: "Failed to fetch calendar events", message: err.message });
  }
});

export default router;
