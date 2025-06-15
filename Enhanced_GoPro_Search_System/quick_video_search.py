#!/usr/bin/env python3
"""
quick_video_search.py – Lightweight embedding-only search over pre-generated
chunk embeddings (768-d text-embedding-004 vectors).

How it works
1. On start-up it scans the `Embeddings_AI_Analyzed/` directory and loads all
   text embeddings + basic metadata into memory (≈ a few MB).
2. For each user query it uses the Vertex *text-embedding-004* model to obtain a
   768-d query vector.
3. Cosine similarity is computed against every chunk (NumPy only, no sklearn).
4. The top-N results (default 5) are printed as compact JSON.

This is a stripped-down subset of `smart_video_search.py` – no keyword
extraction, synonym logic, or Gemini text generation – so it starts fast (<1 s)
 and returns results in <300 ms once embeddings are loaded.

Usage
  python3 quick_video_search.py "mountain biking POV" 10
     → top-10 matches
Environment
  • Requires `google-generativeai` (already in repo).
  • Expects a valid API key via `GEMINI_API_KEY` env var **or** the first key in
    GEMINI_KEYS fallback list.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Tuple

import numpy as np
import google.generativeai as genai

# ----------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------

EMBED_DIR = Path(__file__).with_name("Embeddings_AI_Analyzed")
DEFAULT_TOP_N = 5

# Fallback key list (same as full system)
GEMINI_KEYS = [
    os.getenv("GEMINI_API_KEY", ""),
    "AIzaSyAKvr1pQOWZyZq8bCE5a1Bc1qBzDNo-5bw",
]

# ----------------------------------------------------------------------
# Helper functions
# ----------------------------------------------------------------------

def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two 1-D vectors."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


# ----------------------------------------------------------------------
# Loader
# ----------------------------------------------------------------------

def load_chunks(dir_path: Path) -> List[Dict]:
    """Load all text embeddings and basic metadata from embedding folders."""
    if not dir_path.exists():
        raise FileNotFoundError(f"Embedding directory not found: {dir_path}")

    chunks: List[Dict] = []
    for video_dir in dir_path.iterdir():
        if not video_dir.is_dir():
            continue
        text_file = video_dir / "text_embeddings.json"
        if not text_file.exists():
            continue
        try:
            with open(text_file, "r") as f:
                data = json.load(f)
            for item in data.get("embeddings", []):
                emb = item.get("embedding")
                if not emb or len(emb) != 768:
                    continue
                chunks.append(
                    {
                        "video_id": video_dir.name,
                        "chunk_id": item.get("chunk_id"),
                        "chunk_number": item.get("chunk_number", 1),
                        "description": item.get("description", ""),
                        "scene_tags": item.get("scene_tags", []),
                        "activity_tags": item.get("activity_tags", []),
                        "embedding": np.array(emb, dtype="float32"),
                    }
                )
        except Exception as e:
            print(f"⚠️  Failed to load {text_file}: {e}")
    return chunks


# ----------------------------------------------------------------------
# Query embedding
# ----------------------------------------------------------------------

def get_query_embedding(text: str) -> np.ndarray:
    """Call Vertex text-embedding-004 to get a 768-d embedding."""
    last_err = None
    for key in GEMINI_KEYS:
        if not key:
            continue
        try:
            genai.configure(api_key=key)
            resp = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_query",
            )
            emb = np.array(resp["embedding"], dtype="float32")
            if emb.shape[0] != 768:
                raise ValueError("Unexpected embedding size")
            return emb
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"All embedding attempts failed: {last_err}")


# ----------------------------------------------------------------------
# Search
# ----------------------------------------------------------------------

def search(chunks: List[Dict], query: str, top_n: int = DEFAULT_TOP_N) -> List[Dict]:
    q_emb = get_query_embedding(query)

    scored: List[Tuple[float, Dict]] = []
    for ch in chunks:
        sim = cosine_sim(q_emb, ch["embedding"])
        scored.append((sim, ch))

    # sort descending by similarity
    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for sim, ch in scored[:top_n]:
        res = {
            "video_id": ch["video_id"],
            "chunk_id": ch["chunk_id"],
            "chunk_number": ch["chunk_number"],
            "similarity": round(sim, 4),
            "description": ch["description"],
            "tags": list(set(ch["scene_tags"] + ch["activity_tags"])),
        }
        results.append(res)
    return results


# ----------------------------------------------------------------------
# Main CLI
# ----------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 quick_video_search.py \"query text\" [N]", file=sys.stderr)
        sys.exit(1)

    query = sys.argv[1]
    top_n = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_TOP_N

    t0 = time.time()
    chunks = load_chunks(EMBED_DIR)
    t_load = time.time() - t0
    print(f"✅ Loaded {len(chunks)} chunks in {t_load:.2f}s")

    t1 = time.time()
    results = search(chunks, query, top_n)
    t_search = time.time() - t1

    print(json.dumps({"query": query, "results": results, "search_time_s": round(t_search, 3)}, indent=2))


if __name__ == "__main__":
    main() 