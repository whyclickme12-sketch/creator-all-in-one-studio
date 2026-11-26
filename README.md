# 🎬 올인원 유튜브 스튜디오 (creator-all-in-one-studio)

채널 분석 · AI 대본 · 썸네일 · 자동 컷편집을 **한 화면**에서.
모바일 브라우저에서 홈 화면에 추가해 앱처럼 쓰는 **PWA 정적 웹앱**입니다. 서버가 없고, API 키는 브라우저에만 저장됩니다.

- 앱: **https://whyclickme12-sketch.github.io/creator-all-in-one-studio/**
- 렌더 워커(선택): [`worker/`](worker/) — Python + FFmpeg + Faster-Whisper

## 탭 구성

| 탭 | 하는 일 |
|---|---|
| 📊 **분석** | 채널 URL(@핸들)·영상 URL → 구독자·총 조회수·최근 영상·요일/시간대 분포·쇼츠 vs 롱폼 → Gemini 리포트(후킹 전략·제목 패턴·벤치마킹) |
| ✍️ **기획** | 주제 한 줄 → 제목 5안 · 썸네일 문구 · 40초 쇼츠 / 3분 롱폼 **초 단위 대본**(화면 지시·자막 포함) · SRT/TXT 저장 |
| 🖼️ **썸네일** | 콘셉트 3안 + 영어 이미지 프롬프트 · 커뮤니티/인스타/스레드 캡션·해시태그 · **Canvas 카드 편집기**(16:9·1:1·9:16 → PNG) |
| ✂️ **컷편집** | 영상/오디오 무음 자동 감지(Web Audio) · 9:16/16:9 프리뷰 · 컷 타임라인 · 자막 초안 SRT · **원격 워커로 MP4 렌더** |
| ⚙️ **설정** | YouTube Data API v3 키 · Gemini API 키(localStorage) · 채널 프리셋(헬스랩 1분 / 디투짐 릴스 / 집 go / 고양이를 독점하고 싶은 사람 / 일반) |

## 키 없이도 전부 체험

키가 없으면 **샘플 데이터**로 모든 화면이 채워지고, AI가 만들 프롬프트를 **복사**해 ChatGPT·Claude·Gemini 웹에 붙여 쓸 수 있습니다.
키 발급은 각각 5분이면 됩니다(설정 탭에 링크 있음):

- YouTube Data API v3 — 하루 10,000 유닛 무료 (분석 1회 ≈ 5~10유닛)
- Gemini API — Google AI Studio에서 무료 발급

## 원클릭 세팅 링크 (키 자동 저장)

폰에서 키를 붙여넣지 않아도 되도록, 링크 한 번으로 두 키를 `localStorage`에 넣는 기능이 있습니다.

```
https://whyclickme12-sketch.github.io/creator-all-in-one-studio/#setup=<base64url>
```

- `#setup=` 뒤에는 `yt=<YouTube 키>&gem=<Gemini 키>`(선택: `&model=<모델명>`)를 담은 문자열을 **base64url**로 인코딩해 넣습니다(평문 쿼리 문자열·JSON도 그대로 인식).
- 앱이 부팅 전에 값을 읽어 기존 설정에 병합 저장하고, 곧바로 `history.replaceState`로 해시를 지웁니다 → 주소창·방문 기록·공유 링크에 키가 남지 않습니다.
- 저장 후 상단 모드 배지가 `API 연결됨`으로 바뀌고 "YouTube · Gemini API 키가 자동으로 저장되었습니다!" 토스트가 뜹니다.
- **키는 저장소 코드·커밋에 넣지 않습니다.** 링크는 키를 가진 사람에게만 직접 전달하세요.

```bash
# 링크 만들기 (예시)
python3 -c "import base64;print('https://whyclickme12-sketch.github.io/creator-all-in-one-studio/#setup='+base64.urlsafe_b64encode(b'yt=KEY1&gem=KEY2').decode().rstrip('='))"
```

## 프리셋

「헬스랩 1분」은 논문 근거·AI 티 최소화·안전구역 자막 규칙을, 「디투짐 릴스」는 `24시간`·`연중무휴`·`재활` 금지어와 지역 태그를 프롬프트에 자동으로 넣습니다.

- **집 go (맛집·반주, @jipgo_official)** — 퇴근 후 한잔 대리만족, 동네 노포·자영업자 응원, 과장 없는 1인칭 실사 브이로그. 마지막 줄은 고정 엔딩 멘트 `돌고 돌아 결국 가는 곳은, 2차도 3차도 아닌 내 집입니다. 오늘도 잘 먹고, 집 go!`로 끝맺고, 기본 태그 `#집go #오늘도한잔 #퇴근후한잔 #동네맛집 #노포 #자영업자응원`이 해시태그에 먼저 들어갑니다.
- **고양이를 독점하고 싶은 사람 (4마리 다묘 집사, @고양이독점)** — 유쾌하고 따뜻한 일상 쇼츠, 짧고 가벼운 자막 톤. 기본 태그 `#고양이 #다묘집사 #고양이일상 #집사일기 #고양이를독점하고싶은사람`, 제목·해시태그에는 무거운 단어를 노출하지 않도록 `고독사`를 금지어로 두었습니다.

## 홈 화면에 추가

- **안드로이드 크롬**: ⋮ → 앱 설치 / 홈 화면에 추가
- **아이폰 사파리**: 공유 → 홈 화면에 추가

## 구조

```
index.html                 앱 셸 (5개 패널 + 하단 탭)
manifest.webmanifest       PWA 매니페스트
sw.js                      앱 셸 오프라인 캐시
assets/app.css             모바일 퍼스트 스타일
assets/app.js              저장소·설정·탭·공용 유틸
assets/youtube.js          YouTube Data API 파싱·조회·지표 계산
assets/gemini.js           Gemini 호출·JSON 파싱·모델 폴백
assets/analyzer.js         탭1 렌더 + AI 리포트
assets/script-studio.js    탭2 대본 생성·SRT/TXT
assets/thumbnail-studio.js 탭3 콘셉트·캡션 + Canvas 편집기
assets/cut-editor.js       탭4 무음 감지·타임라인·워커 렌더
worker/                    선택: 원격 렌더 서버(FFmpeg + Whisper)
dev/mobile-preview.html    데스크톱에서 390px 모바일 레이아웃을 확인하는 미리보기
```

## 개인정보

- API 키와 설정은 `localStorage`에만 있고 어떤 서버로도 보내지 않습니다.
- 영상 파일은 **워커를 직접 설정한 경우에만** 그 워커로 전송됩니다(기본은 100% 기기 안에서 처리).
- 렌더 워커는 결과물을 `worker/jobs/`에 두고 24시간 뒤 자동 삭제합니다.

## 라이선스

개인용으로 만든 도구입니다. 자유롭게 고쳐 쓰세요.
