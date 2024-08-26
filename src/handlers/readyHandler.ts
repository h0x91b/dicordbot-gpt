// src/handlers/readyHandler.ts
import { Client } from "discord.js";

export function setupReadyHandler(client: Client) {
  return async function readyHandler() {
    if (client.user) {
      console.log(`Logged in as ${client.user.tag}!`);
    }

    console.log("guilds", client.guilds);
    let availableDiscordChannels: string[] = [];

    // Get all available channels
    client.guilds.cache.forEach((guild) => {
      console.log(`Guild: ${guild.name}`);
      guild.channels.cache.forEach((channel) => {
        if (channel.type === 0) {
          availableDiscordChannels.push(`#${channel.name} - <#${channel.id}>`);
        }
      });
    });
    console.log(
      "availableDiscordChannels",
      availableDiscordChannels.join("\n")
    );

    // Hardcoded channels (kept as is from the original code)
    availableDiscordChannels = [
      "#job-offers - <#979685559654027295>",
      "#games - <#671455728027959322>",
      "#cheat-engine - <#979712419481939999>",
      "#ai-general-talk - <#989926403296337930>",
      "#ai-news-and-links - <#1086196398749401149>",
      "#welcome-log - <#979709375428067328>",
      "#reversing-private - <#825060891510308887>",
      "#general-chat-eng - <#605806276986929156>",
      "#off-topic - <#584036601101811717>",
      "#useful-tools - <#711183558823116822>",
      "#c-sharp-dotnet - <#1019117646337277962>",
      "#ida - <#979712336153681970>",
      "#unity - <#1016016146694152252>",
      "#gta-2 - <#589057145505447947>",
      "#general-chat-rus - <#605806197362130944>",
      "#rules - <#979685480763363398>",
      "#3d-print-and-craft - <#749224717470138428>",
      "#gta-4 - <#1015386490836107455>",
      "#blender - <#642781641886007337>",
      "#image-generation - <#1086196670053761064>",
      "#ai-farcry3 - <#1087396339169640518>",
      "#information - <#979716935149318224>",
      "#ghidra - <#586606271810109441>",
      "#unreal-engine - <#1016016179560726638>",
    ];

    // You might want to export this list or use it in some way
    return availableDiscordChannels;
  };
}
