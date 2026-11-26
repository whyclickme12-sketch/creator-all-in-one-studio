"""
올인원 유튜브 스튜디오 — 원격 고속 렌더링 워커
=================================================
집 PC나 서버에서 돌리는 자동 편집 서버입니다.
 - 업로드된 영상에서 무음 구간을 찾아 잘라내고(FFmpeg silencedetect + select)
 - 9:16 / 16:9 로 크롭·스케일한 뒤
 - Faster-Whisper로 자막을 만들어 안전구역에 태우고
 - MP4(H.264/AAC, faststart)로 돌려줍니다.

실행:  python server.py          (기본 0.0.0.0:8000)
문서:  http://<PC IP>:8000/docs
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

APP_VERSION = "1.0.0"
BASE_DIR = Path(__file__).resolve().parent
JOBS_DIR = BASE_DIR / "jobs"
JOBS_DIR.mkdir(exist_ok=True)

TOKEN = os.environ.get("WORKER_TOKEN", "").strip()          # 비우면 인증 없음(집 LAN 전용)
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")    # tiny/base/small/medium
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "800"))
JOB_TTL_HOURS = int(os.environ.get("JOB_TTL_HOURS", "24"))

app = FastAPI(title="올인원 유튜브 스튜디오 렌더 워커", version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
_whisper = None
_whisper_error = ""


# --------------------------------------------------------------------------- 유틸
def which_ffmpeg() -> tuple[str, str]:
    exe = shutil.which("ffmpeg") or ""
    probe = shutil.which("ffprobe") or ""
    return exe, probe


def run(cmd: list[str], timeout: int = 3600) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, errors="replace")


def probe_duration(path: Path) -> float:
    _, probe = which_ffmpeg()
    if not probe:
        return 0.0
    p = run([probe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)], timeout=120)
    try:
        return float(p.stdout.strip())
    except Exception:
        return 0.0


def set_job(job_id: str, **kw) -> None:
    with JOBS_LOCK:
        job = JOBS.setdefault(job_id, {})
        job.update(kw)
        job["updated_at"] = datetime.now().isoformat(timespec="seconds")


def get_job(job_id: str) -> dict | None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        return dict(job) if job else None


def load_whisper():
    """Faster-Whisper를 한 번만 로드합니다. 없으면 None."""
    global _whisper, _whisper_error
    if _whisper is not None:
        return _whisper
    if _whisper_error:
        return None
    try:
        from faster_whisper import WhisperModel  # type: ignore

        _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        print(f"[whisper] 모델 로드 완료: {WHISPER_MODEL}")
    except Exception as e:  # noqa: BLE001
        _whisper_error = f"{type(e).__name__}: {e}"
        print(f"[whisper] 사용 불가 — 자막 자동 생성을 건너뜁니다. ({_whisper_error})")
        _whisper = None
    return _whisper


def srt_time(sec: float) -> str:
    sec = max(0.0, float(sec))
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms == 1000:
        ms = 0
        s += 1
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def safe_float(value, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


# --------------------------------------------------------------------------- 무음 감지
def detect_silence(path: Path, noise_db: float, min_silence: float, total: float) -> tuple[list[dict], list[dict]]:
    """FFmpeg silencedetect → (컷 구간, 유지 구간)."""
    ffmpeg, _ = which_ffmpeg()
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-i", str(path),
        "-af", f"silencedetect=noise={noise_db}dB:d={min_silence}",
        "-f", "null", "-",
    ]
    proc = run(cmd, timeout=1800)
    log = (proc.stderr or "") + (proc.stdout or "")

    starts = [float(x) for x in re.findall(r"silence_start:\s*(-?[\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", log)]
    cuts: list[dict] = []
    for i, start in enumerate(starts):
        end = ends[i] if i < len(ends) else total
        start = max(0.0, start)
        end = min(total or end, end)
        if end - start >= min_silence * 0.95:
            cuts.append({"start": round(start, 3), "end": round(end, 3)})

    # 앞뒤 아주 짧은 무음은 그대로 둔다(자연스러운 호흡)
    keeps: list[dict] = []
    cursor = 0.0
    for c in cuts:
        if c["start"] - cursor > 0.20:
            keeps.append({"start": round(cursor, 3), "end": round(c["start"], 3)})
        cursor = max(cursor, c["end"])
    if (total or cursor) - cursor > 0.20:
        keeps.append({"start": round(cursor, 3), "end": round(total, 3)})
    return cuts, keeps


# --------------------------------------------------------------------------- 렌더
def build_cut_filter(keeps: list[dict]) -> tuple[str, str]:
    """유지 구간만 남기는 select 필터식을 만듭니다."""
    conds = []
    for k in keeps:
        conds.append(f"between(t\\,{k['start']:.3f}\\,{k['end']:.3f})")
    expr = "+".join(conds) if conds else "1"
    vf = f"select='{expr}',setpts=N/FRAME_RATE/TB"
    af = f"aselect='{expr}',asetpts=N/SR/TB"
    return vf, af


def render_cut_job(job_id: str, input_path: Path, opts: dict) -> None:
    try:
        ffmpeg, _ = which_ffmpeg()
        if not ffmpeg:
            raise RuntimeError("FFmpeg를 찾을 수 없습니다. PATH에 ffmpeg를 설치해 주세요.")

        job_dir = input_path.parent
        out_dir = job_dir / "out"
        out_dir.mkdir(exist_ok=True)

        set_job(job_id, status="processing", progress=5, message="영상 정보 확인 중")

        total = probe_duration(input_path)
        aspect = opts.get("aspect", "9:16")
        do_silence = bool(opts.get("do_silence", True))
        do_subs = bool(opts.get("do_subs", True))
        do_safe = bool(opts.get("do_safe", True))
        noise_db = safe_float(opts.get("silence_db"), -35)
        min_silence = safe_float(opts.get("min_silence"), 0.35)

        cuts: list[dict] = []
        keeps: list[dict] = []
        if do_silence:
            set_job(job_id, progress=15, message="무음 구간 분석 중")
            cuts, keeps = detect_silence(input_path, noise_db, min_silence, total)
            if not keeps:
                keeps = [{"start": 0.0, "end": total}]
                cuts = []
            set_job(job_id, progress=35, cuts=cuts, keeps=keeps,
                    message=f"무음 {len(cuts)}구간 / 유지 {len(keeps)}구간")
        else:
            keeps = [{"start": 0.0, "end": total}]

        # 1단계: 컷 + 비율 맞춤
        target_w, target_h = (1080, 1920) if aspect == "9:16" else (1920, 1080)
        cut_path = out_dir / "cut.mp4"
        vf_cut, af_cut = build_cut_filter(keeps)
        vf = (
            f"{vf_cut},"
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h},fps=30"
        )
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(input_path),
            "-vf", vf, "-af", af_cut,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "160k",
            str(cut_path),
        ]
        set_job(job_id, progress=45, message="컷 편집 · 비율 변환 중")
        proc = run(cmd, timeout=5400)
        if proc.returncode != 0 or not cut_path.exists():
            raise RuntimeError(f"FFmpeg 컷 렌더 실패: {(proc.stderr or '')[-600:]}")

        current = cut_path

        # 2단계: 자막 (Whisper → SRT → burn)
        srt_path = out_dir / "subs.srt"
        if do_subs:
            set_job(job_id, progress=65, message="음성 인식으로 자막 생성 중")
            model = load_whisper()
            if model is not None:
                audio = out_dir / "audio.wav"
                run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(current),
                     "-vn", "-ac", "1", "-ar", "16000", str(audio)], timeout=1800)
                segments, _info = model.transcribe(str(audio), language="ko", vad_filter=True, beam_size=5)
                lines = []
                for i, seg in enumerate(segments, 1):
                    text = (seg.text or "").strip()
                    if not text:
                        continue
                    lines.append(f"{i}\n{srt_time(seg.start)} --> {srt_time(seg.end)}\n{text}\n")
                srt_path.write_text("\n".join(lines), encoding="utf-8")
                try:
                    audio.unlink()
                except OSError:
                    pass
            else:
                provided = (opts.get("subtitles") or "").strip()
                if provided:
                    srt_path.write_text(provided, encoding="utf-8")
                    set_job(job_id, message="Whisper 없음 — 앱에서 보낸 자막 초안 사용")
                else:
                    set_job(job_id, message="Whisper 미설치 — 자막 없이 렌더")

        final_path = out_dir / "final.mp4"
        if srt_path.exists() and srt_path.stat().st_size > 0 and do_subs:
            set_job(job_id, progress=82, message="자막 태우는 중")
            style = (
                "FontName=Malgun Gothic,FontSize=17,PrimaryColour=&H00FFFFFF,"
                "BorderStyle=1,Outline=1.6,Shadow=0,Alignment=2"
            )
            # 안전구역: 하단 여백 210px (9:16 기준). 가로 영상은 90px.
            margin_v = 210 if aspect == "9:16" else 90
            style += f",MarginV={margin_v},MarginL=60,MarginR=60" if do_safe else ",MarginV=48,MarginL=40,MarginR=40"
            srt_escaped = str(srt_path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
            sub_filter = f"subtitles='{srt_escaped}':force_style='{style}'"
            proc = run([
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(current),
                "-vf", sub_filter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-c:a", "copy", "-movflags", "+faststart", str(final_path),
            ], timeout=5400)
            if proc.returncode != 0 or not final_path.exists():
                # 자막 실패는 치명적이지 않게 처리
                shutil.copyfile(current, final_path)
                set_job(job_id, message="자막 합성 실패 — 자막 없이 저장했습니다")
        else:
            shutil.copyfile(current, final_path)
        try:
            run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(final_path),
                 "-c", "copy", "-movflags", "+faststart", str(out_dir / "ready.mp4")], timeout=900)
            if (out_dir / "ready.mp4").exists():
                shutil.move(str(out_dir / "ready.mp4"), str(final_path))
        except Exception:
            pass

        duration = probe_duration(final_path)
        size = final_path.stat().st_size
        set_job(
            job_id,
            status="done",
            progress=100,
            message=f"완료 · {duration:.1f}초 · {size / 1024 / 1024:.1f}MB · 무음 {len(cuts)}구간 제거",
            download_url=f"/download/{job_id}",
            duration=round(duration, 2),
            size=size,
            finished_at=datetime.now().isoformat(timespec="seconds"),
        )
    except Exception as e:  # noqa: BLE001
        set_job(job_id, status="error", message=f"{type(e).__name__}: {e}")
        print(f"[job {job_id}] 실패: {e}")


# --------------------------------------------------------------------------- 정리
def cleanup_old_jobs() -> None:
    now = time.time()
    for folder in JOBS_DIR.glob("*"):
        try:
            if folder.is_dir() and now - folder.stat().st_mtime > JOB_TTL_HOURS * 3600:
                shutil.rmtree(folder, ignore_errors=True)
        except OSError:
            pass


cleanup_old_jobs()


# --------------------------------------------------------------------------- API
@app.get("/", response_class=HTMLResponse)
def index():
    ffmpeg, _ = which_ffmpeg()
    return f"""<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>렌더 워커 상태</title>
