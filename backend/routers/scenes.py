from fastapi import APIRouter, HTTPException
import anthropic
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
            return await analyze_with_claude(req)

        elif req.ai_provider == "gemini":
            model = req.gemini_model or GEMINI_MODELS[0]
            if model not in GEMINI_MODELS:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 Gemini 모델입니다: {model}")
            return await analyze_with_gemini(req, model)

        raise HTTPException(status_code=400, detail="ai_provider는 'claude' 또는 'gemini'여야 합니다.")

    except HTTPException:
        raise
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Anthropic API 키가 유효하지 않습니다. backend/.env 파일의 ANTHROPIC_API_KEY를 확인해주세요.")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 분석 중 오류가 발생했습니다: {e}")
