import chalk from "chalk";
import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
} from "openai";

export enum OpenAIModel {
  GPT_3_5 = "gpt-3.5-turbo",
  GPT_3_5_16K = "gpt-3.5-turbo-16k",
  GPT_4 = "gpt-4",
  GPT_4_TURBO = "gpt-4-turbo",
  GPT_4O = "gpt-4o",
  GPT_4O_2024_08_06 = "gpt-4o-2024-08-06",
  GPT_4O_MINI_2024_07_18 = "gpt-4o-mini-2024-07-18",
}

export function getOpenAI(): OpenAIApi {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  return new OpenAIApi(configuration);
}

interface ChatCompletionOptions extends Partial<CreateChatCompletionRequest> {}

export async function getChatCompletion(
  model: string,
  messages: ChatCompletionRequestMessage[],
  options: ChatCompletionOptions = {}
): Promise<{ content: string; price: number }> {
  const openai = getOpenAI();
  const chatCompletion = await openai.createChatCompletion({
    ...options,
    model,
    messages,
  });

  const meta = chatCompletion.data;
  const usage = meta.usage;

  if (!usage) {
    throw new Error("Usage data is missing from the API response");
  }

  let price = calcOpenAIPrice(model, usage);

  const content = meta.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in the API response");
  }

  return {
    content,
    price,
  };
}

export function calcOpenAIPrice(
  model: string,
  usage: { prompt_tokens: number; completion_tokens: number }
) {
  let price: number;
  switch (model) {
    case OpenAIModel.GPT_3_5:
    case OpenAIModel.GPT_3_5_16K:
      price =
        (usage.prompt_tokens / 1000000) * 1.5 +
        (usage.completion_tokens / 1000000) * 2.0;
      break;

    case OpenAIModel.GPT_4:
      price =
        (usage.prompt_tokens / 1000000) * 30.0 +
        (usage.completion_tokens / 1000000) * 60.0;
      break;

    case OpenAIModel.GPT_4_TURBO:
      price =
        (usage.prompt_tokens / 1000000) * 10.0 +
        (usage.completion_tokens / 1000000) * 30.0;
      break;

    case OpenAIModel.GPT_4O:
      price =
        (usage.prompt_tokens / 1000000) * 5.0 +
        (usage.completion_tokens / 1000000) * 15.0;
      break;

    case OpenAIModel.GPT_4O_2024_08_06:
      price =
        (usage.prompt_tokens / 1000000) * 2.5 +
        (usage.completion_tokens / 1000000) * 10.0;
      break;

    case OpenAIModel.GPT_4O_MINI_2024_07_18:
      price =
        (usage.prompt_tokens / 1000000) * 0.3 +
        (usage.completion_tokens / 1000000) * 1.2;
      break;

    default:
      price = 999.99;
      break;
  }
  return price;
}

interface FunctionCallResult {
  type: "function_call";
  function_call: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface MessageResult {
  type: "message";
  content: string;
}

type ChatCompletionWithFunctionsResult = FunctionCallResult | MessageResult;

export async function getChatCompletionWithFunctions(
  model: string,
  messages: ChatCompletionRequestMessage[],
  functions: CreateChatCompletionRequest["functions"] = [],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionWithFunctionsResult> {
  const openai = getOpenAI();
  const chatCompletion = await openai.createChatCompletion({
    ...options,
    model,
    messages,
    functions,
  });

  const r = chatCompletion.data.choices[0];

  if (r?.finish_reason === "function_call" && r.message?.function_call) {
    console.log(chalk.gray("function_call"), r.message.function_call);
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(r.message.function_call.arguments || "{}");
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
        name: r.message.function_call.name || "",
        arguments: args,
      },
    };
  }

  const content = r?.message?.content;
  if (!content) {
    throw new Error("No content in the API response");
  }

  return {
    type: "message",
    content,
  };
}
