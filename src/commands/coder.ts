import { Message, TextChannel } from "discord.js";
import { fetchMessageHistory } from "../services/discord";
import {
  getChatCompletion as getChatCompletionClaude,
  AnthropicModel,
} from "../services/anthropic";
import { getChatCompletion, OpenAIModel } from "../services/openai";
import { tempFile } from "../utils";
import * as utils from "util";
import { ChatCompletionRequestMessage } from "openai";
import { buildCoderPrompt } from "../prompts/coder";
import fetch from "node-fetch"; // Импортируем fetch для выполнения запросов к DuckDuckGo

// Функция для поиска в DuckDuckGo
async function searchDuckDuckGo(query: string): Promise<string[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось выполнить поиск в DuckDuckGo");
  
  const data = await response.json();
  return data.RelatedTopics.map((topic: any) => topic.Text).filter(Boolean); // Возвращаем массив сниппетов
}

export async function coderChatbotHandler(msg: Message) {
  msg.react("👀");
  let messages = await fetchMessageHistory(msg);

  const system = await buildCoderPrompt(msg);

  messages.unshift({
    role: "system",
    content: [{ type: "text", text: system }],
  });

  const opts = {};
  let respMessage = "";
  let price = 0;
  const useClaude = true;
  let model: string = "claude-3-5-sonnet-20241022" as AnthropicModel;
  if (!useClaude) model = OpenAIModel.GPT_4O_2024_08_06;

  // Получаем запрос пользователя
  const userQuery = msg.content.replace("!coder ", ""); // Предполагается, что команда начинается с "!coder "

  // Выполняем поиск в DuckDuckGo
  const searchResults = await searchDuckDuckGo(userQuery);
  const searchContext = searchResults.join("\n"); // Объединяем результаты в строку

  for (let i = 0; i < 10; i++) {
    console.log(
      "coderChatbotHandler",
      utils.inspect(messages, false, null, true)
    );

    // Добавляем контекст поисковых результатов к сообщениям
    messages.push({
      role: "user",
      content: searchContext, // Добавляем контекст из DuckDuckGo
    });

    let r = useClaude
      ? await getChatCompletionClaude(model as AnthropicModel, messages, opts)
      : await getChatCompletion(
          model,
          messages as unknown as ChatCompletionRequestMessage[],
          opts
        );

    console.log("r", r);
    if (useClaude && "content" in r && Array.isArray(r.content)) {
      const text = r.content[0]?.text || ".";
      respMessage += text;
      console.log("Claude response", text);
      price += r.price;
    } else if (!useClaude && "content" in r) {
      respMessage += r.content || "";
      price += "price" in r ? r.price : 0;
    }

    if (useClaude && "stop_reason" in r && r.stop_reason === "end_turn") {
      console.log("Price", price);
      respMessage = `[${price.toFixed(4)}$ ${model}]\n` + respMessage;
      if (respMessage.length > 2000) {
        const t = await tempFile(respMessage);
        return await msg.reply({
          content: "Message too long, sending as file",
          files: [t],
        });
      }
      return await msg.reply({
        content: respMessage,
      });
    } else if (!useClaude && "content" in r) {
      console.log("Price", price);
      respMessage = `[${price.toFixed(4)}$ ${model}]\n` + respMessage;
      if (respMessage.length > 2000) {
        const t = await tempFile(respMessage);
        return await msg.reply({
          content:
            `[${price.toFixed(4)}$ ${model}]\n` +
            "Message too long, sending as file",
          files: [t],
        });
      }
      return await msg.reply({
        content: respMessage,
      });
    }
  }
}
