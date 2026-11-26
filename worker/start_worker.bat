@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ==========================================================
echo  올인원 유튜브 스튜디오 - 원격 렌더 워커 (Windows)
echo ==========================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [X] Python이 설치되어 있지 않습니다.
  echo     https://www.python.org/downloads/ 에서 설치하고
  echo     설치 첫 화면의 "Add Python to PATH"를 꼭 체크하세요.
  start https://www.python.org/downloads/
  pause
  exit /b 1
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo [!] FFmpeg가 PATH에 없습니다. 지금 설치할 수 있습니다:
  echo     winget install --id Gyan.FFmpeg -e
  echo.
  choice /c YN /m "지금 winget으로 FFmpeg를 설치할까요"
  if errorlevel 2 goto noffmpeg
  winget install --id Gyan.FFmpeg -e
  echo 설치 후 이 창을 닫고 다시 실행해 주세요.
  pause
  exit /b 0
)
:noffmpeg

if not exist ".venv" (
  echo [1/3] 가상환경 만드는 중...
  python -m venv .venv
)
call .venv\Scripts\activate.bat

echo [2/3] 필요한 패키지 확인 중... (처음 한 번은 몇 분 걸립니다)
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
  echo [X] 패키지 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하세요.
  pause
  exit /b 1
)

echo [3/3] 서버 시작
echo.
echo  - 이 PC에서:      http://127.0.0.1:8000
echo  - 같은 와이파이:   http://<이 PC의 IP>:8000
echo  - 폰(HTTPS 앱)에서 쓰려면 새 창에서:
echo      cloudflared tunnel --url http://localhost:8000
echo        (winget install --id Cloudflare.cloudflared -e)
echo    표시되는 https://....trycloudflare.com 주소를 웹앱에 넣으세요.
echo.
python server.py

pause
