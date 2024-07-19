import { Anthropic } from "@anthropic-ai/sdk";
import sharp from "sharp";
import { calculateImageTokens } from "./image-processing.mjs";

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

  let imageTokens = 0;
  await Promise.all(
    filteredMessages.map(async (message) => {
      if (Array.isArray(message.content)) {
        await Promise.all(
          message.content.map(async (content) => {
            if (content.type === "image" && content.source.type === "base64") {
              try {
                const buffer = Buffer.from(content.source.data, "base64");
                const metadata = await sharp(buffer).metadata();
                const width = metadata.width;
                const height = metadata.height;
                const tokens = calculateImageTokens(width, height);
                imageTokens += tokens;
                console.log(
                  `Image size: ${width}x${height}, Tokens: ${tokens}`
                );
              } catch (error) {
                console.error("Error processing image:", error);
              }
            }
          })
        );
      }
    })
  );

  const chatCompletion = await client.messages.create({
    ...options,
    model: model,
    system: system,
    messages: filteredMessages.map((message) => ({
      role: message.role,
      content: Array.isArray(message.content)
        ? message.content
        : [{ type: "text", text: message.content }],
    })),
    max_tokens: 750,
  });

  // Теперь добавляем токены изображений к входным токенам
  const totalInputTokens = chatCompletion.usage.input_tokens + imageTokens;
  console.log("Total input tokens:", { totalInputTokens, imageTokens });

  // Расчет цены с учетом токенов изображений
  let price;
  switch (model) {
    case "claude-3-5-sonnet-20240620":
      price =
        (totalInputTokens / 1000000) * 3 +
        (chatCompletion.usage.output_tokens / 1000000) * 15;
      break;
    case "claude-3-sonnet-20240229":
      price =
        (totalInputTokens / 1000000) * 3 +
        (chatCompletion.usage.output_tokens / 1000000) * 15;
      break;
    case "claude-3-haiku-20240307":
      price =
        (totalInputTokens / 1000000) * 0.25 +
        (chatCompletion.usage.output_tokens / 1000000) * 1.25;
      break;
    default:
      price = 999.99;
  }

  return {
    ...chatCompletion,
    price,
    usage: {
      ...chatCompletion.usage,
      input_tokens: totalInputTokens,
    },
  };
}
