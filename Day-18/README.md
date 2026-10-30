AI Application Testing :Deterministic Evals & LLM-as-a Judge

Testing AI applications requires evaluating both the internal execution path and the generated answer, because AI systems combine non-deterministic LLM reasoning with deterministic components like vector retrieval and external tools.

1. Traditional Testing vs. AI Application Testing
In traditional software, a function given the same input produces the exact same output every time. In AI applications, an answer can fail at multiple points along the execution pipeline:
User Question
    ↓
Knowledge Retrieval (RAG)
    ↓
Tool Selection & Arguments
    ↓
External Data Execution
    ↓
LLM Reasoning & Generation
    ↓
Final Answer

If you only test the final output text, you cannot tell why or where the AI failed. A wrong answer could happen because:
The system retrieved the wrong company document.   
The system picked the wrong tool.   
The model passed incorrect arguments to the tool.   
The model had the right evidence but hallucinated or reasoned poorly. 

2. Test Case Categories in an AI Support Agent
Suppoe an e-commerce support agent demonstrates three common types of user queries:

Category A: Knowledge-Based Questions (Static data RAG)
Goal: Answers questions about static company rules (like return windows) using RAG.   Workflow:
Question: "How many days do I have to return a product?"
    ↓
Vector Search / Knowledge Base (Retrieves "return-policy")
    ↓
LLM Generation
    ↓
Answer: "Products can be returned within 30 days of delivery."

Two failure points:
Retrieval failure: The vector store pulls the wrong document.   
Generation failure: The right document was retrieved, but the LLM gave a bad answer. 

Category B: Live / Order-Specific Questions (Tools Based)
Goal: Retrieves dynamic, real-time data from a database or API.   
Workflow: 
Question: "Where is ORD-101?"
    ↓
LLM decides to call tool: getOrderStatus(orderId: "ORD-101")
    ↓
Tool returns: "SHIPPED"
    ↓
LLM Generation
    ↓
Answer: "ORD-101 has been shipped."

Two deterministic checks:
Tool selection: Did the LLM choose the right tool name (getOrderStatus)?   
Tool arguments: Did the LLM extract and pass the exact order ID (ORD-101)?   

Category C: Combined Questions (RAG + Tools + LLM Reasoning)
Goal: Combines static policy documents with dynamic tool data to reach a logical conclusion.

Workflow:
Question: "My order ORD-102 was delivered 20 days ago. Can I still return it?"
    ↓
Step 1: RAG retrieves "return-policy" (Rule: 30 days allowed)
    ↓
Step 2: Tool checks order status (Fact: Delivered 20 days ago)
    ↓
Step 3: LLM reasoning (20 days < 30 days limit)
    ↓
Answer: "Yes. Your order is still within the 30-day return window."

3. Observability: Splitting Response from Trace
When an API only returns text like "Yes, you can return it", it is impossible to evaluate whether the agent retrieved documents, called tools, or simply guessed. 

For testing and observability, the agent execution must return an AgentResponse split into two streams: 

Agent Execution
   ├── User Answer (Text shown to customer)
   └── Eval Trace  (Internal operational metadata used for testing)

Our support agent gives us many observable behaviours:
Did retrieval happen correctly?
Did the correct document come back?
Did the correct tool get called?
Were the tool arguments correct?
Was the final answer relevant?
Was the answer correct?
Was it grounded?
Did the model hallucinate

Example of the Evaluation Trace Payload
{
  "answer": "ORD-101 has been shipped and is expected by 15 October 2026.",
  "toolsUsed": [
    "getOrderStatus",
    "getDeliveryEstimate"
  ],
  "toolArguments": {
    "orderId": "ORD-101"
  },
  "retrievedDocuments": [
    "shipping-faq"
  ],
  "context": "Status: SHIPPED. Delivery Date: 15 October 2026. Standard shipping takes 3-5 days."
}

Why We Store Each Trace Field
retrievedDocuments: Allows checking if the expected file was fetched using exact string matching (actual == expected) without an LLM.   
toolsUsed: Confirms deterministically that the model chose the exact function needed.   
toolArguments: Verifies the model parsed the user's data cleanly (catching cases where it called getOrderStatus with "ORD-999" instead of "ORD-101").   
context: Holds the exact retrieved chunks and tool outputs so an evaluation judge can later verify if the LLM followed the facts.  

