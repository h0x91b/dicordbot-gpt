import { Anthropic } from "@anthropic-ai/sdk";
import sharp from "sharp";
import { calculateImageTokens } from "../utils";
import { MessageParam } from "@anthropic-ai/sdk/resources";

export function getAnthropicClient() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 3,
  });
  return client;
}

export type AnthropicModel =
  | "claude-3-haiku-20240307"
  | "claude-3-5-sonnet-20240620"
  | "claude-3-opus-20240229";

interface ContentBlock {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
  };
}

interface Message {
  role: string;
  content: string | ContentBlock[];
}

export async function getChatCompletion(
  model: AnthropicModel,
  messages: Message[],
  options: Partial<Anthropic.MessageCreateParams> = {}
) {
  const client = getAnthropicClient();
  let system: string | ContentBlock[] = "Helpful assistant";
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
          message.content.map(async (content: ContentBlock) => {
            if (content.type === "image" && content.source?.type === "base64") {
              try {
                const buffer = Buffer.from(content.source.data || "", "base64");
                const metadata = await sharp(buffer).metadata();
                const width = metadata.width;
                const height = metadata.height;
                if (width && height) {
                  const tokens = calculateImageTokens(width, height);
                  imageTokens += tokens;
                  console.log(
                    `Image size: ${width}x${height}, Tokens: ${tokens}`
                  );
                }
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
      content: (Array.isArray(message.content)
        ? message.content
        : [{ type: "text", text: message.content }]) as ContentBlock[],
    })) as MessageParam[],
    max_tokens: 750,
  });

  // Type assertion to help TypeScript understand the structure
  const completionWithUsage = chatCompletion as Message & {
    usage: { input_tokens: number; output_tokens: number };
  };

  // Теперь добавляем токены изображений к входным токенам
  const totalInputTokens = completionWithUsage.usage.input_tokens + imageTokens;
  console.log("Total input tokens:", {
    totalInputTokens,
    imageTokens,
    rawUsage: completionWithUsage.usage,
  });

  // Расчет цены с учетом токенов изображений
  let price: number;
  switch (model) {
    case "claude-3-5-sonnet-20240620":
      price =
        (totalInputTokens / 1000000) * 3 +
        (completionWithUsage.usage.output_tokens / 1000000) * 15;
      break;
    case "claude-3-haiku-20240307":
      price =
        (totalInputTokens / 1000000) * 0.25 +
        (completionWithUsage.usage.output_tokens / 1000000) * 1.25;
      break;
    default:
      price = 999.99;
  }

  return {
    ...completionWithUsage,
    price,
    usage: {
      ...completionWithUsage.usage,
      input_tokens: totalInputTokens,
    },
    rawUsage: completionWithUsage.usage,
  };
}
