# Day 09: Vector Search, Storage Challenges & k-d Trees

---

## 1. The Core Shift: Exact Match vs. Vector Similarity

In traditional databases, we look for exact matches or range conditions. For example, we might look for movies where `GENRE = 'Sci-Fi'` or `YEAR > 2000`. This is called exact match search.

Vector search, on the other hand, deals with geometric proximity. It doesn't look for exact matches but for data points that are "closest" to the query in a high-dimensional space. This is particularly useful for unstructured data like text, images, or audio, where we want to find items with similar meanings or characteristics.

```text
Traditional Search: Query -> [Condition / ID / Range] -> Match or No Match (Binary)
Vector Search:      Query -> [Vector Embedding]       -> More Similar or Less Similar (Continuous)
```

- **Traditional DBs:** Ask *"Which rows strictly match this condition?"* (e.g., `WHERE id = 42` or `WHERE year >= 2010`).
- **Vector Search:** Asks *"Which stored items are closest in meaning to this query?"* (Nearest Neighbor Search). Exact equality is rarely useful in semantic search.
- **Can MySQL Store Vectors?:** Yes. Relational databases can store vectors as JSON, binary BLOBs, or dedicated vector data types. The core limitation is not storage, but retrieval speed during high-volume similarity searches.

---

## 2. Anatomy of a Minimal Vector System

To build the simplest functional vector search engine, three primary components and a clear runtime workflow are required:

### The Three Required Storage Fields

1. **Unique Identifier:** A column to reference the item (e.g., movie ID, product ID).
2. **Vector Data:** The numerical vector itself (e.g., a JSON array or BLOB).
3. **Metadata (Optional but Recommended):** Contextual fields like movie title, year, director, or genre, which allow for filtering results (e.g., *"Find similar movies, but only those released after 2010"*).

### Key Concepts

- **Embedding Model vs. Vector Database:** The embedding model understands semantic meaning and creates the numeric representation. The vector database does not understand language; its job is efficient multidimensional storage and retrieval.
- **K-Nearest Neighbors (K-NN):** $K$ determines how many of the top closest items to return ($K=1$ yields the single closest item; $K=10$ yields the top 10).

---

## 3. The Scalability Bottleneck (Brute-Force / Exact NN)

Checking every vector guarantees 100% accuracy (Exact Nearest Neighbor search), but degrades rapidly at scale:

```text
Brute-Force Scan: Query Q ──> Compares with 100% of Stored Vectors ──> O(N * D) Work
```

- **$N$:** Number of vectors
- **$D$:** Vector dimension

Since each embedding vector has $D$ dimensions, we need to perform $D$ calculations for each vector in the database.

> **Example:** $Q[x, y, z]$, $V_1[a, b, c]$. For each vector, we need to perform 3 calculations: dot product $(x \cdot a + y \cdot b + z \cdot c)$. Having $N$ vectors results in $O(N \times D)$ operations.

### Compute Complexity ($O(N \times D)$)
For $N = 10,000,000$ vectors and $D = 1536$ dimensions (e.g., OpenAI embeddings), one query requires approximately **$15.36\text{ billion}$ dimension-level operations** ($10^7 \times 1536$).

### Memory Requirement
A vector is an array of `float32` (4 bytes):
- $1\text{ vector} = 1536 \text{ dimensions} \times 4 \text{ bytes (float32)} \approx 6\text{ KB}$
- $1\text{ Million vectors} \approx 6\text{ GB}$
- $100\text{ Million vectors} \approx 600\text{ GB}$ of RAM just for raw vector coordinates (excluding metadata, IDs, and indexes).

### Why Not Just Use Disk?
Moving vectors to disk solves memory capacity constraints but introduces massive disk I/O bottlenecks. Reading gigabytes of vector data sequentially for every query introduces unacceptable latency (RAM access is orders of magnitude faster than disk access).

---

## 4. Why Can't We Use Standard B-Trees?

### 1D Space: Values Have a Single Natural Order
```text
Tree Node: [30] ──> If Target is 42 (42 > 30) ──> Prune Left Subtree Completely.
```
In 1D, we can discard 50% of the candidate space at every balanced branch because an absolute order exists.

