# Day-15: MCP Server: Resources and Prompts

The Model Context Protocol (MCP) connects LLM applications to external capabilities and data using a standardized client-server protocol. An MCP Server exposes three distinct primitives categorized by who initiates and controls them:

```text
MCP Server
  ├── Tools     --> Capabilities        --> Controlled by MODEL (LLM)
  ├── Resources --> Context / Data       --> Controlled by APP (Backend)
  └── Prompts   --> Reusable Workflows   --> Controlled by USER (Human)
```

---

## 1. Core Architecture & Control Plane

| Primitive | Primary Purpose | Controlled By | Express / Web Analogy |
| :--- | :--- | :--- | :--- |
| **Tool** | Executable actions or on-demand fetchers | Model (LLM) | Dynamic backend endpoints (`POST /tasks`, `GET /search`) |
| **Resource** | Reference data / context attached to the prompt | Host Application | Read-only static assets or database records (`GET /docs/rules.md`) |
| **Prompt** | Reusable templates & interactive workflows | End User | UI action buttons, presets, or slash commands (`/plan-day`) |

---

## 2. MCP Resources (Application-Controlled Context)

### 2.1 Why Not Expose Everything as a Tool?

A tool can return data (e.g., `getGuidelines()`), but exposing static or reference context as a tool has key disadvantages:

- **Model Guesswork & Latency:** A tool requires the model to read descriptions, decide to emit a tool call, wait for your server to execute it, and run a second generation loop (1 extra network trip).
  If it's a Resource, the backend reads it directly over the MCP transport and puts it straight into the LLM's system instructions before the LLM runs at all. Zero round trips, zero guessing.
- **Deterministic Control:** An LLM might hallucinate, misspell arguments, or skip calling the tool entirely. When an app needs compliance (e.g., company guidelines or tenant configurations), the app—not the model—must guarantee that context is loaded.
- **Intent Separation:**
  - **Tools** are verbs (capabilities the agent decides to invoke).
  - **Resources** are nouns (raw reference data/documents the environment injects).

```text
Tool Flow (Model Decides, 2 round trips):
User Query ──> LLM ──> "I should call getGuidelines()" ──> Server executes ──> LLM ──> Answer

Resource Flow (App Decides, 1 round trip):
User Query ──> Host App ──> reads Resource (company://guidelines) ──> LLM (with Context) ──> Answer
```

### 2.2 Anatomy of a Resource

Every resource exposed by an MCP Server consists of five properties. A Resource is an addressable piece of context along with metadata describing it:

- **Name:** Human-readable identifier (e.g., `coding-guidelines`).
- **URI:** The unique address identifier (e.g., `company://coding-guidelines`).
  > **Note:** URIs are unique identifiers, not necessarily HTTP URLs. The client reads them via MCP protocol calls, not `fetch()` or `axios`.
- **Description:** Explains what data the resource holds.
- **MIME Type:** Format indicator (e.g., `text/plain`, `application/json`, `image/png`).
- **Content:** The underlying payload (text or binary).

#### Example

- **Name:** `coding-guidelines`
- **URI:** `company://coding-guidelines`
- **Description:** Coding guidelines followed by the development team.
- **MIME Type:** `text/plain`
- **Content:** Use Java 21. Prefer constructor injection. Keep business logic out of controllers.

### 2.3 Discovery vs. Reading

Resources separate discovery from content retrieval to keep client memory light:

- `resources/list`: Returns metadata for all available resources (URI, name, description).
- `resources/read`: Client requests the specific URI (`company://coding-guidelines`), and the server responds with the content payload.

```text
Client / App                                        MCP Server
     │                                                   │
     │ ──── 1. resources/list ("What exists?") ────────> │
     │ <─── 2. [{ uri: "task://rules", ... }] ────────── │
     │                                                   │
     │ ──── 3. resources/read ("Give me task://rules") ─>│
     │ <─── 4. Raw file contents / data ─────────────────│
```

### 2.4 Static, Dynamic, and URI Templates

- **Static Resources:** Hardcoded files or invariant documents (`task://guidelines`).
- **Dynamic Resources:** Live records resolved on-demand from a database (`database://customer/938`).
- **Resource Templates:** Rather than declaring a million static URIs, the server registers a template pattern and extracts parameters dynamically upon `resources/read`.

```text
Example:
  Template:
    uri: user://{userId}
    description: Retrieves profile metadata for a given user ID.
  Client Call:
    Call resources/read with uri: user://12345
  Server Behavior:
    Extracts userId=12345
    Runs database query: SELECT * FROM users WHERE id = 12345
    Returns the resulting JSON object as the resource content.
```

### 2.5 How the Application Chooses Which Resource to Read

MCP does not dictate routing logic. Host applications determine which resources to read using four common strategies:

