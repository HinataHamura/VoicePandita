"""
Local TTS + Embeddings server.
Run alongside Next.js dev server:
pip install gtts fastapi uvicorn sentence-transformers
uvicorn scripts.tts_server:app --port 8001
Then set in .env.local:
NEXT_PUBLIC_TTS_URL=http://localhost:8001
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from gtts import gTTS
from sentence_transformers import SentenceTransformer
import hashlib
import io
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
model = None


def get_model():
    global model
    if model is None:
        model = SentenceTransformer(MODEL_NAME)
    return model


def fallback_embedding(text: str, dimension: int = 384):
    """Deterministic local fallback for connectivity-limited demos."""
    values = []
    seed = text.strip().lower().encode("utf-8") or b"voicepandita"
    counter = 0
    while len(values) < dimension:
        digest = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        values.extend(((byte / 127.5) - 1.0) for byte in digest)
        counter += 1
    return values[:dimension]


class TTSRequest(BaseModel):
    text: str
    slow: bool = False


class EmbeddingRequest(BaseModel):
    text: str


@app.post("/tts")
def tts(req: TTSRequest):
    tts = gTTS(req.text, lang="bn", slow=req.slow)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return Response(content=buf.read(), media_type="audio/mpeg")


@app.post("/embeddings")
def embeddings(req: EmbeddingRequest):
    if os.environ.get("USE_HF_EMBEDDINGS") != "1":
        embedding = fallback_embedding(req.text)
        return {"embedding": embedding, "dimension": len(embedding), "source": "fallback"}

    try:
        embedding = get_model().encode(req.text).tolist()
        return {"embedding": embedding, "dimension": len(embedding), "source": "sentence-transformers"}
    except Exception as exc:
        embedding = fallback_embedding(req.text)
        return {"embedding": embedding, "dimension": len(embedding), "source": "fallback", "warning": str(exc)}


@app.get("/health")
def health():
    return {"status": "ok", "services": ["tts", "embeddings"]}
