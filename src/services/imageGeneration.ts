// src/services/imageGeneration.ts
import { Message } from "discord.js";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

let fluxSchnell: any = null;

export async function handleImageGeneration(msg: Message): Promise<void> {
  try {
    await msg.react("👀");

    const prompt = msg.content.replace(/^!img(age)?/, "").trim();
    if (!prompt) {
      await msg.reply("Please provide a prompt for the image generation.");
      return;
    }

    if (!fluxSchnell) {
      fluxSchnell = await replicate.models.get(
        "black-forest-labs",
        "flux-schnell"
      );
      console.log({ fluxSchnell });
    }

    const input = { prompt, disable_safety_checker: true };
    const output = await replicate.run(
      `black-forest-labs/flux-schnell:${fluxSchnell.latest_version.id}`,
      {
        input,
      }
    );

    if (!output || !Array.isArray(output) || !output[0]) {
      throw new Error("Failed to generate image.");
    }

    await msg.reply({
      content: `[black-forest-labs/flux-schnell 0.03$] Image generated with prompt: ${prompt}`,
      files: [output[0]],
    });
  } catch (error: unknown) {
    console.error("Error in handleImageGeneration:", error);
    await msg.reply(
      `An error occurred while generating the image: ${
        (error as Error).message
      }`
    );
  } finally {
    try {
      await msg.reactions.removeAll();
    } catch (error) {
      console.error("Error removing reactions:", error);
    }
  }
}
