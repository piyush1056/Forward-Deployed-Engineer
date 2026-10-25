import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

let tasks = [
  { id: 1, title: "Initial setup", status: "PENDING" }
];

// Initialize MCP Server instance
const handler = createMcpHandler(() => {
  const server = new McpServer({
    name: "task-manager-server",
    version: "2.0.0" 
  });

  // Tool 1: Create Task
  server.registerTool(
    "createTask",
    {
      description: "Creates a new task in the database",
      inputSchema: z.object({
        title: z.string().describe("Title of the task")
      })
    },
    async ({ title }) => {
      const newTask = { id: tasks.length + 1, title, status: "PENDING" };
      tasks.push(newTask);
      return {
        content: [{ type: "text", text: JSON.stringify(newTask) }]
      };
    }
  );

  // Tool 2: List Tasks
  server.registerTool(
    "listTasks",
    {
      description: "Returns all existing tasks",
      inputSchema: z.object({}) // empty object if no input parameters needed
    },
    async () => {
      return {
        content: [{ type: "text", text: JSON.stringify(tasks) }]
      };
    }
  );

  // Tool 3: Delete Task
  server.registerTool(
    "deleteTask",
    {
      description: "Deletes a task by its numeric ID",
      inputSchema: z.object({
        id: z.number().describe("ID of the task to delete")
      })
    },
    async ({ id }) => {
      const index = tasks.findIndex((t) => t.id === id);
      if (index === -1) {
        return {
          content: [{ type: "text", text: `Task with ID ${id} not found.` }]
        };
      }
      const removed = tasks.splice(index, 1);
      return {
        content: [{ type: "text", text: `Deleted task ID ${id}: ${removed[0].title}` }]
      };
    }
  );

  return server;
});

// App Initialization 
const app = createMcpExpressApp({ host: "127.0.0.1" });
const nodeHandler = toNodeHandler(handler);

// Single standard REST HTTP endpoint for MCP client to connect
app.all("/mcp", (req, res) => {
  void nodeHandler(req, res, req.body);
});

// Independent Microservice on port 8081
app.listen(8081, "127.0.0.1", () => {
  console.log("Task MCP Microservice running at http://localhost:8081/mcp");
});
