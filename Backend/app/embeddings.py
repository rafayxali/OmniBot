from langchain_huggingface import HuggingFaceEndpointEmbeddings
from .database import vector_collection
import os
from dotenv import load_dotenv

load_dotenv()

# -----------------------------
# HUGGING FACE TOKEN
# -----------------------------
HF_TOKEN = os.getenv("HUGGINGFACEHUB_ACCESS_TOKEN")


# -----------------------------
# LANGCHAIN HF CLOUD EMBEDDINGS
# -----------------------------
embeddings_model = HuggingFaceEndpointEmbeddings(
    repo_id="sentence-transformers/all-MiniLM-L6-v2",
    huggingfacehub_api_token=HF_TOKEN
)


# -----------------------------
# GET EMBEDDING
# -----------------------------
def get_embedding(text: str):
    """
    Returns embedding from Hugging Face cloud model via LangChain.
    No local model download.
    """
    return embeddings_model.embed_query(text)


# -----------------------------
# STORE VECTORS IN MONGODB
# -----------------------------
def store_vectors(doc_id: str, chunks: list, user_id: str, session_id: str):

    if not chunks:
        return 0

    docs = []

    for i, chunk in enumerate(chunks):

        vector = get_embedding(chunk)

        docs.append({
            "vector": vector,
            "payload": {
                "user_id": user_id,
                "session_id": session_id,
                "source_file": doc_id,
                "chunk_index": i,
                "text": chunk
            }
        })

    vector_collection.insert_many(docs)

    return len(docs)