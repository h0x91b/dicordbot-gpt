import { Anthropic } from "@anthropic-ai/sdk";

export function getAnthropicClient() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 3,
  });
  return client;
}

/**
 *
 * @param {'claude-3-haiku-20240307'|'claude-3-sonnet-20240229'} model
 * @param {*} messages
 * @param {*} options
 * @returns
 */
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

  // Calculate price based on model and token usage
  let price;
  switch (model) {
    case "claude-3-sonnet-20240229":
      // Sonnet
      // Input: $3 / Million Tokens
      // Output: $15 / Million Tokens
      price =
        (chatCompletion.usage.input_tokens / 1000000) * 3 +
        (chatCompletion.usage.output_tokens / 1000000) * 15;
      break;
    case "claude-3-haiku-20240307":
      // Haiku
      // Input: $0.25 / MTok
      // Output: $1.25 / MTok
      price =
        (chatCompletion.usage.input_tokens / 1000000) * 0.25 +
        (chatCompletion.usage.output_tokens / 1000000) * 1.25;
      break;
    default:
      price = 999.99;
  }

  return {
    ...chatCompletion,
    price,
  };
}
