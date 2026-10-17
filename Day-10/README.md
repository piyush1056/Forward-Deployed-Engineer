# Day 10: Vector Databases & ANN Algorithms

---

## 1. First-Principles Foundation: The Vector Search Problem

### The Core Premise

- **Semantic Meaning = Geometric Distance:** Text, images, or audio are transformed by machine learning models into numeric arrays called embeddings.
- Items with similar semantic meaning end up placed physically close to each other in vector space (e.g., *Interstellar* is close to *The Martian*, while *Titanic* is far away).

```text
[Real-world Concept] ──(Embedding Model)──> [Vector in N-Dimensions] ──> [Nearby Vectors = Similar Meaning]
```

### The Naive Approach: Exact KNN (k-Nearest Neighbors)

To find the top 10 most relevant items for a query:
1. Turn the query into an embedding vector.
2. Calculate the distance (e.g., Cosine similarity or Euclidean/L2) between the query vector and every single vector in the database.
3. Sort all scores and return the top 10.

#### The Exact Search Workflow

```text
[User Query] 
     │
     ▼
[Query Vector Q]
     │
     ▼
[Compare Q with Vector 1]
[Compare Q with Vector 2]
...
[Compare Q with Vector N]
     │
     ▼
[Sort & Retain Top K] ──> [Return Mathematically Exact Top 10]
```

### Why Exact Search Breaks Down at Scale

Assume $N = 10,000,000$ vectors and $D = 1,536$ dimensions (e.g., OpenAI embeddings). Every query requires calculating similarities across every dimension:

$$\text{Approx } 10,000,000 \times 1,536 = 15,360,000,000 \text{ (15+ Billion calculations per query)}$$

With thousands of concurrent users, computing brute-force dot products causes extreme CPU/GPU bottlenecks and high query latency.

---

## 2. Approximate Nearest Neighbor (ANN) Search

Instead of finding the exact $K$ nearest neighbors, ANN algorithms find an approximation of the $K$ nearest neighbors.

This trade-off between accuracy and performance is acceptable for most real-world applications, where finding the "mostly" correct answer quickly is often better than finding the exact answer slowly.

### First Thought Intuition: The Delhi Coffee Shop Analogy

If I am in Delhi looking for the nearest coffee shop, I do not calculate my distance to every coffee shop in Mumbai, Bangalore, or Chennai. I instantly prune those regions and only search within Delhi.

- **Exact Search asks:** *"How do I calculate the distance to every vector faster?"*
- **ANN asks:** *"How can I safely avoid looking at 99% of the vectors in the first place?"*

```text
[Brute Force / Exact KNN]   ──> Compares 10,000,000 vectors ──> 100% Exact Recall, Massive Compute
[Approximate NN (ANN)]      ──> Prunes down to ~10,000 vectors ──> High Recall, Low Latency / Compute
```

### How Approximation Actually Works

- ANN does not perform sloppy math on distance formulas.
- The approximation happens during candidate selection: ANN filters the dataset down to a small candidate set and performs exact, high-precision distance calculations on just those candidates.
- **Why ANN can miss the true nearest neighbor:** A true nearest neighbor might sit just across an artificial index boundary or along an unvisited graph branch, causing it to never be evaluated.

```text
[Query Q] ──> [Index Filter] ──> [Examines Cluster / Branch A] ──> Misses Vector B (Vector B was just over the border in Cluster C)
```

### Evaluation Metric: Recall@K

It measures what percentage of the time the ANN algorithm finds the true nearest neighbor. For example, if $\text{Recall@10}$ is $99\%$, it means that $99\%$ of the time, the true nearest neighbor was found within the top 10 results returned.

$$\text{Recall@K} = \frac{\text{Number of Times True Neighbor Found in Top K}}{\text{Total Queries}} \times 100$$

> **Example:** If Exact KNN returns items $[A, B, C, D, E, F, G, H, I, J]$ for a query, and ANN returns $[A, B, C, D, E, F, G, H, X, Y]$, then 8 out of 10 true neighbors were found:
> $$\text{Recall@10} = \frac{8}{10} = 0.8 \text{ or } 80\% \text{ accuracy}$$

---

