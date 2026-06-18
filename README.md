# OmniBot 

> An AI-powered document intelligence platform with multimodal RAG, voice I/O, and streaming chat — built with FastAPI, React, and MongoDB.

---

## What is OmniBot?

OmniBot (internally called **OmniDoc**) is a full-stack AI assistant that lets users upload documents and images, then have natural, context-aware conversations about them. It combines a **Retrieval-Augmented Generation (RAG)** pipeline with multimodal document parsing, streaming LLM responses, and voice interaction — all behind a clean, session-based interface.

---

## Features

-  **Multimodal Document Ingestion** — Upload PDFs and images; PDFs are parsed with PyMuPDF, images are described using Groq's Llama 4 Vision model
-  **RAG Pipeline** — Documents are chunked, embedded via HuggingFace (`all-MiniLM-L6-v2`), stored in MongoDB, and retrieved with cosine similarity at query time
-  **Streaming Chat** — LLM responses stream token-by-token to the frontend using FastAPI `StreamingResponse` + SSE
-  **Voice Input (STT)** — Record audio directly in the browser; transcription is handled by Groq Whisper (`whisper-large-v3`)
-  **Auth System** — JWT-based register/login with bcrypt password hashing
-  **Session Management** — Create, rename, delete, and switch between multiple named chat sessions per user
-  **Dark / Light Mode** — Theme toggle persisted in localStorage
-  **React + Vite Frontend** — Built with React 19, `lucide-react` icons, and a Vite dev server

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | FastAPI + Uvicorn |
| **Frontend** | React 19 + Vite |
| **Database** | MongoDB Atlas |
| **LLM** | Groq (Llama 3.3 70B Versatile) |
| **Vision / OCR** | Groq (Llama 4 Scout 17B) |
| **Embeddings** | HuggingFace Inference API (`all-MiniLM-L6-v2`) |
| **STT** | Groq Whisper Large v3 |
| **Auth** | PyJWT + Passlib (bcrypt) |
| **PDF Parsing** | PyMuPDF (fitz) |
| **Chunking** | LangChain `RecursiveCharacterTextSplitter` |
| **Vector Search** | Custom cosine similarity over MongoDB |

---

## Project Structure

```
OmniBot/
├── backend/                  # FastAPI application (Python package)
│   ├── main.py               # App entry point, all API routes
│   ├── auth.py               # JWT creation, verification, bcrypt hashing
│   ├── pipeline.py           # RAG pipeline — retrieval + LLM + streaming
│   ├── documents.py          # Document upload, PDF/image ingestion routes
│   ├── embeddings.py         # HuggingFace embedding model + MongoDB vector store
│   ├── retrieval.py          # Cosine similarity search over stored vectors
│   ├── chat.py               # Message persistence and history formatting
│   ├── database.py           # MongoDB connection and collection references
│   ├── tts.py                # Groq Whisper STT (+ optional Gemini TTS)
│   ├── schemas.py            # Pydantic request/response models
│   └── config.py             # Shared config constants (chunk size, top_k, etc.)
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx           # Main app component (auth, chat, sessions, voice)
│   │   ├── main.jsx          # React root entry
│   │   └── index.css         # Global styles with light/dark CSS variables
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── views/                    # (Legacy) Streamlit UI
│   ├── login_views.py
│   ├── register_view.py
│   └── dashboard_view.py
├── requirements.txt
├── .env                      # Environment variables (never commit this)
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster
- API keys for [Groq](https://console.groq.com/) and [HuggingFace](https://huggingface.co/settings/tokens)

### 1. Clone the Repository

```bash
git clone https://github.com/rafayxali/OmniBot.git
cd OmniBot
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
HUGGINGFACEHUB_ACCESS_TOKEN=your_hf_token
MONGODB_URL=your_mongodb_atlas_connection_string
SECRET_KEY=your_jwt_secret_key
```

> ⚠️ Never commit your `.env` file. It is already listed in `.gitignore`.

### 3. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the Backend

```bash
uvicorn backend.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 5. Install and Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The React app will run at `http://localhost:5173`.

---

## API Reference

All protected routes require a Bearer token in the `Authorization` header, obtained from `/auth/token`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/token` | Login and receive a JWT |

### Sessions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/sessions/create` | Create a new chat session |
| `GET` | `/sessions` | List all sessions for the current user |
| `GET` | `/sessions/{session_id}/messages` | Fetch message history for a session |
| `PUT` | `/sessions/{session_id}/rename` | Rename a session |
| `DELETE` | `/sessions/{session_id}` | Delete a session |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Send a question and receive a streaming RAG response |
| `POST` | `/transcribe` | Upload audio and receive a transcription (STT) |

### Documents

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/documents/upload` | Upload a PDF or image file for ingestion |

---

## How the RAG Pipeline Works

1. **Upload** — A PDF or image is uploaded via the `/documents/upload` endpoint.
2. **Parse** — PDFs are text-extracted with PyMuPDF. Images are sent to Groq's Llama 4 Scout vision model, which returns a detailed markdown description.
3. **Chunk** — The extracted text is split into overlapping chunks (size: 1000, overlap: 200) using LangChain's `RecursiveCharacterTextSplitter`.
4. **Embed** — Each chunk is embedded via the HuggingFace Inference API (`all-MiniLM-L6-v2`).
5. **Store** — Embeddings and their metadata (user ID, session ID, source file) are stored in MongoDB.
6. **Retrieve** — On each chat query, the question is embedded and compared against stored vectors using cosine similarity. The top-K most relevant chunks are returned.
7. **Generate** — The retrieved context, conversation history (last 5 messages), and user question are assembled into a structured prompt and sent to Groq's `llama-3.3-70b-versatile` model. The response streams back to the client in real time.

---

## Environment Variables

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key (used for LLM, vision, and Whisper STT) |
| `HUGGINGFACEHUB_ACCESS_TOKEN` | HuggingFace token for the embedding inference API |
| `MONGODB_URL` | MongoDB Atlas connection string |
| `SECRET_KEY` | Secret used to sign and verify JWTs |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## Author

**Rafay Ali** — [GitHub](https://github.com/rafayxali)

---

## License

This project is currently unlicensed. Add a `LICENSE` file if you intend to make it public.
