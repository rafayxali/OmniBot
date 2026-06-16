import os
import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from groq import Groq

from .embeddings import store_vectors
from .auth import get_current_user

router = APIRouter()

# -----------------------------
# GROQ VISION MULTIMODAL SETUP
# -----------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Initialize the specialized Groq hardware API client
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# -----------------------------
# STANDARD PDF TEXT EXTRACTION
# -----------------------------
def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {str(e)}")

    text_content = []
    for page in doc:
        text = page.get_text("text")
        if text and text.strip():
            text_content.append(text)

    return "\n".join(text_content)


# -----------------------------
# ULTRA-FAST GROQ VISION PARSER
# -----------------------------
def extract_markdown_from_image(image_bytes: bytes) -> str:
    """
    Sends image bytes directly to Groq LPUs running Llama 4 Scout.
    Instantly handles technical diagram layout OCR or real-world photo analysis.
    """
    if not GROQ_API_KEY or not groq_client:
        raise HTTPException(
            status_code=500,
            detail="Groq API key (GROQ_API_KEY) missing in environment variables."
        )

    # Standardize image bytes to base64 data URI format (Max 4MB payload supported by Groq)
    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    image_url = f"data:image/jpeg;base64,{base64_image}"

    try:
        # Utilizing Groq's high-speed open-weights Llama 4 multi-modal cluster
        response = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "You are an advanced, multi-purpose vision intelligence agent for a RAG system. "
                                "Analyze this image and provide a comprehensive text representation based on its contents:\n\n"

                                "1. IF THE IMAGE IS A DOCUMENT, BOOK PAGE, OR TECHNICAL SCHEMATIC:\n"
                                "Convert it into perfectly structured Markdown. Preserve headings, tables, lists, and "
                                "technical layouts exactly. Provide granular textual descriptions of visual sub-elements "
                                "like flowcharts, blueprints, or graphs directly inside the markdown stream.\n\n"

                                "2. IF THE IMAGE IS A GENERAL PHOTO, OBJECT, OR REAL-WORLD SCENE:\n"
                                "Provide a highly detailed, descriptive, and analytical textual description of what is in the picture. "
                                "Describe the primary subjects, background actions, setting, colors, item placements, and overall context "
                                "so that this image's content can be accurately matched later via text-based search queries.\n\n"

                                "Output ONLY the direct markdown or text description. Do not include conversational introduction/outro wrappers."
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url}
                        }
                    ]
                }
            ],
            temperature=0.1
        )
        return response.choices[0].message.content
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Groq LPU Vision conversion failed: {str(e)}"
        )


def extract_text_from_scanned_pdf(pdf_bytes: bytes) -> str:
    """
    Fallback for unselectable flat scanned PDFs. Turns pages into image frames
    and pipes them sequentially into the Groq LPU cluster.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {str(e)}")

    markdown_pages = []
    for page_num, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("jpeg")

        print(f"⚡ Processing page {page_num + 1}/{len(doc)} via Groq LPU...")
        page_markdown = extract_markdown_from_image(img_bytes)
        markdown_pages.append(f"\n{page_markdown}")

    return "\n\n".join(markdown_pages)


# -----------------------------
# CHUNKING
# -----------------------------
def chunk_text(text: str):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    return splitter.split_text(text)


# -----------------------------
# VALIDATION
# -----------------------------
def validate(text: str, chunks: list):
    if not text or len(text.strip()) < 50:
        return {"status": "failed", "reason": "Empty or too small extracted text"}

    if not chunks:
        return {"status": "failed", "reason": "No chunks generated"}

    if len(chunks) > 5000:
        return {"status": "failed", "reason": "Too many chunks (possible error)"}

    avg_len = sum(len(c) for c in chunks) / len(chunks)

    if avg_len < 30:
        return {"status": "failed", "reason": "Chunks too small (bad extraction)"}

    return {
        "status": "passed",
        "total_chars": len(text),
        "total_chunks": len(chunks),
        "avg_chunk_length": avg_len
    }


# -----------------------------
# MULTIMODAL INGESTION ENDPOINT
# -----------------------------
@router.post("/upload")
async def upload_document(
        file: UploadFile = File(...),
        session_id: str = Form(...),
        user: dict = Depends(get_current_user)
):
    filename = file.filename.lower()
    file_bytes = await file.read()

    extracted_text = ""

    # Route 1: PDF Documents
    if filename.endswith(".pdf"):
        native_text = extract_text_from_pdf(file_bytes)

        if not native_text or len(native_text.strip()) < 150:
            print("⚠️ Scanned PDF or blueprint booklet detected. Diverting to Groq Vision...")
            extracted_text = extract_text_from_scanned_pdf(file_bytes)
        else:
            print("📄 Native searchable PDF detected. Processing standard layout flows...")
            extracted_text = native_text

    # Route 2: Live Multi-Format Photos or Layout Screenshots
    elif filename.endswith((".png", ".jpg", ".jpeg")):
        print(f"📸 Visual asset uploaded ({file.filename}). Initializing Groq LPU pipeline...")
        extracted_text = extract_markdown_from_image(file_bytes)

    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a PDF, PNG, or JPG/JPEG image."
        )

    # Split text into manageable token chunks
    chunks = chunk_text(extracted_text)

    # Validate structural safety bounds
    result = validate(extracted_text, chunks)
    if result["status"] == "failed":
        raise HTTPException(status_code=400, detail=result["reason"])

    # Pass the clean text blocks to your local SentenceTransformers / MongoDB logic
    store_vectors(
        doc_id=file.filename,
        chunks=chunks,
        user_id=user["user_id"],
        session_id=session_id
    )

    return {
        "message": "Multimodal asset processed and embedded successfully",
        "document_id": file.filename,
        "validation": result,
        "chunks_stored": len(chunks)
    }