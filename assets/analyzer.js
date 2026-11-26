/* 탭 1 — 채널·영상 분석기 */
(function () {
  'use strict';
  var CAS = window.CAS;

  /* ---------- 데모 데이터 (헬스랩 1분 실제 편성 기반 샘플) ---------- */
  function demoData() {
    var titles = [
      ['운동 후 찬물 목욕, 근성장을 30% 깎는다?', 5120, 0, 38.4, 1, 16],
      ['하룻밤 밤새면 근성장 18% 증발?', 3410, 2, 41.3, 0, 9],
      ['레그 익스텐션 90° vs 40°, 2.7배 차이', 2890, 1, 40.3, 3, 9],
      ['AI가 수능을 다 풀어도 근육은 못 만든다', 1620, 2, 40.1, 5, 10],
      ['크레아틴 1회 복용? 수면 부족이 먼저다', 2380, 1, 39.3, 2, 9],
      ['아침 공복 vs 저녁 운동, 뭐가 좋을까', 1480, 3, 39.5, 1, 7],
      ['자기 전 유청 프로틴 30g의 진실', 1120, 4, 44.2, 6, 21],
      ['무거운 10회 vs 가벼운 30회 (롱폼)', 640, 1, 203.0, 0, 13],
      ['펙덱 플라이, 팔꿈치 각도 하나로 달라진다', 12, 0, 53.1, 2, 18]
    ];
    var now = Date.now();
    var rows = titles.map(function (t, i) {
      var daysAgo = i * 2 + 2;
      var d = new Date(now - daysAgo * 86400000);
      var k = new Date(d.getTime() + 9 * 3600 * 1000);
      return {
        id: 'demo' + i,
        title: t[0],
        views: t[1],
        likes: Math.round(t[1] * 0.045),
        comments: Math.round(t[1] * 0.004),
        duration: t[3],
        isShort: t[3] <= 62,
        dow: k.getUTCDay(),
        hour: t[5],
        publishedAt: d.toISOString(),
        thumb: ''
      };
    });

    var dowCount = [0, 0, 0, 0, 0, 0, 0], dowViews = [0, 0, 0, 0, 0, 0, 0];
    var hourCount = new Array(24).fill(0), hourViews = new Array(24).fill(0);
    rows.forEach(function (r) {
      dowCount[r.dow]++; dowViews[r.dow] += r.views;
      hourCount[r.hour]++; hourViews[r.hour] += r.views;
    });
    var total = rows.reduce(function (a, r) { return a + r.views; }, 0);
    var shorts = rows.filter(function (r) { return r.isShort; });
    var longs = rows.filter(function (r) { return !r.isShort; });
    function avg(l) { return l.length ? Math.round(l.reduce(function (a, r) { return a + r.views; }, 0) / l.length) : 0; }
    var sorted = rows.map(function (r) { return r.views; }).sort(function (a, b) { return a - b; });

    return {
      demo: true,
      channel: {
        id: 'UC_DEMO', title: '헬스랩 1분', handle: '@healthlab_1min',
        description: '논문으로 확인한 운동·영양을 1분 안에 정리합니다.',
        avatar: '', subscribers: 10, hiddenSubs: false, totalViews: 16800, videoCount: 9, country: 'KR'
      },
      rows: rows,
      summary: {
        sampled: rows.length, sampleViews: total, avgViews: Math.round(total / rows.length),
        medianViews: sorted[Math.floor(sorted.length / 2)],
        likeRate: total ? (rows.reduce(function (a, r) { return a + r.likes; }, 0) / total) * 100 : 0,
        engagement: 4.9, shortsCount: shorts.length, longCount: longs.length,
        shortsAvg: avg(shorts), longAvg: avg(longs), latestDays: 0,
        bestDow: ['수', '금', '월', '일', '화', '목', '토'][dowViews.indexOf(Math.max.apply(null, dowViews))] + '요일',
        bestDowAvg: Math.max.apply(null, dowViews),
        bestSlot: '09:00~12:00', bestSlotAvg: 2870
      },
      distributions: {
        dow: dowCount.map(function (c, i) { return { label: ['일', '월', '화', '수', '목', '금', '토'][i], count: c, views: dowViews[i] }; }),
        hour: hourCount.map(function (c, i) { return { label: (i < 10 ? '0' : '') + i + '시', count: c, views: hourViews[i] }; })
      },
      top: rows.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, 5),
      bottom: rows.slice().sort(function (a, b) { return a.views - b.views; }).slice(0, 3),
      warning: '샘플 데이터입니다. 실제 분석은 설정 탭의 YouTube Data API 키를 넣으면 됩니다.'
    };
  }

  /* ---------- 렌더 ---------- */
  function barList(items, maxIdx) {
    var max = Math.max.apply(null, items.map(function (it) { return it.count; }).concat([1]));
    return items.map(function (it) {
      var pct = it.count > 0 ? Math.max(3, Math.round((it.count / max) * 100)) : 0;
      return '<div class="bar-row"><span class="lbl">' + CAS.esc(it.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="val">' + (it.count ? it.count + '편' : '-') + '</span></div>';
    }).join('');
  }

  function render(result) {
    var host = document.getElementById('anaResult');
    if (!host) return;
    var c = result.channel, s = result.summary;
    var html = '';

    if (result.demo || result.warning) {
      html += '<div class="card" style="border-color:#3d4450"><div class="tiny muted">⚠ ' + CAS.esc(result.warning || '') + '</div></div>';
    }

    html += '<div class="card">';
    html += '<div class="chan-head">';
    html += c.avatar ? '<img class="chan-avatar" src="' + CAS.esc(c.avatar) + '" alt="" referrerpolicy="no-referrer" />'
      : '<div class="chan-avatar chan-initial">' + CAS.esc(String(c.title || '?').slice(0, 1)) + '</div>';
    html += '<div style="min-width:0"><div class="chan-name">' + CAS.esc(c.title) + '</div>';
    html += '<div class="chan-meta">' + CAS.esc(c.handle || '') + (c.country ? ' · ' + CAS.esc(c.country) : '') + '</div></div>';
    html += '</div>';
    html += '<div class="stat-grid">';
    html += '<div class="stat"><b>' + (c.hiddenSubs ? '비공개' : CAS.num(c.subscribers)) + '</b><span>구독자</span></div>';
    html += '<div class="stat"><b>' + CAS.num(c.totalViews) + '</b><span>채널 총 조회수</span></div>';
    html += '<div class="stat"><b>' + CAS.num(c.videoCount) + '</b><span>공개 영상</span></div>';
    html += '<div class="stat"><b>' + CAS.num(s.avgViews) + '</b><span>최근 ' + s.sampled + '편 평균</span></div>';
    html += '</div>';
    html += '<div class="stat-grid" style="margin-top:8px">';
    html += '<div class="stat"><b>' + CAS.num(s.medianViews) + '</b><span>중앙값 조회수</span></div>';
    html += '<div class="stat"><b>' + s.likeRate.toFixed(1) + '%</b><span>좋아요율</span></div>';
    html += '<div class="stat"><b>' + s.shortsCount + ' / ' + s.longCount + '</b><span>쇼츠 / 롱폼</span></div>';
    html += '<div class="stat"><b>' + (s.latestDays === null ? '-' : s.latestDays + '일 전') + '</b><span>최근 업로드</span></div>';
    html += '</div></div>';

    // 업로드 요일
    html += '<div class="card"><h3 class="card-title">업로드 요일 분포 (최근 ' + s.sampled + '편)</h3>';
    html += '<div class="bars">' + barList(result.distributions.dow) + '</div>';
    html += '<p class="muted tiny" style="margin-top:8px">요일별 평균 조회수 기준 최고: <b style="color:#ffd400">' + CAS.esc(s.bestDow || '-') + '</b> (평균 ' + CAS.num(s.bestDowAvg) + '회)</p></div>';

    // 시간대
    var slots = [];
    for (var i = 0; i < 8; i++) {
      var c3 = 0, v3 = 0;
      result.distributions.hour.slice(i * 3, i * 3 + 3).forEach(function (h) { c3 += h.count; v3 += h.views; });
      slots.push({ label: (i * 3 < 10 ? '0' : '') + (i * 3) + '~' + ((i * 3 + 3) < 10 ? '0' : '') + (i * 3 + 3), count: c3, views: v3 });
    }
    html += '<div class="card"><h3 class="card-title">업로드 시간대 (KST)</h3>';
    html += '<div class="bars">' + barList(slots) + '</div>';
    html += '<p class="muted tiny" style="margin-top:8px">평균 조회수가 가장 높은 구간: <b style="color:#ffd400">' + CAS.esc(s.bestSlot || '-') + '</b></p></div>';

    // 영상 표
    html += '<div class="card"><h3 class="card-title">최근 영상 성과</h3><div class="table-wrap"><table>';
    html += '<thead><tr><th>영상</th><th>형식</th><th>길이</th><th>조회수</th><th>좋아요</th><th>업로드</th></tr></thead><tbody>';
    result.rows.slice(0, 15).forEach(function (r) {
      var day = new Date(new Date(r.publishedAt).getTime() + 9 * 3600 * 1000);
      var ds = (day.getUTCMonth() + 1) + '/' + day.getUTCDate() + ' ' + ['일', '월', '화', '수', '목', '금', '토'][day.getUTCDay()] + ' ' + (day.getUTCHours() < 10 ? '0' : '') + day.getUTCHours() + '시';
      html += '<tr><td class="ttl"><a href="https://www.youtube.com/watch?v=' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener">' + CAS.esc(r.title) + '</a></td>';
      html += '<td>' + (r.isShort ? '쇼츠' : '롱폼') + '</td>';
      html += '<td class="num">' + CAS.youtube.durationLabel(r.duration) + '</td>';
      html += '<td class="num">' + CAS.num(r.views) + '</td>';
      html += '<td class="num">' + CAS.num(r.likes) + '</td>';
      html += '<td class="num">' + ds + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    // AI 리포트 자리
    html += '<div class="card"><div class="block-head"><h3 class="card-title">AI 분석 리포트</h3>' +
      '<button class="btn tiny ghost" id="btnAiReport" type="button">AI 리포트 생성</button></div>' +
      '<div id="aiReportBox"><p class="muted tiny">후킹 전략 · 제목 패턴 · 벤치마킹 포인트를 정리해 드립니다. 키가 없으면 프롬프트를 복사해 ChatGPT·Claude에 붙여 쓰세요.</p></div></div>';

    host.innerHTML = html;
    host.classList.remove('hidden');

    var btn = document.getElementById('btnAiReport');
    if (btn) btn.addEventListener('click', function () { report(result); });
    CAS.bindCopy(host);
  }

  function promptFor(result) {
    var c = result.channel, s = result.summary;
    var lines = result.rows.slice(0, 12).map(function (r) {
      return '- ' + r.title + ' | ' + (r.isShort ? '쇼츠' : '롱폼') + ' | ' + Math.round(r.duration) + '초 | 조회 ' + r.views + ' | 좋아요 ' + r.likes;
    }).join('\n');
    return [
      '아래는 유튜브 채널 "' + c.title + '"의 최근 성과다. 데이터를 읽고 다음을 한국어로 정리해 줘.',
      '',
      '[채널] 구독자 ' + c.subscribers + ' / 총 조회 ' + c.totalViews + ' / 영상 ' + c.videoCount + '편',
      '[최근 표본] ' + s.sampled + '편, 평균 ' + s.avgViews + '회, 중앙값 ' + s.medianViews + '회, 좋아요율 ' + s.likeRate.toFixed(1) + '%',
      '[쇼츠] ' + s.shortsCount + '편 평균 ' + s.shortsAvg + '회 / [롱폼] ' + s.longCount + '편 평균 ' + s.longAvg + '회',
      '[최고 요일] ' + (s.bestDow || '-') + ' (평균 ' + s.bestDowAvg + '회) / [최고 시간대] ' + (s.bestSlot || '-'),
      '',
      '[최근 영상]',
      lines,
      '',
      '요청:',
      '1) 잘 된 영상의 공통 후킹 구조를 3가지로 뽑고, 실제 문장 예시를 들어 설명',
      '2) 제목 패턴을 분석해 지금 채널에 없는 유형 3개 제안',
      '3) 벤치마킹 포인트(썸네일·길이·업로드 리듬)와 근거',
      '4) 다음 3편의 구체적 기획안(주제·한 줄 후킹·예상 반응)',
      'JSON이 아니라 사람이 바로 읽는 한국어 소제목과 짧은 문단으로 정리해. 표·목록은 써도 되지만 코드블록이나 JSON은 쓰지 마.',
      '숫자는 위 데이터에 있는 것만 쓰고, 추측은 "추정"이라고 표시해.'
    ].join('\n');
  }

  function report(result) {
    var box = document.getElementById('aiReportBox');
    var btn = document.getElementById('btnAiReport');
    if (!box) return;
    var prompt = promptFor(result);
    if (!CAS.gemini.ready()) {
      box.innerHTML = '<div class="tiny muted" style="margin-bottom:8px">Gemini 키가 없어 프롬프트를 준비했습니다. 복사해서 ChatGPT·Claude·Gemini 웹에 붙여 넣으면 같은 결과를 받을 수 있어요.</div>' + CAS.block('분석 프롬프트', prompt);
      CAS.bindCopy(box);
      CAS.toast('프롬프트 준비 완료');
      return;
    }
    CAS.setStatus(box, 'Gemini가 분석 중…', 'busy');
    if (btn) CAS.busy(btn, true);
    CAS.gemini.text(prompt, { temperature: 0.6, maxTokens: 3000 })
      .then(function (text) {
        box.innerHTML = '<div class="report">' + CAS.md(text) + '</div>' + CAS.block('다시 쓰기용 프롬프트', prompt);
        CAS.bindCopy(box);
      })
      .catch(function (e) {
        box.innerHTML = '<div class="tiny" style="color:#ff6b6b;margin-bottom:8px">' + CAS.esc(CAS.errText(e)) + '</div>' + CAS.block('분석 프롬프트(직접 붙여넣기)', prompt);
        CAS.bindCopy(box);
      })
      .then(function () { if (btn) CAS.busy(btn, false); });
  }

  /* ---------- 이벤트 ---------- */
  CAS.analyzer = {
    init: function () {
      var input = document.getElementById('anaInput');
      var btn = document.getElementById('btnAnalyze');
      var demoBtn = document.getElementById('btnAnalyzeDemo');
      var status = document.getElementById('anaStatus');

      if (btn) btn.addEventListener('click', function () {
        var v = (input.value || '').trim();
        if (!v) { CAS.setStatus(status, '채널 주소나 영상 URL을 입력하세요.', 'err'); input.focus(); return; }
        if (!CAS.hasYt()) {
          CAS.setStatus(status, 'YouTube 키가 없어 샘플 데이터로 보여줍니다. 설정 탭에서 키를 넣으면 실제 채널을 분석합니다.', '');
          render(demoData());
          return;
        }
        CAS.setStatus(status, 'YouTube Data API로 불러오는 중…', 'busy');
        CAS.busy(btn, true);
        CAS.youtube.load(v, { limit: 50 })
          .then(function (result) {
            CAS.setStatus(status, '완료 — 최근 ' + result.summary.sampled + '편을 분석했습니다.', 'ok');
            render(result);
            window.__lastAnalysis = result;
            document.getElementById('anaResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
          })
          .catch(function (e) {
            var extra = '';
            if (e.reason === 'quotaExceeded') extra = ' — 오늘 무료 할당량(10,000유닛)을 다 썼습니다. 내일 다시 시도하세요.';
            if (e.reason === 'keyInvalid' || e.status === 400) extra = ' — 키를 확인하세요(설정 탭).';
            if (e.reason === 'ipRefererBlocked') extra = ' — 키의 HTTP 리퍼러 제한에 이 사이트 주소를 추가하세요.';
            CAS.setStatus(status, '분석 실패: ' + (e.message || e) + extra, 'err');
          })
          .then(function () { CAS.busy(btn, false); });
      });

      if (input) input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); btn && btn.click(); }
      });

      if (demoBtn) demoBtn.addEventListener('click', function () {
        CAS.setStatus(status, '샘플 데이터로 화면을 채웠습니다.', '');
        render(demoData());
      });
    },
    demo: demoData
  };
})();
