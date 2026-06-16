import streamlit as st
import requests

API_URL = "http://localhost:8000"


def login_page():
    st.title("Login")

    email = st.text_input("Email")
    password = st.text_input("Password", type="password")

    if st.button("Login"):
        res = requests.post(
            f"{API_URL}/auth/token",
            data={
                "username": email,
                "password": password
            }
        )

        if res.status_code == 200:
            token = res.json()["access_token"]

            # STORE JWT TICKET
            st.session_state["token"] = token
            st.session_state.page = "dashboard"

            # 🚀 FIX: Instantly forces the layout engine to jump to the dashboard page
            st.rerun()
        else:
            st.error("Invalid credentials")

    if st.button("Go to Register"):
        st.session_state.page = "register"
        st.rerun()