import json
import anthropic
from models.schemas import AnalyzeResponse, Scene
from services.ai_service import build_prompt

CLAUDE_MODEL = "claude-sonnet-4-6"


async def analyze_with_claude(script: str) -> AnalyzeResponse:
    client = anthropic.Anthropic()

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": build_prompt(script),
            }
        ],
    )

    raw = message.content[0].text.strip()
    # JSON 코드블록 제거
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    data = json.loads(raw)

    scenes = [Scene(**s) for s in data["scenes"]]
    return AnalyzeResponse(
        scenes=scenes,
        total_duration=data["total_duration"],
        total_scenes=data["total_scenes"],
        ai_provider="claude",
        model_used=CLAUDE_MODEL,
    )
