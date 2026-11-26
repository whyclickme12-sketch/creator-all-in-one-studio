/* 탭 4 — 자동 컷편집기 (로컬 무음 감지 + 원격 워커 렌더) */
(function () {
  'use strict';
  var CAS = window.CAS;

  var S = {
    file: null,
    url: '',
    duration: 0,
    envelope: null,     // {rate: 100, values: Float32Array}
    cuts: [],           // 무음 구간
    keeps: [],          // 유지 구간
    subs: [],
    aspect: '9:16',
    workerJob: null,
    analyzing: false
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  /* ---------- 파일 선택 ---------- */
  function pickFile(file) {
    if (!file) return;
    if (!/^(video|audio)\//.test(file.type)) {
      CAS.setStatus(els.status, '영상이나 오디오 파일만 올릴 수 있습니다. (지금: ' + (file.type || '알 수 없음') + ')', 'err');
      return;
    }
    reset(false);
    S.file = file;
    S.url = URL.createObjectURL(file);
    els.video.src = S.url;
    els.video.load();
    els.detect.disabled = false;
    CAS.setStatus(els.status, fileLabel(file) + ' 준비됨. "무음 감지"를 눌러 주세요.', 'ok');
    els.video.addEventListener('loadedmetadata', function once() {
      S.duration = els.video.duration || 0;
      els.video.removeEventListener('loadedmetadata', once);
      CAS.setStatus(els.status, fileLabel(file) + ' · 길이 ' + CAS.time(S.duration) + ' — "무음 감지"를 눌러 주세요.', 'ok');
    });
    els.drop.querySelector('strong').textContent = file.name;
    els.drop.querySelector('.muted').textContent = fileLabel(file);
  }

  function fileLabel(f) {
    var mb = (f.size / (1024 * 1024));
    return f.name + ' · ' + (mb > 1 ? mb.toFixed(1) + 'MB' : Math.round(f.size / 1024) + 'KB');
  }

  function reset(clearFile) {
    if (S.url) { try { URL.revokeObjectURL(S.url); } catch (e) {} }
    S.url = ''; S.envelope = null; S.cuts = []; S.keeps = []; S.subs = []; S.duration = 0;
    if (clearFile) {
      S.file = null;
      els.video.removeAttribute('src');
      els.detect.disabled = true;
      els.drop.querySelector('strong').textContent = '영상 · 오디오 선택';
      els.drop.querySelector('.muted').textContent = 'MP4 · MOV · MP3 · M4A · WAV';
    }
    if (els.wave) {
      var ctx = els.wave.getContext('2d');
      ctx.clearRect(0, 0, els.wave.width, els.wave.height);
    }
    els.list.innerHTML = '';
    els.subs.innerHTML = '';
    els.summary.textContent = '';
    if (els.exportPlan) els.exportPlan.disabled = true;
    if (els.exportSrt) els.exportSrt.disabled = true;
  }

  /* ---------- 오디오 디코드 & 무음 감지 ---------- */
  function analyseBuffer(buffer, db, minSilence) {
    var rate = 100; // 초당 100 윈도우
    var chCount = buffer.numberOfChannels;
    var len = buffer.length;
    var sr = buffer.sampleRate;
    var winSize = Math.max(1, Math.floor(sr / rate));
    var winCount = Math.floor(len / winSize);
    var env = new Float32Array(winCount);
    var data = [];
    for (var c = 0; c < Math.min(chCount, 2); c++) data.push(buffer.getChannelData(c));

    for (var w = 0; w < winCount; w++) {
      var start = w * winSize;
      var sum = 0;
      for (var i = 0; i < winSize; i += 4) { // 4샘플 간격으로 충분
        var v = 0;
        for (var c2 = 0; c2 < data.length; c2++) v += data[c2][start + i] || 0;
        v /= data.length;
        sum += v * v;
      }
      env[w] = Math.sqrt(sum / Math.ceil(winSize / 4));
    }

    S.envelope = { rate: rate, values: env, duration: len / sr };
    var cuts = detect(env, rate, db, minSilence);
    S.cuts = cuts;
    S.keeps = complement(cuts, len / sr);
    drawWave();
    renderTimeline();
    buildSubs();
    els.exportPlan.disabled = false;
    els.exportSrt.disabled = false;
  }

  function detect(env, rate, dbThreshold, minSilence) {
    var th = Math.pow(10, dbThreshold / 20);
    var out = [];
    var runStart = -1;
    for (var i = 0; i < env.length; i++) {
      var silent = env[i] < th;
      if (silent && runStart < 0) runStart = i;
      if ((!silent || i === env.length - 1) && runStart >= 0) {
        var end = (!silent ? i : i + 1) / rate;
        var startT = runStart / rate;
        if (end - startT >= minSilence) {
          // 앞뒤 80ms 여유를 남기지 않고 그대로 자른다
          out.push({ start: round3(startT), end: round3(end) });
        }
        runStart = -1;
      }
    }
    return mergeAdjacent(out);
  }

  function mergeAdjacent(list) {
    var out = [];
    list.forEach(function (c) {
      var last = out[out.length - 1];
      if (last && c.start - last.end < 0.12) last.end = c.end;
      else out.push({ start: c.start, end: c.end });
    });
    return out;
  }

  function complement(cuts, duration) {
    var keeps = [];
    var cursor = 0;
    cuts.forEach(function (c) {
      if (c.start - cursor > 0.15) keeps.push({ start: round3(cursor), end: round3(c.start) });
      cursor = Math.max(cursor, c.end);
    });
    if (duration - cursor > 0.15) keeps.push({ start: round3(cursor), end: round3(duration) });
    return keeps;
  }

  function round3(n) { return Math.round(n * 1000) / 1000; }

  /* ---------- 실시간 폴백(디코드 실패 시) ---------- */
  function analyseRealtime() {
    return new Promise(function (resolve, reject) {
      if (!S.file) return reject(new Error('파일이 없습니다.'));
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return reject(new Error('이 브라우저는 Web Audio를 지원하지 않습니다.'));
      CAS.setStatus(els.status, '영상 오디오를 실시간으로 훑는 중… 끝까지 재생되므로 길이만큼 걸립니다.', 'busy');
      var ac = new AC();
      var src;
      try { src = ac.createMediaElementSource(els.video); }
      catch (e) { return reject(new Error('이미 오디오 그래프에 연결된 요소입니다. 페이지를 새로고침해 주세요.')); }
      var analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      var gain = ac.createGain();
      gain.gain.value = 0;
      src.connect(analyser); analyser.connect(gain); gain.connect(ac.destination);
      var buf = new Float32Array(analyser.fftSize);
      var values = [];
      var dur = els.video.duration || 0;
      var rate = 100;
      els.video.currentTime = 0;
      els.video.playbackRate = Math.min(16, Math.max(4, dur / 120));
      els.video.muted = false; els.video.volume = 1;
      var timer = setInterval(function () {
        analyser.getFloatTimeDomainData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i += 4) sum += buf[i] * buf[i];
        values.push(Math.sqrt(sum / (buf.length / 4)));
      }, 10);
      els.video.play().catch(function () {});
      var done = function () {
        clearInterval(timer);
        els.video.pause();
        els.video.playbackRate = 1;
        try { src.disconnect(); gain.disconnect(); ac.close(); } catch (e) {}
        if (!values.length) return reject(new Error('오디오를 읽지 못했습니다.'));
        // 재생 속도를 고려해 초당 100 윈도우로 리샘플
        var total = values.length;
        var target = Math.max(1, Math.round(dur * rate));
        var env = new Float32Array(target);
        for (var w = 0; w < target; w++) {
          var a = Math.floor(w / target * total), b = Math.floor((w + 1) / target * total);
          var mx = 0;
          for (var k = a; k < Math.max(a + 1, b); k++) mx = Math.max(mx, values[k] || 0);
          env[w] = mx;
        }
        S.envelope = { rate: rate, values: env, duration: dur };
        var db = Number(els.db.value), minSil = Number(els.minSil.value);
        S.cuts = detect(env, rate, db, minSil);
        S.keeps = complement(S.cuts, dur);
        drawWave(); renderTimeline(); buildSubs();
        els.exportPlan.disabled = false;
        els.exportSrt.disabled = false;
        resolve();
      };
      els.video.addEventListener('ended', done, { once: true });
      setTimeout(done, Math.max(8000, (dur / els.video.playbackRate) * 1000 + 4000));
    });
  }

  /* ---------- 목록 ---------- */
  function renderTimeline() {
    var keepTotal = S.keeps.reduce(function (a, k) { return a + (k.end - k.start); }, 0);
    var cutTotal = S.cuts.reduce(function (a, c) { return a + (c.end - c.start); }, 0);
    els.summary.textContent = '유지 ' + S.keeps.length + '구간 ' + CAS.time(keepTotal) + ' · 컷 ' + S.cuts.length + '구간 ' + CAS.time(cutTotal) + ' (−' + Math.round(cutTotal / Math.max(1, S.duration) * 100) + '%)';

    var html = '';
    S.cuts.forEach(function (c, i) {
      html += '<div class="cut-item cut"><span class="t">✂ ' + CAS.time(c.start) + ' ~ ' + CAS.time(c.end) + ' <span class="muted">(' + (c.end - c.start).toFixed(2) + '초)</span></span>' +
        '<button class="btn tiny ghost" type="button" data-restore="' + i + '">살리기</button></div>';
    });
    S.keeps.forEach(function (k, i) {
      html += '<div class="cut-item"><span class="t">▶ ' + CAS.time(k.start) + ' ~ ' + CAS.time(k.end) + ' <span class="muted">(' + (k.end - k.start).toFixed(2) + '초)</span></span>' +
        '<button class="btn tiny ghost" type="button" data-keep-play="' + i + '">미리보기</button></div>';
    });
    els.list.innerHTML = html;

    els.list.querySelectorAll('[data-restore]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-restore'));
        var cut = S.cuts[i];
        if (!cut) return;
        S.cuts.splice(i, 1);
        S.keeps = complement(S.cuts, S.duration);
        drawWave(); renderTimeline(); buildSubs();
        CAS.toast('구간을 되살렸습니다');
      });
    });
    els.list.querySelectorAll('[data-keep-play]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = S.keeps[Number(b.getAttribute('data-keep-play'))];
        if (!k) return;
        els.video.currentTime = k.start;
        els.video.play().catch(function () {});
        var stopAt = function () {
          if (els.video.currentTime >= k.end) { els.video.pause(); els.video.removeEventListener('timeupdate', stopAt); }
        };
        els.video.addEventListener('timeupdate', stopAt);
      });
    });
  }

  function drawWave() {
    var cv = els.wave;
    if (!cv || !S.envelope) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cssW = cv.clientWidth || 600, cssH = 90;
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    var env = S.envelope, n = env.values.length;
    var max = 0.0001;
    for (var i = 0; i < n; i++) max = Math.max(max, env.values[i]);
    var mid = cssH / 2, barW = Math.max(1, cssW / n);

    // 무음 구간 배경
    S.cuts.forEach(function (c) {
      var x1 = (c.start / env.duration) * cssW;
      var x2 = (c.end / env.duration) * cssW;
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(x1, 0, Math.max(1, x2 - x1), cssH);
    });

    for (var w = 0; w < n; w++) {
      var x = (w / n) * cssW;
      var amp = Math.min(1, env.values[w] / max);
      var h = Math.max(1, amp * (cssH - 8));
      var silent = env.values[w] < Math.pow(10, Number(els.db.value) / 20);
      ctx.fillStyle = silent ? '#3a4453' : '#ffd400';
      ctx.fillRect(x, mid - h / 2, Math.max(1, barW - 0.3), h);
    }
    // 중앙선
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, mid, cssW, 1);
  }

  /* ---------- 자막 초안 ---------- */
  function buildSubs() {
    S.subs = S.keeps.map(function (k) {
      return { start: k.start, end: k.end, text: '' };
    });
    renderSubs();
  }

  function renderSubs() {
    els.subs.innerHTML = S.subs.map(function (s, i) {
      return '<div class="sub-item"><span class="script-time">' + CAS.time(s.start) + '~' + CAS.time(s.end) + '</span>' +
        '<input type="text" data-sub="' + i + '" value="' + CAS.esc(s.text) + '" placeholder="이 구간에서 할 말" /></div>';
    }).join('');
    els.subs.querySelectorAll('[data-sub]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        S.subs[Number(inp.getAttribute('data-sub'))].text = inp.value;
      });
    });
  }

  function subsToSrt() {
    var filled = S.subs.filter(function (s) { return s.text.trim(); });
    var list = filled.length ? filled : S.subs;
    return list.map(function (s, i) {
      return (i + 1) + '\n' + CAS.srtTime(s.start) + ' --> ' + CAS.srtTime(s.end) + '\n' + (s.text || ' ') + '\n';
    }).join('\n');
  }

  /* ---------- 워커 ---------- */
  function workerBase() {
    return String(CAS.getSetting('workerUrl') || '').trim().replace(/\/+$/, '');
  }

  function health() {
    var base = workerBase();
    if (!base) { CAS.setStatus(els.renderStatus, '설정 탭에서 워커 주소를 먼저 넣어 주세요.', 'err'); return; }
    CAS.setStatus(els.renderStatus, '확인 중…', 'busy');
    fetch(base + '/health', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        CAS.setStatus(els.renderStatus, '연결됨 · ' + (j.ffmpeg ? 'FFmpeg OK' : 'FFmpeg 확인 필요') + ' · ' + (j.whisper ? 'Whisper OK' : 'Whisper 미설치') , j.ffmpeg ? 'ok' : 'err');
      })
      .catch(function () {
        CAS.setStatus(els.renderStatus, '연결 실패 — 주소·CORS·HTTPS(터널) 여부를 확인하세요. Pages는 https라서 http 워커는 브라우저가 막습니다.', 'err');
      });
  }

  function renderRemote() {
    var base = workerBase();
    if (!base) { CAS.setStatus(els.renderStatus, '설정 탭에서 워커 주소를 먼저 넣어 주세요.', 'err'); return; }
    if (!S.file) { CAS.setStatus(els.renderStatus, '영상 파일을 먼저 선택하세요.', 'err'); return; }

    var fd = new FormData();
    fd.append('file', S.file, S.file.name);
    fd.append('aspect', S.aspect);
    fd.append('silence_db', els.db.value);
    fd.append('min_silence', els.minSil.value);
    fd.append('do_silence', els.optSilence.checked ? '1' : '0');
    fd.append('do_subs', els.optSubs.checked ? '1' : '0');
    fd.append('do_safe', els.optSafe.checked ? '1' : '0');
    fd.append('subtitles', subsToSrt());
    fd.append('cuts', JSON.stringify(S.cuts));

    CAS.busy(els.render, true);
    CAS.setStatus(els.renderStatus, '업로드 중… 파일이 크면 오래 걸립니다. 화면을 켜 두세요.', 'busy');
    els.renderResult.classList.add('hidden');

    fetch(base + '/render', { method: 'POST', body: fd })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.detail || j.error || ('워커 오류 ' + r.status));
          return j;
        });
      })
      .then(function (j) {
        S.workerJob = j.job_id;
        poll(j.job_id, base, 0);
      })
      .catch(function (e) {
        CAS.setStatus(els.renderStatus, '업로드 실패: ' + CAS.errText(e), 'err');
        CAS.busy(els.render, false);
      });
  }

  function poll(jobId, base, attempt) {
    fetch(base + '/jobs/' + encodeURIComponent(jobId))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.status === 'done') {
          CAS.setStatus(els.renderStatus, '완료 — 내려받으세요.', 'ok');
          var url = base + (j.download_url || ('/download/' + jobId));
          els.renderResult.innerHTML = '<div class="block"><div class="block-head"><b>렌더 결과</b>' +
            '<a class="btn tiny primary" href="' + CAS.esc(url) + '" download>MP4 저장</a></div>' +
            '<video src="' + CAS.esc(url) + '" controls playsinline style="width:100%;border-radius:10px;margin-top:6px"></video>' +
            '<div class="tiny muted" style="margin-top:6px">' + CAS.esc(j.message || '') + '</div></div>';
          els.renderResult.classList.remove('hidden');
          CAS.busy(els.render, false);
          return;
        }
        if (j.status === 'error') {
          CAS.setStatus(els.renderStatus, '워커 오류: ' + (j.message || '알 수 없음'), 'err');
          CAS.busy(els.render, false);
          return;
        }
        CAS.setStatus(els.renderStatus, (j.status === 'queued' ? '대기 중' : '렌더링 중') + '… ' + (j.progress != null ? Math.round(j.progress) + '%' : '') + ' ' + (j.message || ''), 'busy');
        if (attempt < 900) setTimeout(function () { poll(jobId, base, attempt + 1); }, 2000);
      })
      .catch(function (e) {
        if (attempt < 5) setTimeout(function () { poll(jobId, base, attempt + 1); }, 2500);
        else { CAS.setStatus(els.renderStatus, '상태 확인 실패: ' + CAS.errText(e), 'err'); CAS.busy(els.render, false); }
      });
  }

  /* ---------- 초기화 ---------- */
  CAS.cutEditor = {
    init: function () {
      els.drop = $('cutDrop');
      els.file = $('cutFile');
      els.video = $('cutVideo');
      els.wave = $('waveCanvas');
      els.list = $('cutList');
      els.subs = $('subtitleList');
      els.summary = $('cutSummary');
      els.status = $('cutStatus');
      els.detect = $('btnDetect');
      els.db = $('cutDb');
      els.minSil = $('cutMinSil');
      els.exportPlan = $('btnExportPlan');
      els.exportSrt = $('btnExportSrt');
      els.render = $('btnWorkerRender');
      els.renderStatus = $('renderStatus');
      els.renderResult = $('renderResult');
      els.optSilence = $('optSilence');
      els.optSubs = $('optSubs');
      els.optSafe = $('optSafe');

      if (!els.drop) return;

      els.drop.addEventListener('click', function () { els.file.click(); });
      els.file.addEventListener('change', function () { pickFile(els.file.files[0]); });
      ['dragenter', 'dragover'].forEach(function (ev) {
        els.drop.addEventListener(ev, function (e) { e.preventDefault(); els.drop.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        els.drop.addEventListener(ev, function (e) { e.preventDefault(); els.drop.classList.remove('drag'); });
      });
      els.drop.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) pickFile(f);
      });

      var dbVal = $('cutDbVal'), minVal = $('cutMinSilVal');

      function redetect() {
        if (dbVal) dbVal.textContent = els.db.value + ' dB';
        if (minVal) minVal.textContent = Number(els.minSil.value).toFixed(2) + '초';
        if (!S.envelope) return;
        S.cuts = detect(S.envelope.values, S.envelope.rate, Number(els.db.value), Number(els.minSil.value));
        S.keeps = complement(S.cuts, S.duration);
        drawWave(); renderTimeline(); buildSubs();
      }
      els.db.addEventListener('input', redetect);
      els.minSil.addEventListener('input', redetect);

      document.getElementById('cutAspect').addEventListener('click', function (e) {
        var b = e.target.closest('.chip');
        if (!b) return;
        document.querySelectorAll('#cutAspect .chip').forEach(function (c) { c.classList.remove('active'); });
        b.classList.add('active');
        S.aspect = b.getAttribute('data-aspect');
        $('previewFrame').classList.toggle('landscape', S.aspect === '16:9');
      });

      els.detect.addEventListener('click', function () {
        if (!S.file) return;
        var db = Number(els.db.value), minSil = Number(els.minSil.value);
        CAS.busy(els.detect, true);
        CAS.setStatus(els.status, '오디오를 분석하는 중…', 'busy');
        var failSafe = function (err) {
          // 디코드 실패 → 실시간 스캔
          analyseRealtime().then(function () {
            CAS.setStatus(els.status, '실시간 스캔 완료 — 무음 ' + S.cuts.length + '구간을 찾았습니다.', 'ok');
          }).catch(function (e2) {
            CAS.setStatus(els.status, '분석 실패: ' + (e2.message || e2) + '. 오디오 트랙이 없는 영상이거나 코덱 문제일 수 있습니다. 원격 워커(FFmpeg)를 쓰면 해결됩니다.', 'err');
          }).then(function () { CAS.busy(els.detect, false); });
        };
        var file = S.file;
        if (file.size > 400 * 1024 * 1024) {
          CAS.setStatus(els.status, '파일이 400MB를 넘어 브라우저 디코드를 건너뜁니다. 실시간 스캔으로 진행합니다.', '');
          return failSafe();
        }
        var reader = new FileReader();
        reader.onerror = function () { failSafe(new Error('파일을 읽지 못했습니다.')); };
        reader.onload = function () {
          var AC = window.AudioContext || window.webkitAudioContext;
          var ac = new AC();
          ac.decodeAudioData(reader.result).then(function (buffer) {
            S.duration = buffer.duration;
            analyseBuffer(buffer, db, minSil);
            CAS.setStatus(els.status, '완료 — 무음 ' + S.cuts.length + '구간 · 유지 ' + S.keeps.length + '구간. 아래에서 조정하세요.', 'ok');
            try { ac.close(); } catch (e) {}
            CAS.busy(els.detect, false);
          }).catch(function () {
            try { ac.close(); } catch (e) {}
            failSafe(new Error('decode'));
          });
        };
        reader.readAsArrayBuffer(file);
      });

      document.getElementById('btnCutReset').addEventListener('click', function () {
        reset(true);
        CAS.setStatus(els.status, '초기화했습니다.', '');
      });

      els.exportPlan.addEventListener('click', function () {
        var plan = {
          source: S.file ? S.file.name : '',
          duration: S.duration,
          aspect: S.aspect,
          silenceDb: Number(els.db.value),
          minSilence: Number(els.minSil.value),
          cuts: S.cuts,
          keeps: S.keeps,
          subtitles: S.subs
        };
        CAS.download('cut-plan-' + Date.now() + '.json', JSON.stringify(plan, null, 2), 'application/json');
        CAS.toast('컷 플랜 저장');
      });

      els.exportSrt.addEventListener('click', function () {
        CAS.download('auto-subs-' + Date.now() + '.srt', subsToSrt(), 'text/plain;charset=utf-8');
        CAS.toast('자막 초안 저장');
      });

      document.getElementById('btnAddSub').addEventListener('click', function () {
        var last = S.subs[S.subs.length - 1];
        var start = last ? last.end : 0;
        S.subs.push({ start: start, end: start + 3, text: '' });
        renderSubs();
      });

      document.getElementById('btnWorkerHealth').addEventListener('click', health);
      els.render.addEventListener('click', renderRemote);

      var wu = $('workerUrl');
      if (wu) {
        wu.addEventListener('change', function () {
          CAS.saveSettings({ workerUrl: wu.value.trim().replace(/\/+$/, '') });
        });
        // workerUrl 입력은 설정 탭과 공유
        document.addEventListener('cas:settings', function (e) {
          if (document.activeElement !== wu) wu.value = e.detail.workerUrl || '';
        });
        wu.value = CAS.getSetting('workerUrl') || '';
      }

      window.addEventListener('resize', function () { if (S.envelope) drawWave(); });
    }
  };
})();
