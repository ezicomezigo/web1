from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from routers.scenes import router as scenes_router
from routers.projects import router as projects_router
from routers.tts import router as tts_router
from routers.visual import router as visual_router
from routers.stock import router as stock_router
from routers.subtitle import router as subtitle_router

load_dotenv()

app = FastAPI(title="YouTube Video Generator API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"\n[422] Validation error on {request.method} {request.url.path}:")
    for e in exc.errors():
        print(f"  loc={e.get('loc')}  msg={e.get('msg')}  input={str(e.get('input', ''))[:80]}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.include_router(scenes_router)
app.include_router(projects_router)
app.include_router(tts_router)
app.include_router(visual_router)
app.include_router(stock_router)
app.include_router(subtitle_router)


@app.get("/health")
def health():
    return {"status": "ok"}
