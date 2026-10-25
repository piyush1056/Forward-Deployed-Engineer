import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"; 

let clientInstance = null;

// Singleton client fetcher: Reuse single MCP Client instance
export async function getMcpClient() {
  if (clientInstance) return clientInstance;

  //HTTP Client Transport : HTTP Streamable Endpoint 
  const transport = new SSEClientTransport(new URL("http://localhost:8081/mcp"));

  const client = new Client(
    { name: "express-host-client", version: "2.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  clientInstance = client;
  return clientInstance;
}

// Helper 1: Discovers tools and formats them into OpenAI's tool format
export async function getOpenAITools() {
  const client = await getMcpClient();
  const result = await client.listTools(); 

  return result.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

// Helper: Calls tools/call on the MCP Server
export async function executeMcpTool(name, args) {
  const client = await getMcpClient();
  const response = await client.callTool({
    name,
    arguments: args
  });
  return response.content[0].text;
}
