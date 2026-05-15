from fastapi import APIRouter, HTTPException
from models.schemas import AnalyzeRequest, AnalyzeResponse, GEMINI_MODELS
from services.claude_service import analyze_with_claude
from services.gemini_service import analyze_with_gemini

router = APIRouter(prefix="/api", tags=["scenes"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_script(req: AnalyzeRequest):
    if not req.script.strip():
        raise HTTPException(status_code=400, detail="대본을 입력해주세요.")

    try:
        if req.ai_provider == "claude":
            return await analyze_with_claude(req.script)

        elif req.ai_provider == "gemini":
            model = req.gemini_model or GEMINI_MODELS[0]
            if model not in GEMINI_MODELS:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 Gemini 모델입니다: {model}")
            return await analyze_with_gemini(req.script, model)

        raise HTTPException(status_code=400, detail="ai_provider는 'claude' 또는 'gemini'여야 합니다.")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 분석 중 오류가 발생했습니다: {e}")
