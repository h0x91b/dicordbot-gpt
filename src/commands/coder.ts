// lib/coder-chatbot.js
import { Message, TextChannel } from "discord.js";
import { fetchMessageHistory } from "../unsorted-lib-to-be-deleted/discord";
import {
  getChatCompletion as getChatCompletionClaude,
  AnthropicModel,
} from "../services/anthropic";
import { getChatCompletion } from "../services/openai";
import { tempFile } from "../utils";
import * as utils from "util";
import { ChatCompletionRequestMessage } from "openai";
import { buildCoderPrompt } from "../prompts/coder";

export async function coderChatbotHandler(msg: Message) {
  msg.react("👀");
  let messages = await fetchMessageHistory(msg);

  messages.unshift({
    role: "system",
    content: [{ type: "text", text: buildCoderPrompt(msg) }],
  });

  const opts = {};
  let respMessage = "";
  let price = 0;
  const useClaude = true;
  let model: AnthropicModel = "claude-3-5-sonnet-20240620";

  for (let i = 0; i < 10; i++) {
    console.log(
      "coderChatbotHandler",
      utils.inspect(messages, false, null, true)
    );
    let r = useClaude
      ? await getChatCompletionClaude(model, messages, opts)
      : await getChatCompletion(
          model,
          messages as unknown as ChatCompletionRequestMessage[],
          opts
        );

    if (useClaude && "content" in r && Array.isArray(r.content)) {
      const text = r.content[0]?.text || ".";
      respMessage += text;
      console.log("Claude response", text);
      if (messages[messages.length - 1].role !== "assistant") {
        messages.push({
          role: "assistant",
          content: [],
        });
      }
      messages[messages.length - 1].content.push({
        type: "text",
        text: text,
      });
      price += r.price;
    } else if (
      !useClaude &&
      "choices" in r &&
      Array.isArray(r.choices) &&
      r.choices[0] &&
      r.choices[0].message
    ) {
      respMessage += r.choices[0].message.content || "";
      price += "price" in r ? r.price : 0;
      messages.push({
        role: "assistant",
        content: r.choices[0].message.content || "",
      });
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
    } else if (
      !useClaude &&
      "choices" in r &&
      Array.isArray(r.choices) &&
      r.choices[0] &&
      r.choices[0].finish_reason === "stop"
    ) {
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
    }
  }
}
