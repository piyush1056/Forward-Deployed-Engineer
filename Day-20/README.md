# Day 20: Mastering AI Agent Reliability with Agent Harnessing

To build a truly reliable AI agent that can handle complex, multi-step tasks like generating automated release notes, a simple connection between an LLM and tools is not enough. Relying only on an LLM can lead to issues like hallucinations, missing data, or failure to complete tasks. To solve this, we introduce the Agent Harness—a structural framework that manages the agent loop, enforces validation, maintains state, and handles retries. By using an Agent Harness, we shift from a simple request-response model to a robust system capable of planning, acting, observing, and deciding until a task is successfully completed.

---

## Understanding the Real-World Scenario

### What is Jira and What is a Jira Ticket?
Jira is a project management website used by software companies to track daily engineering work.

Every single bug fix, new feature, or code change is recorded as a Jira Ticket with a unique ID.

**Example of 3 Jira tickets for an app release (`v2.4.0`):**
- **PAY-101 (Bug):** "Fix UPI payment timeout when bank server is slow"
- **UI-205 (Feature):** "Add dark mode toggle in user settings"
- **DB-309 (Internal Task):** "Upgrade PostgreSQL driver from v14 to v15"

### What are Release Notes?
When a company finishes building version `v2.4.0` and pushes it to users, they publish Release Notes—a clean summary posted on their website or Slack channel telling customers and managers what changed in this update (New Features and Bug Fixes). 

> **Note:** DB-309 (upgrading a database driver) is internal engineering work, so it should not be shown to customers.

### Why is This a Problem?
In a real company, 40 developers might close 60 Jira tickets every two weeks. A Product Manager has to manually open all 60 tickets, read messy developer comments, ignore internal tasks, and write clean release notes. This wastes 3 to 4 hours every release.

**The Goal:** Build an automated AI backend that fetches all Jira tickets for `v2.4.0` and generates accurate, safe, ready-to-publish release notes.

---

## I. The Problem: Why a Plain LLM and Basic Agent Fail

### First Principle
An LLM is just a text-in, text-out function. It has no access to your company's private tools, no memory of previous steps, and no ability to verify whether its own answer is right or wrong.

### Why Simply Calling an LLM Fails
If you just call the OpenAI or Gemini API from your backend (`POST /generate-notes`), the LLM cannot log into your company's Jira account. It has zero data about `v2.4.0`.

### Why a "Basic AI Agent" Still Fails in Production
Earlier, we turned an LLM into a Basic Agent by giving it a Tool—a function like `fetchJiraTickets("v2.4.0")`. Now the LLM can pull the 60 tickets and write release notes.

However, in a real company, a Basic Agent breaks in 4 dangerous ways:
1. **Silent Omissions:** Out of 60 tickets, the LLM writes about 56 of them and quietly forgets 4 critical bug fixes. Nobody notices until customers complain.
2. **Hallucinations:** A developer wrote "We might add Apple Pay next month" in a ticket comment. The LLM misreads this and announces Apple Pay as a live feature in `v2.4.0`.
3. **Broken Output Format:** Your frontend expects strict Markdown with `## New Features` and `## Bug Fixes`, but the LLM adds conversational chatter like "Sure! Here is your summary:" which breaks your automated publisher.
4. **Zero Crash Recovery:** If Jira's API takes 6 seconds to respond and throws a network timeout error, your whole Express script crashes and loses all progress.

```text
[Trigger: Release v2.4.0]
          |
          v
    [Basic Agent] ---> [Calls getJiraTickets()] ---> [Writes Draft Once] ---> [Publishes Broken Notes]
                                                            |
                                              (No checks, no retries, crashes on error)
```

---

## II. Introducing the Agent Harness & The Agent Loop

### First Principle
If an AI model makes unpredictable mistakes, the AI model cannot be the boss of the workflow. You must wrap deterministic, rule-based backend code around the LLM to control every step, inspect the output, and force fixes when quality is bad.

### What is an Agent Harness?
An Agent Harness is the outer backend code layer that wraps around the LLM. The LLM only generates text; the Harness controls execution, checks quality, handles errors, and talks to databases.

### The Evaluator (Checking the LLM's Work)
Before accepting any draft from the LLM, the Harness passes the draft to an Evaluator. There are two types:

1. **Deterministic Evaluator (Pure JavaScript rules):** Fast, cheap code that checks hard facts.
   - *Example:* You fetched 12 customer-facing ticket IDs from Jira (`PAY-101` to `PAY-112`). Your Express service runs a simple `.includes()` check to verify all 12 IDs exist in the draft. If `PAY-108` is missing, JavaScript catches it immediately.
