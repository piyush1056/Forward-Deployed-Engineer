import "dotenv/config";
import { Agent, MCPServerStreamableHttp, run } from "@openai/agents";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable in your .env file.");
}

// Initialize the link to our MCP Server microservice
const mcpServer = new MCPServerStreamableHttp({
  name: "Task MCP Server Link",
  url: process.env.MCP_SERVER_URL ?? "http://localhost:8081/mcp",
  cacheToolsList: true, 
});

await mcpServer.connect();

const agent = new Agent({
  name: "Task Management Assistant",
  model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  instructions: `You are a structured task management assistant.
                 Always check your attached MCP server resources ('task://guidelines') to cross-reference scheduling logic.
                 Execute the matching task tools whenever the user requests mutations or lookups.`,
  mcpServers: [mcpServer], // Framework completely automates tool-calling loops here
});

// Sends a chat message to the automated agent
 export async function chat(message) {
  const result = await run(agent, message);
  return String(result.finalOutput ?? "");
}

// Triggers the pre-formatted day planning routine
export async function planDay(hours) {
  const promptText = `Execute the prompt template 'plan_day' with argument availableHours set to ${hours}.`;
  const result = await run(agent, promptText);
  return String(result.finalOutput ?? "");
}
