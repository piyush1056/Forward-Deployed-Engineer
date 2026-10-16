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