## 3. Algorithm 1: IVF (Inverted File Index)

Divide the continuous vector space into geometric regions (clusters). At query time, check which cluster centers are closest to the query, and only inspect the vectors belonging to those clusters.

### Key Concepts

- **Centroid:** The central mean position (the "neighborhood address") representing all vectors inside a given cluster.
- **Inverted List:** A lookup list where each centroid points to an array of its constituent vectors.
- **Probes (`nprobe`):** The number of adjacent centroids/clusters to search per query.

### Workflows for IVF

```text
[N Unindexed Vectors]
         │
         ▼
[Cluster Vectors into K Groups (e.g., K-Means)]
         │
         ▼
[Compute Centroid Vector for Each Cluster]
         │
         ▼
[Build Inverted Lists: Assign Each Vector ID to its Nearest Centroid]
         │
         ▼
[Store Index on Disk / Memory for Serving]
```

### Query Execution Workflow

```text
[User Query Vector Q]
         │
         ▼
[Calculate Distance between Q and all Centroids]
         │
         ▼
[Select the Top 'nprobe' Closest Centroids (e.g., top 5)]
         │
         ▼
[Fetch the Inverted Lists for Only Those 5 Centroids]
         │
         ▼
[Compute Exact Vector Distances for vectors in those lists]
         │
         ▼
[Sort & Return Top K Results]
```

### The Boundary Problem & The `nprobe` Dial

If a query vector lies right on the edge of Cluster A (close to its centroid), its true nearest neighbor might sit right across the boundary line in Cluster B.

```text
   Cluster A           :        Cluster B
   [• Vector 1]        :
   [• Vector 2]        :
   [• Q (Query)]  <─── : ───>  [• True Nearest Vector!]
                       :  (Boundary)
```

- **If `nprobe = 1`:** Only Cluster A is searched. The true nearest vector in Cluster B is missed.
- **If `nprobe = 5`:** Both Cluster A and Cluster B are searched. The neighbor is retrieved safely at the cost of computing distances against a few more vectors.

### Trade-offs and Performance

- **High Speed:** Reduces search space from $N$ to approximately $N/K$ (where $K$ is the number of clusters).
- **Moderate Accuracy:** Accuracy drops as `nprobe` decreases.
- **Best For:** Datasets where 100% exact recall is not strictly required (e.g., movie recommendations, image search).
- **Parameter Tuning:** Selecting the number of clusters and `nprobe` is critical for balancing speed and accuracy.

---

## 4. Algorithm 2: HNSW (Hierarchical Navigable Small World)

### First Principle

Instead of partitioning space into clusters, connect vectors into a graph where vectors are nodes and similarities are edges. Search becomes an act of graph traversal (navigation).

### The Road & Skip-List Analogy

Navigating a flat graph with millions of nodes step-by-step requires far too many hops. HNSW structures graphs into a hierarchy of layers, analogous to transport networks or multi-level skip lists:

- **Top Layers (Highways):** Very few nodes, long-distance jumps across vector space to quickly locate the broad neighborhood.
- **Bottom Layers (Local Streets):** Every vector exists here (Layer 0), connected by short edges for dense, fine-grained local navigation.

```text
Local Street ──> Main Road ──> Highway ──> Main Road ──> Local Street ──> (Accurate Location Found)
```

- **Highways:** Long jump (Faster)
- **Local Streets:** Precise jump (Accurate)

### Layer Architecture

```text
Layer 2 (Highway)      :  [Node A] ───────────────────────────> [Node M] ─────────────> [Node Z]
                                │                                    │
                                ▼                                    ▼
Layer 1 (Main Arterials): [Node A] ───> [Node F] ─────────────> [Node M] ───> [Node S] ─> [Node Z]
                                │          │                         │          │          │
                                ▼          ▼                         ▼          ▼          ▼
Layer 0 (Local Streets) : [A]─[B]─[C]─[D]─[E]─[F]─[G]─[H]─...─[M]─[N]─...─[S]─...─[W]─[X]─[Y]─[Z]
                          (Contains 100% of the dataset)
```

### Query Navigation Workflow

