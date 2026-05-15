import { AgentBase } from "../base/AgentBase.js";
import { GOAL_AGENT_SYSTEM, goalAgentUserPrompt } from "./prompts.js";

export class GoalAgent extends AgentBase {
  constructor(goal) {
    super({
      name: `GoalAgent:${goal.title}`,
      temperature: 0.7,
      maxTokens: 700,
    });
    this.goal = goal;
  }

  systemPrompt() {
    const custom = this.goal.agentConfig?.customInstructions;
    return custom
      ? `${GOAL_AGENT_SYSTEM}\n\nAdditional instructions for this specific goal:\n${custom}`
      : GOAL_AGENT_SYSTEM;
  }

  userPrompt(context) {
    return goalAgentUserPrompt({ goal: this.goal, today: context.today });
  }
}

export async function runGoalAgent(goal, context = { today: new Date() }) {
  const agent = new GoalAgent(goal);
  const result = await agent.run(context);

  return {
    goalId: String(goal._id),
    goalTitle: goal.title,
    candidates: Array.isArray(result.candidates) ? result.candidates : [],
    progressReport: result.progressReport || "",
    questionForUser: result.questionForUser || "",
    generatedAt: new Date().toISOString(),
  };
}
