import { Anthropic } from "@anthropic-ai/sdk";

export function getAnthropicClient() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 3,
  });
  return client;
}

export async function getChatCompletion(model, messages, options = {}) {
  const client = getAnthropicClient();
  let system;
  const filteredMessages = messages.filter((message) => {
    if (message.role === "system") {
      system = message.content;
      return false;
    }
    return true;
  });

  const chatCompletion = await client.messages.create({
    ...options,
    model: model,
    system: system,
    messages: filteredMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    max_tokens: 750,
  });
  return chatCompletion;
}
