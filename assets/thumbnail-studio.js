/* 탭 3 — 썸네일·카드뉴스·포스팅 */
(function () {
  'use strict';
  var CAS = window.CAS;

  var THEMES = {
    xray: { bg: ['#05070a', '#121a22'], ink: '#f4f8ff', sub: '#9fb0c3', grid: 'rgba(120,170,220,0.10)' },
    paper: { bg: ['#f7f5ef', '#e9e4d8'], ink: '#16181c', sub: '#5b6472', grid: 'rgba(0,0,0,0.07)' },
    ink: { bg: ['#081326', '#132a4a'], ink: '#eaf3ff', sub: '#90b4dd', grid: 'rgba(140,190,255,0.12)' },
    alert: { bg: ['#12060a', '#2a0a12'], ink: '#fff1f1', sub: '#e6a6a6', grid: 'rgba(255,140,140,0.10)' }
  };

  var state = { size: '1280x720', theme: 'xray', accent: '#ffd400', extra: null };

  function canvas() { return document.getElementById('cardCanvas'); }

  /* ---------- 텍스트 줄바꿈 ---------- */
  function wrapLines(ctx, text, maxWidth) {
    var paragraphs = String(text || '').split('\n');
    var out = [];
    paragraphs.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      var words = p.split(/\s+/);
      var line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w; }
        else line = test;
      });
      if (line) out.push(line);
    });
    return out;
  }

  function draw() {
    var cv = canvas();
    if (!cv) return;
    var parts = state.size.split('x');
    var W = Number(parts[0]), H = Number(parts[1]);
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var t = THEMES[state.theme] || THEMES.xray;
    var titleEl = document.getElementById('cardTitle');
    var subEl = document.getElementById('cardSub');
    var accEl = document.getElementById('cardAccent');
    if (accEl) state.accent = accEl.value || '#ffd400';
    var title = titleEl ? titleEl.value : '';
    var sub = subEl ? subEl.value : '';
    if (state.extra) {
      title = state.extra.title || title;
      sub = state.extra.sub || sub;
    }

    // 배경
    var g = ctx.createLinearGradient(0, 0, W * 0.7, H);
    g.addColorStop(0, t.bg[0]);
    g.addColorStop(1, t.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 그리드 (X-ray 느낌)
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = Math.max(1, W / 900);
    var step = W / 18;
    for (var x = 0; x <= W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y <= H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // 비네트
    var vg = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.15, W * 0.5, H * 0.5, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 강조 바
    var pad = Math.round(W * 0.075);
    ctx.fillStyle = state.accent;
    var barW = Math.round(W * 0.012);
    ctx.fillRect(pad, pad, barW, Math.round(H * 0.22));

    // 제목
    var titleSize = state.size === '1080x1920' ? Math.round(W * 0.108) : Math.round(W * 0.078);
    ctx.font = '900 ' + titleSize + 'px "Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    ctx.textBaseline = 'top';
    var lines = wrapLines(ctx, title || '제목을 입력하세요', W - pad * 2 - barW - 10).slice(0, 2);
    var lineH = titleSize * 1.16;
    var blockH = lines.length * lineH;
    var hasSub = !!sub;
    var subSize = Math.round(titleSize * 0.34);
    var subBlock = hasSub ? subSize * 1.35 * wrapLines(ctx, sub, W - pad * 2 - 20).slice(0, 2).length : 0;
    // 제목+보조 블록을 세로 중앙에 두되 하단 표식과 겹치지 않게
    var footerY = H - pad * 0.62 - Math.round(W * 0.022);
    var contentH = blockH + (hasSub ? subBlock + titleSize * 0.30 : 0);
    var startY = Math.round((H - contentH) / 2 - H * 0.04);
    if (startY < pad + H * 0.06) startY = pad + Math.round(H * 0.06);
    if (startY + contentH > footerY - 20) startY = Math.max(pad, footerY - 20 - contentH);
    lines.forEach(function (line, i) {
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(line, pad + barW + 14, startY + i * lineH + titleSize * 0.05);
      ctx.fillStyle = t.ink;
      ctx.fillText(line, pad + barW + 10, startY + i * lineH);
    });

    // 숫자 강조(제목에서 퍼센트/숫자 찾아 강조색으로) — 두 번째 줄이 있으면 마지막 줄 숫자만
    var lastLine = lines[lines.length - 1] || '';
    var m = lastLine.match(/([-+]?\d+(?:\.\d+)?\s*(?:%|배|회|g|초|분))/);
    if (m) {
      var before = lastLine.slice(0, m.index);
      var after = lastLine.slice(m.index + m[0].length);
      ctx.font = '900 ' + titleSize + 'px "Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
      var wBefore = ctx.measureText(before).width;
      var wNum = ctx.measureText(m[0]).width;
      var baseX = pad + barW + 10;
      var baseY = startY + (lines.length - 1) * lineH;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(lastLine, baseX, baseY + titleSize * 0.05);
      ctx.fillStyle = t.ink;
      ctx.fillText(before, baseX, baseY);
      ctx.fillStyle = state.accent;
      ctx.fillText(m[0], baseX + wBefore, baseY);
      ctx.fillStyle = t.ink;
      ctx.fillText(after, baseX + wBefore + wNum, baseY);
    }

    // 보조 문구
    if (sub) {
      ctx.font = '600 ' + subSize + 'px "Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
      ctx.fillStyle = t.sub;
      var subY = startY + blockH + Math.round(titleSize * 0.30);
      wrapLines(ctx, sub, W - pad * 2 - 20).slice(0, 2).forEach(function (l, i) {
        ctx.fillText(l, pad + barW + 10, subY + i * subSize * 1.35);
      });
    }

    // 하단 표식
    ctx.font = '700 ' + Math.round(W * 0.022) + 'px "Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    ctx.fillStyle = state.accent;
    ctx.fillText('●', pad, footerY);
    ctx.fillStyle = t.sub;
    ctx.fillText(state.size === '1080x1920' ? 'SHORTS' : (state.size === '1080x1080' ? 'CARD' : 'THUMBNAIL'), pad + W * 0.032, footerY);
  }

  CAS.thumbnail = { redraw: draw };

  /* ---------- AI 생성 ---------- */
  function buildPrompt(topic) {
    return [
      '주제: ' + topic,
      '아래 JSON으로 썸네일 콘셉트 3안과 채널별 게시 문구를 만들어 줘.',
      '- concepts: 서로 다른 전략 3개(예: 대비형/숫자형/질문형). composition은 구도·배치를 구체적으로.',
      '- imagePrompt: 이미지 생성 AI에 넣을 영어 프롬프트. 사진처럼 사실적인 톤, 텍스트는 넣지 말 것(no text, no watermark).',
      '- captions: youtubeCommunity(2~3문장 + 질문), instagram(3~4줄, 첫 줄 후킹, 줄바꿈 포함), threads(2문장, 대화체).',
      '- hashtags: 12~18개, 채널 성격에 맞게. 금지어는 넣지 않는다.'
    ].join('\n');
  }

  var SCHEMA = [
    '{',
    '  "concepts": [ { "name": "전략명", "composition": "구도 설명", "text": "썸네일 문구", "colors": "색 조합", "imagePrompt": "english prompt" } ],',
    '  "captions": { "youtubeCommunity": "...", "instagram": "...", "threads": "..." },',
    '  "hashtags": ["#태그"]',
    '}'
  ].join('\n');

  function demo(topic) {
    return {
      concepts: [
        {
          name: '숫자 대비형',
          composition: '좌측 상단 큰 제목 2줄, 우측에 다크 X-ray 근육 단면. 하단에 숫자 -18%만 강조색으로.',
          text: '밤새면 근성장 -18%',
          colors: '블랙 배경 + 노랑 #FFD400 강조 + 흰색 타이틀',
          imagePrompt: 'dark medical x-ray style illustration of human quadriceps muscle, blue-gray tones, subtle grid overlay, dramatic rim light, photorealistic, no text, no watermark, 16:9'
        },
        {
          name: '질문형',
          composition: '중앙 정렬 2줄 질문 + 배경에 흐릿한 침대/수면 장면. 하단 로고 자리 비움.',
          text: '하룻밤 새면\n근육이 사라질까?',
          colors: '딥 네이비 + 오프화이트 타이포',
          imagePrompt: 'cinematic photo of a dim bedroom at dawn, cold blue light through blinds, moody, shallow depth of field, no people, no text, 16:9'
        },
        {
          name: '도표 증거형',
          composition: '좌측에 논문 Forest plot 도표 카드, 우측에 결론 한 줄. 신뢰감 위주.',
          text: '8편 메타분석\n결론은 반대였다',
          colors: '페이퍼 화이트 + 잉크 블랙 + 레드 포인트',
          imagePrompt: 'clean scientific infographic layout on white paper, forest plot chart mockup, editorial design, flat, no readable text, 16:9'
        }
      ],
      captions: {
        youtubeCommunity: '잠을 줄이면 운동 효과가 줄어든다는 이야기, 실제 논문에서는 어디까지 확인됐을까요?\n8편을 모아 분석한 결과를 40초로 정리했습니다. 여러분은 하루 몇 시간 주무시나요?',
        instagram: '밤새면 근성장 18% 증발?\n8편 메타분석 결론은 조금 달랐습니다.\n수면 부족이 근육 합성을 어떻게 건드리는지 40초에 정리했어요.\n저장해 두고 오늘 밤은 일찍 누워보세요.',
        threads: '수면 부족이 근성장을 18% 깎는다는 논문, 조건을 보면 이야기가 조금 달라집니다. 40초 정리본 올렸어요.'
      },
      hashtags: ['#근성장', '#수면부족', '#운동과학', '#헬스랩1분', '#논문정리', '#근비대', '#운동정보', '#헬스타그램', '#단백질', '#회복', '#운동루틴', '#건강정보']
    };
  }

  function render(d, topic, meta) {
    var host = document.getElementById('thResult');
    var html = '';
    if (meta && meta.demo) html += '<div class="card"><div class="tiny muted">⚠ 샘플 결과입니다.</div></div>';
    html += '<div class="card"><h3 class="card-title">썸네일 콘셉트 3안</h3><div class="concept-grid">';
    (d.concepts || []).forEach(function (c, i) {
      html += '<div class="concept"><h4>' + (i + 1) + '. ' + CAS.esc(c.name || ('안 ' + (i + 1))) + '</h4>' +
        '<p><b style="color:#ffd400">' + CAS.esc(c.text || '') + '</b></p>' +
        '<p>' + CAS.esc(c.composition || '') + '</p>' +
        (c.colors ? '<p>색: ' + CAS.esc(c.colors) + '</p>' : '') +
        '<div class="row tight"><button class="btn tiny ghost" type="button" data-concept-copy="' + i + '">프롬프트 복사</button>' +
        '<button class="btn tiny ghost" type="button" data-concept-card="' + i + '">카드에 적용</button></div>' +
        '</div>';
    });
    html += '</div></div>';

    html += '<div class="card"><h3 class="card-title">게시 문구</h3>';
    var cap = d.captions || {};
    var rows = [
      ['유튜브 커뮤니티', cap.youtubeCommunity],
      ['인스타그램', cap.instagram],
      ['스레드', cap.threads]
    ];
    rows.forEach(function (r) {
      if (!r[1]) return;
      html += CAS.block(r[0], r[1]);
    });
    if (d.hashtags && d.hashtags.length) html += CAS.block('해시태그', d.hashtags.join(' '));
    html += '<div class="row"><button class="btn ghost" id="btnCopyPost" type="button">게시글 한 번에 복사</button></div></div>';

    host.innerHTML = html;
    host.classList.remove('hidden');
    CAS.bindCopy(host);

    host.querySelectorAll('[data-concept-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = (d.concepts || [])[Number(b.getAttribute('data-concept-copy'))] || {};
        CAS.copy(c.imagePrompt || '', '이미지 프롬프트');
      });
    });
    host.querySelectorAll('[data-concept-card]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = (d.concepts || [])[Number(b.getAttribute('data-concept-card'))] || {};
        state.extra = { title: c.text || topic, sub: topic };
        var ct = document.getElementById('cardTitle');
        var cs = document.getElementById('cardSub');
        if (ct) ct.value = c.text || topic;
        if (cs) cs.value = (c.colors || '').slice(0, 40) || '';
        draw();
        document.getElementById('cardCanvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
        CAS.toast('카드에 적용했습니다 — 문구를 다듬어 저장하세요');
      });
    });
    var post = document.getElementById('btnCopyPost');
    if (post) post.addEventListener('click', function () {
      var txt = '인스타그램\n' + (cap.instagram || '') + '\n\n' + (d.hashtags || []).join(' ') +
        '\n\n유튜브 커뮤니티\n' + (cap.youtubeCommunity || '') +
        '\n\n스레드\n' + (cap.threads || '');
      CAS.copy(txt, '게시글');
    });
  }

  CAS.thumbnailStudio = {
    init: function () {
      var topicEl = document.getElementById('thTopic');
      var status = document.getElementById('thStatus');
      var btn = document.getElementById('btnThGenerate');
      var demoBtn = document.getElementById('btnThDemo');
      var sizeSel = document.getElementById('cardSize');
      var themeSel = document.getElementById('cardTheme');
      var titleEl = document.getElementById('cardTitle');
      var subEl = document.getElementById('cardSub');
      var accEl = document.getElementById('cardAccent');
      var dl = document.getElementById('btnDownloadCard');
      var fromRes = document.getElementById('btnCardFromResult');

      if (sizeSel) sizeSel.addEventListener('change', function () { state.size = sizeSel.value; state.extra = null; draw(); });
      if (themeSel) themeSel.addEventListener('change', function () { state.theme = themeSel.value; draw(); });
      if (titleEl) titleEl.addEventListener('input', function () { state.extra = null; draw(); });
      if (subEl) subEl.addEventListener('input', function () { state.extra = null; draw(); });
      if (accEl) accEl.addEventListener('input', function () { state.accent = accEl.value; draw(); });

      if (dl) dl.addEventListener('click', function () {
        var cv = canvas();
        if (!cv) return;
        cv.toBlob(function (blob) {
          if (!blob) { CAS.toast('저장 실패'); return; }
          var name = (state.size === '1280x720' ? 'thumbnail' : state.size === '1080x1080' ? 'card' : 'shorts-cover')
            + '-' + Date.now() + '.png';
          CAS.download(name, blob, 'image/png');
          CAS.toast('PNG 저장');
        }, 'image/png');
      });

      if (fromRes) fromRes.addEventListener('click', function () {
        var first = document.querySelector('#thResult .concept b');
        if (first) { if (titleEl) titleEl.value = first.textContent; state.extra = null; draw(); CAS.toast('적용'); }
        else CAS.toast('먼저 콘셉트를 만들어 주세요');
      });

      function run() {
        var topic = (topicEl.value || '').trim();
        if (!topic) { CAS.setStatus(status, '주제나 영상 제목을 적어 주세요.', 'err'); topicEl.focus(); return; }
        CAS.busy(btn, true);
        CAS.setStatus(status, CAS.gemini.ready() ? '콘셉트 구성 중…' : '샘플 준비 중…', 'busy');
        var finish = function (d, meta) {
          render(d, topic, meta);
          CAS.setStatus(status, meta && meta.demo ? '샘플을 채웠습니다. 프롬프트를 복사해 AI에 붙이면 주제 맞춤 결과가 나옵니다.' : '완료', meta && meta.demo ? '' : 'ok');
          document.getElementById('thResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
          CAS.busy(btn, false);
        };
        if (!CAS.gemini.ready()) {
          finish(demo(topic), { demo: true });
          var host = document.getElementById('thResult');
          var box = document.createElement('div');
          box.className = 'card';
          box.innerHTML = CAS.block('썸네일·캡션 생성 프롬프트', CAS.gemini.copyPrompt(buildPrompt(topic), SCHEMA));
          host.appendChild(box);
          CAS.bindCopy(host);
          return;
        }
        CAS.gemini.json(buildPrompt(topic), { schemaHint: SCHEMA, temperature: 0.9 })
          .then(function (d) { finish(d, {}); })
          .catch(function (e) {
            CAS.setStatus(status, '생성 실패: ' + CAS.errText(e), 'err');
            var host = document.getElementById('thResult');
            host.innerHTML = '<div class="card">' + CAS.block('썸네일·캡션 생성 프롬프트', CAS.gemini.copyPrompt(buildPrompt(topic), SCHEMA)) + '</div>';
            host.classList.remove('hidden');
            CAS.bindCopy(host);
            CAS.busy(btn, false);
          });
      }

      if (btn) btn.addEventListener('click', run);
      if (demoBtn) demoBtn.addEventListener('click', function () {
        var topic = (topicEl.value || 'AI가 수능을 다 풀어도 근육은 못 만든다').trim();
        render(demo(topic), topic, { demo: true });
        CAS.setStatus(status, '샘플을 채웠습니다.', '');
      });

      // 초기 카드
      if (titleEl && !titleEl.value) titleEl.value = '밤새면\n근성장 -18%';
      if (subEl && !subEl.value) subEl.value = 'Lamon et al. 2021 · Physiol Rep';
      state.accent = (accEl && accEl.value) || '#ffd400';
      requestAnimationFrame(draw);
    },
    draw: draw
  };
})();
