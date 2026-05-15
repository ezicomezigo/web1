from abc import ABC, abstractmethod


class TTSProviderBase(ABC):
    @abstractmethod
    async def generate(self, text: str, voice: str, speed: float) -> tuple[bytes, str, float]:
        """Returns (audio_bytes, file_extension, duration_seconds)"""
        pass
