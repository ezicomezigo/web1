import json
import re
import logging
import anthropic
from models.schemas import AnalyzeResponse, Scene
from services.ai_service import build_prompt

logger = logging.getLogger(__name__)
CLAUDE_MODEL = "claude-sonnet-4-6"


def extract_json(raw: str) -> dict:
    """응답 텍스트에서 JSON 객체를 추출합니다."""
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip())
    raw = raw.strip()

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]

    return json.loads(raw)


async def analyze_with_claude(script: str) -> AnalyzeResponse:
    client = anthropic.Anthropic()

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8192,
        messages=[
            {
                "role": "user",
                "content": build_prompt(script),
            }
        ],
    )

    try:
        data = extract_json(message.content[0].text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Claude JSON 파싱 실패.\nraw 응답:\n%s", message.content[0].text)
        raise ValueError(f"AI 응답을 JSON으로 파싱할 수 없습니다: {e}") from e

    scenes = [Scene(**s) for s in data["scenes"]]
    return AnalyzeResponse(
        scenes=scenes,
        total_duration=data["total_duration"],
        total_scenes=data["total_scenes"],
        ai_provider="claude",
        model_used=CLAUDE_MODEL,
    )
