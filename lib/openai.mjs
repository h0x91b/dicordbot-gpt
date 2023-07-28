// lib/openai.mjs
import chalk from "chalk";
import { Configuration, OpenAIApi } from "openai";

export function getOpenAI() {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  return openai;
}

export async function getChatCompletion(model, messages, options = {}) {
  const openai = getOpenAI();
  const chatCompletion = await openai.createChatCompletion({
    ...options,
    model: model,
    messages: messages,
  });
  return chatCompletion.data.choices[0].message.content;
}

export async function getChatCompletionWithFunctions(
  model,
  messages,
  functions = [],
  options = {}
) {
  const openai = getOpenAI();
  const chatCompletion = await openai.createChatCompletion({
    ...options,
    model: model,
    messages: messages,
    functions: functions,
  });
  let r = chatCompletion.data.choices[0];
  if (r.finish_reason === "function_call") {
    console.log(chalk.gray("function_call"), r.message.function_call);
    let args;
    try {
      args = JSON.parse(r.message.function_call.arguments);
    } catch (e) {
      console.log(chalk.red("Error parsing JSON arguments, retry"));
      return getChatCompletionWithFunctions(
        model,
        messages,
        functions,
        options
      );
    }
    return {
      type: "function_call",
      function_call: {
        name: r.message.function_call.name,
        arguments: args,
      },
    };
  }
  return {
    type: "message",
    content: r.message.content,
  };
}
