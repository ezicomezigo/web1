import re
from typing import List


def split_into_sentences(text: str) -> List[str]:
    """
    대본을 문장 단위로 분리합니다.
    줄바꿈과 문장 부호(.!?~)를 기준으로 분리하며 빈 문장은 제외합니다.
    """
    lines = text.strip().split('\n')
    sentences = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = re.split(r'(?<=[.!?~])\s+', line)
        sentences.extend(p.strip() for p in parts if p.strip())
    return sentences


def reconstruct_scenes(sentences: List[str], ranges: List[dict]) -> List[str]:
    """
    문장 목록과 AI가 반환한 범위(start_idx, end_idx)로 장면 텍스트를 재구성합니다.
    텍스트는 원본 문장에서만 가져오므로 원본이 100% 보존됩니다.
    """
    return [
        ' '.join(sentences[r['start_idx']: r['end_idx'] + 1])
        for r in ranges
    ]


def validate_coverage(sentences: List[str], ranges: List[dict]) -> List[str]:
    """
    모든 문장이 정확히 한 번씩 커버되는지 검증합니다.
    문제가 있으면 경고 메시지 목록을 반환합니다.
    """
    n = len(sentences)
    covered = [False] * n
    warnings = []

    for r in ranges:
        s, e = r['start_idx'], r['end_idx']
        if s < 0 or e >= n or s > e:
            warnings.append(f"장면 {r['scene_id']}: 유효하지 않은 범위 [{s}~{e}] (전체 문장 수: {n})")
            continue
        for i in range(s, e + 1):
            if covered[i]:
                warnings.append(f"문장 [{i}] 중복 포함됨 (장면 {r['scene_id']})")
            covered[i] = True

    missing = [i for i, c in enumerate(covered) if not c]
    if missing:
        warnings.append(f"누락된 문장 인덱스: {missing}")

    return warnings


# ─── 프롬프트 ────────────────────────────────────────────────────────────────

SCENE_SPLIT_PROMPT = """당신은 유튜브 영상 제작 전문가입니다.
아래 번호가 매겨진 문장 목록을 분석하여 장면 분할과 미디어 구성 계획을 수립해주세요.

## 장면 분할 기준
1. 이야기의 세부 주제가 바뀔 때 장면을 나눕니다
2. 각 장면의 예상 낭독 시간: 최소 12초 / 목표 15초 / 최대 20초 (낭독 속도: 초당 약 5.5자)
3. 모든 문장을 빠짐없이, 중복 없이 커버해야 합니다 (인덱스는 0부터 시작)

## 미디어 유형 선택 기준
각 장면에 대해 아래 중 하나를 선택하세요:
- "ai_image": 추상적 개념, 비유, 감정 표현, 역사적 재현, 특수한 장면 구성이 필요한 경우
- "stock_photo": 인물, 장소, 사물, 정적인 실사 이미지가 어울리는 경우
- "stock_video": 동작, 자연, 군중, 도시 풍경 등 움직이는 장면이 어울리는 경우

## 미디어 비율 목표 (전체 장면 기준)
{ratio_guide}
이 비율을 최대한 맞춰서 장면별 미디어 유형을 결정하세요.
콘텐츠와 전혀 맞지 않는 경우에는 비율보다 콘텐츠 적합성을 우선합니다.

## 미디어 유형별 추가 정보
- "ai_image" 선택 시: 영어로 된 이미지 생성 프롬프트 (구체적인 구도, 스타일, 분위기 포함)
- "stock_photo" 또는 "stock_video" 선택 시: 영어 검색 키워드 3~5개 (짧고 직관적으로)

## 장면 분위기 (mood) - 나중에 BGM과 자막 스타일에 활용됩니다
bright / calm / serious / energetic / dark / emotional 중 하나 선택

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{
  "scenes": [
    {{
      "scene_id": 1,
      "start_idx": 0,
      "end_idx": 3,
      "topic_summary": "이 장면의 핵심 주제 한 줄 요약",
      "estimated_duration": 15.2,
      "media": {{
        "media_type": "ai_image",
        "ai_image_prompt": "A crumbling ancient Chinese imperial palace at dusk, dramatic lighting, cinematic style, ultra-realistic",
        "stock_keywords": null,
        "mood": "serious"
      }}
    }},
    {{
      "scene_id": 2,
      "start_idx": 4,
      "end_idx": 7,
      "topic_summary": "...",
      "estimated_duration": 14.8,
      "media": {{
        "media_type": "stock_video",
        "ai_image_prompt": null,
        "stock_keywords": ["busy stock market trading floor", "financial crisis", "crowd panic"],
        "mood": "energetic"
      }}
    }}
  ],
  "total_scenes": 2
}}

## 문장 목록 (총 {total} 개)
{numbered_sentences}"""


def build_prompt(sentences: list, media_ratio: dict | None = None) -> str:
    numbered = '\n'.join(f'[{i}] {s}' for i, s in enumerate(sentences))

    if media_ratio:
        ai = media_ratio.get("ai_image", 30)
        photo = media_ratio.get("stock_photo", 30)
        video = media_ratio.get("stock_video", 40)
        ratio_guide = (
            f"- AI 이미지(ai_image): 약 {ai}%\n"
            f"- 스톡 사진(stock_photo): 약 {photo}%\n"
            f"- 스톡 영상(stock_video): 약 {video}%"
        )
    else:
        ratio_guide = "- AI가 콘텐츠에 맞게 자유롭게 결정"

    return SCENE_SPLIT_PROMPT.format(
        total=len(sentences),
        numbered_sentences=numbered,
        ratio_guide=ratio_guide,
    )
