SCENE_SPLIT_PROMPT = """당신은 유튜브 영상 제작을 위한 대본 분석 전문가입니다.

아래 대본을 분석하여 장면(씬)으로 분할해주세요.

## 분할 기준
1. 이야기의 세부 주제가 바뀔 때 분할합니다
2. 각 장면의 예상 낭독 시간 기준:
   - 최소: 12초
   - 목표: 15초
   - 최대: 20초
   - 한국어 평균 낭독 속도: 초당 약 5.5자 기준으로 계산
3. 12초 미만이면 인접 장면과 합치고, 20초 초과면 추가 분할하세요

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{
  "scenes": [
    {{
      "scene_id": 1,
      "text": "장면 대본 텍스트 (원문 그대로)",
      "topic_summary": "이 장면의 핵심 주제 한 줄 요약",
      "estimated_duration": 15.2
    }}
  ],
  "total_duration": 120.5,
  "total_scenes": 8
}}

## 대본
{script}"""


def build_prompt(script: str) -> str:
    return SCENE_SPLIT_PROMPT.format(script=script)
