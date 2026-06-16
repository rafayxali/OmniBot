import streamlit as st
import requests

API_URL = "http://localhost:8000"

def register_page():

    st.title("Register")

    username = st.text_input("Username")
    email = st.text_input("Email")
    password = st.text_input("Password", type="password")

    if st.button("Register"):

        res = requests.post(
            f"{API_URL}/auth/register",
            json={
                "username": username,
                "email": email,
                "password": password
            }
        )

        if res.status_code == 200:
            st.success("Registered successfully! Go to login.")
            st.session_state.page = "login"
        else:
            st.error(res.json()["detail"])

    if st.button("Go to Login"):
        st.session_state.page = "login"