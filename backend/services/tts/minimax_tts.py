import base64
import io
import os
import logging

import httpx

from .base import TTSProviderBase

logger = logging.getLogger(__name__)

MINIMAX_URL = "https://api.minimax.io/v1/t2a_v2"


class MinimaxTTS(TTSProviderBase):
    def __init__(self, model: str):
        self.model = model
        self.api_key = os.environ["MINIMAX_API_KEY"]

    async def generate(self, text: str, voice: str, speed: float) -> tuple[bytes, str, float]:
        payload = {
            "model": self.model,
            "text": text,
            "stream": False,
            "voice_setting": {
                "voice_id": voice,
                "speed": max(0.5, min(2.0, speed)),
                "vol": 1.0,
                "pitch": 0,
            },
            "audio_setting": {
                "sample_rate": 24000,
                "bitrate": 128000,
                "format": "mp3",
                "channel": 1,
            },
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                MINIMAX_URL,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        status = data.get("base_resp", {})
        if status.get("status_code", -1) != 0:
            raise ValueError(f"MiniMax 오류: {status.get('status_msg', '알 수 없는 오류')}")

        audio_raw = data["data"].get("audio_file") or data["data"].get("audio", "")
        audio_bytes = _decode_audio(audio_raw)
        duration = _mp3_duration(audio_bytes)
        return audio_bytes, "mp3", duration


def _decode_audio(raw: str) -> bytes:
    # MiniMax T2A v2는 hex 인코딩으로 반환한다.
    # hex 문자(0-9, a-f)는 모두 base64 알파벳에 속하므로 base64.b64decode가
    # 예외 없이 잘못된 바이트를 생성해버린다 → hex를 먼저 시도해야 한다.
    try:
        return bytes.fromhex(raw)
    except ValueError:
        return base64.b64decode(raw)


def _mp3_duration(data: bytes) -> float:
    try:
        from mutagen.mp3 import MP3
        audio = MP3(io.BytesIO(data))
        return round(audio.info.length, 3)
    except Exception:
        return 0.0
