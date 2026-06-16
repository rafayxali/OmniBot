import numpy as np
from .database import vector_collection
from .embeddings import get_embedding


# -----------------------------
# COSINE SIMILARITY
# -----------------------------
def cosine_similarity(a, b):
    a = np.array(a)
    b = np.array(b)

    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


# -----------------------------
# RETRIEVE TOP-K CHUNKS
# -----------------------------
def retrieve(query: str, user_id: str, session_id: str, top_k: int = 5):

    query_vector = get_embedding(query)

    # 🔒 ISOLATION FILTER (CRITICAL)
    documents = vector_collection.find({
        "payload.user_id": user_id,
        "payload.session_id": session_id
    })

    scored_results = []

    for doc in documents:

        score = cosine_similarity(query_vector, doc["vector"])

        scored_results.append({
            "text": doc["payload"]["text"],
            "score": score,
            "source_file": doc["payload"]["source_file"],
            "chunk_index": doc["payload"]["chunk_index"]
        })

    # sort by similarity
    scored_results.sort(key=lambda x: x["score"], reverse=True)

    return scored_results[:top_k]