import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod"; 
import { completeTask, createTask, listTasks } from "./tools.js";
import { getGuidelines } from "./resources.js";
import { planDay } from "./prompt.js";

// Initialize MCP Server instance
const handler = createMcpHandler(() => {
const server = new McpServer( {name: "task-mcp-server", version: "2.0.0",} );

  // --- 1. TOOLS SECTION ---
  server.registerTool(
    "create_task",
    {
      description: "Create a new task",
      inputSchema: z.object({
        title: z.string().describe("Title of the task"),
      }),
    },
    async ({ title }) => ({
      content: [{ type: "text", text: createTask(title) }],
    })
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List all pending tasks",
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(listTasks()) }],
    })
  );

  server.registerTool(
    "complete_task",
    {
      description: "Complete a task using its exact title",
      inputSchema: z.object({
        title: z.string().describe("Exact title of the task"),
      }),
    },
    async ({ title }) => ({
      content: [{ type: "text", text: completeTask(title) }],
    })
  );

  // --- 2. RESOURCES SECTION ---
  server.registerResource(
    "task-guidelines",
    "task://guidelines",
    {
      description: "Guidelines for managing and prioritizing tasks",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/plain", text: getGuidelines() }],
    })
  );

  // --- 3. PROMPTS SECTION ---
  server.registerPrompt(
    "plan_day",
    {
      description: "Plan pending tasks for the available time",
      argsSchema: z.object({
        availableHours: z.string().describe("Number of hours available today"),
      }),
    },
    ({ availableHours }) => ({
      description: "Plan pending tasks for the day",
      messages: [
        {
          role: "user",
          content: { type: "text", text: planDay(availableHours) },
        },
      ],
    })
  );

  return server;
});

const app = createMcpExpressApp({ host: "127.0.0.1" });
const nodeHandler = toNodeHandler(handler);

app.all("/mcp", (req, res) => {
  void nodeHandler(req, res, req.body);
});

const httpServer = app.listen(8081, "127.0.0.1", () => {
  console.log("Task MCP Microservice running at http://localhost:8081/mcp");
});
process.on("SIGINT", () => {
  httpServer.close();
});
