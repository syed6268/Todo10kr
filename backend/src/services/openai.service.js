import OpenAI from "openai";
import { config, assertOpenAI } from "../config/env.js";

let _client = null;

function getClient() {
  assertOpenAI();
  if (!_client) {
    _client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _client;
}

export async function generateSmartSchedule({
  calendarEvents,
  freeSlots,
  dumpTodos,
  suggestedTodos,
}) {
  const client = getClient();

  const calendarEventsFormatted = calendarEvents.length
    ? calendarEvents.map((e) => `${e.startTime} - ${e.endTime}: ${e.title}`).join("\n")
    : "None - empty calendar";

  const freeSlotsFormatted = freeSlots.length
    ? freeSlots
        .map((s) => `${s.startLabel} - ${s.endLabel} (${s.duration} min)`)
        .join("\n")
    : "No free slots";

  const totalFreeMinutes = freeSlots.reduce((sum, s) => sum + s.duration, 0);

  const prompt = `You are an elite AI productivity agent. Fill the user's free slots with their todos to create the perfect day.

EXISTING CALENDAR EVENTS (DO NOT MODIFY, include them in output as type "calendar"):
${calendarEventsFormatted}

FREE SLOTS AVAILABLE FOR SCHEDULING:
${freeSlotsFormatted}

DUMP TODOS (everyday tasks - must be scheduled):
${dumpTodos.map((t) => `- ${t.title}`).join("\n") || "(none)"}

SUGGESTED TODOS (growth tasks - schedule if space allows):
${suggestedTodos.map((t) => `- ${t.title} (${t.category})`).join("\n") || "(none)"}

INSTRUCTIONS:
1. Keep all existing calendar events exactly as they are - mark them as type "calendar"
2. Fill free slots with dump todos first (priority), then suggested todos
3. Energy-intensive tasks in the morning, lighter tasks later
4. Add short breaks between intense activities
5. Schedule ALL dump todos
6. Fit as many suggested todos as possible without cramming

Return ONLY valid JSON:
{
  "schedule": [
    { "time": "8:00 AM - 9:00 AM", "task": "...", "type": "calendar" | "dump" | "suggested" | "break", "reason": "why scheduled here" }
  ],
  "summary": "Overview of the optimized day",
  "stats": {
    "freeSlots": ${freeSlots.length},
    "dumpScheduled": 0,
    "suggestedScheduled": 0,
    "totalFreeMinutes": ${totalFreeMinutes}
  }
}`;

  const completion = await client.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: "system",
        content:
          "You are an elite agentic AI scheduler. You optimize schedules by intelligently filling free time with the right tasks at the right time. Always return valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1500,
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content.trim();
  return JSON.parse(raw);
}
