import chalk from "chalk";
import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  ChatCompletionResponseMessage,
} from "openai";

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

  let price: number;
  switch (model) {
    case "gpt-3.5-turbo":
    case "gpt-3.5-turbo-16k":
      price =
        (usage.prompt_tokens / 1000000) * 1.5 +
        (usage.completion_tokens / 1000000) * 2.0;
      break;
    case "gpt-4":
      price =
        (usage.prompt_tokens / 1000000) * 30.0 +
        (usage.completion_tokens / 1000000) * 60.0;
      break;
    case "gpt-4-turbo":
      price =
        (usage.prompt_tokens / 1000000) * 10.0 +
        (usage.completion_tokens / 1000000) * 30.0;
      break;
    case "gpt-4o":
      price =
        (usage.prompt_tokens / 1000000) * 5.0 +
        (usage.completion_tokens / 1000000) * 15.0;
      break;
    default:
      price = 999.99;
      break;
  }

  const content = meta.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in the API response");
  }

  return {
    content,
    price,
  };
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
