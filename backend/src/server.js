import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import todosRouter from "./routes/todos.routes.js";
import authRouter from "./routes/auth.routes.js";
import gcalRouter from "./routes/gcal.routes.js";
import scheduleRouter from "./routes/schedule.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api/todos", todosRouter);
app.use("/api/auth", authRouter);
app.use("/api/gcal", gcalRouter);
app.use("/api/schedule", scheduleRouter);

app.listen(config.port, () => {
  console.log(`Server started on PORT: ${config.port}`);
  console.log(`Google OAuth redirect URI: ${config.google.redirectUri}`);
});

export default app;
