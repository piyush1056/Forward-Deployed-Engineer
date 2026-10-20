import OpenAI from 'openai';
import { config } from '../config/env';

const openai = new OpenAI({ apiKey: config.openaiApiKey });


// Generates a 1024-dimension vector embedding for text

export async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1024, 
  });
  return response.data[0].embedding;
}


//Queries OpenAI LLM with retrieved policy context and user question

export async function getLLMResponse(systemPrompt, contextText, userQuery) {
  const messages = [
    {
      role: "system",
      content: `${systemPrompt}\n\nRelevant ShopSphere Policy Context:\n${contextText}`
    },
    {
      role: "user",
      content: userQuery
    }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", 
    messages: messages,
    temperature: 0.2, 
  });

  return response.choices[0].message.content;
}