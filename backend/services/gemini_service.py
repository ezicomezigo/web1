import json
import re
import logging
import google.generativeai as genai
import os
from models.schemas import AnalyzeResponse, Scene, SceneRange
from services.text_utils import split_into_sentences, build_prompt, reconstruct_scenes, validate_coverage

logger = logging.getLogger(__name__)


def extract_json(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip()).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]
    return json.loads(raw)


async def analyze_with_gemini(script: str, model_name: str) -> AnalyzeResponse:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    sentences = split_into_sentences(script)

    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
        ),
    )

    response = model.generate_content(build_prompt(sentences))

    try:
        data = extract_json(response.text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Gemini JSON 파싱 실패.\nraw:\n%s", response.text)
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
        )
        for i, r in enumerate(ranges)
    ]
    total_duration = sum(s.estimated_duration for s in scenes)

    return AnalyzeResponse(
        scenes=scenes,
        total_duration=total_duration,
        total_scenes=len(scenes),
        ai_provider="gemini",
        model_used=model_name,
        warnings=warnings,
    )
