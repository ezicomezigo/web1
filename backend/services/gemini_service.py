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
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip())
    raw = raw.strip()

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]

    return json.loads(raw)


def get_model(model_name: str) -> genai.GenerativeModel:
    return genai.GenerativeModel(
        model_name=model_name,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            # max_output_tokens 미지정 → 모델 기본 최대값 사용
        ),
    )


async def analyze_with_gemini(script: str, model_name: str) -> AnalyzeResponse:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = get_model(model_name)

    response = model.generate_content(build_prompt(script))
    raw = response.text

    # 응답이 잘린 경우 이어받기 (최대 2회)
    for _ in range(2):
        try:
            data = extract_json(raw)
            break
        except (json.JSONDecodeError, ValueError):
            logger.warning("응답이 잘린 것으로 판단, 이어받기 시도 중...")
            continuation = model.generate_content(
                f"이전 JSON 응답이 잘렸습니다. 아래 내용에 이어서 완전한 JSON을 완성해주세요:\n\n{raw}"
            )
            raw = raw + continuation.text
    else:
        logger.error("Gemini JSON 파싱 최종 실패.\nraw 응답:\n%s", raw)
        raise ValueError("AI 응답을 JSON으로 파싱할 수 없습니다. 대본을 줄이거나 다른 모델을 선택해보세요.")

    scenes = [Scene(**s) for s in data["scenes"]]
    return AnalyzeResponse(
        scenes=scenes,
        total_duration=data["total_duration"],
        total_scenes=data["total_scenes"],
        ai_provider="gemini",
        model_used=model_name,
    )
