import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import { getOpenAITools, executeMcpTool } from "./mcp-client";
dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // Phase 1: Tool Discovery via MCP HTTP Client
    const openAiTools = await getOpenAITools();

    const messages = [
      { role: "system", content: "You are a helpful task management assistant." },
      { role: "user", content: message }
    ];

    // Phase 2: Send prompt + dynamically parsed schemas to OpenAI
    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: openAiTools
    });

    let choice = response.choices[0];

    // Phase 3: Check if LLM triggers an execution cycle
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      // HTTP request triggers tool execution on Microservice port 8081
      const toolResult = await executeMcpTool(toolName, toolArgs);

      // Send execution result back to OpenAI for the final reply
      messages.push(choice.message);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult
      });

      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages
      });

      return res.json({ reply: finalResponse.choices[0].message.content });
    }

    // Direct response if no tool was needed
    return res.json({ reply: choice.message.content });
  } catch (error) {
    console.error("Gateway error executing lifecycle:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log(" Express Host Client App running on http://localhost:3000");
});
