import axios from "axios";
import fs from "fs/promises";
import path from "path";

import { extractCodeFromMessage } from "./utils.mjs";

export async function fetchMessageHistory(msg) {
  let refMsg = msg.reference?.messageId;
  const gptConversation = [];

  for (let i = 0; i < 30; i++) {
    if (!refMsg) break;
    console.log("fetchin message", refMsg);
    const refMsgObj = await loadReferenceMessage(msg, refMsg);
    refMsg = refMsgObj?.reference?.messageId;
    if (refMsgObj.author.bot) {
      console.log("author is bot", refMsgObj);
      // handle function call
      if (refMsgObj.content.startsWith("[function_call]")) {
        let [fn] = await extractCodeFromMessage(refMsgObj.content);
        fn = JSON.parse(fn);
        console.log("fn call found", fn);

        gptConversation.unshift({
          role: "assistant",
          content: null,
          function_call: {
            name: fn.name,
            arguments: JSON.stringify(fn.function_call.arguments),
          },
        });
        continue;
      } else if (refMsgObj.content.startsWith("[function_call_response]")) {
        console.log("parse function_call_response");
        const fn = refMsgObj.content.split(" ")[1];
        const [file] = await downloadAttachmentsFromMessage(refMsgObj);
        gptConversation.unshift({
          role: "function",
          name: fn,
          content: file,
        });
        continue;
      }
    }
    const regex = /^\[([^\n]*)\]/;
    let cleanedMessage = refMsgObj.content.replace(regex, "").trim();
    gptConversation.unshift({
      role: refMsgObj.author.bot ? "assistant" : "user",
      content: cleanedMessage,
    });
  }

  const content = msg.content.replace("!gpt", "").replace("!гпт", "");
  // Push the user's message to gptConversation
  gptConversation.push({
    role: "user",
    content,
  });

  return gptConversation;
}

export async function loadReferenceMessage(msg, messageId) {
  const refMsgObj = await msg?.channel?.messages.fetch(messageId);
  return refMsgObj;
}

const downloadAttachment = async (url, filename) => {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const filePath = path.join("/tmp", filename);
  await fs.writeFile(filePath, response.data);

  // Read the file content
  const fileContent = await fs.readFile(filePath);

  // delete the file immediately after reading
  try {
    await fs.unlink(filePath);
    console.log(`Deleted file: ${filePath}`);
  } catch (err) {
    console.error(`Error deleting file: ${filePath}`, err);
  }

  // return file content
  return fileContent.toString("utf8");
};

export async function downloadAttachmentsFromMessage(message) {
  let attachmentsArray = [];
  for (let attachment of message.attachments.values()) {
    let filename = attachment.name;
    let url = attachment.url;
    const fileContent = await downloadAttachment(url, filename);
    attachmentsArray.push(fileContent);
  }
  return attachmentsArray;
}