- **User Selection:** User selects an attachment in a UI menu or chat input (`[x] Attach Coding Guidelines`).
- **Application State:** The application uses context from the UI, server state, or route parameters (e.g., the active tab/file open in an editor or route params like `req.params.projectId`).
- **Search / Vector RAG:** App fetches the resource catalog via `resources/list`. It runs embedding search across the name and description fields against the user query, and reads the matching URI.
- **Deterministic LLM Router:** A small, fast LLM (e.g., `gpt-4o-mini`) runs ahead of the main model. Its sole job is to examine the user prompt and immediately decide which static/dynamic resources must be loaded, preventing the main model from wasting tokens searching.

---

## 3. MCP Prompts (User-Controlled Workflows)

### 3.1 What is an MCP Prompt?

An MCP Prompt is a predefined message template stored on the MCP Server.

It is **NOT** an LLM response: It does not call an AI model. It produces structured message payloads (system, user, or assistant instructions) that the client forwards to an LLM.

#### Why store prompts on the server instead of client code?

- **Reusability** across multiple MCP clients (Claude Desktop, IDEs, Express web apps, internal CLI tools).
- The server author defines best-practice workflows for their specific tools and schemas (e.g., a GitHub server offering `review_pr`, a Jira server offering `summarize_sprint`).

### 3.2 Discovery and Arguments

Prompts accept dynamic input arguments:

- `prompts/list`: Returns available prompts and required arguments (e.g., `plan_day` requires `availableHours`).
- `prompts/get`: Returns the evaluated message template populated with the user's arguments.

```text
User ────> Selects "/plan_day 4"
                │
                ▼
Client ──> prompts/get("plan_day", { availableHours: 4 }) ──> MCP Server
                │                                                   │
                ▼ <────────── Returns Formatted Messages ───────────┘
Client ──> Passes template to LLM
```

### 3.3 Tools vs. Resources vs. Prompts

| MCP Primitive | Main Purpose | Primarily Controlled By | Example |
| :--- | :--- | :--- | :--- |
| **Tool** | Expose callable capabilities | Model | `list_tasks` |
| **Resource** | Expose context or reference data | Application | `task://guidelines` |
| **Prompt** | Expose reusable interaction templates | User | `plan_day` |

---

## 4. End-to-End Orchestration: The Complete Triad

A real-world task-planning workflow combines all three primitives:

```text
   [ USER ]
      │
      │ 1. Triggers workflow from UI or endpoint (e.g., clicks "Plan My Day" with 4 hours)
      ▼
   [ PROMPT ] ── (USER-CONTROLLED)
      │
      │ 2. MCP Server fills template: "Plan my day. Check tasks first. I have 4 hours."
      ▼
   [ APPLICATION / HOST (Express) ] ── (APP-CONTROLLED)
      │
      │ 3. Express directly fetches reference context: resources/read("task://guidelines")
      │ 4. Packages System Prompt (Guidelines) + User Message (from Prompt Template)
      ▼
   [ LLM (Gemini) ]
      │
      │ 5. Reads instructions, notices pending tasks are missing, and picks a capability
      ▼
   [ TOOL ] ── (MODEL-CONTROLLED)
      │
      │ 6. Model issues function call: list_tasks()
      ▼
   [ MCP SERVER ]
      │
      │ 7. Executes list_tasks() logic and returns pending task records
      ▼
   [ LLM (Gemini) ]
      │
      │ 8. Combines: Guidelines (Resource) + Tasks (Tool) + 4-Hour Goal (Prompt)
      ▼
   [ FINAL DAY PLAN ] ──> Returned to User via Express response
```

### Execution Lifecycle Breakdown

- **Step 1:** User triggers the workflow by clicking "Plan My Day" with 4 hours available.
- **Step 2:** MCP Server fetches the `plan_day` prompt and fills it with the user's arguments, creating the message: *"Plan my day. Check tasks first. I have 4 hours."*
- **Step 3:** Express backend reads the coding guidelines via `resources/read("task://guidelines")` and prepends them to the system instructions.
- **Step 4:** LLM receives the combined System Prompt (Guidelines) + User Message (Planned Day).
- **Step 5:** The LLM identifies that it needs task data and issues a tool call for `list_tasks()`.
- **Step 6:** MCP Server executes `list_tasks()` and returns the pending tasks.
- **Step 7:** LLM combines: Guidelines + Tasks + 4-Hour Goal + Prompt = Final Day Plan.
- **Step 8:** Express returns the Final Day Plan to the User.

---

## Final Summary

- **TOOLS:** *"What should the MODEL be able to call?"*
- **RESOURCES:** *"What context should the APPLICATION be able to provide?"*
- **PROMPTS:** *"What reusable workflows should the USER be able to choose?"*