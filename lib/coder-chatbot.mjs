import { search } from "./chroma.mjs";
import { fetchMessageHistory } from "./discord.mjs";
import { getChatCompletion } from "./anthropic.mjs";
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
  return `You are a bot in a Discord server called "h0x91b". Your purpose is to assist users in writing code in the programming language specified by the channel name.

The channel name is:
#${msg.channel.name}

Extract the programming language from this channel name and use it to guide your responses.

When a user sends a message, it will be provided in the following format:
> Please help me with this code. I am trying to write a function that calculates the factorial of a number.

Analyze the user's message and determine if it is related to programming and the language specified by the channel name.

**If the user's message is related to programming and the specified language, follow these steps:**
1. Carefully consider the user's question and think through the problem they are trying to solve. Analyze potential solutions and best practices.
\`\`\`
(Write your thought process here, considering the problem, potential solutions, and any relevant {language} concepts or techniques that could be applied.)
\`\`\`

2. Provide a clear, concise code snippet that addresses the user's question or problem. Use proper formatting, indentation, and syntax for the specified language.
\`\`\`
(Write your code solution here)
\`\`\`

3. Explain your code and any key concepts or techniques you applied. Provide a clear, easy-to-understand explanation that will help the user learn and understand the solution.
> (Write your explanation here, discussing the code and any important {language} concepts or best practices related to the solution.)

4. Respond to the user in the same language they asked the question in. If they asked in English, reply in English. If they asked in Russian, reply in Russian.
(Combine your code snippet and explanation into a friendly, helpful response for the user, written in the same language they used.)

Remember, your goal is to provide clear, concise, and helpful responses to users' programming questions, assisting them in writing code in the language specified by the channel name. Adapt your language and explanations to best fit the user's needs and level of understanding.
`;
}

export async function coderChatbotHandler(msg) {
  let messages = await fetchMessageHistory(msg);
  messages.unshift({
    role: "system",
    content: buildSystemMessage(msg),
  });

  const opts = {};
  let respMessage = "";
  let usage = {
    input_tokens: 0,
    output_tokens: 0,
  };

  for (let i = 0; i < 10; i++) {
    console.log("coderChatbotHandler", messages);
    let r = await getChatCompletion("claude-3-sonnet-20240229", messages, opts);
    if (r.type === "message") {
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
      usage.input_tokens += r.usage.input_tokens;
      usage.output_tokens += r.usage.output_tokens;
    } else if (r.type === "function_call") {
      console.log("resp", r);
      const fn = FUNCTIONS[r.function_call.name];

      messages.push({
        role: "assistant",
        content: null,
        function_call: {
          name: fn.definition.name,
          arguments: JSON.stringify(r.function_call.arguments),
        },
      });

      let str = JSON.stringify(
        {
          function_call: {
            name: fn.definition.name,
            arguments: JSON.stringify(r.function_call.arguments),
          },
        },
        null,
        2
      );
      const r1 = await msg.reply(`[function_call] \`\`\`${str}\`\`\``);

      const res = await fn.handler(r.function_call.arguments);
      messages.push({
        role: "function",
        name: fn.definition.name,
        content: res,
      });
      str = JSON.stringify(res, null, 2);
      const t = await tempFile(str);

      await msg.channel.send({
        content: `[function_call_response] ${fn.definition.name}`,
        files: [t],
        reply: { messageReference: r1.id },
      });
    }

    if (r.stop_reason === "end_turn") {
      /* 
      Sonnet
      Input: $3 / Million Tokens
      Output: $15 / Million Tokens
      */
      console.log("Usage", usage);
      const price = (
        (usage.input_tokens / 1000000) * 3 +
        (usage.output_tokens / 1000000) * 15
      ).toFixed(3);
      respMessage = `[${price}$ sonnet]\n` + respMessage;
      while (respMessage.length > 2000) {
        await msg.reply({
          content: respMessage,
        });
        respMessage = respMessage.slice(0, 2000);
      }
      return await msg.reply({
        content: respMessage,
      });
    }
  }
}