2. **LLM-as-a-Judge (A second AI call for subjective rules):** Some rules cannot be checked with if/else code—for example, "Is the language clear for non-technical users?" or "Did the draft accidentally include internal tasks?".
   - *Example:* The Harness sends the draft to a second, fast LLM call with a grading prompt: *"Check this draft against the ticket list. Reply ONLY with PASS or FAIL and list any problems."*

### The Agent Loop: Plan &rarr; Act &rarr; Observe &rarr; Decide
Instead of running once and quitting, the Harness runs a `while` loop:

- **Plan:** Determine what needs to happen next (e.g., "Need to fetch Jira tickets for v2.4.0" or "Need to fix missing ticket PAY-108").
- **Act:** Execute the tool (`jiraService.getTickets()`) or call the LLM to write/update the draft.
- **Observe:** Pass the LLM's draft through the Evaluator and inspect the test results.
- **Decide:** If the Evaluator says `PASS`, exit the loop and move forward. If `FAIL`, feed the exact error message back into the loop and force the LLM to try again.

```text
AGENT HARNESS (Express.js)

   [1. Plan] ---> [2. Act: Call Jira / LLM] ---> [3. Observe: Draft]
       ^                                                 |
       |                                                 v
   [4. Decide: Loop back with error] <--- FAIL <--- [Evaluator Check]
                                                         |
                                                       PASS
                                                         v
                                                 [Next Stage / Done]
```

---

## III. Managing Task State & Model Context

### First Principle
Every API call to an LLM is stateless—the LLM forgets everything the millisecond the response finishes. At the same time, stuffing huge amounts of raw data into every prompt makes the LLM confused, slow, and expensive. Therefore, your database must store the full progress, and your code must clean the data before sending it to the LLM.

### 1. Task State (Stored in Your Database)
Task State is a structured JSON object saved in PostgreSQL, Redis, or an in-memory JavaScript Map. It tracks everything happening in the job so your server never loses track.

*Example (Stored in database / Map under key `"release-v2.4.0"`):*
```javascript
const taskState = {
  taskId: "release-v2.4.0",
  status: "VALIDATING",           // FETCHING | DRAFTING | VALIDATING | AWAITING_APPROVAL | DONE
  attemptCount: 2,                // How many times the LLM has tried so far
  cleanTickets: [ /* 12 objects */ ],
  currentDraft: "## New Features\n- Added dark mode (UI-205)...",
  validationErrors: ["Missing ticket PAY-108 in Bug Fixes section"]
};
```

### 2. Context Compaction (Removing Junk Data)
When you call Jira's REST API (`GET /rest/api/3/search`), Jira returns massive JSON objects. One single ticket contains ~80 fields (`avatarUrls`, `timezone`, `projectCategory`, `customfield_10042`, etc.). If you send 60 raw Jira tickets to an LLM, you send 80,000+ tokens of useless noise, causing the LLM to miss important details.

Context Compaction is writing a small JavaScript function to strip out the 76 useless fields and keep only what the LLM needs:

```javascript
// Raw Jira ticket has 80 fields -> Compacted down to 4 clean fields
function compactTickets(rawJiraIssues) {
  return rawJiraIssues.map(issue => ({
    id: issue.key,                       // "PAY-101"
    type: issue.fields.issuetype.name,   // "Bug" or "Story"
    summary: issue.fields.summary,       // "Fix UPI payment timeout"
    notes: issue.fields.description      // Short developer explanation
  }));
}
```

### 3. Model Context (What Actually Goes Into the Prompt)
Model Context is the exact, clean prompt your `contextBuilder.js` service creates right before calling the LLM. It combines:
- System instructions (formatting rules)
- Compacted tickets from Task State
- Previous draft + validationErrors (if this is a retry)

#### Workflow Architecture

```text
PHASE 1: PREPARE & SAVE (Happens Once)
[Jira API (80 fields)] ──► compactTickets() ──► [Saves cleanTickets into Task State DB]


PHASE 2: BUILD PROMPT & RUN (Happens Every Attempt)
[Task State in DB]  ──────────┐
  • cleanTickets              │
  • currentDraft (if retry)   ├──► [contextBuilder.js] ──► [Final Model Context] ──► (LLM)
  • validationErrors (retry)  │
                              │
[System Instructions] ────────┘
```

---

## IV. Checkpointing & Fault Tolerance

### First Principle
AI agent workflows take 30 to 90 seconds and depend on external networks (Jira API, OpenAI API, database). Servers crash, cloud containers restart, and APIs randomly drop connections. If a job crashes at Step 4, restarting from Step 1 wastes money and time.

### Checkpointing
Checkpointing means saving the updated Task State object to your database immediately after every single step completes.

### Fault Tolerance (Recovering From a Crash)
Fault Tolerance is designing your backend so that if the server crashes and restarts, it reads the last saved checkpoint from the database and continues from that exact step.

