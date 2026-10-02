# **Day 2: How Large Language Models Actually Work**

A complete, first-principles breakdown of how Large Language Models (LLMs) turn text into numbers, build rich context-aware representations using Query, Key, and Value, and generate output one token at a time.

---

## **1. The Core Job: Repeated Next-Token Prediction**

At its heart, an LLM does not write an entire essay or build full answers in one go. It runs one fundamental task over and over:

> **Given everything written so far, predict what should come next.**

* *"I drink coffee every..."* $\rightarrow$ could be morning, day, evening.
* *"I drink coffee every morning before going to..."* $\rightarrow$ could be work, office, gym.
* *"I work remotely as a software engineer. Every morning I drink coffee before going to my..."* $\rightarrow$ **desk** suddenly becomes the highest-probability choice.

The prediction is never based solely on the last word—it depends on the entire available context window.

```text
┌─────────────────┐      ┌─────────────┐      ┌───────────────────────────────┐
│  Previous Text  │ ───► │  LLM Model  │ ───► │ Next-Token Probabilities      │
│  ("Capital of   │      │             │      │  • Delhi: 94%                 │
│    India is")   │      │             │      │  • Mumbai: 2%   • Other: 4%   │
└─────────────────┘      └─────────────┘      └──────────────┬────────────────┘
                                                             │
                                                             ▼
                                                    Pick "Delhi" & Append
                                                             │
                                                             ▼
                                             New Input: "Capital of India is Delhi"
                                             (Repeat process for the next token)
```

---

## **2. Text to Tokens: Why Computers Need Numbers**

Computers and neural networks cannot read letters—they only understand numbers, matrix multiplications, and weighted additions.

### **What is a Token?**

* **Wrong Assumption:** 1 word = 1 token. This is not always true.
* A token can be a full word, a syllable fragment, a punctuation mark, or even whitespace.
* **Example:** `unbelievable` $\rightarrow$ split into subwords: `un` + `believ` + `able`.
* **Rough rule of thumb:** 1 token ≈ 4 characters in English (an approximation, not a rule).

```text
Original Text:      "I love programming"
                           │
                           ▼ Tokenizer
Tokens:             ["I", "love", "programming"]
                           │
                           ▼ Vocabulary Lookup
Token IDs:          [51, 872, 4381]
```

> **Note:** A Token ID is just a unique number assigned to a token by the tokenizer. It contains no semantic meaning—it is simply a lookup mapping.

---

## **3. Embeddings & Positional Encoding**

### **Static Embeddings (Initial Vectors)**

To give tokens mathematical meaning, every Token ID is converted into a list of numbers called an **Embedding Vector** (e.g., `[0.41, -0.82, 1.34, ...]`).

In this multi-dimensional space, words with related concepts sit closer together:
* **King** and **Queen** share similar conceptual coordinates.
* **Banana** and **Laptop** sit in completely different areas of vector space.

### **Why Word Order Matters (Positional Encoding)**

Language is not an unordered bag of words:
* *"Dog bites man"* $\neq$ *"Man bites dog"*
* *"Piyush teaches Ayush"* $\neq$ *"Ayush teaches Piyush"*

Because modern Transformers process all words at once in parallel, they need explicit markers indicating where each word sits:

$$\text{Input to Transformer} = \text{Token Embedding} + \text{Positional Information}$$

---

## **4. Why Static Embeddings Fail: The Context Problem**

A static dictionary embedding gives the word **"bank"** the exact same starting vector every time. But context alters meaning:

* *"I deposited money at the bank."* (Financial institution)
* *"We sat on the bank of the river."* (Riverbank)

A token cannot remain an isolated island. It must gather clues from surrounding tokens to update its vector into a **Context-Specific Representation**. This is where **Self-Attention** steps in.

---

## **5. Self-Attention: The Query, Key, and Value (Q, K, V) Deep Dive**

Self-Attention allows every token in a sentence to look at every other token, calculate relevance, and blend in relevant information.

### **The Real-World Search Analogy**

Think of looking for a video on YouTube:
* **Query (Q):** What you type into the search bar (*"best CPP course"*).
* **Key (K):** The video title and metadata tags that YouTube checks against the query to see if it matches.
* **Value (V):** The actual video content you watch once the match is found.

| Vector | Conceptual Question | Real Role in Attention |
| :--- | :--- | :--- |
| **Query (Q)** | *"What information am I looking for?"* | Sent out by the current token to inspect other tokens. |
| **Key (K)** | *"What kind of information do I contain?"* | Acts as labels that queries match against. |
| **Value (V)** | *"What content do I provide if matched?"* | The actual information contributed to the new vector. |

---

### **Why Does Each Token Need 3 Separate Vectors?**

Why not just use one single vector for everything?

Consider a person named **Piyush**:
* If you ask: *"Who knows Java?"* $\rightarrow$ You evaluate Piyush's technical skills.
* If you ask: *"Who lives closest to the office?"* $\rightarrow$ You evaluate Piyush's home location.
* If you ask: *"Who should lead the team?"* $\rightarrow$ You evaluate Piyush's communication skills and availability.

It is the same person, but different contexts require evaluating completely different aspects.

By projecting every token into three separate vectors (**Q, K, V**), the model decouples three distinct jobs:
* **Query (Q):** How the token looks for help.
* **Key (K):** How the token announces itself to help others.
* **Value (V):** What actual information it transfers when selected.

