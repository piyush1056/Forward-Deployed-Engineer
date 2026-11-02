import { Router } from "express";
import { chat, planDay } from "./chatService";

export const router = Router();

// Chat conversation path
router.post("/ask", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "JSON body parameter 'message' is required." });
    }

    const responseText = await chat(message);
    return res.json({ response: responseText });
  } catch (error) {
    console.error("Routing Error:", error);
    return res.status(500).json({ error: "Unable to process the request." });
  }
});

//  Day planning path
router.post("/plan", async (req, res) => {
  try {
    const { hours } = req.body;
    if (!hours) {
      return res.status(400).json({ error: "Parameter 'hours' is required." });
    }

    const planText = await planDay(String(hours));
    return res.json({ plan: planText });
  } catch (error) {
    console.error("Planning Error:", error);
    return res.status(500).json({ error: "Unable to build plan." });
  }
});
