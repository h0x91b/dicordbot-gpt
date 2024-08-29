// src/index.ts
import dotenv from "dotenv";
dotenv.config();
import { Events } from "discord.js";

import { initializeBot } from "./bot";
import { setupMessageHandler } from "./handlers/messageHandler";
import { setupReadyHandler } from "./handlers/readyHandler";

const client = initializeBot();

const readyHandler = setupReadyHandler(client);
client.on(Events.ClientReady, readyHandler);

const messageHandler = setupMessageHandler(client);
client.on(Events.MessageCreate, messageHandler);

client.login(process.env.DISCORD_BOT_TOKEN);
