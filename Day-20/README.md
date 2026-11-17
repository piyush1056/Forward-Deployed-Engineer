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
