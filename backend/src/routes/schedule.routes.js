import { Router } from "express";
import { config } from "../config/env.js";
import { findFreeSlots } from "../utils/freeSlots.js";
import { formatMinutes } from "../utils/time.js";
import { orchestrateDay } from "../agents/orchestrator/OrchestratorAgent.js";
import { persistAndEnrichSchedule } from "../agents/orchestrator/persistSchedule.js";
import { fetchTodaysEvents, isAuthenticated } from "../services/gcal.service.js";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const { calendarEvents: bodyEvents = [], useGCal = false } = req.body || {};

    let calendarEvents = bodyEvents;
    let source = "manual";

    if (useGCal) {
      if (!isAuthenticated()) {
        return res.status(401).json({
          error: "Not authenticated with Google Calendar",
          connectUrl: "/api/auth/google",
        });
      }
      try {
        calendarEvents = await fetchTodaysEvents();
        source = "gcal";
      } catch (err) {
        return res.status(500).json({
          error: "Failed to fetch Google Calendar events",
          message: err.message,
        });
      }
    }

    const rawFreeSlots = findFreeSlots(calendarEvents, {
      dayStartHour: config.schedule.dayStartHour,
      dayEndHour: config.schedule.dayEndHour,
    });

    const freeSlots = rawFreeSlots.map((s) => ({
      ...s,
      startLabel: formatMinutes(s.start),
      endLabel: formatMinutes(s.end),
    }));

    const result = await orchestrateDay({ calendarEvents, freeSlots });
    const enrichedSchedule = await persistAndEnrichSchedule(result.schedule);

    res.json({
      source,
      schedule: enrichedSchedule,
      summary: result.summary,
      stats: result.stats,
      deferred: result.deferred,
      proposals: result.proposals,
      recentLoad: result.recentLoad,
      activeGoals: result.activeGoals,
      calendarEvents,
      freeSlots,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error generating schedule:", err);
    res.status(500).json({ error: "Failed to generate schedule", message: err.message });
  }
});

export default router;
