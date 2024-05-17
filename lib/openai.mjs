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

  const meta = chatCompletion.data;

  let price;
  switch (model) {
    case "gpt-3.5-turbo":
      price =
        (meta.usage.prompt_tokens / 1000000) * 1.5 +
        (meta.usage.completion_tokens / 1000000) * 2.0;
      break;
    case "gpt-3.5-turbo-16k":
      price =
        (meta.usage.prompt_tokens / 1000000) * 1.5 +
        (meta.usage.completion_tokens / 1000000) * 2.0;
      break;
    case "gpt-4":
      price =
        (meta.usage.prompt_tokens / 1000000) * 30.0 +
        (meta.usage.completion_tokens / 1000000) * 60.0;
      break;
    case "gpt-4-turbo":
      price =
        (meta.usage.prompt_tokens / 1000000) * 10.0 +
        (meta.usage.completion_tokens / 1000000) * 30.0;
      break;
    case "gpt-4o":
      price =
        (meta.usage.prompt_tokens / 1000000) * 5.0 +
        (meta.usage.completion_tokens / 1000000) * 15.0;
      break;
    default:
      price = 999.99;
      break;
  }

  return {
    ...chatCompletion.data,
    price,
  };
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
