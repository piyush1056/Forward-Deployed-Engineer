# Day 14: Model Context Protocol (MCP)

---

## 1. The Starting Point: Tool Calling in a Single Application

When an LLM runs, it only knows what it was trained on. It doesn't know live data, today's date, or the contents of our local files.

To fix this, we give the model a tool (a local JavaScript/TypeScript function):

1. The user asks a question.
2. The LLM analyzes the question, decides to call a tool, and formats the necessary arguments.
3. Your backend code receives the tool call and executes the actual function.
4. The result from the function is sent back to the LLM.
5. The LLM generates a final, natural-language answer.

```text
User 
  │ ("What is the weather in Delhi?")
  ▼
AI App (Node.js/LLM) 
  │ (Decides: run getWeather({ city: "Delhi" }))
  ▼
Local Function / Tool ──► Weather API ──► Result
  │
  ▼
AI App (LLM formats output) ──► User ("It's 28°C and sunny.")
```

For a single app running isolated tasks, this direct integration works fine.   

---

## 2. First Principles: The N x M Integration Problem

As systems grow, direct tool integration breaks down.

Imagine an organization maintains 5 backend capabilities:
1. `getCourseDetails`
2. `searchVideos`
3. `createStudentTicket`
4. `getStudentProgress`
5. `scheduleMentorship`

Multiple AI applications want to use these same capabilities: a **Web Chatbot**, a **VS Code Extension**, an **Internal Admin Agent**, a **CLI Assistant**, and a **Support Bot**.

### The Architecture Without MCP

```text
[Web Chatbot]        ──(Custom Glue Code A)──┐
[VS Code AI]         ──(Custom Glue Code B)──┼──► [Task / Course Service]
[Internal Admin Bot] ──(Custom Glue Code C)──┘
```

If we have $N$ AI clients and $M$ internal services, we end up writing $N \times M$ custom integration adapters.

### Why We Need a Solution
- **Without a standard:** Every single AI app must individually figure out: Where does the endpoint live? What parameters are required? What JSON schema does it expect? How is authentication handled?   
- **What breaks:** If you change an argument name in your Node.js service, every single client adapter across all apps breaks and requires a code rewrite.

---

## 3. The Solution: MCP as the "USB-C" of AI

In hardware, we do not build unique sockets for every keyboard, mouse, and external drive; we use USB. In web backends, we use HTTP/REST.

**Model Context Protocol (MCP)** is an open standard that allows AI applications to connect to external data, tools, and prompts through a unified protocol.

```text
[AI App A] ──┐
[AI App B] ──┼──► [ MCP Protocol ] ──► [ MCP Server (Node/Express backend) ]
[AI App C] ──┘
```

We build the capability once as an MCP Server. Any AI client that speaks MCP can instantly discover and use it.

---

## 4. MCP Server vs. LLM

> **Crucial Rule:** An MCP Server does not contain an LLM.   

- An MCP Server is standard backend software (e.g., a lightweight Node.js/TypeScript service).   
- It contains pure business logic, database queries, or third-party API calls.   
- The LLM lives inside the MCP Host (the consumer application).

```text
MCP Server  = Provides capabilities & context (Does NOT think)
AI Host/LLM = The brain that decides WHEN to call those capabilities
```

---

## 5. Tool Calling vs. MCP

These two concepts work together rather than competing with each other:

- **MCP** is a protocol for **communication and discovery**. It defines *how* systems talk to each other.
- **Tool Calling** is a **feature of LLMs** (decision-making capability). It defines *what* the LLM can do: which function to run, and with what arguments.

In a full MCP architecture, the MCP Server exposes a list of capabilities. The LLM (running in the MCP Host) uses tool calling to invoke those capabilities. The MCP Server translates those tool calls into real backend actions.

---

## 6. The 3 Core Components of MCP Architecture

```text
┌─────────────────────────────────────────────────────────┐
│ MCP HOST (e.g., Claude Desktop, Cursor, Custom Node App)│
│                                                         │
│   ┌───────┐            ┌────────────┐                   │
│   │  LLM  │ ◄────────► │ MCP CLIENT │                   │
│   └───────┘            └─────┬──────┘                   │
└──────────────────────────────┼──────────────────────────┘
                               │ MCP Protocol
                               ▼
┌─────────────────────────────────────────────────────────┐
│ MCP SERVER (Node.js service exposing tools/data)        │
│                                                         │
│  [tools/list]   [tools/call]   [resources]   [prompts]  │
│       │              │              │            │      │
│  Database API    REST API       Filesystem   Git Repo   │
└─────────────────────────────────────────────────────────┘
```

