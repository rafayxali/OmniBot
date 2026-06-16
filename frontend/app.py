import streamlit as st
from views.login_views import login_page
from views.register_view import register_page
from views.dashboard_view import dashboard_page

API_URL = "http://localhost:8000"
st.set_page_config(page_title="OmniDoc", layout="wide")

if "page" not in st.session_state:
    st.session_state.page = "login"

# -----------------------
# ROUTING
# -----------------------

if st.session_state.page == "login":
    login_page()

elif st.session_state.page == "register":
    register_page()

elif st.session_state.page == "dashboard":
    dashboard_page()