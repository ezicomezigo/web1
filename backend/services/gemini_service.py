import json
import re
import logging
import google.generativeai as genai
import os
from models.schemas import AnalyzeResponse, AnalyzeRequest, Scene, SceneRange
from services.text_utils import split_into_sentences, build_prompt, reconstruct_scenes, validate_coverage

logger = logging.getLogger(__name__)


def extract_json(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip()).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]
    return json.loads(raw)


async def analyze_with_gemini(req: AnalyzeRequest, model_name: str) -> AnalyzeResponse:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    sentences = split_into_sentences(req.script)
    ratio = req.media_ratio.model_dump() if req.media_ratio else None

    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
        ),
    )

    response = model.generate_content(build_prompt(sentences, ratio))

    try:
        data = extract_json(response.text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Gemini JSON 파싱 실패.\nraw:\n%s", response.text)
        raise ValueError(f"AI 응답을 JSON으로 파싱할 수 없습니다: {e}") from e

    raw_scenes = data.get("scenes", [])
    if not raw_scenes:
        logger.error("Gemini가 빈 scenes 배열을 반환했습니다.\nraw:\n%s", response.text)
        raise ValueError("AI가 장면을 생성하지 못했습니다. 대본을 조정하거나 다시 시도해주세요.")
    ranges = [SceneRange(**s) for s in raw_scenes]
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
        ai_provider="gemini",
        model_used=model_name,
        warnings=warnings,
    )
