import { search } from "./chroma.mjs";
import { fetchMessageHistory } from "./discord.mjs";
import { getChatCompletionWithFunctions } from "./openai.mjs";
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

function buildSytemMessage(msg) {
  let currentDate = new Date().toISOString().split("T")[0];
  return `As an AI programmer assistant, you know things up to September 2021. Use utility functions to check the newest APIs before answering a user.

Today's date is ${currentDate}

**Duties:**

- Analyze the user's question, then print out on how you understood the question and what 3 variants of search (rules for variants defined below) you are going to perform, then wait for user confirmation
  - Form a 5+ word that should match potential documentation text based on user input. Use key terms such as library and function names. It is ideal to match the documentation exactly.
  - query must be in English
- After user confirmation use search function to get fresh documentation, then read search results, identify relevant parts, then write full and clear answer to the question in the language user uses
- Give the user the link of the search result you used

`;
}

export async function coderChatbotHandler(msg) {
  let messages = await fetchMessageHistory(msg);
  messages.unshift({
    role: "system",
    content: buildSytemMessage(msg),
  });

  const functions = Object.values(FUNCTIONS).map((f) => f.definition);
  const opts = {
    function_call: "none",
  };

  for (let i = 0; i < 10; i++) {
    console.log("coderChatbotHandler", messages);
    if (messages.length > 3) {
      opts.function_call = "auto";
    }
    let r = await getChatCompletionWithFunctions(
      "gpt-3.5-turbo-16k",
      messages,
      functions,
      opts
    );
    if (r.type === "message") {
      return await msg.reply({
        content: r.content,
      });
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
  }
}
