import express from "express";
import { router } from "./routes.js";
import { mcpServer } from "./chatService.js";

const app = express();
app.use(express.json());

app.use(router);

const httpServer = app.listen(8080, "127.0.0.1", () => {
  console.log("🚀 Client Hub running at http://127.0.0.1:8080");
});

async function shutdown() {
  console.log("\nClosing client networking channels cleanly...");
  await mcpServer.close();
  httpServer.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
