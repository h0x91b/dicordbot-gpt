// lib/indexer.mjs
import chalk from "chalk";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { TokenTextSplitter } from "langchain/text_splitter";
import { getEncoding } from "js-tiktoken";
import { getVectorStore, search } from "./chroma.mjs";
import { promises as fs } from "fs";

// import { EmbedBuilder } from "discord.js";

// https://ziglang.org/documentation/0.10.1/ main#contents
// this function will download and split the document to chunks
export async function loadDocument(url, selectors = ["body"]) {
  console.log(chalk.cyan("[indexer.loadDocument]"), { url, selectors });
  const webLoader = new CheerioWebBaseLoader(url);
  const rawDocs = [];
  for (const selector of selectors) {
    webLoader.selector = selector;
    const tmpDocs = await webLoader.load();
    tmpDocs.forEach((doc) => {
      doc.metadata.selector = selector;
    });
    rawDocs.push(...tmpDocs);
  }
  // console.log(chalk.cyan("rawDocs"), rawDocs);

  return rawDocs;
}

export async function chunkDocument(msg, url, selectors = ["body"]) {
  const rawDocs = await loadDocument(url, selectors);
  const enc = getEncoding("cl100k_base");
  let chars = 0;
  let tokens = 0;
  rawDocs.forEach(({ pageContent }) => {
    chars += pageContent.length;
    tokens += enc.encode(pageContent).length;
  });

  const tokenSplitter = new TokenTextSplitter({
    encodingName: "cl100k_base",
    chunkSize: 1000,
    chunkOverlap: 350,
  });

  const splitDocs = await tokenSplitter.splitDocuments(rawDocs);
  splitDocs.forEach((doc, part) => {
    doc.metadata.part = part;
    doc.metadata.date = new Date().toISOString();
  });
  console.log("Split documents", splitDocs);

  const status = `${rawDocs.length} documents loaded, total ${chars} length, ${tokens} tokens total, split into ${splitDocs.length} chunks`;
  await msg.reply(status);
  return splitDocs;
}

export async function indexDocument(msg, url, selectors = ["body"]) {
  console.log(chalk.cyan("[indexer.indexDocument]"), { url, selectors });
  const chunks = await chunkDocument(msg, url, selectors);
  console.log("chunks", chunks);
  const vectorStore = getVectorStore();
  await vectorStore.addDocuments(chunks);
  msg.reply(`Indexing of ${url} is complete`);
}

export async function searchDocument(msg, query) {
  const res = await search(query, 5);
  console.log(chalk.cyan("[indexer.searchDocument]"), res);

  // https://discordjs.guide/popular-topics/embeds.html#using-the-embed-constructor
  // const exampleEmbed = new EmbedBuilder()
  //   .setColor(0x0099ff)
  //   .setTitle("Some title")
  //   .setURL("https://discord.js.org/")
  //   .setAuthor({
  //     name: "Botik",
  //     iconURL: "https://i.imgur.com/AfFp7pu.png",
  //   })
  //   .setDescription("Some description here");
  // await msg.reply({
  //   content: `Found ${res.length} results`,
  //   embeds: [exampleEmbed],
  // });
  const codeFile = `/tmp/output.${Math.floor(Math.random() * 1000000)}.json`;
  setTimeout(() => {
    console.log("delete temp file", codeFile);
    fs.unlink(codeFile);
  }, 5000);
  await fs.writeFile(codeFile, JSON.stringify(res, null, 2));
  await msg.reply({
    content: `Found ${res.length} results`,
    files: [codeFile],
  });
}
