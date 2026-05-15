import { Router } from "express";
import { Todo } from "../models/Todo.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [dumpTodos, suggestedTodos] = await Promise.all([
      Todo.find({ type: "dump" }).sort({ createdAt: -1 }),
      Todo.find({ type: "suggested" }).sort({ createdAt: -1 }),
    ]);
    res.json({ dumpTodos, suggestedTodos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, type = "dump", category, goalId, priority, estimatedMinutes } =
      req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });

    const todo = await Todo.create({
      title,
      type,
      category,
      goalId: goalId || null,
      priority,
      estimatedMinutes,
      source: "manual",
    });
    res.status(201).json({ todo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["title", "completed", "priority", "category", "estimatedMinutes"];
    const update = {};
    for (const k of allowed) if (req.body?.[k] !== undefined) update[k] = req.body[k];
    if (update.completed === true) update.completedAt = new Date();
    if (update.completed === false) update.completedAt = null;

    const todo = await Todo.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!todo) return res.status(404).json({ error: "Todo not found" });
    res.json({ todo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id);
    if (!todo) return res.status(404).json({ error: "Todo not found" });
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
