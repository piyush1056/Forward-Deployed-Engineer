# Day 08: Building a Movie Recommendation Engine with Vector Embeddings

## 1. Overview & Objective

This project builds a Netflix-style movie recommendation engine from scratch without relying on a generative Large Language Model (LLM) to decide recommendations.

Instead of asking a chatbot what to watch, recommendations are calculated mathematically using:
- **Embedding Models**
- **Vector Coordinates**
- **Semantic & Cosine Similarity**
- **Score Ranking**

---

## 2. Core Concepts: Embeddings & Vector Space

### Why Embeddings?
Keyword search fails when words differ but meanings align:
- **Description A:** *"An astronaut is stranded on Mars."*
- **Description B:** *"A man must survive alone on another planet."*

These two sentences share almost zero vocabulary, yet human intuition knows $A \approx B$. Computers cannot compute math directly on raw text; they require numbers.

```text
Language (Text) ───► Numerical Representation (Vectors) ───► Mathematics (Similarity)
```

### Distributed Meaning
An embedding transforms input text into an array of floating-point numbers (e.g., `[0.014, -0.031, 0.087, ...]`).

Individual dimensions rarely map to human concepts like *"Dimension 17 = sadness"*. Meaning is distributed across the entire vector. Inputs with similar semantics end up closer together in vector space.

---

## 3. Generative LLM vs. Embedding Model: Are They Different?

Both models often use Transformer-based neural network architectures and share the first step: text is converted into tokens and token IDs. However, their core objectives and architectures solve two completely different problems.

### The Core Difference
* **Embedding Model (Specialized for Representation):**
  * **Goal:** Takes input text and converts its meaning into a fixed-size numerical vector.
  * **How it works:** It does not try to predict what comes next. It captures semantic meaning across numbers.
  * **Output:** A vector of numbers (e.g., `[-0.024, 0.182, ...]`)
  * **Cannot Answer Questions:** If you ask *"What is the capital of India?"*, it will **not** answer *"New Delhi"*. It will simply return an array of coordinates.

* **Generative LLM (Specialized for Generation):**
  * **Goal:** Predicts and outputs language token-by-token.
  * **How it works:** Given *"The astronaut opened the..."*, it calculates probabilities for candidate next words (`door: 0.31`, `hatch: 0.27`, `airlock: 0.19`). It picks a token and repeats the loop sequentially.
  * **Output:** Human-readable text strings.

| Question / Feature | Generative LLM | Embedding Model |
| :--- | :--- | :--- |
| **Primary Job** | Generate language / text | Represent meaning / coordinates |
| **Output Type** | Text strings | Array of numbers (`float[]`) |
| **Answering Questions** | Answers directly (e.g., "New Delhi") | Returns a vector (e.g., `[0.023, -0.193, ...]`) |

---

## 4. Why Not Simply Use an LLM for Recommendations?

When asking for generic recommendations like *"movies similar to Interstellar"*, an LLM can answer from its pre-trained memory—a generic answer, not necessarily from the catalog. However, for an internal streaming catalog (e.g., MovieHub with 7,000+ custom, regional, or unreleased movies), prompting an LLM with the entire dataset introduces serious bottlenecks:

### Problem 1 - Context Window Limits
* Passing thousands of movie descriptions in every prompt is impractical and expensive.
* Even with large context windows, shoving an entire catalog into a prompt increases prompt processing costs dramatically and degrades retrieval precision.

### Problem 2 - Redundant Computation
* If 100,000 users search the catalog, passing the static catalog repeatedly forces the LLM to re-read unchanged text every time.
* This wastes massive compute cycles re-encoding the same static catalog over and over again.

### Problem 3 - We Do Not Need Generation 
* The recommendation goal is simply: *"Which movie is closest in meaning to this query?"*
* We do not need the model to write conversational explanations like:
  > *"The Martian would be an excellent choice because it features survival on Mars..."*
* We only need numerical similarity scores:
  * Movie A: `0.87`
  * Movie B: `0.81`
  * Movie C: `0.42`
* Recommendation is fundamentally a **ranking problem**, not a text-generation problem. Once converted to vectors, ranking is just simple math.

### Problem 4 - Cost and Latency
* **Generative LLMs are slow and expensive:** They generate words sequentially (`token -> token -> token`).
* **Embeddings are fast and cheap:** You make a single request to convert the user query to a vector.
* **Local Math Execution:** Comparing the query vector against 7,000 movie vectors happens locally via mathematical formulas (like Cosine Similarity) without making any additional external API calls.

### First Principles Solution: Precomputation
* **Stable Data (Movie Catalog):** Description of movies rarely change. Calculate vectors once and store them.
* **Dynamic Data (User Queries):** Convert the active user search query into a vector on demand.
* **Comparison:** Perform fast mathematical vector comparisons without LLM calls.

