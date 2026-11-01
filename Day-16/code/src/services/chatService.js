const SYSTEM_PROMPT = 'You are a helpful AI assistant. Answer questions clearly and simply.';

export class ChatService {
  
    constructor(client, model = 'gpt-4o-mini') 
    {
    this.client = client;
    this.model = model;
    this.history = [];
    this.queue = Promise.resolve();
    }

  // Serialize chat/clear operations so simultaneous requests preserve turn order.
    runInOrder(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  chat(message, image) {
    return this.runInOrder(async () => {
      let content = message;
      if (image && image.buffer.length > 0) {
        content = [
          { type: 'text', text: message },
          {
            type: 'image_url',
            image_url: {
              url: `data:${image.mimetype};base64,${image.buffer.toString('base64')}`,
            },
          },
        ];
      }
      const userMessage = { role: 'user', content };
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...this.history,
          userMessage,
        ],
      });
      const reply = response.choices[0]?.message?.content;
      if (typeof reply !== 'string') {
        throw new Error('The model returned no text response.');
      }
      // Only commit a complete turn after the API call succeeds.
      this.history.push(userMessage, { role: 'assistant', content: reply });
      return reply;
    });
  }

  clearHistory() {
    return this.runInOrder(() => { this.history.length = 0; });
  }
}