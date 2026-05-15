import base64
import io
import os
import wave
import logging

import httpx

from .base import TTSProviderBase

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
SAMPLE_RATE = 24000
SAMPLE_WIDTH = 2   # 16-bit PCM
CHANNELS = 1


class GeminiTTS(TTSProviderBase):
    def __init__(self, model: str):
        self.model = model
        self.api_key = os.environ["GEMINI_API_KEY"]

    async def generate(self, text: str, voice: str, speed: float) -> tuple[bytes, str, float]:
        url = f"{GEMINI_API_BASE}/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": voice}
                    }
                },
            },
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                body = resp.json()
                err = body.get("error", {}).get("message", resp.text)
                raise ValueError(f"Gemini TTS 오류: {err}")
            data = resp.json()

        try:
            inline = data["candidates"][0]["content"]["parts"][0]["inlineData"]
            pcm_bytes = base64.b64decode(inline["data"])
        except (KeyError, IndexError) as e:
            raise ValueError(f"Gemini TTS 응답 파싱 실패: {e}") from e

        wav_bytes = _pcm_to_wav(pcm_bytes)
        duration = len(pcm_bytes) / (SAMPLE_RATE * SAMPLE_WIDTH * CHANNELS)
        return wav_bytes, "wav", round(duration, 3)


def _pcm_to_wav(pcm: bytes) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm)
    return buf.getvalue()
