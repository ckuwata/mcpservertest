import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import neo4j from "neo4j-driver";
import express from "express";
import cors from "cors";

const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, });
// Neo4j connection setup
const driver = neo4j.driver(
	"bolt://localhost:7687",
	neo4j.auth.basic("neo4j", "testpassword")
);
const session = driver.session();

// Create MCP server instance
const server = new McpServer({
	name: "graph-rag-server",
	version: "1.0.0",
	capabilities: {
		tools: {},
	},
});

// Helper function to query Neo4j
async function queryNeo4j(query: string, params: Record<string, any> = {}) {
	try {
		const result = await session.run(query, params);
		return result.records.map((record) => record.toObject());
	} catch (error) {
		console.error("Neo4j query error:", error);
		throw new Error("Failed to query Neo4j");
	}
}

// Register a tool to retrieve related nodes
server.tool(
	"get-related-nodes",
	"Retrieve related nodes from the graph",
	{
		name: z.string().describe("The ID of the node to retrieve related nodes for"),
	},
	async ({ name }) => {
		const query = `MATCH (n)-[r]->(m) WHERE n.name = $name RETURN m`;
		const results = await queryNeo4j(query, { name });
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(results, null, 2),
				},
			],
		};
	}
);

// Register a tool to add a new relationship
server.tool(
	"add-relationship",
	"Add a relationship between two nodes",
	{
		fromName: z.string().describe("The ID of the source node"),
		toName: z.string().describe("The ID of the target node"),
		relationshipType: z.string().describe("The type of the relationship"),
	},
	async ({ fromName, toName, relationshipType }) => {
		const query = `MATCH (a), (b) WHERE a.name = $fromName AND b.name = $toName CREATE (a)-[r:${relationshipType}]->(b) RETURN r`;
		const results = await queryNeo4j(query, {
			fromNodeId: fromName,
			toNodeId: toName,
			relationshipType,
		});
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(results, null, 2),
				},
			],
		};
	}
);

server.tool(
	"add-node",
	"Add a new node to the graph",
	{
		label: z.string().describe("The label of the new node"),
		name: z.string().describe("The name of the new node"),
		properties: z.object({}).describe("The properties of the new node"),
	},
	async ({ label, name, properties }) => {
		const query = `CREATE (n:${label} {name: $name, ...$properties}) RETURN n`;
		const results = await queryNeo4j(query, {
			name,
			properties
		});
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(results, null, 2),
				},
			],
		};
	}
);

const app = express();
app.use(express.json());

// Enable CORS
app.use(cors());

// Define OpenAPI specification
const openApiSpec = {
    openapi: "3.0.0",
    info: {
        title: "Graph RAG Server API",
        version: "1.0.0",
        description: "API documentation for the Graph RAG Server",
    },
    paths: {
        "/tools/get-related-nodes": {
            post: {
                summary: "Retrieve related nodes from the graph",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    name: {
                                        type: "string",
                                        description: "The ID of the node to retrieve related nodes for",
                                    },
                                },
                                required: ["name"],
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "A list of related nodes",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        // Add other tools here as needed
		"/tools/add-relationship": {
			post: {
				summary: "Add a relationship between two nodes",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									fromName: {
										type: "string",
										description: "The ID of the source node",
									},
									toName: {
										type: "string",
										description: "The ID of the target node",
									},
									relationshipType: {
										type: "string",
										description: "The type of the relationship",
									},
								},
								required: ["fromName", "toName", "relationshipType"],
							},
						},
					},
				},
				responses: {
					200: {
						description: "The created relationship",
						content: {
							"application/json": {
								schema: {
									type: "object",
								},
							},
						},
					},
				},
			},
		},
		// add nodeのopen api schema
		"/tools/add-node": {
			post: {
				summary: "Add a new node to the graph",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									label: {
										type: "string",
										description: "The label of the new node",
									},
									name: {
										type: "string",
										description: "The name of the new node",
									},
									properties: {
										type: "object",
										description: "The properties of the new node",
										additionalProperties: true,
									},
								},
								required: ["label", "name", "properties"],
							},
						},
					},
				},
				responses: {
					200: {
						description: "The created node",
						content: {
							"application/json": {
								schema: {
									type: "object",
								},
							},
						},
					},
				},
			},
		},
					
    },
};

// Add /openapi.json endpoint
app.get("/openapi.json", (req, res) => {
    res.json(openApiSpec);
});

const setupServer = async () => {
	await server.connect(transport);
};


const PORT = process.env.MCP_SERVER_PORT || "3000";

setupServer()
	.then(() => {
		app.listen(Number.parseInt(PORT), () => {
			console.log("Server is running on http://localhost:" + PORT);
		});
	})
	.catch((err) => {
		console.error("Error setting up server:", err);
		process.exit(1);
	});

process.on("SIGINT", async () => {
	console.log("Shutting down server...");
	try {
		console.log(`Closing transport`);
		await transport.close();
	} catch (error) {
		console.error(`Error closing transport:`, error);
	}

	await server.close();
	console.log("Server shutdown complete");
	process.exit(0);
});