"""
Local TTS server using gTTS.
Run alongside Next.js dev server for local TTS:
pip install gtts fastapi uvicorn
uvicorn scripts.tts_server:app --port 3001
Then set in .env.local:
NEXT_PUBLIC_TTS_URL=http://localhost:3001
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from gtts import gTTS
import io

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=[""], allow_methods=[""], allow_headers=["*"])


class TTSRequest(BaseModel):
    text: str
    slow: bool = False


@app.post("/tts")
def tts(req: TTSRequest):
    tts = gTTS(req.text, lang="bn", slow=req.slow)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return Response(content=buf.read(), media_type="audio/mpeg")


@app.get("/health")
def health():
    return {"status": "ok"}
