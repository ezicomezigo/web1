# 유튜브 영상 자동 생성기 — 프로젝트 문서

## 개요

대본(스크립트)을 입력하면 AI가 장면을 자동 분할하고, 미디어 기획·오디오 생성까지
처리해주는 개인용 로컬 도구. 최종 목표는 FFmpeg로 완성된 영상을 자동 조립하는 것.

**스택**: Next.js 프론트엔드 + FastAPI 백엔드 (로컬 전용, 서버 불필요)

---

## 서버 실행 방법

```bash
# 백엔드 (포트 8000)
cd backend && uvicorn main:app --reload

# 프론트엔드 (포트 3000)
cd frontend && npm run dev
```

---

## 디렉토리 구조

```
web1/
├── backend/
│   ├── main.py                        # FastAPI 앱, 라우터 등록, 422 에러 핸들러
│   ├── .env                           # API 키 (ANTHROPIC_API_KEY, GEMINI_API_KEY, MINIMAX_API_KEY)
│   ├── requirements.txt
│   ├── projects/                      # 프로젝트 데이터 저장소 (.gitignore 처리됨)
│   │   └── {uuid}/
│   │       ├── project.json
│   │       └── media/
│   │           ├── scene_1_audio.wav  # Gemini TTS 결과
│   │           ├── scene_2_audio.mp3  # MiniMax TTS 결과
│   │           └── ...
│   ├── models/
│   │   ├── schemas.py                 # Scene, MediaPlan, SceneAssets, AnalyzeRequest/Response
│   │   └── project.py                # Project, ProjectMeta, CRUD 요청 모델
│   ├── routers/
│   │   ├── scenes.py                 # POST /api/analyze
│   │   ├── projects.py               # CRUD /api/projects
│   │   └── tts.py                    # TTS 생성/삭제/미디어 서빙
│   └── services/
│       ├── claude_service.py         # Claude sonnet-4-6 분석
│       ├── gemini_service.py         # Gemini 분석 (google-generativeai)
│       ├── text_utils.py             # 문장 분리, 프롬프트 빌드, 커버리지 검증
│       └── tts/
│           ├── base.py               # TTSProviderBase (추상 클래스)
│           ├── gemini_tts.py         # Gemini TTS (직접 HTTP, PCM→WAV)
│           └── minimax_tts.py        # MiniMax T2A v2 (httpx, base64 MP3)
└── frontend/
    └── app/
        ├── page.tsx                  # 메인 페이지 (모든 상태 관리)
        ├── types/index.ts            # 공유 타입 정의
        ├── hooks/
        │   └── useProject.ts         # 프로젝트 CRUD + 자동저장 훅
        ├── utils/
        │   └── sceneOps.ts           # renumber, estimateDuration, DEFAULT_MEDIA
        └── components/
            ├── ProjectBar.tsx         # 프로젝트명 인라인편집, 저장상태 표시
            ├── ProjectListModal.tsx   # 프로젝트 목록/열기/삭제/이름변경
            ├── ScriptInput.tsx        # 대본 입력 텍스트에어리어
            ├── AISelector.tsx         # Claude/Gemini + Gemini 모델 선택
            ├── MediaRatioSlider.tsx   # AI이미지/스톡사진/스톡영상 비율 슬라이더
            ├── TTSSettings.tsx        # TTS 제공자/모델/목소리/속도 설정
            ├── SceneEditor.tsx        # DnD 장면 목록, 전체 오디오 생성 버튼
            ├── SceneCard.tsx          # 장면 카드 (편집, 분할, 합치기, 오디오 생성/재생)
            ├── MediaPlanEditor.tsx    # 미디어 타입/프롬프트/키워드/무드 편집
            ├── SplitSceneModal.tsx    # 문장 단위 분할 UI
            └── AddSceneModal.tsx      # 장면 추가 (위치 선택 포함)
```

---

## 핵심 데이터 모델

