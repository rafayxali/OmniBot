import streamlit as st
import requests

API_URL = "http://localhost:8000"


def dashboard_page():
    st.title("OmniDoc Workspace")

    token = st.session_state.get("token")
    if not token:
        st.warning("Login required")
        st.session_state.page = "login"
        st.rerun()
        return

    headers = {"Authorization": f"Bearer {token}"}

    # ---------------------------------------------------------
    # SIDEBAR: CHAT MANAGEMENT & DOCUMENT INGESTION
    # ---------------------------------------------------------
    if st.sidebar.button("➕ New Chat", use_container_width=True):
        res = requests.post(f"{API_URL}/sessions/create", headers=headers)
        if res.status_code == 200:
            st.session_state.current_session = res.json()["session_id"]
            st.rerun()

    st.sidebar.markdown("---")
    st.sidebar.subheader("Your Chat History")

    res = requests.get(f"{API_URL}/sessions", headers=headers)
    active_session_title = "Active Chat"

    if res.status_code == 200:
        sessions = res.json()
        for s in sessions:
            is_active = st.session_state.get("current_session") == s["session_id"]
            if is_active:
                active_session_title = s['title']

            label = f"💬 {s['title']}" if not is_active else f"▶️ {s['title']}"

            if st.sidebar.button(label, key=s["session_id"], use_container_width=True):
                st.session_state.current_session = s["session_id"]
                st.rerun()

    if "current_session" in st.session_state:
        # --- NEW Feature: Chat Naming / Renaming Control ---
        st.sidebar.markdown("---")
        st.sidebar.subheader("Chat Settings")
        with st.sidebar.form("rename_form", clear_on_submit=False):
            new_title = st.text_input("Chat Name", value=active_session_title)
            submit_rename = st.form_submit_button("✏️ Rename Title", use_container_width=True)

            if submit_rename and new_title.strip():
                rename_res = requests.put(
                    f"{API_URL}/sessions/{st.session_state.current_session}/rename",
                    headers=headers,
                    json={"title": new_title.strip()}
                )
                if rename_res.status_code == 200:
                    st.toast("Chat renamed successfully!")
                    st.rerun()

        # --- Updated Feature: Multimodal Image & Document Uploader ---
        st.sidebar.markdown("---")
        st.sidebar.subheader("Document Control")
        # Allowed file formats expanded to encompass images
        uploaded_file = st.sidebar.file_uploader(
            "Upload reference asset",
            type=["pdf", "png", "jpg", "jpeg"]
        )

        if uploaded_file is not None:
            if st.sidebar.button("⚙️ Process Document", use_container_width=True):
                with st.spinner("Extracting & Indexing content..."):
                    # Dynamically detect explicit content type header for parsing safety
                    file_ext = uploaded_file.name.split(".")[-1].lower()
                    if file_ext == "pdf":
                        mime_type = "application/pdf"
                    elif file_ext in ["jpg", "jpeg"]:
                        mime_type = "image/jpeg"
                    elif file_ext == "png":
                        mime_type = "image/png"
                    else:
                        mime_type = "application/octet-stream"

                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), mime_type)}
                    data = {"session_id": st.session_state.current_session}

                    upload_res = requests.post(
                        f"{API_URL}/documents/upload",
                        headers=headers,
                        files=files,
                        data=data
                    )
                    if upload_res.status_code == 200:
                        st.sidebar.success(f"Successfully processed {uploaded_file.name}!")
                    else:
                        st.sidebar.error("Failed to parse or save document contents.")

    # ---------------------------------------------------------
    # MAIN AREA: LIVE INTERACTIVE CONVERSATIONAL INTERFACE
    # ---------------------------------------------------------
    if "current_session" not in st.session_state:
        st.info("👈 Please select a chat or create a new one to begin your session.")
        return

    session_id = st.session_state.current_session

    # Render past messages
    msg_res = requests.get(f"{API_URL}/sessions/{session_id}/messages", headers=headers)
    if msg_res.status_code == 200:
        history_messages = msg_res.json()
        for msg in history_messages:
            with st.chat_message("user" if msg["role"] == "human" else "assistant"):
                st.write(msg["content"])

    # Live interactive chat block with streaming support
    if user_query := st.chat_input("Ask OmniDoc anything regarding your parsed context..."):
        with st.chat_message("user"):
            st.write(user_query)

        with st.chat_message("assistant"):
            try:
                chat_res = requests.post(
                    f"{API_URL}/chat",
                    headers=headers,
                    json={"question": user_query, "session_id": session_id},
                    stream=True
                )

                if chat_res.status_code == 200:
                    def stream_chunks():
                        for chunk in chat_res.iter_content(chunk_size=None, decode_unicode=True):
                            if chunk:
                                yield chunk

                    st.write_stream(stream_chunks())
                    st.rerun()
                else:
                    st.error("Error communicating to RAG engine.")
            except Exception as e:
                st.error(f"Connection failed: {e}")