4. Deterministic Evals vs. LLM-as-a-Judge
Testing is split into two distinct layers based on whether a property is objectively knowable by code or requires semantic language understanding.

              AI APPLICATION EVALUATION
                          |
         +----------------+----------------+
         |                                 |
Deterministic Evals                 LLM-as-a-Judge
 (Normal Code Checks)             (Quality & Meaning)
         |                                 |
* Response exists?                * Relevance?
* Correct tool called?            * Correctness?
* Correct argument passed?        * Faithfulness?
* Correct doc retrieved?          * Helpfulness?
* Valid JSON schema?              * Hallucination-free?

Rule of Thumb
Use Deterministic Evals: For anything with an exact binary answer. Never waste an LLM call to check if toolsUsed equals "getOrderStatus".   
Use LLM-as-a-Judge: For meaning and natural language quality. Two answers can convey the identical meaning using completely different words, making string equality (expected.equals(actual)) fail.  

5. The End-to-End Evaluation Pipeline

Golden Dataset Case
        ↓
Run Real Application (Live LLM + Tools + RAG)
        ↓
Collect AgentResponse (Answer + Trace)
        ↓
Layer 1: Deterministic Evals (Tool, Args, Document checks)
        ↓ (If PASS)
Layer 2: LLM Judge Scoring (Rubric on 1 to 5 scale)
        ↓
Layer 3: Threshold Verification (e.g., Score >= 4)
        ↓
Layer 4: Final Verdict (PASS only if Deterministic AND Quality pass)

Step 1: The Golden Dataset
Create a JSON file containing known test prompts paired with ground-truth expectations:
{
  "question": "Where is ORD-101?",
  "expectedTool": "getOrderStatus",
  "expectedToolArgument": "ORD-101",
  "expectedSource": null,
  "goldenAnswer": "The order has been shipped."
}

Step 2: Run the Real System
Run the actual application code from start to finish. Do not use fake or simulated versions of the LLM, RAG search, or tool calling. You must use the real components because they are exactly what we are testing.

Step 3: Layer 1 — Deterministic Verification
Check the raw data from the test run using standard test rules:
Was an answer generated at all?   
Did toolsUsed match expectedTool?   
Did toolArguments match expectedToolArgument?   
Did retrievedDocuments match expectedSource? 

Step 4: Layer 2 — LLM Judge Evaluation
Pass the question, context, actual answer, and golden answer to a judge model with a clear rubric.

The 5 Quality Dimensions
All metrics use a uniform positive scale (5=Good, 1=Bad): 
Relevance: Did the response directly address what the user asked?   
Correctness: Does the answer match the expected behavior and golden answer?   Faithfulness: Are factual claims backed up by the retrieved context or tool evidence?   
Helpfulness: Is the response easy to read, clear, and actionable?   Hallucination-Free: Did the model stick to verified facts without inventing unsupported details (named positively to match the 1–5 scoring scale)? 

Structured Output from the Judge
The judge model must output structured JSON rather than free-form text so code can parse scores and check thresholds:
{
  "relevance": 5,
  "correctness": 5,
  "faithfulness": 4,
  "helpfulness": 5,
  "hallucinationFree": 5,
  "reason": "The answer correctly uses the supplied return policy and does not introduce unsupported information."
}

Step 5: Layers 3 & 4 — Thresholds and Final Verdict
Define Thresholds: Set a passing bar (such as score >= 4) based on product risk. Medical or financial applications demand higher thresholds than casual creative writing apps.   
Overall Result: The test passes only if all deterministic checks pass and all quality scores meet or exceed the threshold. If the model returned the right answer but used the wrong tool, the test fails. 

The core idea is simple:
Test deterministic behaviour with deterministic code. Use LLM-based
evaluation only where understanding language and meaning is actually
required

Final detailed flow:
               Golden Dataset
                     │
                     ▼
                  Question
                     │
                     ▼
               AI Application
                     │
                     ▼
AI Application Testing: Deterministic Evals & LLM-as-a-Judge
                     │
                     ▼
               AgentResponse
                     │
           ┌─────────┴─────────┐
           │                   │
           ▼                   ▼
  Deterministic Evals      LLM-as-a-Judge
           │                   │
           ▼                   ▼
    Tool correct?          Relevance
    Args correct?          Correctness
    Source correct?        Faithfulness
    Response exists?       Helpfulness
                           Hallucination-Free
           │                   │
           └─────────┬─────────┘
                     │
                     ▼
               Threshold Check
                     │
                     ▼
                 PASS / FAIL
