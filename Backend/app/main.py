import traceback
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from .documents import router as documents_router
from .pipeline import rag_pipeline
from .auth import hash_password, verify_password, create_token, get_current_user
from .schemas import UserRegister, RenameSessionRequest
from fastapi import Form, UploadFile, File # <-- ADD THESE IMPORTS
from .tts import transcribe_audio_with_gemini, generate_speech_with_gemini

load_dotenv()

app = FastAPI()

# ---------------------------------------------------------
# SECURE CORS INFRASTRUCTURE SETUP
# ---------------------------------------------------------
# Restrict access specifically to your local Vite + React port
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the sub-routers safely
app.include_router(documents_router, prefix="/documents")

# -------------------------
# DB CONNECTION
# -------------------------
client = MongoClient(os.getenv("MONGODB_URL"))
db = client["omnidoc"]
users = db["users"]

# =========================
# REGISTER ROUTE
# =========================
@app.post("/auth/register")
def register(user: UserRegister):
    if users.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="User already exists")

    new_user = {
        "username": user.username,
        "email": user.email,
        "password": hash_password(user.password)
    }
    users.insert_one(new_user)
    return {"message": "User registered successfully"}


# =========================
# LOGIN ROUTE (TOKEN)
# =========================
@app.post("/auth/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # OAuth2 specifies form_data.username is used as the login identifier
    user = users.find_one({"email": form_data.username})

    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({
        "user_id": str(user["_id"]),
        "email": user["email"]
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# =========================
# PROTECTED TEST ROUTE
# =========================
@app.get("/protected")
def protected_route(user=Depends(get_current_user)):
    return {
        "message": "You are authenticated",
        "user": user
    }


# ======================
#  CREATE CHAT SESSIONS
# ======================
@app.post("/sessions/create")
def create_session(user=Depends(get_current_user)):
    session = {
        "user_id": user["user_id"],
        "title": f"Chat {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        "created_at": datetime.utcnow()
    }
    result = db["chat_sessions"].insert_one(session)
    return {
        "session_id": str(result.inserted_id),
        "title": session["title"]
    }


# ======================
#  GET CHAT SESSIONS
# ======================
@app.get("/sessions")
def get_sessions(user=Depends(get_current_user)):
    sessions = db["chat_sessions"].find({"user_id": user["user_id"]})
    return [
        {
            "session_id": str(s["_id"]),
            "title": s["title"]
        }
        for s in sessions
    ]


# ======================
#  GET SESSION MESSAGES (History Fetch)
# ======================
@app.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str, user=Depends(get_current_user)):
    from .chat import get_last_messages
    docs = get_last_messages(session_id=session_id, user_id=user["user_id"], limit=50)
    return [{"role": d["role"], "content": d["content"]} for d in docs]


# ======================
#  DELETE CHAT SESSION
# ======================
@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, user=Depends(get_current_user)):
    db["chat_sessions"].delete_one({
        "_id": ObjectId(session_id),
        "user_id": user["user_id"]
    })
    return {"message": "Session deleted"}


@app.put("/sessions/{session_id}/rename")
def rename_session(
    session_id: str,
    request: RenameSessionRequest,
    user=Depends(get_current_user)
):
    try:
        result = db["chat_sessions"].update_one(
            {"_id": ObjectId(session_id), "user_id": user["user_id"]},
            {"$set": {"title": request.title}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Chat session not found")
        return {"message": "Session title updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid session update: {str(e)}")


# -----------------------
# CHAT ENDPOINT (STREAMING)
# -----------------------
class ChatRequest(BaseModel):
    question: str
    session_id: str


@app.post("/chat")
def chat(
        request: ChatRequest,
        current_user: dict = Depends(get_current_user)
):
    print(f"📥 Incoming TEXT request received for session: {request.session_id}")
    try:
        # Generate the initialized stream object inside our core execution context
        active_pipeline = rag_pipeline(
            question=request.question,
            user_id=str(current_user["user_id"]),
            session_id=request.session_id
        )

        return StreamingResponse(active_pipeline, media_type="text/plain")

    except Exception as e:
        print("\n💥 ==================== BACKEND ENGINE CRASH ====================")
        traceback.print_exc()
        print("=================================================================\n")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Initialization pipeline error: {str(e)}"
        )


# -------------------------------------------------------
# 🎙️ NEW VOICE CHAT ENDPOINT (AUDIO IN -> AUDIO FILE OUT)
# -------------------------------------------------------
@app.post("/chat/voice")
async def chat_voice(
        file: UploadFile = File(...),
        session_id: str = Form(...),
        voice_gender: str = Form("female"),  # Defaults to female if not chosen
        current_user: dict = Depends(get_current_user)
):
    print(f"📥 Incoming VOICE request received for session: {session_id} (Voice: {voice_gender})")

    # 1. Validate that it's an audio recording file
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Invalid file type sent from mic input.")

    try:
        # 2. Read the binary recording payload from the frontend
        audio_bytes = await file.read()

        # 3. Use Gemini STT to transcribe the microphone into a clear query string
        transcribed_question = transcribe_audio_with_gemini(audio_bytes, file.filename)
        print(f"🗣️ Transcribed Voice Query: \"{transcribed_question}\"")

        if not transcribed_question.strip():
            raise HTTPException(status_code=400, detail="Could not understand or parse any audio content.")

        # 4. Trigger your exact existing LangChain RAG pipeline with the text query
        # Since rag_pipeline returns a token generator, we consume it completely to get the full string text response
        token_generator = rag_pipeline(
            question=transcribed_question,
            user_id=str(current_user["user_id"]),
            session_id=session_id
        )

        # Fully collect the response generated by the streaming generator pipeline
        # This guarantees your save_message functions fire safely inside pipeline.py
        full_response_text = ""
        for token in token_generator:
            full_response_text += token

        print(f"🤖 AI Response Generated: \"{full_response_text[:60]}...\"")

        # 5. Convert the complete text response back to speech with the chosen voice persona
        audio_response_buffer = generate_speech_with_gemini(full_response_text, voice_gender=voice_gender)

        # 6. Stream the crystal-clear MP3 file back out over the network response
        return StreamingResponse(
            audio_response_buffer,
            media_type="audio/mpeg",
            headers={
                "X-Transcribed-Text": transcribed_question,
                "X-AI-Text": full_response_text[:500],  # truncate for header limits
                "Access-Control-Expose-Headers": "X-Transcribed-Text, X-AI-Text"
            }
        )

    except Exception as e:
        print("\n💥 ==================== VOICE ROUTE EXCEPTION ====================")
        traceback.print_exc()
        print("==================================================================\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice processing pipeline collapsed: {str(e)}"
        )