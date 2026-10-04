import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5.6-luna";

// Factory function: allows injecting a mock client/model for easy testing without calling real APIs
export function createSummarizeService({
  client = new OpenAI(),
  model = process.env.OPENAI_MODEL || DEFAULT_MODEL,
} = {}) {
  return {
    async summarize(ticket) {
      // Send prompt combining instructions and the raw support ticket text
      const response = await client.responses.create({
        model,
        input: `Summarize this support ticket in 2 lines : \n\n${ticket}`,
        store: false, // Don't persist this interaction in OpenAI storage
      });

      // Ensure model produced text before returning
      if (!response.output_text) {
        throw new Error("OpenAI returned an empty summary");
      }

      return response.output_text;
    },
  };
}