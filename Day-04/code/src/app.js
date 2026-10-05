import cors from "cors";
import express from "express";

export function createApp(chatService) {
  if (!chatService?.chat) {
    throw new TypeError("A chat service is required");
  }

  const app = express();
  app.use(cors());
  app.use(express.text({ type: "*/*", limit: "100kb" }));

  app.post("/api/chat", async (req, res, next) => {
    if (typeof req.body !== "string" || !req.body.trim()) {
      return res.status(400).type("text/plain").send("Request body must be text");
    }

    try {
      const answer = await chatService.chat(req.body);
      return res.type("text/plain").send(answer);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api", async (_req, res, next) => {
    try {
      if (typeof chatService.resetHistory === "function") {
        await chatService.resetHistory();
      }
      return res.status(200).send();
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    console.error("Chat API error:", error);
    return res
      .status(500)
      .type("text/plain")
      .send("Unable to process the chat request");
  });

  return app;
}