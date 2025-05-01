import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatOllama } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { LLMGraphTransformer } from "@langchain/community/experimental/graph_transformers/llm";
import fs from "fs";

// Neo4j connection setup
const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASSWORD = 'testpassword';

// Initialize Neo4jGraph
const graph = new Neo4jGraph({
    url: NEO4J_URI,
    username: NEO4J_USER,
    password: NEO4J_PASSWORD,
});

// Initialize Ollama LLM
const llm = new ChatOllama({
    baseUrl: 'http://127.0.0.1:11434',
	model: 'llama3:8b',
});

const llmGraphTransformer = new LLMGraphTransformer({
	llm: llm,
  });
  
  const main = async () => {
	try {
	  const file = fs.readFileSync("./sample.txt", "utf-8");
  
	  const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
		chunkSize: 1000,
		chunkOverlap: 200,
	  });
	  const chunkedDocs = await splitter.createDocuments([file]);
	  console.log("Chunked documents:", chunkedDocs);
	  const graphDocuments =
		await llmGraphTransformer.convertToGraphDocuments(chunkedDocs);
	  console.log("Graph documents:", graphDocuments);
	  await graph.addGraphDocuments(graphDocuments);
	} catch (error) {
	  console.error(error);
	} finally {
	  process.exit(1);
	}
  };
  
  main();