### Multi-Dimensional Space: No Natural Scalar Order Exists
Consider $A = [2, 8]$ and $B = [5, 3]$:
- On the $x$-axis, $A.x < B.x$
- On the $y$-axis, $A.y > B.y$

There is no definitive way to declare which vector is overall "greater" or "smaller," preventing standard 1D binary tree structures from working directly.

---

## 5. k-d Trees: Mechanics, Pruning & The Failure Point

The "kd" in k-d tree refers to "k-dimensions." A 2-dimensional k-d tree is essentially a binary tree where each node splits the space along one of the dimensions (e.g., the x-axis at level 0, the y-axis at level 1, x-axis at level 2, and so on).

**The Splitting Rule:** At each level of the tree, the data is partitioned based on a specific dimension. The goal is to create a balanced tree structure that efficiently subdivides the space.

```text
                           Root (Splits on X = 6)
                           /                     \
                Left (X < 6)                 Right (X >= 6)
                Splits on Y = 5            Splits on Y = 7
```

### How Pruning Works (The Ideal Case)

Pruning means skipping an entire branch because it is geometrically impossible for a closer vector to exist there.

```text
Pruning Rule:
Does your "search circle" touch or cross the dividing wall?
├── NO  ──> No one on the other side can possibly be closer. PRUNE (ignore the other room completely)
└── YES ──> Someone on the other side might be inside your circle. MUST SEARCH BOTH ROOMS
```

```text
Dividing Boundary (X = 5)
         │
         │           * Query Q (X = 8)
         │           (Distance to boundary = 3)
         │
Current Best Candidate found has Distance = 1
Since Distance to Boundary (3) > Best Distance (1):
──> LEFT BRANCH CANNOT BE CLOSER ──> Prune Left Branch!
```

### The Edge Case: When Pruning Fails

Pruning breaks when the query point lies closer to the dividing boundary than the distance to your current best candidate.

```text
Dividing Boundary (X = 5)
       │
       │ * Query Q (X = 5.1)
       │ (Distance to boundary = 0.1)
       │
Current Best Candidate found has Distance = 2.0
Since Distance to Boundary (0.1) < Best Distance (2.0):
──> A closer vector could easily sit right across the border!
──> MUST SEARCH BOTH SIDES (Pruning Fails).
```

### The Decision Rule for Any $K$

```text
Do you have K items in your bucket?
├── NO  ──> Search Radius = ∞ ──> CANNOT PRUNE (Search both sides)
└── YES ──> Search Radius = Distance to K-th item
             │
             ├── If Radius < Distance to Wall ──> PRUNE other side (Skip it!)
             └── If Radius >= Distance to Wall ──> CANNOT PRUNE (Search both sides!)
```

This shows why larger values of $K$ make k-d trees even slower: the search circle radius is wider (set by the $K$-th farthest candidate), which causes it to cross boundaries more often and triggers more backtracking into other branches.

---

## 6. The Curse of Dimensionality

In low dimensions (2D or 3D), queries only occasionally cross boundaries, so k-d trees prune large swathes of the search space effectively.

```text
2D / 3D Space: Few boundaries ──> Most regions pruned safely ──> Fast O(log N) search
1536D Space:   1536 boundary checks ──> Query is near a boundary in many dimensions ──> Must search both sides repeatedly.
```

- In $1536$-dimensional embeddings, each node check introduces another axis boundary.
- The probability that a query is farther from all boundaries than the current best radius approaches zero.
- Because the tree cannot prove the opposite side is irrelevant, it is forced to explore both branches repeatedly.
- **Result:** The search visits 70% to 90%+ of the nodes. The tree degenerates back into an expensive brute-force scan, but with the added computational overhead of recursive tree traversal.

```text
Exact Search:   Checks 100% of data ──> 100% accurate, but too slow for high-dim scale (O(N*D))
k-d Tree:       Attempts geometric pruning ──> Collapses in high dimensions (Curse of Dimensionality)
The Solution:   Approximate Nearest Neighbor (ANN) algorithms (trade a tiny fraction of accuracy for orders-of-magnitude speed)
```