```text
[Incoming Query Q (target near X)]
         │
         ▼
[Enter at Top Layer Entry Point (Node A)]
         │
         ▼
[Greedy Hop to Nearest Neighbor in Top Layer (Hop A ──> M)]
         │
         ▼
[Drop Down to Next Layer at Node M]
         │
         ▼
[Hop to Closer Neighbor in Current Layer (Hop M ──> S)]
         │
         ▼
[Drop Down Layer by Layer until reaching Layer 0]
         │
         ▼
[Perform Local Beam/Greedy Search at Layer 0 (Hop S ──> V ──> W ──> X)]
         │
         ▼
[Return Top K Nearest Vectors]
```

### Key HNSW Parameters & Trade-offs

- **$M$ (Max Edges per Node):** Controls how many connections each vector maintains.
  - **Low $M$ (e.g., 8):** Lower memory usage, but harder to navigate (risk of getting stuck).
  - **High $M$ (e.g., 64):** Highly connected graph, higher recall, but demands significantly more RAM.
- **Memory Penalty:** Because every node must store pointers to its directional neighbors across multiple layers, HNSW indexes are memory-heavy and often need to remain entirely resident in RAM.

---

## 5. Architectural Comparison: IVF vs. HNSW

| Feature | IVF (Inverted File Index) | HNSW (Hierarchical Navigable Small World) |
| :--- | :--- | :--- |
| **Core Concept** | Space partitioning via geometric Voronoi clustering. | Multi-layer graph traversal (skip-list applied to graphs). |
| **Search Mechanism** | Compare with centroids $\rightarrow$ inspect inverted lists. | Route from top highway layers down to local street layer. |
| **RAM Footprint** | Low to moderate (stores vectors grouped in inverted lists). | Very high (stores raw vectors plus multi-layer edge graphs). |
| **Build Time** | Faster (requires clustering like K-Means). | Slower (iterative edge evaluation for every inserted node). |
| **Query Latency / Recall** | Good query latency; sensitive to `nprobe` settings. | Superior query speed and higher recall out of the box. |

---

## 6. Vector Compression: Product Quantization (PQ)

### The Storage Crisis

High-dimensional vectors require substantial storage.

#### A Standard "Dense" Embedding (like those from OpenAI/SBERT)

1. **Dimension Size:** Common from 768 to 1536 dimensions.
2. **Storage per Vector:**
   - At 1536 dimensions.
   - Using FP32 (4 bytes per dimension).
   - Storage Cost: $1536 \times 4 = 6\text{ KB per vector}$.
   - For 100 million vectors this is **600 GB**!
   - Adding metadata, system overhead, and graph links (HNSW) quickly drives memory requirements into multiple terabytes.

### First Principles of Product Quantization

Do not store floating-point numbers with high precision. Break vectors down into smaller slices (sub-vectors), identify recurring patterns across the dataset, and store the ID of the closest matching pattern (centroid) instead of raw numbers.

### Step-by-Step PQ Compression Example

- **Original Vector (8-dim):** `[0.2, 0.8, -0.4, 0.1, 0.7, -0.2, 0.9, 0.3]` (32 bytes)
- **Split into Sub-vectors:** Split the 8D vector into 4 sub-vectors of 2 dimensions each:
  - Part 1: `[0.2, 0.8]`
  - Part 2: `[-0.4, 0.1]`
  - Part 3: `[0.7, -0.2]`
  - Part 4: `[0.9, 0.3]`
- **Build Codebooks:** Cluster all sub-vectors across the entire dataset into 256 representative centroids (codewords).
- **Assign IDs:**
  - Part 1 is closest to Centroid #17
  - Part 2 is closest to Centroid #203
  - Part 3 is closest to Centroid #81
  - Part 4 is closest to Centroid #6
- **Compressed Vector:** Store simply as `[17, 203, 81, 6]`.

### The Power of 256 Centroids

$256 = 2^8$, which means any integer from 0 to 255 fits exactly into 1 byte (8 bits).

For a 1,536-dimensional vector:
- Slice into 96 sub-vectors (each containing $1,536 / 96 = 16$ dimensions).
- Each sub-vector maps to an ID from 0 to 255 (1 byte).
- **Compressed vector size:** $96 \times 1\text{ byte} = 96\text{ bytes}$.
- **Compression Ratio:** $6\text{ KB} / 96\text{ bytes} \approx 64\times\text{ compression}$.