```text
[Movie Description] ──► [Embedding Model] ──► [Movie Vector] ──► (Saved in Memory / Storage)
                                                                            │
[User Search Query] ──► [Embedding Model] ──► [Query Vector] ───────────────┴──► [Cosine Similarity] ──► Ranked Results
```

---

## 5. Can We Combine Embeddings and LLMs?

Yes! Each system performs the job it is best suited for:
* **Embedding Model** ──► **SEARCH / RETRIEVAL**
* **Generative LLM** ──► **GENERATION / REASONING**

```text
User Query: "I want an emotional space movie where protagonist is isolated"
                                │
                                ▼
                       [ Embedding Model ]
                                │
                                ▼
                         [ Query Vector ]
                                │
                                ▼
               [ Search Catalog via Similarity ]
                                │
                                ▼
               Retrieved Movies: [The Martian, Gravity]
                                │
                                ▼
                             [ LLM ]
                                │
                                ▼
Final Answer: "Based on your preference, The Martian would be a strong match because..."
```

**Key Concept:** This separation of roles—searching internal data with embeddings, then passing matching results to an LLM for final generation—forms the foundational basis of RAG (Retrieval-Augmented Generation).

---

## 6. The Core 4-Step Mental Model

Every vector search and recommendation system relies on four fundamental stages:

```text
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ 1. REPRESENT │ ───► │   2. STORE   │ ───► │  3. COMPARE  │ ───► │   4. RANK    │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

1. **REPRESENT:** Pass text through an embedding model to get coordinates.
2. **STORE:** Save the vectors in a list, database, or vector store.
3. **COMPARE:** Calculate similarity between a target vector and all catalog vectors.
4. **RANK:** Sort descending by similarity score (e.g., $0.89, 0.84, 0.78, 0.21$).

---

## 7. System Architecture & Workflows

### System Scope
- **Type:** Content-Based Recommendation System (matches movie description similarity).
- **Out of Scope:** Collaborative Filtering (matching based on user watch histories, ratings, or "users who watched X also watched Y").

### Real-World Recommendation Systems vs. This Project
In real production systems (like Netflix or YouTube), recommendations combine multiple signals together:
* Movie Content / Descriptions
* User Watch History & Clicks
* Ratings & Likes
* Behavior of similar users (Collaborative Filtering)
* Freshness / Trending content
* Business rules & promotions

**Why isolate embeddings in this project?**  
To master the vector mechanics first. Understanding vector similarity in isolation makes it easy to integrate with other ranking signals later.

### Workflow 1: Catalog Initialization (Offline Phase)
Executed once to prepare catalog embeddings.

```text
[ Movie 1 Description ] ──► [ Embedding Model ] ──► [ Vector 1 ] ──┐
[ Movie 2 Description ] ──► [ Embedding Model ] ──► [ Vector 2 ] ──┼──► Save to List / Database
[ Movie N Description ] ──► [ Embedding Model ] ──► [ Vector N ] ──┘
```

### Workflow 2: Feature 1 — Semantic Search (Online Phase)
Handles queries where the user describes a movie concept rather than searching by title.

```text
User Input: "a person trying to stay alive far away from Earth"
                           │
                           ▼
                  [ Embedding Model ]
                           │
                           ▼
                     [Query Vector]
                           │
                           ▼
          [ Compare Against All Movie Vectors ]
                           │
                           ▼
                  [ Calculate Scores ]
                           │
                           ▼
                     [ Sort / Rank ]
                           │
                           ▼
                 Top Results Returned:
                 1. The Martian (0.87)
                 2. Gravity (0.81)
                 3. Interstellar (0.75)
```

### Workflow 3: Feature 2 — Similar Movie Recommendations
When a user views a movie and requests related options, no new embedding generation is required. The precomputed vector is used directly.

```text
User selects: "Interstellar"
                     │
                     ▼
       Fetch Precomputed Movie Vector
                     │
                     ▼
    [ Compare with Remaining Movie Vectors ]
                     │
                     ▼
            [ Calculate Scores ]
                     │
                     ▼
               [ Sort / Rank ]
                     │
                     ▼
           Recommended Movies:
           1. Arrival
           2. The Martian
           3. Gravity
```

---

## 8. Why This Project Matters & Final Mental Model

### The General Pattern
This architecture is not limited to movies. Whenever the engineering problem looks like:
> **"Find the items in my dataset whose meaning is closest to this input."**

Use this exact same pattern:
```text
REPRESENT ───► STORE ───► COMPARE ───► RANK
```

The same engine powers:
- **E-commerce:** Finding related products
- **Enterprise Docs / Code:** Semantic code & documentation search
- **Customer Support:** Auto-routing tickets to similar resolved issues
- **Job Boards:** Matching resumes to job listings

### Final Mental Model
Do not think of an embedding model as a chatbot.  
Think of it as a machine that translates human meaning into spatial coordinates.  
Once meaning is expressed as coordinates, searching and recommending is purely coordinate mathematics.