<style>body{{font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif;background:#0b0d10;color:#eef2f7;padding:24px;line-height:1.6}}
code{{background:#161b22;padding:2px 6px;border-radius:6px}} .ok{{color:#3ddc97}} .bad{{color:#ff6b6b}}</style>
<h2>올인원 유튜브 스튜디오 · 렌더 워커 v{APP_VERSION}</h2>
<p>FFmpeg: <b class="{'ok' if ffmpeg else 'bad'}">{'설치됨' if ffmpeg else '없음'}</b></p>
<p>Whisper: <b class="{'ok' if not _whisper_error else 'bad'}">{'사용 가능' if not _whisper_error else '미설치/오류'}</b></p>
<p>작업 폴더: <code>{JOBS_DIR}</code> · {JOB_TTL_HOURS}시간 뒤 자동 삭제</p>
<p>API 문서: <a href="/docs" style="color:#ffd400">/docs</a></p>
<p>웹앱의 "원격 고속 렌더링 워커" 주소 칸에 이 주소를 그대로 넣으세요.</p>
</html>"""


@app.get("/health")
def health():
    ffmpeg, probe = which_ffmpeg()
    return {
        "ok": True,
        "version": APP_VERSION,
        "ffmpeg": bool(ffmpeg),
        "ffprobe": bool(probe),
        "whisper": not bool(_whisper_error),
        "whisper_error": _whisper_error,
        "jobs": len(JOBS),
    }


@app.post("/render")
async def render(
    request: Request,
    file: UploadFile = File(...),
    aspect: str = Form("9:16"),
    silence_db: float = Form(-35),
    min_silence: float = Form(0.35),
    do_silence: str = Form("1"),
    do_subs: str = Form("1"),
    do_safe: str = Form("1"),
    subtitles: str = Form(""),
    cuts: str = Form(""),
):
    if TOKEN:
        supplied = request.headers.get("x-worker-token") or request.query_params.get("token") or ""
        if supplied != TOKEN:
            raise HTTPException(status_code=401, detail="이 워커는 X-Worker-Token 헤더(또는 ?token=)가 필요합니다.")
    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "input.mp4").suffix or ".mp4"
    input_path = job_dir / f"input{suffix}"

    limit = MAX_UPLOAD_MB * 1024 * 1024
    written = 0
    with open(input_path, "wb") as fh:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > limit:
                fh.close()
                shutil.rmtree(job_dir, ignore_errors=True)
                raise HTTPException(status_code=413, detail=f"파일이 너무 큽니다(최대 {MAX_UPLOAD_MB}MB).")
            fh.write(chunk)
    await file.close()

    set_job(job_id, status="queued", progress=0, message="대기 중", filename=file.filename, bytes=written)
    opts = {
        "aspect": aspect,
        "silence_db": silence_db,
        "min_silence": min_silence,
        "do_silence": do_silence not in ("0", "false", "False"),
        "do_subs": do_subs not in ("0", "false", "False"),
        "do_safe": do_safe not in ("0", "false", "False"),
        "subtitles": subtitles,
        "cuts": cuts,
    }
    threading.Thread(target=render_cut_job, args=(job_id, input_path, opts), daemon=True).start()
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")
    return job


@app.get("/download/{job_id}")
def download(job_id: str):
    path = JOBS_DIR / job_id / "out" / "final.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="결과 파일이 없습니다.")
    return FileResponse(path, media_type="video/mp4", filename=f"short-{job_id}.mp4")


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    with JOBS_LOCK:
        JOBS.pop(job_id, None)
    shutil.rmtree(JOBS_DIR / job_id, ignore_errors=True)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    ffmpeg, _ = which_ffmpeg()
    port = int(os.environ.get("PORT", "8000"))
    print("=" * 62)
    print(f" 올인원 유튜브 스튜디오 렌더 워커 v{APP_VERSION}")
    print(f" FFmpeg: {'OK' if ffmpeg else '없음 — 반드시 설치하세요'}")
    print(f" 주소:   http://127.0.0.1:{port}  (같은 와이파이에서는 http://<PC IP>:{port})")
    print(" 폰에서 쓰려면 HTTPS 터널이 필요합니다: cloudflared tunnel --url http://localhost:%d" % port)
    print("=" * 62)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
