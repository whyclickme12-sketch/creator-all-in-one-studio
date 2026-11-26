# 원격 고속 렌더링 워커 (Python + FFmpeg + Faster-Whisper)

폰에서 올린 영상을 **집 PC나 서버가 대신 편집**해 주는 작은 서버입니다.
웹앱의 `컷편집 → 원격 고속 렌더링 워커` 주소 칸에 이 서버 주소를 넣으면:

1. 업로드된 영상에서 **무음 구간을 자동으로 찾아** 잘라내고
2. **9:16(쇼츠) 또는 16:9(롱폼)** 로 크롭·스케일한 뒤
3. **Faster-Whisper로 한국어 자막**을 만들어 안전구역(하단 여백 210px)에 태우고
4. **MP4(H.264/AAC, faststart)** 로 렌더해 폰으로 내려받게 해 줍니다.

무료·로컬 실행이며, 영상이 외부로 나가지 않습니다(내 PC에서만 처리).

---

## 1. 준비물

| 프로그램 | 확인 방법 | 설치 |
|---|---|---|
| Python 3.10+ | `python --version` | https://www.python.org/downloads/ (설치 시 **Add Python to PATH** 체크) |
| FFmpeg | `ffmpeg -version` | `winget install --id Gyan.FFmpeg -e` |
| (선택) Cloudflare Tunnel | `cloudflared --version` | `winget install --id Cloudflare.cloudflared -e` |

> Faster-Whisper 모델은 첫 실행 때 자동으로 내려받습니다(`small` 기준 약 500MB). 인터넷이 필요합니다.

## 2. 실행 (윈도우)

`start_worker.bat`을 **더블클릭**하면 가상환경 생성 → 패키지 설치 → 서버 실행까지 자동으로 됩니다.

수동으로 하려면:

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

정상 실행되면 콘솔에 주소가 찍힙니다:

```
주소: http://127.0.0.1:8000   (같은 와이파이에서는 http://<PC IP>:8000)
```

브라우저에서 그 주소를 열면 **FFmpeg / Whisper 상태**가 보입니다.

## 3. 폰에서 연결하기 (중요)

GitHub Pages는 **HTTPS** 사이트입니다. 브라우저는 HTTPS 페이지에서 `http://` 주소로 요청하는 것을 막습니다(혼합 콘텐츠).
그래서 폰에서 쓰려면 워커에도 **HTTPS 주소**가 필요합니다. 가장 쉬운 방법:

```bat
cloudflared tunnel --url http://localhost:8000
```

출력에 나오는 `https://xxxx-xxxx.trycloudflare.com` 주소를 복사해
웹앱 → 컷편집 → **원격 고속 렌더링 워커 → 워커 주소**에 붙여넣고 **연결 확인**을 누르세요.

- 같은 와이파이에서 PC 브라우저로만 쓸 때는 `http://<PC IP>:8000`도 됩니다.
- `trycloudflare.com` 주소는 실행할 때마다 바뀝니다. 계속 쓰려면 Cloudflare 계정의 **Named Tunnel**을 만드세요.

## 4. 렌더 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| 무음 자동 컷 | 켜짐 | `silencedetect`로 무음 구간을 찾아 제거 |
| 자동 자막(Whisper) | 켜짐 | 컷이 끝난 영상의 음성으로 자막 생성(타임코드가 자동으로 맞음) |
| 안전구역 자막 | 켜짐 | 9:16 기준 하단 210px 여백, 좌우 60px |

`WHISPER_MODEL` 환경 변수로 모델 크기를 바꿀 수 있습니다(`tiny` / `base` / `small` / `medium`).
빠르게 쓰려면 `base`, 정확도를 올리려면 `medium`(느림).

```bat
set WHISPER_MODEL=base
python server.py
```

## 5. API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 상태(FFmpeg·Whisper 설치 여부) |
| POST | `/render` | multipart 업로드 → `{ "job_id": "..." }` |
| GET | `/jobs/{job_id}` | `status`(queued/processing/done/error), `progress`, `message` |
| GET | `/download/{job_id}` | 완성된 MP4 |
| DELETE | `/jobs/{job_id}` | 작업 폴더 삭제 |

```bash
curl -F "file=@input.mp4" -F "aspect=9:16" -F "silence_db=-35" -F "min_silence=0.35" \
     http://localhost:8000/render
```

## 6. 문제 해결

- **"연결 실패"** — ① 서버가 켜져 있는지 ② 주소가 `https://`인지(폰) ③ `cloudflared` 창이 살아 있는지 확인.
- **자막이 안 나옴** — `faster-whisper` 설치 실패가 가장 흔합니다. `pip install faster-whisper`를 다시 실행하고 콘솔의 `[whisper]` 로그를 확인하세요. 실패해도 컷 편집은 정상 동작합니다.
- **한글 자막 폰트 깨짐** — 자막은 `subs.ass`를 만들어 태우고, 폰트는 `Malgun Gothic`(윈도우 기본)입니다. 리눅스 서버라면 `fonts-noto-cjk`를 설치하고 `server.py`의 `write_ass()` 안 `Style:` 줄의 `Malgun Gothic`을 `Noto Sans CJK KR`로 바꾸세요.
- **자막 위치** — 자막은 SRT가 아니라 해상도를 지정한 ASS로 그립니다(9:16은 하단 210px, 16:9는 80px 여백). `safe` 옵션을 끄면 더 아래(90px/48px)에 붙습니다.
- **업로드가 끊김** — 파일이 크면(300MB↑) 와이파이에서 시도하세요. `MAX_UPLOAD_MB`(기본 800)로 제한을 바꿀 수 있습니다.
- **느림** — `preset veryfast`로 인코딩합니다. 3분 영상이 보통 PC에서 1~2분, Whisper까지 하면 2~4분 걸립니다.

## 7. 보안

기본값은 인증이 없습니다(집 LAN·임시 터널 전용). 인터넷에 상시 노출하려면:

```bat
set WORKER_TOKEN=원하는-긴-문자열
python server.py
```

앱은 `?token=` 쿼리나 `X-Worker-Token` 헤더를 함께 보내야 합니다(현재 웹 UI는 토큰 미지원이므로, 상시 노출 시에는 Named Tunnel 앞단에 Cloudflare Access를 거는 편을 권합니다).
