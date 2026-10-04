import express from "express";

// Factory function: accepts summarizeService so we can test routes with a mock service
export function createApp(summarizeService) {
  if (!summarizeService?.summarize) {
    throw new TypeError("A summarize service is required");
  }

  const app = express();
  // Parse incoming text/plain request bodies up to 100kb
  app.use(express.text({ type: "*/*", limit: "100kb" }));

  app.post("/api/summarize", async (request, response) => {
    const ticket = typeof request.body === "string" ? request.body : "";

    // Guard clause: reject empty or whitespace-only inputs
    if (!ticket.trim()) {
      return response
        .status(400)
        .type("text/plain")
        .send("Ticket text is required.");
    }

    try {
      // Call service layer to generate summary via LLM
      const summary = await summarizeService.summarize(ticket);
      return response.type("text/plain").send(summary);
    } catch (error) {
      console.error("Failed to summarize ticket:", error);
      return response
        .status(500)
        .type("text/plain")
        .send("Unable to summarize the ticket.");
    }
  });

  return app;
}
