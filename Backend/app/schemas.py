from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str

class RenameSessionRequest(BaseModel):
    title: str

class ChatRequest(BaseModel):
    question: str
    session_id: str