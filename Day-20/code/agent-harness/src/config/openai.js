import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();


export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Central config for Agent Harness limits and timeouts
export const HARNESS_CONFIG = {
    MODEL: "gpt-4o-mini",
    MAX_ATTEMPTS: 3,             // Hard stop: never let the agent loop more than 3 times
    TOOL_TIMEOUT_MS: 5000,       // 5 seconds max for external tools (like Jira API)
    LLM_TIMEOUT_MS: 20000,       // 20 seconds max for a single OpenAI API call
    TASK_TIMEOUT_MS: 120000,     // 2 minutes max for the entire job from start to finish
};