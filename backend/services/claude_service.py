import json
import re
import logging
import anthropic
from models.schemas import AnalyzeResponse, AnalyzeRequest, Scene, SceneRange
from services.text_utils import split_into_sentences, build_prompt, reconstruct_scenes, validate_coverage

logger = logging.getLogger(__name__)
CLAUDE_MODEL = "claude-sonnet-4-6"


def extract_json(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip()).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]
    return json.loads(raw)


async def analyze_with_claude(req: AnalyzeRequest) -> AnalyzeResponse:
    sentences = split_into_sentences(req.script)
    ratio = req.media_ratio.model_dump() if req.media_ratio else None
    client = anthropic.Anthropic()

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": build_prompt(sentences, ratio)}],
    )

    try:
        data = extract_json(message.content[0].text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Claude JSON 파싱 실패.\nraw:\n%s", message.content[0].text)
        raise ValueError(f"AI 응답을 JSON으로 파싱할 수 없습니다: {e}") from e

    ranges = [SceneRange(**s) for s in data["scenes"]]
    warnings = validate_coverage(sentences, [r.model_dump() for r in ranges])
    texts = reconstruct_scenes(sentences, [r.model_dump() for r in ranges])

    scenes = [
        Scene(
            scene_id=r.scene_id,
            text=texts[i],
            topic_summary=r.topic_summary,
            estimated_duration=r.estimated_duration,
            media=r.media,
        )
        for i, r in enumerate(ranges)
    ]

    return AnalyzeResponse(
        scenes=scenes,
        total_duration=sum(s.estimated_duration for s in scenes),
        total_scenes=len(scenes),
        ai_provider="claude",
        model_used=CLAUDE_MODEL,
        warnings=warnings,
    )
