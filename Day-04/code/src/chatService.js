import OpenAI from "openai";

export const SYSTEM_PROMPT = `You are a customer-support executive for our
Food ordering app named Tomato.

Your job is to identify the customer's main
problem and urgency. Answer them related to there query.

Use professional language. If user has an issue,
use words like I understand your frustration,
I am really sorry for your trouble etc.

Do not answer any other question which is not
related to Ordering Food query, refund query,
order tracking status query or company policy query.
`;

export function createChatService({
  client = new OpenAI(),
  model = process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  systemPrompt = SYSTEM_PROMPT,
} = {}) {
  const history = [];

  // Serialize history operations so simultaneous requests cannot interleave turns.
  let historyQueue = Promise.resolve();
  function useHistory(operation) {
    const result = historyQueue.then(operation);
    historyQueue = result.catch(() => {});
    return result;
  }

  return {
    async chat(message) {
      return useHistory(async () => {
        history.push({ role: "user", content: message });

        const apiResponse = await client.responses.create({
          model,
          instructions: systemPrompt,
          input: history,
          store: false,
        });

        const outputText = apiResponse.output_text;
        history.push({ role: "assistant", content: outputText });
        return outputText;
      });
    },

    async resetHistory() {
      return useHistory(async () => {
        history.length = 0;
      });
    },

    getHistory() {
      return [...history];
    },
  };
}

// Backward-compatibility alias if needed
export const createSummarizeService = createChatService;
