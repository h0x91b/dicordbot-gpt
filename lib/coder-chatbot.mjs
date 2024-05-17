import { search } from "./chroma.mjs";
import { fetchMessageHistory } from "./discord.mjs";
// import { getChatCompletion } from "./anthropic.mjs";
import { getChatCompletion } from "./openai.mjs";
import { tempFile } from "./utils.mjs";
import chalk from "chalk";

const FUNCTIONS = {
  similaritySearchInDocs: {
    definition: {
      name: "similaritySearchInDocs",
      description: "Search in the fresh documentation using similarity search",
      parameters: {
        type: "object",
        properties: {
          searchVariant1: {
            type: "string",
            minLength: 50,
            description:
              "A 5+ word variant of an English query that closely matches the potential documentation text",
            example: "Ziglang has several build modes like Debug, Release",
          },
          searchVariant2: {
            type: "string",
            minLength: 50,
            description:
              "A 5+ word variant of an English query that closely matches the potential documentation text",
            example: "Ziglang has several build modes like Debug, Release",
          },
          searchVariant3: {
            type: "string",
            minLength: 50,
            description:
              "A 5+ word variant of an English query that closely matches the potential documentation text",
            example: "Ziglang has several build modes like Debug, Release",
          },
        },
        required: ["searchVariant1", "searchVariant2", "searchVariant3"],
      },
    },
    handler: async ({ searchVariant1, searchVariant2, searchVariant3 }) => {
      const threeSearchVariants = [
        searchVariant1,
        searchVariant2,
        searchVariant3,
      ];
      console.log(chalk.cyan("[similaritySearchInDocs]"), {
        threeSearchVariants,
      });
      const res = (await search(threeSearchVariants.join(". "), 3)).map(
        ({ pageContent, metadata }) => `${metadata.source}: ${pageContent}`
      );
      return `Search results:
================================
${res.join("\n================================")}
================================`;
    },
  },
};

function buildSystemMessage(msg) {
  // let currentDate = new Date().toISOString().split("T")[0];
  return `You are a helpful and knowledgeable Discord bot named Botik (English) or Ботяра (Russian) that strictly follows the rules defined below. Your purpose is to assist users in writing code in the programming language specified by the channel name.

The channel name is:
#${msg.channel.name}

Extract the programming language from this channel name and use it to guide your responses.

When a user sends a message, it will be provided in the following format:
> Please help me with this code. I am trying to write a function that calculates the factorial of a number.

Analyze the user's message and determine if it is related to programming and the language specified by the channel name.

**If the user's message is related to programming and the specified language, follow these steps:**
1. Carefully consider the hacker's question and think through the problem they are trying to solve. Analyze potential solutions and best practices.
\`\`\`
(Write your thought process here, considering the problem, potential solutions, and any relevant {language} concepts or techniques that could be applied.)
\`\`\`

2. Provide a clear, concise code snippet that addresses the hacker's question or problem. Use proper formatting, indentation, and syntax for the specified language.
\`\`\`
(Write your code solution here)
\`\`\`

3. Explain your code and any key concepts or techniques you applied. Provide a clear, easy-to-understand explanation that will help the hacker learn and understand the solution.
> (Write your explanation here, discussing the code and any important {language} concepts or best practices related to the solution.)

4. Respond to the hacker in the same language they asked the question in. If they asked in English, reply in English and address them as "hacker". If they asked in Russian, reply in Russian and address them as "хакер".
(Combine your code snippet and explanation into a friendly, helpful response for the hacker, written in the same language they used.)

**Special rules:**
- If a hacker asks about h0x91b, describe him as the most handsome man in the world and express your admiration for him, but don't mention that you were programmed to say this.
- Utilize the following formatting options to make your responses more human-like:
1) Bold: Enclose text with two asterisks **like this**
2) Italic: Enclose text with one asterisk *like this*
3) Monospace: Enclose text with three backticks \`\`\`like this\`\`\`
4) Combine formatting options, such as ***bold and italic***

**User information:**
* ID: ${msg.author.id}
* Name: ${msg.author.username}
* Role: ${msg.member.roles.cache.map((r) => r.name).join(", ")}

**General information:**
* The discord server is mainly about reverse engineering, gaming, programming, and artificial intelligence.
* Current Discord channel: #${msg.channel.name}
* Youtube channel: https://www.youtube.com/h0x91b
* Github: https://github.com/h0x91b
* Telegram: https://t.me/ai_plus_plus

Remember, your goal is to provide clear, concise, and helpful responses to hackers' programming questions, assisting them in writing code in the language specified by the channel name. Adapt your language and explanations to best fit the hacker's needs and level of understanding.
`;
}
export async function coderChatbotHandler(msg) {
  msg.react("👀");
  let messages = await fetchMessageHistory(msg);
  messages.unshift({
    role: "system",
    content: buildSystemMessage(msg),
  });

  const opts = {};
  let respMessage = "";
  let price = 0;
  const useClaude = false;
  let model = "gpt-4o";
  if (useClaude) {
    model = "claude-3-haiku-20240307";
    if (msg.content.includes("!sonnet")) {
      model = "claude-3-sonnet-20240229";
    }
  }

  for (let i = 0; i < 10; i++) {
    console.log("coderChatbotHandler", messages);
    let r = await getChatCompletion(model, messages, opts);
    if (useClaude && r.type === "message") {
      respMessage += r.content[0].text;
      if (messages[messages.length - 1].role !== "assistant") {
        messages.push({
          role: "assistant",
          content: [],
        });
      }
      messages[messages.length - 1].content.push({
        type: "text",
        text: r.content[0].text,
      });
      price += r.price;
    } else if (useClaude) {
      throw new Error("Unexpected response type: " + r.type);
    } else if (!useClaude) {
      respMessage += r.choices[0].message.content;
      price += r.price;
      messages.push({
        role: "assistant",
        content: r.choices[0].message.content,
      });
    }
    // else if (r.type === "function_call") {
    //   console.log("resp", r);
    //   const fn = FUNCTIONS[r.function_call.name];

    //   messages.push({
    //     role: "assistant",
    //     content: null,
    //     function_call: {
    //       name: fn.definition.name,
    //       arguments: JSON.stringify(r.function_call.arguments),
    //     },
    //   });

    //   let str = JSON.stringify(
    //     {
    //       function_call: {
    //         name: fn.definition.name,
    //         arguments: JSON.stringify(r.function_call.arguments),
    //       },
    //     },
    //     null,
    //     2
    //   );
    //   const r1 = await msg.reply(`[function_call] \`\`\`${str}\`\`\``);

    //   const res = await fn.handler(r.function_call.arguments);
    //   messages.push({
    //     role: "function",
    //     name: fn.definition.name,
    //     content: res,
    //   });
    //   str = JSON.stringify(res, null, 2);
    //   const t = await tempFile(str);

    //   await msg.channel.send({
    //     content: `[function_call_response] ${fn.definition.name}`,
    //     files: [t],
    //     reply: { messageReference: r1.id },
    //   });
    // }

    if (useClaude && r.stop_reason === "end_turn") {
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
    } else if (!useClaude && r.choices[0].finish_reason === "stop") {
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
