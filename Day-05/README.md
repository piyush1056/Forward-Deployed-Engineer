# Day 05: AI Agents & Tools (From Next-Token Predictor to Autonomous Agent)

---

## 1. The Core Limitation of an LLM

* **What an LLM actually does:** Predicts the next token based on input probabilities.
* **Generating text $\neq$ Performing an action:** If we ask the model to create a directory, outputting `mkdir portfolio` is just text—it does not actually execute the command.

### The Mental Model:
* **LLM = Brain** (language understanding, reasoning, planning).
* **Tools = Hands** (executing code, touching files, calling APIs, querying databases).

```text
[Text In] -> [LLM] -> [Text Out] (Cannot affect the real world)
```

```text
[User Prompt] -> [LLM] -> [Tool Request] -> [Application / Runtime] -> [Real World Action]
```

---

## 2. Why Give LLMs Tools?

* **Deterministic Accuracy:** Models can struggle with precise arithmetic or live data. A calculator tool handles exact math reliably, while the LLM handles language intent.
* **Translation Layer:** Humans speak loosely (*"add 10 and 20"*, *"combine ten and twenty"*, *"I have 10 and got 20 more"*). Traditional code needs strict schemas. The LLM translates ambiguous natural language into structured arguments for your backend functions.

```text
User Natural Language ──► LLM ──► Structured Tool Arguments ──► Backend Function
```

---

## 3. What Actually Is a Tool?

A tool is just a standard function in your backend code (JavaScript/Node.js or Java) exposed to the model.

The model receives a contract/schema:
* **Tool Name** (e.g., `calculate`)
* **Description** (what it does)
* **Parameters & Types** (what arguments it expects)

> **Key Concept:** The LLM does not execute code directly. It simply returns a structured JSON payload saying: *"Please call function X with arguments Y"*. The server executes it and sends the result back.

---

## 4. The Tool-Calling Loop (Step-by-Step)

```text
[User Message]
      │
      ▼
   [LLM] ──(Needs Tool?)──► NO ──► [Final Natural Language Answer]
      │
     YES
      │
      ▼
[Tool Call Request (JSON)]
      │
      ▼
[Application executes function (Node.js/Express)]
      │
      ▼
[Tool Result returned to LLM]
      │
      ▼
   [LLM] ──(Need another step?)──► Loops back
```

### Step-by-Step Execution:
1. User asks a question.
2. LLM selects the tool and provides parameters in JSON.
3. Server runs the local function or API.
4. Server passes the raw result back to the model as a tool role message.
5. The model evaluates: If the goal is done, format the final answer; if not, call another tool.

---

## 5. Tool Types

* **Information Tools:** Read-only operations to fetch external state (e.g., `getWeather()`, `convertCurrency()`, querying a database).
* **Action Tools:** State-altering operations that modify the external environment (e.g., `writeFile()`, `sendEmail()`, `refundOrder()`).

---

## 6. The Progression to an AI Agent

| Level | Setup | Behavior |
| :--- | :--- | :--- |
| **Level 1** | Raw LLM | Answers purely with text generation. |
| **Level 2** | LLM + Single Tool | Delegates one isolated task (e.g., calculator). |
| **Level 3** | LLM + Multiple Tools | Performs tool selection based on the query. |
| **Level 4** | Autonomous Loop | Chains multi-step tool calls sequentially to achieve a goal. |

### Workflow vs. Agent

* **Workflow:** We hardcode both **WHAT** and **HOW** (`Step 1 -> Step 2 -> Step 3`).
* **Agent:** We define the **WHAT** (Goal + Available Tools), and the LLM determines the **HOW** (order of execution, self-correction).

---

## 7. The 6 Pillars of an AI Agent

```text
┌─────────────── [Goal] ────────────────┐
│                                       │
▼                                       │
┌──────────────┐                        │
│     LLM      │◄──────┐                │
└──────┬───────┘       │                │
       │ Decides       │ Observes Result
       ▼               │                │
┌──────────────┐       │                │
│Action (Tool) │       │                │
└──────┬───────┘       │                │
       │ Executes      │                │
       ▼               │                │
┌──────────────┐       │                │
│ Environment  │───────┘                │
└──────┬───────┘                        │
       └──────────────► [Goal Completed] ◄┘
```

* **Goal:** The desired end-state (e.g., *"Build a portfolio website"*).
* **Decision Maker:** The LLM choosing the next move based on current state.
* **Actions:** Tools available (e.g., `createDirectory`, `writeFile`, `readFile`, `listFiles`).
* **Environment:** The domain being operated on (e.g., a local sandboxed file directory).
* **Observations:** Output received back from executing an action (e.g., *"File written successfully"*, error logs).
* **Loop:** Repeating $\text{Decide} \rightarrow \text{Act} \rightarrow \text{Observe} \rightarrow \text{Decide}$ until the task is complete.

---

## 8. Security & Engineering Principles

* **Tool = Capability + Permission:** Giving a model a tool grants it authority to change systems.
* **Application is the Security Boundary:** Never rely on the LLM to follow security rules. Validate and sanitize inputs in your backend code (e.g., preventing path traversal `../../` using path normalization and sandboxing).
* **Least Privilege:** Expose specific narrow tools (`writeFile`, `readFile`) instead of dangerous unrestricted tools (`runTerminalCommand`).
* **Human-in-the-Loop:** For destructive or high-risk actions (e.g., payments, refunds, deleting records), pause the loop and require explicit human confirmation before execution.

```text
[LLM requests dangerous action] ──► [PAUSE] ──► [Human Approval?]
                                                    ├── Yes ──► Execute
                                                    └── No  ──► Abort
```

---

### The Core Formula

$$\text{LLM} + \text{Tools} + \text{Environment} + \text{Observations} + \text{Decision Loop} + \text{Goal} = \textbf{AI Agent}$$