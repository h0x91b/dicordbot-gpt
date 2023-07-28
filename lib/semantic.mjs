import { Chroma } from "langchain/vectorstores/chroma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";

// Create docs with a loader
const loader = new TextLoader("README.md");
const docs = await loader.load();

console.log(docs);

// Create vector store and index the docs
const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
  collectionName: "a-test-collection",
  url: "http://127.0.0.1:8000",
});

// Search for the most similar document
const response = await vectorStore.similaritySearch("hello", 1);

console.log("response", response);

export default 1;
