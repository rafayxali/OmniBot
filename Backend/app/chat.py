from .database import messages


# -----------------------------
# SAVE MESSAGE
# -----------------------------
def save_message(
    session_id: str,
    user_id: str,
    role: str,
    content: str

):
    """
    Store a single chat message in MongoDB.
    role = "human" or "ai"
    """

    messages.insert_one({
        "session_id": session_id,
        "user_id": user_id,
        "role": role,
        "content": content
    })


# -----------------------------
# GET LAST MESSAGES
# -----------------------------
def get_last_messages(
    session_id: str,
    user_id: str,
    limit: int = 5
):
    """
    Fetch last N messages for a session (chronological order).
    """

    docs = list(
        messages.find({
            "session_id": session_id,
            "user_id": user_id
        })
        .sort("_id", -1)
        .limit(limit)
    )

    docs.reverse()

    return docs


# -----------------------------
# FORMAT HISTORY FOR PROMPT
# -----------------------------
def format_history(
    session_id: str,
    user_id: str,
    limit: int = 5
) -> str:
    """
    Convert MongoDB chat history into LLM-readable text.
    """

    docs = get_last_messages(
        session_id=session_id,
        user_id=user_id,
        limit=limit
    )

    if not docs:
        return ""

    return "\n".join(
        f"{doc['role']}: {doc['content']}"
        for doc in docs
    )