#### Concrete Crash & Recovery Timeline:
- **10:00:01** — Express fetches 60 tickets from Jira and compacts them. Saves Checkpoint 1 (`status: "TICKETS_READY"`).
- **10:00:08** — LLM generates Draft 1. Saves Checkpoint 2 (`status: "DRAFT_GENERATED", currentDraft: "..."`).
- **10:00:10** — **Server Crash!** Your Node.js process runs out of memory and restarts.
- **10:00:15** — Your worker restarts and checks `taskState` for `"release-v2.4.0"`. It sees `status === "DRAFT_GENERATED"`. Instead of calling Jira again or regenerating Draft 1, it skips straight to running the Evaluator on the saved `currentDraft`.

---

## V. Execution Control & Timeouts

### First Principle
If an LLM gets confused inside an Agent Loop, it can fail validation 100 times in a row, burning $50 of API credits in two minutes and hanging your Express server. You need smart retries so it actually fixes errors, and hard limits so it stops when stuck.

### 1. Two Types of Retries
When the Evaluator rejects a draft, the Harness chooses between two retry strategies:

- **Instruction Retry (Format Failure):**
  - **What happened:** The LLM returned conversational text instead of valid JSON.
  - **How Harness retries:** Keep the exact same input data, but append a strict formatting rule to the instruction: *"Your last output was not valid JSON. Output ONLY a raw JSON object with no markdown backticks."*

- **Model Context Retry (Content/Logic Failure):**
  - **What happened:** The format was valid, but the content missed a ticket (`PAY-108`) or included an internal task (`DB-309`).
  - **How Harness retries:** Add the previous draft and the Evaluator's exact feedback into the Model Context: *"In your previous draft, you forgot bug ticket PAY-108. Keep everything else, but add PAY-108 under Bug Fixes."*

### 2. Three Layers of Timeouts (Using Node.js AbortController)
Every network call and loop needs a strict timer:

- **Tool Timeout (e.g., 5 seconds):** If `fetch()` to Jira takes longer than 5 seconds, abort the request so Express does not hang.
- **LLM Timeout (e.g., 20 seconds):** If the LLM provider freezes, cancel the HTTP request and trigger a retry.
- **Overall Task Timeout (e.g., 2 minutes) + Max Attempts (`maxAttempts = 3`):** Even if individual calls succeed, if the agent fails validation 3 times in a row or crosses 2 minutes total, the Harness stops the loop, marks `status: "FAILED"`, and alerts an engineer.

```text
[Start Loop: attempt = 1]
         |
         v
[Call LLM (20s Timeout)] ---(Timeout)---> [Retry if attempt < 3] ---> [Stop & Mark FAILED]
         |
     (Success)
         v
[Evaluator Check] ---(Format Error)---> [Instruction Retry (Fix JSON/Format)]
         |
   (Logic Error)
         v
[Model Context Retry (Pass Error Feedback to LLM)]
```

---

## VI. Human-in-the-Loop (HITL) & Express.js Architecture

### First Principle
Automated evaluators catch structural and factual mistakes, but AI lacks real-world business judgment. For high-risk actions that affect real customers, the Harness must pause and wait for human approval before executing the final step.

### Why HITL is Critical Here
Suppose a developer closed ticket `SEC-404`: "Fix SQL injection vulnerability on login endpoint".

Both your Deterministic Evaluator and LLM-as-a-Judge see a valid bug fix, so they mark it `PASS`.

However, if you publish "Fixed SQL injection on login" to public release notes, hackers immediately know your older app versions can be hacked!

### How the Approval Workflow Works
1. Once the draft passes the Evaluator, the Harness does not publish it.
2. Instead, the Harness updates `taskState.status = "AWAITING_APPROVAL"`, saves a checkpoint in the database, and stops execution.
3. A Product Manager opens a simple internal dashboard, reviews the draft, deletes `SEC-404`, and clicks Approve.
4. Clicking Approve calls `POST /api/releases/v2.4.0/approve` on your Express server, which loads the checkpoint and runs `publishReleaseNotes()`.

#### Architecture Flow

```text
POST /api/releases/start
         |
         v
[agentHarness.js] ---> [jiraToolService.js] (Fetch raw Jira tickets)
         |
         +-----------> [contextBuilder.js] (Compact 80 fields -> 4 fields)
         |
         +-----------> [LLM API Call] (Generate Release Notes Draft)
         |
         +-----------> [evaluatorService.js] (Check ticket IDs + LLM Judge)
         |
         +-----------> [taskStore.js] (Save Checkpoint: status = AWAITING_APPROVAL)
                              |
                 (Product Manager reviews & edits)
                              |
POST /api/releases/:id/approve ---> [jiraToolService.js] (Publish final notes)
```
