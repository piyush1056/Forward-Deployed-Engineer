import "dotenv/config";
import express from "express";
import cors from "cors";
import { streamChat, resetHistory } from "./chatService.js";

const app = express();
app.use(cors());
app.use(express.json()); 


app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).send("Message is required.");
  }

  // Set headers for raw text streaming over HTTP
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    // Call chat service and pass a callback to write chunks instantly
    await streamChat(message, (chunk) => {
      res.write(chunk); // Send each piece to the browser
    });
    
    res.end(); // Close connection when stream finishes
  } 
  catch (error) {
    console.error("Chat error:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating response.");
    } else {
      res.end();
    }
  }
});


app.delete("/api/chat", (req, res) => {
  resetHistory();
  res.status(200).send("History cleared.");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});