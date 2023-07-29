import { search } from "./chroma.mjs";
import { fetchMessageHistory } from "./discord.mjs";
import { getChatCompletionWithFunctions } from "./openai.mjs";
import { tempFile } from "./utils.mjs";
import chalk from "chalk";

const FUNCTIONS = {
  searchInDocs: {
    definition: {
      name: "searchInDocs",
      description:
        "Search for a query in the documentation. The search query should be a single detailed sentence.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query should be a single detailed sentence.",
          },
        },
        required: ["query"],
      },
    },
    handler: async ({ query }) => {
      console.log(chalk.cyan("[searchInDocs]"), { query });
      const res = (await search(query, 3)).map(
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
  return `Your are helpful assistant of programmer, you knowledge cutoff: 2021-09
Current-date: ${currentDate}

Your job is:
- To understand user request by searching in fresh documentation and if it is not found, ask user to provide more details.
- You must always search the fresh documentation before giving an answer to user
- You must provide to user source link of used search result

`;
}

export async function coderChatbotHandler(msg) {
  let messages = await fetchMessageHistory(msg);
  messages.unshift({
    role: "system",
    content: buildSytemMessage(msg),
  });

  const functions = Object.values(FUNCTIONS).map((f) => f.definition);

  for (let i = 0; i < 10; i++) {
    console.log("coderChatbotHandler", messages);
    let r = await getChatCompletionWithFunctions(
      "gpt-3.5-turbo-16k",
      messages,
      functions
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