### The MCP Architecture Flow

```text
              +-----------------------+               +-----------------------+
              |       MCP HOST        |               |      MCP SERVER       |
[ USER ] ───► |                       | ────(MCP)───► |                       |
              |         LLM           |               |  createTask()         |
              |          |            |               |  listTasks()          |
              |      MCP CLIENT       |               |  completeTask()       |
              +-----------------------+               +-----------------------+
```

- **MCP Host:** The main application that orchestrates the run. It has the thinking engine (LLM) and uses MCP Clients to request data, run tools, and access resources. Example MCP Hosts include: Cursor, Claude Desktop, or custom Node.js apps.
- **MCP Client:** The built-in adapter inside the Host that speaks the MCP protocol. It translates the Host’s internal requests into MCP messages.
- **MCP Server:** The standalone program exposing tools, resources, and prompt templates to any connected client.

---

## 7. The Three MCP Primitives

MCP standardizes three distinct capabilities: 

```text
Primitives:
├── 1. Tools     ──► "Do something"      (Model-Controlled)
├── 2. Resources ──► "Know something"    (App-Controlled)
└── 3. Prompts   ──► "Preset workflows"  (User-Controlled)
```

### 1. Tools (Action Execution)
- **What it is:** These are **functions** that the model can call to execute an action or fetch fresh data. The LLM decides *when* to use a tool based on the user's request.
- **Role:** Allows the model to interact with the external world, manipulate data, or run external code.
- **Example:** `get_current_weather`, `create_github_issue`, `run_database_query`.
- **Format:** Exposes a JSON Schema specifying required parameters:

```json
{
  "name": "createTask",
  "description": "Creates a new task in the database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "priority": { "type": "string", "enum": ["low", "high"] }
    },
    "required": ["title"]
  }
}
```

### 2. Resources (Context & Data)
- **What it is:** Read-only data sources identified by URI schemas (e.g., `file:///logs/app.log`, `postgres://users/schema`, `company://docs/refund-policy`).   
- **Control:** Application-controlled. The client app attaches context without needing the LLM to make a runtime tool call.   
- **Tool vs. Resource:**
  - **Tool** = "What action can I execute?" (e.g., `fetchCustomerOrder(id)`)   
  - **Resource** = "What context can I read?" (e.g., `orders://current-cart`)   
- **Resource vs. RAG:**
  - RAG solves semantic chunking and similarity search across thousands of unstructured docs.   
  - Resources provide direct URI-addressable context. *(Note: An MCP Server can expose a RAG search as a Tool).*

### 3. Prompts (Workflow & Behavior Templates)
- **What it is:** Pre-defined prompt templates that standardize the model’s behavior, output format, or multi-step workflows (e.g., `/code-review`, `/generate-release-notes`).
- **Role:** Ensures consistency and structure across different applications or tasks.
- **Control:** User-controlled. The end user or the app developer chooses which prompt to use for a given task, not the LLM.
- **Example:** A prompt template for summarizing a meeting, formatting an email, or converting JSON to XML.

---

## 8. Complete Lifecycle: Discovery to Execution

### Sequence Flow Diagram

```text
Phase 1: Discovery (Finding out what tools exist)
MCP CLIENT ───( tools/list )───► MCP SERVER
MCP CLIENT ◄──( Tool Schemas )── MCP SERVER
    │
    ▼
 AI HOST
    │
    ▼
   LLM

───────────────────────────────────────────────────────
Phase 2: Decision (Matching user intent to a tool)
  USER ───("Create Go to Gym task")───► LLM
                                                │
                                                ▼
                                         Chooses createTask()
                                                │
                                                ▼
                                             AI HOST
                                                │
                                                ▼
                                           MCP CLIENT

───────────────────────────────────────────────────────
Phase 3: Execution & Output (Running the action)
MCP CLIENT ───( tools/call )───► MCP SERVER
                                      │
                                 Executes createTask()
                                      │
MCP CLIENT ◄─────( Result )────── MCP SERVER
    │
    ▼
 AI HOST
    │
    ▼
   LLM (Turns raw result into plain English)
    │
    ▼
  USER ◄──("I've added 'Go to Gym' to your tasks")
```

