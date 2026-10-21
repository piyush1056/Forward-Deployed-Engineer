import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

dotenv.config();

const app = express();
app.use(express.json());


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the Schema Contract using Zod
const MeetingSchema = z.object({
  title: z.string().describe("Brief title of the meeting topic"),
  attendee: z.string().describe("Name of the person attending"),
  date: z.string().describe("Date of the meeting in YYYY-MM-DD format"),
  time: z.string().describe("Time of the meeting in 24-hour format, e.g., 16:00"),
  durationMinutes: z.number().describe("Duration of the meeting in minutes"),
  type: z.enum(["ONE_ON_ONE", "TEAM_SYNC", "INTERVIEW"]).describe("Category of the meeting")
});


app.post("/api/parse-meeting", async (req, res) => {
  try {
    const { userPrompt } = req.body;

    if (!userPrompt) {
      return res.status(400).json({ error: "userPrompt is required in the request body." });
    }

    // Call OpenAI with strict structured output enforcement via Zod
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are an AI assistant that extracts meeting scheduling details from user text accurately." 
        },
        { role: "user", content: userPrompt }
      ],
      // This guarantees the output strictly maps to our Zod schema structure
      response_format: zodResponseFormat(MeetingSchema, "meeting_request"),
    });

    const meetingData = completion.choices[0].message.parsed;

    // Backend business logic validation using the structured data
    if (meetingData.durationMinutes > 60) {
      console.log("Notice: Meeting duration exceeds 60 minutes. Flagging for review.");
    }

    return res.json({
      success: true,
      message: "Successfully extracted structured data from natural language!",
      data: meetingData
    });

  } catch (error) {
    console.error("Error processing structured output:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});