import OpenAI from "openai";

const openai = new OpenAI();
const history = [];

const SYSTEM_PROMPT = "Reply to any question in a sarcastic and friendly way.";

// Stream chat response
export async function streamChat(userMessage, onChunk) {
  // 1. Add user message to history
  history.push({ role: "user", content: userMessage });

  // 2. Combine system prompt with history
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history
  ];

  // 3. Request stream from OpenAI
  const stream = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: messages,
    stream: true,
  });

  let fullAssistantReply = "";

  // 4. Loop through incoming chunks
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      fullAssistantReply += content; // Buffer locally
      onChunk(content);             // Send chunk immediately to client
    }
  }

  // 5. Save complete assistant response to history
  history.push({ role: "assistant", content: fullAssistantReply });
  return fullAssistantReply;
}

// Clear conversation history
export function resetHistory() {
  history.length = 0;
}