### Step-by-Step Breakdown

#### Phase 1: Tool Discovery
- **Request Tools:** The MCP Client calls `tools/list` on the MCP Server to ask: "What capabilities do you offer?"  
- **Return Schemas:** The MCP Server responds with tool names, descriptions, and input schemas (e.g., `createTask` requires a title string).   
- **Pass to LLM:** The Host makes these tool definitions available inside the LLM prompt context. 

#### Phase 2: User Intent & Decision (Tool Calling)
- **User Input:** The end user asks, "Create a task for going to the gym."
- **LLM Selects Tool:** The LLM reads the request, inspects the available tools, and decides: `"I should call createTask with argument { title: 'Go to Gym' }"`
- **Pass Back to Host:** The LLM does not execute anything directly; it simply hands the chosen tool name and arguments back to the Host application.

#### Phase 3: Tool Execution & Final Response (MCP)
- **Host Dispatches Call:** The Host hands the tool call to the MCP Client, which sends a `tools/call` request over MCP to the MCP Server.
- **Server Executes:** The MCP Server runs the real code (e.g., inserts a record into your database) and generates a result: `{ id: 1, title: 'Go to Gym', status: 'PENDING' }`.   
- **Return Payload:** The result travels from the MCP Server back through the MCP Client to the Host.
- **Final Answer:** The Host sends that result to the LLM, which formats it into a natural response for the user: "I've created your task!"

---

## 9. Key Engineering Advantages & Security

### Dynamic Discovery (Zero Local Re-coding)
- **Why it matters:** If we deploy a new tool (`cancelTask`) to our MCP Server, the AI Host picks it up on the next `tools/list` discovery call.
- **Without it:** If we add a new tool, we have to update the schema in the Host code, re-compile, and re-deploy the entire application.
- **Isolation:** The Host (Cursor) remains stable. Only the MCP Server crashes when its database goes offline. We don't re-deploy the entire AI application for a single backend dependency update.

### Security & Human-in-the-Loop
The MCP Server only declares capabilities; the MCP Host owns authorization and security policy.
- **Safe Actions (Automatic):** If the AI wants to do something harmless—like reading a text file (`readFile`)—the system lets it happen automatically because it won't break anything.
- **Dangerous Actions (Human-in-the-Loop):** If the AI wants to do something destructive—like deleting a whole database (`deleteDatabase`)—the main system stops it in its tracks. It puts up a big pause screen and asks you: *"Are you sure you want to let the AI delete this?"* The AI cannot proceed until a human physically clicks "Yes."

### MCP Alongside Existing REST APIs
You don't need to rewrite existing Node/Express APIs. You can keep your existing REST API for user authentication, and then create a separate, lightweight MCP Server that exposes only the "actions" (tools) you want the AI to use. The AI communicates with your API for simple things, and communicates with your MCP Server for complex tasks.

```text
[AI Host] ──(MCP)──► [Node.js MCP Server] ──(HTTP/REST)──► [Existing Express API] ──► [DB]
```

#### Example Walkthrough:
**The Goal:** A customer asks an AI chatbot, *"What is the status of my pizza order #55?"*

Here is how that request travels:
1. **[AI Host]:** The AI understands the customer's question. It triggers a tool call using the MCP language: *"I need to run checkPizzaStatus for Order #55."*
2. **[MCP Server]:** This acts as the translator. It takes the AI's request and turns it into a standard web link: `GET /orders/55`.
3. **[Existing Express API]:** Your old pizza shop code receives this standard link. It has no idea an AI is involved. It just thinks a normal website user is checking their order.
4. **[DB]:** The Express API pulls the status (*"Baking in oven"*) out of the database and sends it back up the chain to the AI, which tells the customer.

**Why this helps you:** You didn't have to change a single line of your original pizza shop code or database to make the AI work.

---

### Summary: With vs. Without MCP

#### Without MCP (The Problem):
- Every AI tool (OpenAI, Claude, Cursor) speaks a different language.
- If we switch AI tools, we have to rewrite our connection code from scratch every single time. It locks us into one AI provider and forces us to constantly update our backend.

#### With MCP (The Solution):
- We write the connection code **ONCE** for MCP. 
- Now, we can swap the AI engine (OpenAI → Claude) without ever touching our backend code. MCP is the universal translator that makes this switch seamless.
