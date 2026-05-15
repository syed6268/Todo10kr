import { Router } from "express";
import { dumpTodos, suggestedTodos } from "../data/todos.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ dumpTodos, suggestedTodos });
});

export default router;
