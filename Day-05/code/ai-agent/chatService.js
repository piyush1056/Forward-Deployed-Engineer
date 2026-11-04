import OpenAI from 'openai';
import { chatSystemPrompt, websiteSystemPrompt } from './config/prompt.js';
import { chatTools, websiteTools, toolRegistry } from './tools/index.js';

const openai = new OpenAI();
const MODEL_NAME = 'gpt-4o-mini';


const sessions = {
  chat: [],
  website: [],
};

async function executeAgentLoop(systemPrompt, history, schemaTools, userMessage) {
  history.push({ role: 'user', content: userMessage });
  const messageStream = [{ role: 'system', content: systemPrompt }, ...history];

  while (true) {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: messageStream,
      tools: schemaTools,
    });

    const assistantMsg = completion.choices[0].message;
    
    // Check if tools need calling
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      history.push({ role: 'assistant', content: assistantMsg.content });
      return assistantMsg.content;
    }

    messageStream.push(assistantMsg);

    // Dynamic execution of called tools
    for (const call of assistantMsg.tool_calls) {
      const toolAction = toolRegistry[call.function.name];
      if (!toolAction) {
        throw new Error(`Execution error: Tool "${call.function.name}" is unregistered.`);
      }

      const argumentsParsed = JSON.parse(call.function.arguments);
      const executionResult = await toolAction(argumentsParsed);

      messageStream.push({
        role: 'tool',
        tool_call_id: call.id,
        content: typeof executionResult === 'string' ? executionResult : JSON.stringify(executionResult),
      });
    }
  }
}

export const runGeneralChat = (message) => 
  executeAgentLoop(chatSystemPrompt, sessions.chat, chatTools, message);

export const runWebsiteGeneration = (message) => 
  executeAgentLoop(websiteSystemPrompt, sessions.website, websiteTools, message);
