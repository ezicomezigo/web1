import re
from typing import List, Tuple


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
        # 문장 종결 부호 뒤 공백이 있으면 분리 (부호는 앞 문장에 유지)
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

SCENE_SPLIT_PROMPT = """당신은 유튜브 영상 제작을 위한 대본 분석 전문가입니다.

아래에 번호가 매겨진 문장 목록이 있습니다.
각 장면에 포함될 문장 범위(시작 인덱스 ~ 끝 인덱스)를 결정해주세요.

## 분할 기준
1. 이야기의 세부 주제가 바뀔 때 장면을 나눕니다
2. 각 장면의 예상 낭독 시간:
   - 최소: 12초 / 목표: 15초 / 최대: 20초
   - 낭독 속도: 초당 약 5.5자
3. 모든 문장을 빠짐없이, 중복 없이 커버해야 합니다
4. 인덱스는 0부터 시작합니다

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{
  "scenes": [
    {{
      "scene_id": 1,
      "start_idx": 0,
      "end_idx": 3,
      "topic_summary": "이 장면의 핵심 주제 한 줄 요약",
      "estimated_duration": 15.2
    }}
  ],
  "total_scenes": 8
}}

## 문장 목록 (총 {total} 개)
{numbered_sentences}"""


def build_prompt(sentences: List[str]) -> str:
    numbered = '\n'.join(f'[{i}] {s}' for i, s in enumerate(sentences))
    return SCENE_SPLIT_PROMPT.format(total=len(sentences), numbered_sentences=numbered)
