import json
import re
import logging
import google.generativeai as genai
import os
from models.schemas import AnalyzeResponse, Scene
from services.ai_service import build_prompt

logger = logging.getLogger(__name__)


def extract_json(raw: str) -> dict:
    """응답 텍스트에서 JSON 객체를 추출합니다."""
    # 코드블록 제거
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip())
    raw = raw.strip()

    # 중괄호 범위로 JSON 추출
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]

    return json.loads(raw)


async def analyze_with_gemini(script: str, model_name: str) -> AnalyzeResponse:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            max_output_tokens=8192,
        ),
    )

    response = model.generate_content(build_prompt(script))

    try:
        data = extract_json(response.text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Gemini JSON 파싱 실패.\nraw 응답:\n%s", response.text)
        raise ValueError(f"AI 응답을 JSON으로 파싱할 수 없습니다: {e}") from e

    scenes = [Scene(**s) for s in data["scenes"]]
    return AnalyzeResponse(
        scenes=scenes,
        total_duration=data["total_duration"],
        total_scenes=data["total_scenes"],
        ai_provider="gemini",
        model_used=model_name,
    )