### Scene (backend/models/schemas.py)
```python
Scene:
  scene_id: int
  text: str                        # 원본 텍스트 그대로 (AI가 수정 불가)
  topic_summary: str
  estimated_duration: float        # TTS 생성 후 실제 오디오 길이로 갱신됨
  media: MediaPlan
    media_type: "ai_image" | "stock_photo" | "stock_video"
    ai_image_prompt: str | None
    stock_keywords: list[str] | None
    mood: "bright"|"calm"|"serious"|"energetic"|"dark"|"emotional"
  assets: SceneAssets
    audio: str | None              # 상대경로: "media/scene_1_audio.wav"
    visual: str | None             # 상대경로: "media/scene_1_image.png" (미구현)
```

### Project (backend/models/project.py)
```python
Project:
  id: str (uuid)
  name: str
  created_at / updated_at: str (ISO)
  script: str
  analysis_info: AnalysisInfo | None
    ai_provider: str
    model_used: str
    warnings: list[str]
  scenes: list[Scene]
```

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 대본 → 장면 분할 (Claude/Gemini) |
| GET | `/api/projects` | 프로젝트 목록 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects/{id}` | 프로젝트 조회 |
| PUT | `/api/projects/{id}` | 프로젝트 저장 |
| PATCH | `/api/projects/{id}/rename` | 이름 변경 |
| DELETE | `/api/projects/{id}` | 프로젝트 삭제 |
| POST | `/api/projects/{id}/scenes/{sid}/audio` | 단일 장면 오디오 생성 |
| DELETE | `/api/projects/{id}/scenes/{sid}/audio` | 오디오 삭제 |
| POST | `/api/projects/{id}/audio/batch` | 전체 장면 일괄 오디오 생성 |
| GET | `/api/projects/{id}/media/{filename}` | 미디어 파일 서빙 |

---

## 환경 변수 (.env)

```
ANTHROPIC_API_KEY=...     # Claude 분석용
GEMINI_API_KEY=...        # Gemini 분석 + Gemini TTS 공용
MINIMAX_API_KEY=...       # MiniMax TTS (Token Plan Key 또는 API Key)
```

---

## 구현 완료 기능

### 장면 분석
- 대본 입력 후 Claude(claude-sonnet-4-6) 또는 Gemini로 장면 자동 분할
- Gemini 모델 3종: gemini-2.5-flash, gemini-3-flash-preview, gemini-3.1-pro-preview
- 장면당 목표 15초 (최소 12초 / 최대 20초) 제약 조건 프롬프트 반영
- AI는 문장 인덱스만 반환 → 백엔드가 원본 텍스트 재조합 (텍스트 변조 방지)
- validate_coverage() 로 원본 문장 100% 포함 여부 검증

### 미디어 기획
- 장면별 미디어 타입 지정: ai_image / stock_photo / stock_video
- AI 이미지용 프롬프트, 스톡용 검색 키워드(영어), 무드 태그 자동 생성
- 미디어 비율 슬라이더 (합계 100% 자동 조정) → AI 프롬프트에 비율 지침 전달

### 장면 편집
- 드래그앤드롭 순서 변경 (@dnd-kit)
- 인라인 텍스트/주제/미디어 편집
- 장면 분할 (문장 단위 UI)
- 장면 합치기 (위/아래)
- 장면 추가 (위치 선택)
- 장면 삭제

### 프로젝트 관리
- 프로젝트 생성/열기/저장/이름변경/삭제
- 자동저장: 30초 타이머 + Ctrl+S 단축키
- localStorage 드래프트: 프로젝트 미저장 상태도 새로고침 후 복원 가능
- 마지막 열었던 프로젝트 자동 복원
- 프로젝트 데이터 = backend/projects/{uuid}/project.json (파일시스템)

### UX 보호 장치
- AI 분석 중: 모델선택·미디어비율·장면편집·저장·프로젝트목록 전부 비활성화
- 장면 있는 상태에서 재분석 시 경고 다이얼로그 + 기존 장면 초기화 후 시작
- 422 에러 시 Pydantic 필드 경로+메시지 가독성 있게 표시

### TTS 오디오 생성
- 제공자: Gemini TTS (직접 HTTP, PCM→WAV 변환) / MiniMax TTS (httpx, MP3)
- Gemini TTS 모델 3종: gemini-2.5-flash-preview-tts, gemini-2.5-pro-preview-tts, gemini-3.1-flash-tts-preview
- MiniMax TTS 모델: speech-02-hd, speech-02-turbo
- 목소리 선택: Gemini 30개 프리빌트 / MiniMax 프리셋 + 직접 입력
- 오디오 생성 후 실제 재생 시간으로 estimated_duration 자동 갱신
- 장면별 인라인 플레이어, 재생성, 삭제
- 전체 장면 일괄 생성 버튼
- WAV 파일 길이: wave 모듈 / MP3 길이: mutagen

---

## 미완성 / 미구현 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 스톡 미디어 검색 | ❌ 미구현 | Pixabay / Pexels API 연동 필요 |
| AI 이미지 생성 | ❌ 미구현 | scene.media.ai_image_prompt 활용, Imagen/DALL-E 등 |
| 자막(SRT) 생성 | ❌ 미구현 | 오디오 타임스탬프 기반 자막 생성 |
| 자막 오버레이 | ❌ 미구현 | FFmpeg subtitles 필터 |
| 배경음악 | ❌ 미구현 | 스톡 BGM 또는 AI 생성 |
| FFmpeg 영상 조립 | ❌ 미구현 | 최종 목표: 오디오+비주얼+자막 → MP4 |
| scene.assets.visual | ❌ 미구현 | 스키마에 필드 준비됨, 파일 저장 로직 미구현 |
| 영상 다운로드/내보내기 | ❌ 미구현 | FFmpeg 조립 후 가능 |

---

## 다음 작업 순서 (권장)

### Phase 3: 비주얼 자산 생성
1. **스톡 미디어 검색**: `stock_keywords` 활용
   - Pixabay API (`PIXABAY_API_KEY`) 또는 Pexels API
   - `POST /api/projects/{id}/scenes/{sid}/visual/search` → 검색 결과 목록
   - `POST /api/projects/{id}/scenes/{sid}/visual/select` → 선택 후 다운로드·저장
   - `scene.assets.visual` 경로 저장
2. **AI 이미지 생성**: `ai_image_prompt` 활용
   - Google Imagen / OpenAI DALL-E 3 / Stability AI 등
   - `POST /api/projects/{id}/scenes/{sid}/visual/generate`

### Phase 4: 자막 생성
- 오디오 파일 타임스탬프 기반 SRT 자막 생성
- Gemini TTS는 타임스탬프 미지원 → 문장 분리 + 오디오 길이 비율로 추정
- 또는 Whisper(STT)로 역추출

### Phase 5: 영상 조립 (FFmpeg)
- 장면 순서대로: 비주얼(이미지/영상) + 오디오 + 자막 합치기
- `POST /api/projects/{id}/render` → 백그라운드 작업 (진행률 SSE)
- 결과: `projects/{id}/output.mp4`

---

## 주의사항 / 알려진 이슈

- **Gemini TTS 속도 조절 미지원**: API 레벨에서 speed 파라미터 없음
- **MiniMax voice_id 확인**: [platform.minimax.io](https://platform.minimax.io) 콘솔에서 정확한 voice_id 확인 필요. Token Plan 사용 시 Token Plan Key 사용
- **Claude/Gemini 분석 동기 호출**: `claude_service.py`의 `anthropic.Anthropic()` 클라이언트가 sync이므로 async 루프를 블로킹함. 분석 중 다른 API 요청이 대기 상태가 됨 → 분석 중 UI 전체 비활성화로 우회 처리
- **대본 텍스트 보존 원칙**: AI는 절대 텍스트를 수정하지 않음. `start_idx`/`end_idx`(문장 인덱스)만 반환 → 백엔드가 원본에서 재조합
- **프로젝트 파일 위치**: `backend/projects/` — `.gitignore`에 등록됨
