#!/bin/bash
# 백엔드와 프론트엔드를 동시에 실행

echo "=== 유튜브 영상 자동 생성기 시작 ==="

# 백엔드 실행
cd backend
if [ ! -d ".venv" ]; then
  echo "[백엔드] 가상환경 생성 중..."
  python3 -m venv .venv
fi
source .venv/bin/activate
echo "[백엔드] 패키지 설치 중..."
pip install -r requirements.txt -q
echo "[백엔드] 서버 시작 (http://localhost:8000)"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# 프론트엔드 실행
cd frontend
echo "[프론트엔드] 서버 시작 (http://localhost:3000)"
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ 백엔드:    http://localhost:8000"
echo "✓ 프론트엔드: http://localhost:3000"
echo "✓ API 문서:  http://localhost:8000/docs"
echo ""
echo "종료하려면 Ctrl+C 를 누르세요."

# 두 프로세스가 종료될 때까지 대기
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
