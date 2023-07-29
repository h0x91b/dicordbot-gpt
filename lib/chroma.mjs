// src/lib/chroma.mjs
import { Chroma } from "langchain/vectorstores/chroma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import chalk from "chalk";

const cache = {};

/** @returns {Chroma} */
export function getVectorStore(collectionName = "discord-h0x91b") {
  if (cache[collectionName]) {
    return cache[collectionName];
  }
  const embeddings = new OpenAIEmbeddings({ verbose: true });
  const vectorStore = new Chroma(embeddings, {
    collectionName,
  });
  cache[collectionName] = vectorStore;
  return cache[collectionName];
}

export async function deleteDocumentsBySource(source) {
  const vectorStore = getVectorStore();
  const res = await vectorStore.similaritySearch("a", 100, {
    source: {
      $eq: source,
    },
  });
  console.log("deleteDocumentsBySource", res);
  vectorStore.delete({
    filter: {
      source: {
        $eq: source,
      },
    },
  });
}

export async function search(query, limit = 3) {
  const vectorStore = getVectorStore();
  const res = await vectorStore.similaritySearch(query, limit);
  console.log(
    chalk.cyan("[chroma.search]"),
    res.map(({ pageContent, metadata }) => ({
      pageContent: pageContent.substring(0, 100) + "...",
      metadata,
    }))
  );
  return res;
}
