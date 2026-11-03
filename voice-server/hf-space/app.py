"""Tali's voice server for Tali HQ.

Same recipe as the Tali videos (claude/Tali_Voice.py.md): Kokoro, 70% af_heart + 30% af_nicole,
lang en-us, her name spelt "Tally" so it is said right. Returns MP3.

Only the tali-voice edge function calls this. Every request must carry the shared key in the
x-voice-key header (VOICE_KEY env var), so nobody else can use the server.
"""
import io
import os
import re

import lameenc
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from kokoro_onnx import Kokoro
from pydantic import BaseModel

VOICE_KEY = os.environ.get("VOICE_KEY", "")
SPEED = float(os.environ.get("VOICE_SPEED", "1.0"))
MAX_CHARS = 3000

kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
TALI = kokoro.get_voice_style("af_nicole") * 0.3 + kokoro.get_voice_style("af_heart") * 0.7

app = FastAPI()


class Speak(BaseModel):
    text: str


def clean(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)  # links are not read out
    text = re.sub(r"[*_#`>]", "", text)  # markdown symbols
    text = re.sub(r"\s*[–—]\s*", ", ", text)
    text = re.sub(r"\bTali\b", "Tally", text)
    return re.sub(r"\s+", " ", text).strip()[:MAX_CHARS]


def to_mp3(samples: np.ndarray, sr: int) -> bytes:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
    enc = lameenc.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm.tobytes()) + enc.flush()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/speak")
def speak(body: Speak, x_voice_key: str = Header(default="")):
    if not VOICE_KEY or x_voice_key != VOICE_KEY:
        raise HTTPException(status_code=401, detail="bad key")
    text = clean(body.text)
    if not text:
        raise HTTPException(status_code=400, detail="no text")
    samples, sr = kokoro.create(text, voice=TALI, speed=SPEED, lang="en-us")
    return Response(content=to_mp3(samples, sr), media_type="audio/mpeg")
