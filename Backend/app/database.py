from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")

client = MongoClient(MONGODB_URL)

db = client["omnidoc"]

vector_collection = db["vector_store"]
users = db["users"]
workspaces = db["workspaces"]
documents = db["documents"]
chunks = db["chunks"]
chat_sessions = db["chat_sessions"]
messages = db["messages"]