> **Trade-off Note:** PQ is lossy compression. The reconstructed vectors approximate the original coordinates, trading a slight drop in accuracy for major memory savings.

### How Compression (PQ) and ANN Work Together

- **The Storage Problem:** Raw vectors are huge (6 KB each). We compress them using Product Quantization (PQ) into tiny codes (e.g., 96 bytes) so they fit easily into memory.
- **Where does ANN (IVF or HNSW) fit in?**
  - **ANN (like HNSW or IVF)** is the map/search algorithm that tells you which movies to look at.
  - **PQ (Quantization)** is the compression tool that shrinks the size of the movie vectors so reading them is lightning fast.
- In real-world high-scale vector databases (like Faiss or Qdrant), they are combined: We build an HNSW or IVF index, but store compressed PQ vectors for candidate evaluation.

---

## 7. Anatomy of a Production Vector Database

A production-grade Vector DB does much more than calculate dot products; it combines data structures across multiple layers:

```text
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Metadata Filtering (genre='Sci-Fi', year >= 2020)  │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Vector Index (HNSW, IVF, PQ accelerated)           │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Distance Metric (Cosine, Dot Product, Euclidean L2)│
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Vector Embeddings (1536-d float arrays)            │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Raw Document / Application Payload Data            │
└─────────────────────────────────────────────────────────────┘
```

**Example Record:**
```json
{
  "id": 101,
  "title": "Interstellar",
  "metadata": {
    "genre": "Sci-Fi",
    "year": 2014,
    "language": "English"
  },
  "vector": [0.21, -0.45, 0.81]
}
```

### The Metadata Problem: Hybrid Filtering

Real enterprise queries rarely look for pure similarity alone. They typically include operational filters:

```sql
Find Top 10 vectors nearest to Q 
WHERE language = 'Hindi' 
  AND genre = 'Comedy' 
  AND year >= 2020;
```

*(Combined execution must efficiently filter metadata while traversing the vector index without degrading recall or scanning every record.)*

### Standalone Vector DBs vs. Vector Extensions

```text
                 ┌───────────────────────────────────────────────────────┐
                 │                 Vector Search Systems                 │
                 └───────────────────────────┬───────────────────────────┘
                             │                               │
                             ▼                               ▼
                 [Specialized Vector DBs]           [Relational Extensions]
                 - Pinecone                         - pgvector (PostgreSQL)
                 - Qdrant                           - Extensions for MySQL/Redis
                 - Weaviate                         (Good when ACID & relational
                 (Optimized for high-scale,          data co-exist)
                  dedicated vector workloads)  
```

### Example: pgvector in PostgreSQL

```sql
-- Create table with vector column
CREATE TABLE movies (
    id BIGSERIAL PRIMARY KEY,
    title TEXT,
    embedding VECTOR(1536)
);

-- Query nearest 10 using cosine/distance operator (<=>)
SELECT * 
FROM movies 
ORDER BY embedding <=> :queryVector 
LIMIT 10;
```

---

## 8. Summary Review Checklist

```text
                      ┌────────────────────────────────────────┐
                      │      Vector DB Engineering Stack       │
                      └───────────────────┬────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         ▼                                ▼                                ▼
[Search Problem]                 [Storage Problem]               [Production System]
- Solved by: ANN                 - Solved by: PQ / Quantization  - Solved by: Vector DB
- IVF: Cluster Voronoi cells     - Sub-vectors -> Codebooks      - Embedding + Metadata
- HNSW: Hierarchical skip-graphs - 64x memory reduction          - Filter + Similarity Search
```

### Summary: How it feels like an ANN search

When a query comes in:
1. **ANN (HNSW/IVF)** guides our search through the graph or clusters, telling our CPU: *"Ignore 99% of the movies; look only at these 50 promising candidate movies."*
2. **PQ (Compressed vectors)** allows the computer to calculate the distance to those 50 candidates instantly because the data is $64\times$ smaller and fits directly in fast CPU cache memory.
3. It sorts them and returns the closest matching movies.
 