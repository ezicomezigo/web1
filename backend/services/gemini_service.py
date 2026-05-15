import json
import google.generativeai as genai
import os
from models.schemas import AnalyzeResponse, Scene
from services.ai_service import build_prompt


async def analyze_with_gemini(script: str, model_name: str) -> AnalyzeResponse:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            max_output_tokens=4096,
        ),
    )

    response = model.generate_content(build_prompt(script))
    raw = response.text.strip()

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
        ai_provider="gemini",
        model_used=model_name,
    )
