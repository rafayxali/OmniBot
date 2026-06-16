import os
from dotenv import load_dotenv

load_dotenv()

# HUGGING FACE
# -----------------------------
HF_TOKEN = os.getenv("HUGGINGFACEHUB_ACCESS_TOKEN")

# -----------------------------
# EMBEDDING MODEL
# -----------------------------
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# -----------------------------
# LLM MODEL (FOR RAG)
# -----------------------------
LLM_MODEL = "Qwen/Qwen2.5-7B-Instruct"

# -----------------------------
# RETRIEVAL SETTINGS
# -----------------------------
TOP_K = 3  # number of chunks retrieved per query

# -----------------------------
# MEMORY SETTINGS
# -----------------------------
MEMORY_WINDOW = 5  # last N chat messages

# -----------------------------
# CHUNKING SETTINGS
# -----------------------------
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200