---

### **The Self-Attention Math Flow (Step-by-Step)**

Take the sentence: *"The animal didn't cross the street because it was too tired."*

```text
1. Emit Query:
   Token "it" sends out its Query vector: Q("it")
                               │
                               ▼
2. Match with Keys (Relevance Scores):
   Q("it") • K("animal")   ───►   Score = 0.60  (High relevance: animals get tired)
   Q("it") • K("street")   ───►   Score = 0.20  (Low relevance: streets do not get tired)
   Q("it") • K("because")  ───►   Score = 0.05
                               │
                               ▼
3. Weight the Values:
   Take the calculated scores and multiply them by each token's Value (V) vector:
   
   New Vector for "it" = 0.60 × V("animal") + 0.20 × V("street") + 0.05 × V("because")

   Result: The vector representing "it" is no longer a generic pronoun—it is now mathematically enriched with the context of "animal".
```

---

## **6. Transformer Blocks: Layer-by-Layer Refinement**

A Transformer is not just one attention step—it is a stack of multiple Transformer blocks repeated over and over (often dozens of layers):

```text
Input Embeddings + Position Info
               │
               ▼
┌──────────────────────────────┐
│     Transformer Layer 1      │  ──► Detects basic grammar and local word pairs.
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Transformer Layer 2      │  ──► Captures multi-word phrases and references.
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Transformer Layer N      │  ──► Builds deep semantic relationships and logic.
└──────────────┬───────────────┘
               │
               ▼
Final Contextualized Representations
```

### **Analogy: Think of editing a photograph**
* **Layer 1:** Basic adjustments (brightness, contrast).
* **Layer 2:** Removing blemishes, balancing colors.
* **Layer 3:** Applying artistic filters, adding effects.
* **Layer N:** Final professional grade retouching and composition.

Each layer builds upon the previous one, progressively refining the representation into a final polished result.

---

## **7. The Output Phase: Logits, Softmax & Decoding**

Once the sequence passes through all layers, the model looks at the final token's vector and prepares to make a prediction:

```text
Final Context Vector
         │
         ▼
Raw Vocabulary Scores (Logits)
(e.g., Delhi: 12.8, Mumbai: 8.1, Kolkata: 5.2, Apple: -4.1)
         │
         ▼ Softmax Function
Probability Distribution (Sums to 100%)
(e.g., Delhi: 92%, Kolkata: 2%, Mumbai: 1%, Others: 5%)
         │
         ▼ Decoding Strategy
Selected Token ("Delhi")
```

* **Logits:** Raw, unnormalized numerical scores assigned to every token in the vocabulary (e.g., 100,000 words).
* **Softmax:** Turns those raw numbers into a clean percentage distribution where all options sum to 1.0 (100%).
* **Decoding Strategy:** The rule used to pick the winning token.

---

## **8. Decoding Strategies & Temperature**

The Model calculates probabilities; the Decoder decides how to pick from them.

### **1. Greedy Decoding**
* Always select the token with the highest probability.
* **Problem:** Produces stiff, repetitive, and predictable text.

### **2. Sampling (Weighted Lottery)**
* Treat probabilities like raffle tickets. If Java has 40% and Python has 35%, Java is most likely, but Python still has a real chance of being chosen. This creates natural, creative variation.

### **3. Temperature: Controlling Randomness**
Temperature adjusts the logits before Softmax is calculated:

$$\text{Adjusted Logits} = \frac{\text{Original Logits}}{\text{Temperature}}$$

* **Temperature = 1.0 (Default):** Uses the raw learned probabilities as-is.
* **Low Temperature (0.1 - 0.5):** Sharpening effect. Divides logits by a fraction, making the gap between the top choice and runner-up much wider. The output becomes focused, predictable, and factual (great for coding and technical Q&A).
* **High Temperature (1.2 - 2.0):** Flattening effect. Divides logits by a larger number, pulling all scores closer together. The output becomes creative and diverse, but increases the risk of hallucinations and nonsense.

---

## **9. Autoregressive Streaming: Why Output Streams Live**

LLMs generate text autoregressively:
* **Auto (Self):** It uses its own generated output as part of the next input context.
* **Regressive:** Future predictions depend on past outputs.

```text
Step 1: Input: "Java"                   ──► Predicts "is"
Step 2: Input: "Java is"                ──► Predicts "a"
Step 3: Input: "Java is a"              ──► Predicts "programming"
Step 4: Input: "Java is a programming"  ──► Predicts "language"
```

Because each token is created one after another, applications can stream tokens to the screen the moment they are generated instead of waiting for the full response to finish.

---

## **10. Summary Pipeline of an LLM**

```text
User Prompt
    │
    ▼
Tokenizer ──► Converts text into Token IDs
    │
    ▼
Embeddings + Positional Encodings ──► Converts IDs into initial position-aware vectors
    │
    ▼
Transformer Layers (Self-Attention with Q, K, V) ──► Builds rich contextual vectors
    │
    ▼
Final Output Layer ──► Generates raw Logits across vocabulary
    │
    ▼
Softmax (scaled by Temperature) ──► Converts logits to a Probability Distribution
    │
    ▼
Decoding Strategy ──► Picks next token (Greedy or Sampling)
    │
    ▼
Append Token to Context ──► Repeat loop until finished
```