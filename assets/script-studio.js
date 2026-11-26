/* 탭 2 — AI 기획·대본 스튜디오 */
(function () {
  'use strict';
  var CAS = window.CAS;

  var state = { format: 'both', data: null, topic: '', refMeta: null };

  function schemaHint() {
    return [
      '{',
      '  "titles": ["제목 5개"],',
      '  "thumbnailText": ["썸네일 문구 3개(각 12자 이내)"],',
      '  "hooks": ["첫 3초 후킹 문장 2개"],',
      '  "shorts": { "totalSeconds": 40, "segments": [ { "start": 0, "end": 3, "line": "내레이션", "broll": "화면 지시", "caption": "화면 자막" } ] },',
      '  "longform": { "totalSeconds": 180, "sections": [ { "start": 0, "end": 12, "line": "내레이션", "broll": "화면 지시", "caption": "섹션 제목" } ] },',
      '  "citations": ["근거 — 논문·공식 자료·매장 정보 등. 없으면 빈 배열"],',
      '  "hashtags": ["#태그"],',
      '  "factcheck": ["확인이 필요한 부분"]',
      '}'
    ].join('\n');
  }

  function buildPrompt() {
    var topic = state.topic;
    var p = CAS.preset();
    var f = p.formats || {};
    var ss = f.shorts || 40;
    var lm = Math.round((f.longform || 180) / 60);
    var parts = [];
    parts.push('주제: ' + topic);
    parts.push('채널 프리셋: ' + p.label);
    if (state.format === 'both') parts.push('포맷: ' + ss + '초 쇼츠 1편 + ' + lm + '분 롱폼 1편을 모두 만든다.');
    if (state.format === 'shorts') parts.push('포맷: ' + ss + '초 쇼츠만 만든다. (longform은 빈 배열)');
    if (state.format === 'longform') parts.push('포맷: ' + lm + '분 롱폼만 만든다. (shorts는 빈 배열)');
    if (state.refMeta) {
      parts.push('\n[레퍼런스] ' + (state.refMeta.title || '') + '\n' + String(state.refMeta.text || '').slice(0, 3000));
      parts.push('레퍼런스의 전개 순서와 후킹 방식만 참고하고 문장은 그대로 쓰지 않는다.');
    }
    parts.push('\n요구사항:');
    parts.push('- 초 단위 타임라인으로 끊는다. 쇼츠는 3~5초 단위 8~12개 구간, 롱폼은 12~20초 단위 10~14개 구간.');
    parts.push('- 각 구간의 broll에는 실제로 찍을 수 있는 화면을 구체적으로 적는다(프리셋의 화면 규칙을 따른다). 반짝이는 3D CG는 쓰지 않는다.');
    parts.push('- line은 실제로 읽을 수 있는 구어체 한국어. 한 구간 1~2문장.');
    parts.push('- 수치·가게 정보는 확인된 것만 쓰고, 확실하지 않으면 factcheck에 적는다.');
    parts.push('- titles는 클릭을 부르되 낚시하지 않는다. 숫자나 대비를 활용한다.');
    return parts.join('\n');
  }

  /* ---------- 렌더 ---------- */
  function segsText(segs, rangeLabel) {
    return segs.map(function (s, i) {
      return '[' + CAS.time(s.start) + '~' + CAS.time(s.end) + '] ' + (s.line || '') +
        (s.broll ? '\n    ▸ 화면: ' + s.broll : '') +
        (s.caption ? '\n    ▸ 자막: ' + s.caption : '');
    }).join('\n');
  }

  function fullScriptText(d) {
    var out = [];
    out.push('■ 제목안');
    (d.titles || []).forEach(function (t, i) { out.push((i + 1) + '. ' + t); });
    out.push('');
    out.push('■ 썸네일 문구: ' + (d.thumbnailText || []).join(' / '));
    out.push('■ 후킹: ' + (d.hooks || []).join(' / '));
    if (d.shorts && d.shorts.segments && d.shorts.segments.length) {
      out.push('');
      out.push('■ 쇼츠 ' + (d.shorts.totalSeconds || 40) + '초 대본');
      out.push(segsText(d.shorts.segments));
    }
    if (d.longform && d.longform.sections && d.longform.sections.length) {
      out.push('');
      out.push('■ 롱폼 ' + Math.round((d.longform.totalSeconds || 180) / 60) + '분 대본');
      out.push(segsText(d.longform.sections));
    }
    if (d.citations && d.citations.length) {
      out.push('');
      out.push('■ 근거');
      d.citations.forEach(function (c) { out.push('- ' + c); });
    }
    if (d.hashtags && d.hashtags.length) {
      out.push('');
      out.push(d.hashtags.join(' '));
    }
    if (d.factcheck && d.factcheck.length) {
      out.push('');
      out.push('■ 확인 필요');
      d.factcheck.forEach(function (c) { out.push('- ' + c); });
    }
    return out.join('\n');
  }

  function toSrt(segs) {
    return segs.map(function (s, i) {
      return (i + 1) + '\n' + CAS.srtTime(s.start) + ' --> ' + CAS.srtTime(s.end) + '\n' + (s.line || '') + '\n';
    }).join('\n');
  }

  function render(d, meta) {
    var host = document.getElementById('scResult');
    if (!host) return;
    state.data = d;
    var html = '';

    if (meta && meta.demo) {
      html += '<div class="card"><div class="tiny muted">⚠ ' + CAS.esc(meta.note || '샘플 결과입니다.') + '</div></div>';
    }

    // 제목
    html += '<div class="card"><h3 class="card-title">제목 5안</h3><div class="cut-list">';
    (d.titles || []).forEach(function (t, i) {
      html += '<div class="cut-item"><span>' + (i + 1) + '. ' + CAS.esc(t) + '</span>' +
        '<button class="btn tiny ghost" type="button" data-copy-title="' + i + '">복사</button></div>';
    });
    html += '</div>';
    html += CAS.block('썸네일 문구', (d.thumbnailText || []).join('\n'));
    if (d.hooks && d.hooks.length) html += CAS.block('첫 3초 후킹', d.hooks.join('\n'));
    html += '</div>';

    // 쇼츠
    if (d.shorts && d.shorts.segments && d.shorts.segments.length) {
      html += '<div class="card"><div class="block-head"><h3 class="card-title">쇼츠 ' + (d.shorts.totalSeconds || 40) + '초</h3>' +
        '<button class="btn tiny ghost" data-copy="shortsTxt" type="button">복사</button></div>';
      html += '<div id="shortsTxt" style="display:none"></div>';
      html += d.shorts.segments.map(function (s) {
        return '<div class="script-line"><div class="script-time">' + CAS.time(s.start) + '~' + CAS.time(s.end) + '</div>' +
          '<div><div class="script-text">' + CAS.esc(s.line) + '</div>' +
          (s.caption ? '<div class="script-broll">자막 · ' + CAS.esc(s.caption) + '</div>' : '') +
          (s.broll ? '<div class="script-broll">화면 · ' + CAS.esc(s.broll) + '</div>' : '') +
          '</div></div>';
      }).join('');
      html += '<div class="row"><button class="btn ghost" type="button" data-srt="shorts">쇼츠 SRT</button>' +
        '<button class="btn ghost" type="button" data-txt="shorts">쇼츠 TXT</button></div></div>';
    }

    // 롱폼
    if (d.longform && d.longform.sections && d.longform.sections.length) {
      html += '<div class="card"><div class="block-head"><h3 class="card-title">롱폼 ' + Math.round((d.longform.totalSeconds || 180) / 60) + '분</h3>' +
        '<button class="btn tiny ghost" type="button" data-copy="longTxt">복사</button></div>';
      html += '<div id="longTxt" style="display:none"></div>';
      html += d.longform.sections.map(function (s) {
        return '<div class="script-line"><div class="script-time">' + CAS.time(s.start) + '~' + CAS.time(s.end) + '</div>' +
          '<div><div class="script-text">' + CAS.esc(s.line) + '</div>' +
          (s.caption ? '<div class="script-broll">구간 · ' + CAS.esc(s.caption) + '</div>' : '') +
          (s.broll ? '<div class="script-broll">화면 · ' + CAS.esc(s.broll) + '</div>' : '') +
          '</div></div>';
      }).join('');
      html += '<div class="row"><button class="btn ghost" type="button" data-srt="longform">롱폼 SRT</button>' +
        '<button class="btn ghost" type="button" data-txt="longform">롱폼 TXT</button></div></div>';
    }

    // 근거·확인
    if ((d.citations && d.citations.length) || (d.factcheck && d.factcheck.length)) {
      html += '<div class="card"><h3 class="card-title">근거 · 확인 필요</h3>';
      if (d.citations && d.citations.length) {
        html += '<div class="report"><h4>근거</h4><ul>' + d.citations.map(function (c) { return '<li>' + CAS.esc(c) + '</li>'; }).join('') + '</ul></div>';
      }
      if (d.factcheck && d.factcheck.length) {
        html += '<div class="report"><h4>확인 필요</h4><ul>' + d.factcheck.map(function (c) { return '<li>' + CAS.esc(c) + '</li>'; }).join('') + '</ul></div>';
      }
      html += '</div>';
    }

    html += '<div class="card"><div class="row" style="margin-top:0">' +
      '<button class="btn primary" id="btnCopyAll" type="button">전체 대본 복사</button>' +
      '<button class="btn ghost" id="btnDlSrt" type="button">SRT 저장</button>' +
      '<button class="btn ghost" id="btnDlTxt" type="button">TXT 저장</button>' +
      '<button class="btn ghost" id="btnSendThumb" type="button">썸네일 만들기 →</button>' +
      '</div></div>';

    host.innerHTML = html;
    host.classList.remove('hidden');
    CAS.bindCopy(host);

    // 숨김 텍스트 채우기
    var st = document.getElementById('shortsTxt'); if (st) st.textContent = segsText((d.shorts || {}).segments || []);
    var lt = document.getElementById('longTxt'); if (lt) lt.textContent = segsText((d.longform || {}).sections || []);
    (function () {
      var st2 = document.getElementById('shortsTxt'); if (st2) CAS._blocks.shortsTxt = st2.textContent;
      var lt2 = document.getElementById('longTxt'); if (lt2) CAS._blocks.longTxt = lt2.textContent;
    })();

    host.querySelectorAll('[data-copy-title]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-copy-title'));
        CAS.copy((d.titles || [])[i] || '', '제목');
      });
    });
    host.querySelectorAll('[data-srt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var which = b.getAttribute('data-srt');
        var segs = which === 'shorts' ? ((d.shorts || {}).segments || []) : ((d.longform || {}).sections || []);
        CAS.download(safeName(state.topic) + '-' + which + '.srt', toSrt(segs), 'text/plain;charset=utf-8');
        CAS.toast('SRT 저장');
      });
    });
    host.querySelectorAll('[data-txt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var which = b.getAttribute('data-txt');
        var segs = which === 'shorts' ? ((d.shorts || {}).segments || []) : ((d.longform || {}).sections || []);
        CAS.download(safeName(state.topic) + '-' + which + '.txt', segsText(segs), 'text/plain;charset=utf-8');
        CAS.toast('TXT 저장');
      });
    });
    var all = document.getElementById('btnCopyAll');
    if (all) all.addEventListener('click', function () { CAS.copy(fullScriptText(d), '전체 대본'); });
    var dlSrt = document.getElementById('btnDlSrt');
    if (dlSrt) dlSrt.addEventListener('click', function () {
      var segs = ((d.shorts || {}).segments || []).concat(((d.longform || {}).sections || []).map(function (s) {
        return { start: (d.shorts && d.shorts.totalSeconds || 0) + s.start, end: (d.shorts && d.shorts.totalSeconds || 0) + s.end, line: s.line };
      }));
      CAS.download(safeName(state.topic) + '.srt', toSrt(segs), 'text/plain;charset=utf-8');
      CAS.toast('SRT 저장');
    });
    var dlTxt = document.getElementById('btnDlTxt');
    if (dlTxt) dlTxt.addEventListener('click', function () {
      CAS.download(safeName(state.topic) + '.txt', fullScriptText(d), 'text/plain;charset=utf-8');
      CAS.toast('TXT 저장');
    });
    var toThumb = document.getElementById('btnSendThumb');
    if (toThumb) toThumb.addEventListener('click', function () {
      var th = document.getElementById('thTopic');
      if (th) th.value = (d.titles && d.titles[0]) || state.topic;
      var ct = document.getElementById('cardTitle');
      if (ct) ct.value = ((d.thumbnailText && d.thumbnailText[0]) || state.topic || '').replace(/\s+/g, '\n');
      CAS.go('thumb');
      if (CAS.thumbnail && CAS.thumbnail.redraw) CAS.thumbnail.redraw();
    });
  }

  function safeName(s) {
    return String(s || 'script').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'script';
  }

  /* ---------- 샘플 대본 ---------- */
  function demo(topic) {
    var key = CAS.getSetting('preset');
    if (key === 'jipgo') return demoJipgo(topic);
    if (key === 'cat4') return demoCat(topic);
    return demoHealth(topic);
  }

  function demoHealth(topic) {
    topic = topic || '운동 후 찬물 목욕이 근성장을 방해한다?';
    return {
      titles: [
        topic,
        '찬물 목욕, 근육 키우려면 절대 하지 마세요',
        '운동 후 샤워 하나로 근성장이 30% 깎입니다',
        '선수들이 찬물에 들어가는 진짜 이유',
        '찬물 목욕 8편 메타분석 — 결론이 뒤집혔습니다'
      ],
      thumbnailText: ['근성장 -30%', '찬물 목욕의 진실', '운동 후 금지 행동'],
      hooks: [
        '운동 끝나고 찬물로 샤워하셨다면, 방금 근성장의 3분의 1을 버리셨을지도 모릅니다.',
        '찬물 목욕이 회복에 좋다는 말, 절반만 맞습니다.'
      ],
      shorts: {
        totalSeconds: 40,
        segments: [
          { start: 0, end: 4, line: '운동 후 찬물 샤워, 회복에 좋다고들 하죠. 그런데 근성장에는 반대일 수 있습니다.', broll: '욕실 샤워 장면, 물방울 슬로모션', caption: '찬물 샤워 = 회복?' },
          { start: 4, end: 9, line: '2024년 유럽스포츠과학저널에 실린 8편 메타분석입니다.', broll: '논문 첫 페이지 → Forest plot 도표 인포그래픽', caption: 'Piñero 2024 · EJSS' },
          { start: 9, end: 15, line: '근비대 효과는 운동만 했을 때 0.36, 찬물을 같이 하면 0.14로 떨어졌습니다.', broll: '막대 2개 비교 인포그래픽(0.36 vs 0.14)', caption: '0.36 → 0.14' },
          { start: 15, end: 21, line: '찬물이 근육의 염증 반응을 눌러서, 성장 신호까지 같이 줄여버리는 겁니다.', broll: '근섬유 단면 도식 + 억제 화살표', caption: '성장 신호 차단' },
          { start: 21, end: 27, line: '물론 통증 완화나 경기 사이 회복에는 여전히 도움이 됩니다.', broll: '아이싱 배스 장면(실사)', caption: '통증·경기 회복엔 유효' },
          { start: 27, end: 33, line: '정리하면, 근육을 키우는 시기라면 운동 직후 찬물은 피하세요.', broll: '체크리스트 카드', caption: '벌크업 시즌엔 미루기' },
          { start: 33, end: 40, line: '저장해 두고 오늘 샤워부터 바꿔 보세요. 다음 편은 단백질 30g 상식입니다.', broll: '구독 버튼 애니메이션(정적 카드)', caption: '저장 · 구독' }
        ]
      },
      longform: {
        totalSeconds: 180,
        sections: [
          { start: 0, end: 14, line: '찬물 목욕은 회복의 상징처럼 쓰입니다. 그런데 근성장 관점에서는 이야기가 달라집니다.', broll: '인트로 타이틀 + 아이싱 배스 B롤', caption: '인트로' },
          { start: 14, end: 38, line: '먼저 이 메타분석이 무엇을 봤는지 정리합니다. 저항운동 후 냉수 침수 유무를 비교한 8편, 참가자 수와 프로토콜은 이렇습니다.', broll: '연구 설계 표(Table 1 재현 인포그래픽)', caption: '연구 설계' },
          { start: 38, end: 66, line: '결과는 두 갈래였습니다. 근비대는 줄고, 통증·피로 지표는 좋아졌습니다. 효과 크기 숫자를 그대로 보여드리겠습니다.', broll: 'Forest plot + 확률 게이지', caption: '결과' },
          { start: 66, end: 96, line: '왜 이런 일이 생길까요. 냉수가 국소 염증과 mTOR 신호를 함께 누르기 때문이라는 기전 연구들이 있습니다.', broll: '기전 도식: 냉수 → 혈류 감소 → 염증 억제 → 합성 신호 감소', caption: '기전' },
          { start: 96, end: 126, line: '그럼 언제 써야 할까요. 경기 사이 회복, 부상 직후 통증 관리, 체중 감량 목적의 열 발산에는 여전히 유효합니다.', broll: '상황별 카드 3장', caption: '쓸 때와 피할 때' },
          { start: 126, end: 156, line: '실전 적용입니다. 근성장 블록에서는 운동 후 6시간 정도는 미지근한 물로, 찬물은 다음 날 회복용으로 미루세요.', broll: '타임라인 카드(운동 → 6시간 → 다음날)', caption: '실전 적용' },
          { start: 156, end: 180, line: '정리합니다. 찬물은 만능이 아니고, 목적에 따라 켜고 끄는 도구입니다. 다음 편에서 단백질 30g 상식을 깨봅니다.', broll: '요약 3줄 + 다음 편 예고 카드', caption: '정리' }
        ]
      },
      citations: [
        'Piñero et al. 2024, European Journal of Sports Science (DOI 10.1002/ejsc.12074) — 냉수 침수가 근비대를 둔화(SMD 0.36 → 0.14)',
        'Roberts et al. 2015, J Physiol — 냉수 적용 후 단백질 합성 신호 감소 기전'
      ],
      hashtags: ['#근성장', '#찬물목욕', '#운동회복', '#헬스랩1분', '#논문으로보는운동'],
      factcheck: ['메타분석 참가자 수와 세부 프로토콜은 원문 Table 1에서 재확인 필요', '두 번째 기전 인용은 예시이므로 실제 인용 전 원문 확인']
    };
  }

  /* 집 go 샘플 — 가게 이름·가격·영업시간은 만들지 않고 "확인" 자리로 둔다 */
  function demoJipgo(topic) {
    topic = topic || '퇴근 후 동네 노포 한잔';
    return {
      titles: [
        topic,
        '2차 없이 1차에서 끝내는 날',
        '퇴근길에 발길이 멈춘 간판 하나',
        '20년째 같은 자리에서 직접 굽는 사장님',
        '안주 두 개면 충분한 이유'
      ],
      thumbnailText: ['오늘은 1차만', '여기서 끝', '퇴근 후 한잔'],
      hooks: [
        '오늘은 2차 없이 1차에서 끝내는 날입니다. 그래서 고른 곳이 여기입니다.',
        '퇴근하고 걷다가 불 켜진 간판 하나에 끌려 들어왔습니다.'
      ],
      shorts: {
        totalSeconds: 40,
        segments: [
          { start: 0, end: 4, line: '퇴근하고 걷다가 불 켜진 간판 하나에 끌려 들어왔습니다.', broll: '밤 골목길 1인칭 보행, 간판 클로즈업(실사)', caption: '퇴근길 골목' },
          { start: 4, end: 10, line: '문 열자마자 나는 냄새. 오늘은 여기서 끝내기로 했습니다.', broll: '문 열고 들어가는 시점, 매장 안쪽과 테이블', caption: '1차 확정' },
          { start: 10, end: 16, line: '안주는 두 개만 시켰습니다. 계란말이, 그리고 오늘 들어온 생선구이.', broll: '주문 장면, 테이블 위 음식 클로즈업', caption: '안주 두 개' },
          { start: 16, end: 22, line: '계란말이는 겉은 노릇하고 속은 아직 촉촉합니다. 이 조합에 한잔이면 충분합니다.', broll: '젓가락으로 자르는 클로즈업, 김 올라오는 장면', caption: '겉은 노릇, 속은 촉촉' },
          { start: 22, end: 28, line: '사장님은 오래 같은 자리에서 직접 굽습니다. 값도 크게 안 올리셨더군요.', broll: '주방에서 굽는 사장님 손, 메뉴판 클로즈업', caption: '같은 자리, 같은 손' },
          { start: 28, end: 35, line: '2차 생각이 안 나는 건 아니지만, 집에 가서 한잔 더 하면 되니까요.', broll: '빈 접시와 잔, 창밖 골목', caption: '2차는 집에서' },
          { start: 35, end: 40, line: '돌고 돌아 결국 가는 곳은, 2차도 3차도 아닌 내 집입니다. 오늘도 잘 먹고, 집 go!', broll: '가게 문 닫고 나오는 뒷모습, 집 앞 골목', caption: '집 go' }
        ]
      },
      longform: {
        totalSeconds: 180,
        sections: [
          { start: 0, end: 16, line: '퇴근 후 한잔은 대개 2차로 흘러갑니다. 오늘은 그 흐름을 한 번 끊어보려고 이 집을 골랐습니다.', broll: '골목 입구 → 간판 → 문 여는 장면', caption: '인트로' },
          { start: 16, end: 52, line: '이 집은 오래 같은 자리에 있었습니다. 테이블은 몇 개 안 되고, 주방은 사장님 혼자입니다.', broll: '외관·간판·테이블 배치·주방 실사', caption: '가게 소개' },
          { start: 52, end: 88, line: '주문은 두 가지로 줄였습니다. 안주를 늘리면 맛이 기억에 안 남더군요.', broll: '주문, 서빙, 잔 따르는 장면', caption: '주문' },
          { start: 88, end: 124, line: '계란말이는 겉이 노릇하고 속은 촉촉합니다. 생선구이는 간이 세지 않아서 술이 천천히 들어갑니다.', broll: '음식 클로즈업, 젓가락질, 김 오르는 장면', caption: '맛' },
          { start: 124, end: 156, line: '가격과 영업시간은 매장에서 확인한 값만 적습니다. 이 대본에서는 확인 자리로 비워 둡니다.', broll: '메뉴판과 영업시간 안내판 클로즈업', caption: '가격·영업시간 확인 후' },
          { start: 156, end: 180, line: '돌고 돌아 결국 가는 곳은, 2차도 3차도 아닌 내 집입니다. 오늘도 잘 먹고, 집 go!', broll: '가게 앞에서 집 쪽으로 걷는 골목', caption: '집 go' }
        ]
      },
      citations: [],
      hashtags: CAS.preset().tags || [],
      factcheck: ['가게 이름·위치·가격·영업시간은 방문 확인 후 채우기', '사장님 인터뷰 문장은 실제 발언으로 교체']
    };
  }

  /* 고양이 샘플 — 무거운 단어 없이 가벼운 일상만 */
  function demoCat(topic) {
    topic = topic || '새벽 4시 츄르 소동';
    return {
      titles: [
        topic,
        '새벽 4시, 넷째가 먼저 일어났습니다',
        '츄르 봉지 소리에 네 마리가 다 왔습니다',
        '다묘집사가 새벽에 하는 일',
        '우리 집 고양이는 순서가 정해져 있습니다'
      ],
      thumbnailText: ['새벽 4시', '넷 다 모였다', '순서는 정해져 있음'],
      hooks: [
        '새벽 4시에 작은 발소리 하나로 시작됩니다. 그다음은 늘 정해져 있습니다.',
        '츄르 봉지 뜯는 소리만 나도 네 마리가 같은 방향을 봅니다.'
      ],
      shorts: {
        totalSeconds: 40,
        segments: [
          { start: 0, end: 4, line: '새벽 4시. 넷째가 제 배 위에서 먼저 일어납니다.', broll: '어두운 침실, 이불 위를 걷는 고양이(실사)', caption: '새벽 4시' },
          { start: 4, end: 9, line: '그 소리에 둘째가 깨고, 첫째는 이미 문 앞에 앉아 있습니다.', broll: '문 앞에 앉은 고양이, 복도 불빛', caption: '이미 문 앞' },
          { start: 9, end: 15, line: '츄르 봉지 뜯는 소리, 이건 숨길 수가 없습니다.', broll: '서랍에서 츄르 꺼내는 손, 봉지 클로즈업', caption: '이건 못 숨김' },
          { start: 15, end: 21, line: '셋째는 안 왔습니다. 부르면 올 때도 있고, 아닐 때도 있습니다.', broll: '빈 방 문가, 다른 방에서 자는 고양이', caption: '셋째는 안 옴' },
          { start: 21, end: 27, line: '먹는 순서는 늘 같습니다. 첫째, 둘째, 넷째, 그러고 나서 셋째.', broll: '나란히 먹는 네 마리 클로즈업', caption: '순서는 정해져 있음' },
          { start: 27, end: 34, line: '다 먹고 나면 아무 일 없었다는 얼굴로 흩어집니다.', broll: '각자 자리로 흩어지는 모습', caption: '끝' },
          { start: 34, end: 40, line: '이 40초를 위해 집사는 새벽에 일어납니다.', broll: '다시 이불 속으로 들어가는 고양이', caption: '집사의 하루' }
        ]
      },
      longform: {
        totalSeconds: 180,
        sections: [
          { start: 0, end: 14, line: '네 마리와 사는 집의 새벽은 조용하지 않습니다. 오늘 새벽도 츄르 하나로 시작됐습니다.', broll: '어두운 집 안, 창밖 새벽빛', caption: '인트로' },
          { start: 14, end: 52, line: '먼저 네 마리 소개입니다. 첫째는 조용하고, 둘째는 제일 먼저 달려오고, 셋째는 자기 페이스, 넷째는 새벽 담당입니다.', broll: '네 마리 각자 클로즈업, 이름 자막', caption: '네 마리 소개' },
          { start: 52, end: 90, line: '새벽 츄르는 원래 넷째 간식이었는데, 어느 순간 다 같이 먹는 시간이 됐습니다.', broll: '츄르 꺼내는 손, 몰려드는 장면', caption: '새벽 츄르' },
          { start: 90, end: 128, line: '먹는 순서와 자리는 그들끼리 정해져 있습니다. 사람이 바꾸려 해도 잘 안 바뀝니다.', broll: '밥자리 배치, 순서대로 먹는 모습', caption: '순서와 자리' },
          { start: 128, end: 160, line: '다묘집사 팁 하나. 물그릇은 방마다, 화장실은 마리 수보다 하나 더 두면 새벽 소동이 줄어듭니다.', broll: '방마다 놓인 물그릇과 화장실', caption: '다묘집사 팁' },
          { start: 160, end: 180, line: '오늘도 츄르 하나로 시작해서, 츄르 하나로 끝난 새벽이었습니다.', broll: '다시 잠든 네 마리, 이불 위', caption: '마무리' }
        ]
      },
      citations: [],
      hashtags: CAS.preset().tags || [],
      factcheck: ['고양이 이름·성격·순서는 실제 관찰대로 채우기', '츄르·간식 양은 수의사 권장량 확인 후 표기']
    };
  }

  /* ---------- 이벤트 ---------- */
  CAS.scriptStudio = {
    init: function () {
      var topicEl = document.getElementById('scTopic');
      var refEl = document.getElementById('scRef');
      var status = document.getElementById('scStatus');
      var btn = document.getElementById('btnGenerate');
      var demoBtn = document.getElementById('btnGenerateDemo');
      var fmtWrap = document.getElementById('scFormat');

      if (fmtWrap) fmtWrap.addEventListener('click', function (e) {
        var b = e.target.closest('.chip');
        if (!b) return;
        fmtWrap.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
        b.classList.add('active');
        state.format = b.getAttribute('data-format');
      });

      function collectRef() {
        var raw = (refEl.value || '').trim();
        state.refMeta = null;
        if (!raw) return Promise.resolve();
        var looksUrl = /^https?:\/\//i.test(raw);
        if (looksUrl && CAS.hasYt() && /youtu/.test(raw)) {
          return CAS.youtube.load(raw, { limit: 1 }).then(function (r) {
            var focus = r.focus || r.rows[0];
            if (focus) state.refMeta = { title: focus.title, text: '채널: ' + r.channel.title + ' / 영상: ' + focus.title + ' / 길이 ' + Math.round(focus.duration) + '초 / 조회 ' + focus.views };
            else state.refMeta = { title: r.channel.title, text: r.channel.description };
          }).catch(function () { state.refMeta = { title: 'URL', text: raw }; });
        }
        state.refMeta = { title: looksUrl ? 'URL' : '붙여넣은 대본', text: raw };
        return Promise.resolve();
      }

      function run() {
        state.topic = (topicEl.value || '').trim();
        if (!state.topic) { CAS.setStatus(status, '주제를 한 줄 적어 주세요.', 'err'); topicEl.focus(); return; }
        CAS.busy(btn, true);
        CAS.setStatus(status, '구성 중…', 'busy');
        collectRef().then(function () {
          if (!CAS.gemini.ready()) {
            var d = demo(state.topic);
            if (state.format === 'shorts') d.longform = { totalSeconds: 0, sections: [] };
            if (state.format === 'longform') d.shorts = { totalSeconds: 0, segments: [] };
            CAS.setStatus(status, 'Gemini 키가 없어 샘플 대본을 채웠습니다. 아래 프롬프트를 복사해 AI에 붙이면 이 주제로 실제 대본이 나옵니다.', '');
            var host = document.getElementById('scResult');
            render(d, { demo: true, note: '샘플 대본입니다(키 없음). 프롬프트를 복사해 Gemini·ChatGPT에 붙여 넣으면 주제에 맞는 대본을 받을 수 있습니다.' });
            var box = document.createElement('div');
            box.className = 'card';
            box.innerHTML = CAS.block('대본 생성 프롬프트', CAS.gemini.copyPrompt(buildPrompt(), schemaHint()));
            host.appendChild(box);
            CAS.bindCopy(host);
            return;
          }
          CAS.gemini.json(buildPrompt(), { schemaHint: schemaHint(), temperature: 0.85 })
            .then(function (d) {
              if (!d || !d.titles) throw new Error('응답 형식이 예상과 다릅니다.');
              if (state.format === 'shorts' && d.longform) d.longform.sections = [];
              if (state.format === 'longform' && d.shorts) d.shorts.segments = [];
              render(d, { demo: false });
              CAS.setStatus(status, '완료 — 제목 5안과 대본을 만들었습니다.', 'ok');
              document.getElementById('scResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
            })
            .catch(function (e) {
              CAS.setStatus(status, '생성 실패: ' + CAS.errText(e), 'err');
              var host = document.getElementById('scResult');
              host.innerHTML = '<div class="card">' + CAS.block('대본 생성 프롬프트(직접 붙여넣기)', CAS.gemini.copyPrompt(buildPrompt(), schemaHint())) + '</div>';
              host.classList.remove('hidden');
              CAS.bindCopy(host);
            });
        }).then(function () { CAS.busy(btn, false); });
      }

      if (btn) btn.addEventListener('click', run);
      if (demoBtn) demoBtn.addEventListener('click', function () {
        var pk = CAS.getSetting('preset');
        var dflt = pk === 'jipgo' ? '퇴근 후 동네 노포 한잔'
          : pk === 'cat4' ? '새벽 4시 츄르 소동'
          : '운동 후 찬물 목욕이 근성장을 방해한다?';
        state.topic = (topicEl.value || dflt).trim();
        render(demo(state.topic), { demo: true, note: '샘플 대본입니다.' });
        CAS.setStatus(status, '샘플 대본을 채웠습니다.', '');
      });
    },
    demo: demo
  };
})();
