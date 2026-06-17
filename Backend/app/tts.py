import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def transcribe_audio_with_groq(audio_bytes: bytes, filename: str) -> str:
    """
    STT using Groq Whisper (FAST + FREE TIER FRIENDLY)
    """

    try:
        transcription = groq_client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model="whisper-large-v3",
            response_format="text"
        )

        return transcription.strip()

    except Exception as e:
        raise RuntimeError(f"Groq STT Failed: {str(e)}")

'''import os
from io import BytesIO
from google import genai
from google.genai import types
from dotenv import load_dotenv

#api_ke = os.getenv("GEMINI_API_KEY")
load_dotenv()
client = genai.Client(api_key= os.getenv("GEMINI_API_KEY"))

def transcribe_audio_with_gemini(audio_bytes: bytes, filename: str) -> str:
    """
    STT: Transcribes raw file bytes from the user's mic into text using Gemini.
    """
    try:
        # Resolve common mime types based on incoming frontend extensions
        mime_type = "audio/mp3"
        ext = filename.lower()
        if ext.endswith(".wav"):
            mime_type = "audio/wav"
        elif ext.endswith(".m4a"):
            mime_type = "audio/m4a"
        elif ext.endswith(".webm"):
            mime_type = "audio/webm"

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(
                    data=audio_bytes,
                    mime_type=mime_type,
                ),
                "Provide a highly accurate, literal transcription of this audio. Output ONLY the words spoken without intro text."
            ]
        )
        return response.text.strip()
    except Exception as e:
        raise RuntimeError(f"Gemini Audio Transcription (STT) Failed: {str(e)}")


def generate_speech_with_gemini(text: str, voice_gender: str = "female") -> BytesIO:
    """
    TTS: Sends text to Gemini's native text-to-speech engine and returns raw audio bytes.
    Accepts 'male' or 'female' to dynamically adjust the persona.
    """
    # Map the user selection to Gemini's prebuilt voices
    # 'Aoede' provides a clear feminine tone, 'Fenrir' provides a clear masculine tone
    selected_voice = "Aoede" if voice_gender.lower() == "female" else "Fenrir"

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-tts-preview",
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=selected_voice
                        )
                    )
                ),
            ),
        )

        # Pull the inline binary data from the generated payload
        audio_bytes = None
        for candidate in response.candidates:
            for part in candidate.content.parts:
                if part.inline_data:
                    audio_bytes = part.inline_data.data
                    break

        if not audio_bytes:
            raise ValueError("No audio payload returned from the Gemini TTS engine.")

        return BytesIO(audio_bytes)

    except Exception as e:
        raise RuntimeError(f"Gemini Speech Synthesis (TTS) Failed: {str(e)}")'''