/* core: 저장소 · 설정 · 탭 · 공용 유틸 */
(function () {
  'use strict';

  var NS = 'cas.'; // creator all-in-one studio

  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(NS + key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; }
      catch (e) { CAS.toast('저장 공간이 부족해 저장하지 못했어요'); return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(NS + key); } catch (e) {}
    }
  };

  var PRESETS = {
    healthlab: {
      label: '헬스랩 1분',
      summary: '논문 근거 · AI 티 최소화 · 35~40초 쇼츠 + 3분 롱폼',
      style: [
        '채널: 「헬스랩 1분」 — 운동·영양 논문을 1분 안에 정리하는 한국어 채널.',
        '톤: 차분한 남자 다큐 내레이션. 과장 없이 사실 위주, 시청자를 "여러분"으로 부른다.',
        '구조: 첫 3초에 통념을 뒤집는 질문 → 논문 수치 → 실전 적용 한 줄 → 저장/구독 유도.',
        '자막: 상단 2줄 빅 타이틀(흰색 + 노랑 #FFD400), 다크 X-ray/MRI 톤 이미지, 하단 자막은 안전구역(y 1209~1338, 우측 아이콘 열 x≥940 회피).',
        '근거: 모든 수치에 저자·연도·학술지(가능하면 DOI)를 붙이고, 동물실험이면 사람 연구와 구분해 표기한다.',
        'B-roll: 반짝이는 3D CG 대신 논문 도표·Forest plot·확률 게이지 같은 인포그래픽을 지시한다.'
      ].join('\n'),
      ban: ['무조건', '100%', '완치', '부작용 없음', '최고', '다이어트 보장', '기적', '특효'],
      formats: { shorts: 40, longform: 180 }
    },
    d2gym: {
      label: '디투짐 릴스',
      summary: '탕정 헬스장 홍보 · 금지어 자동 회피 · 지역 태그',
      style: [
        '채널: 충남 아산 탕정 「디투짐」(@d2gym_official) 인스타 릴스 / 네이버 블로그.',
        '톤: 사장님이 회원에게 직접 말하듯 친근하고 담백하게. 전문 용어는 한 번 풀어서 쓴다.',
        '소재: 운동역학·기능해부학 릴스를 기준으로, 매장 자랑보다 "왜 이 동작이 이렇게 되어야 하는지"를 먼저 보여준다.',
        '영업시간 표기는 항상 05:00 - 24:00. 매장은 아산 탕정(브라운스톤갤럭시 2층).',
        '지역 태그 후보: #탕정헬스장 #탕정PT #아산PT #아산헬스장 #탕정브라운스톤'
      ].join('\n'),
      ban: ['24시간', '연중무휴', '재활', '한강'],
      formats: { shorts: 30, longform: 90 }
    },
    jipgo: {
      label: '집 go',
      summary: '맛집·반주 1인칭 브이로그 · 담백한 톤 · 고정 엔딩 멘트',
      style: [
        '채널: 「집 go 오늘도 한잔하고 집으로」(@jipgo_official) — 동네 맛집과 반주를 기록하는 실사 브이로그/쇼츠.',
        '톤: 사장님이 폰 들고 직접 말하듯 1인칭 구어체. 퇴근 후 한잔의 대리만족을 과장 없이 담백하게, 사실대로 전한다.',
        '시선: 손님을 부르는 홍보가 아니라, 동네에서 오래 버틴 노포·자영업자 사장님을 응원하는 마음으로 쓴다. 가게의 가격·영업시간·위치는 확인된 것만 적고 모르면 "확인 필요"라고 쓴다.',
        '구성: 첫 3초에 "여기 왜 갔냐면" 한마디 → 주문 장면 → 안주 묘사(온도·식감 중심) → 값과 위치 정리 → 고정 엔딩 한 줄.',
        '화면: 실사만 지시한다. 매장 외관·간판·주문 장면·음식 클로즈업·사장님 손길 위주. 스톡 이미지나 반짝이는 3D CG는 쓰지 않는다.',
        '과음 미화 표현(원샷·폭음·필름 끊김·음주운전)은 쓰지 않는다. 술은 곁들이는 한잔으로 다루고, 물과 귀가 이야기를 함께 둔다.',
        '고정 엔딩: 쇼츠·롱폼 모두 마지막 줄을 "돌고 돌아 결국 가는 곳은, 2차도 3차도 아닌 내 집입니다. 오늘도 잘 먹고, 집 go!"로 끝맺는다.'
      ].join('\n'),
      signature: '돌고 돌아 결국 가는 곳은, 2차도 3차도 아닌 내 집입니다. 오늘도 잘 먹고, 집 go!',
      ban: ['무조건', '역대급', '100%', '인생맛집'],
      tags: ['#집go', '#오늘도한잔', '#퇴근후한잔', '#동네맛집', '#노포', '#자영업자응원'],
      formats: { shorts: 40, longform: 180 }
    },
    cat4: {
      label: '고양이를 독점하고 싶은 사람',
      summary: '4마리 다묘 집사 일상 쇼츠 · 가볍고 힐링되는 자막 톤',
      style: [
        '채널: 「고양이를 독점하고 싶은 사람」(@고양이독점) — 고양이 4마리와 함께 사는 다묘 집사의 일상 쇼츠.',
        '톤: 유쾌하고 따뜻한 1인칭 집사 시점. 큰 사건이 없어도 웃음이 나는 장면을 고르고, 자막은 짧고 가볍게 한 줄씩 끊는다.',
        '소재: 네 마리 성격이 드러나는 순간(밥 시간·자리 쟁탈·새벽 츄르·택배 상자·병원 다녀온 날). 이름이 정해지기 전까지는 첫째·둘째·셋째·넷째로 쓴다.',
        '자막: 한 줄 12자 안팎, 이모지는 한 화면에 1개까지. 과한 효과음 지시나 반짝이는 3D CG는 쓰지 않는다.',
        '주의: 제목·해시태그·자막에 무거운 단어를 직접 노출하지 않는다. 채널 이름에 담긴 줄임말 이야기는 채널 소개에서만 다루고, 영상 제목은 고양이 일상 그대로 쓴다.',
        '구성: 첫 3초에 가장 귀여운 장면 → 상황 한 줄 → 웃긴 포인트 → 집사 속마음 한 줄 → 여운 있는 마무리.'
      ].join('\n'),
      ban: ['고독사'],
      tags: ['#고양이', '#다묘집사', '#고양이일상', '#집사일기', '#고양이를독점하고싶은사람'],
      formats: { shorts: 40, longform: 180 }
    },
    general: {
      label: '일반 유튜브',
      summary: '범용 후킹 구조 · 담백한 말투',
      style: [
        '톤: 담백하고 또렷한 한국어 해설. 유행어·과장 없이 사실과 예시로 말한다.',
        '구조: 첫 3초 후킹 → 문제 제기 → 근거 2~3개 → 정리 → 다음 행동 유도.',
        '자막은 짧은 어절 단위로 끊고, 화면에는 핵심 숫자만 크게 남긴다.'
      ].join('\n'),
      ban: [],
      formats: { shorts: 40, longform: 180 }
    }
  };

  var defaults = {
    ytKey: '',
    geminiKey: '',
    model: 'gemini-flash-latest',
    preset: 'healthlab',
    workerUrl: '',
    lastTab: 'analyzer'
  };

  var settings = Object.assign({}, defaults, store.get('settings', {}));

  var CAS = window.CAS = window.CAS || {};
  CAS.store = store;
  CAS.presets = PRESETS;
  CAS.settings = function () { return Object.assign({}, settings); };
  CAS.getSetting = function (key) { return settings[key]; };
  CAS.saveSettings = function (patch) {
    Object.assign(settings, patch || {});
    store.set('settings', settings);
    updateModePill();
    document.dispatchEvent(new CustomEvent('cas:settings', { detail: CAS.settings() }));
    return CAS.settings();
  };
  CAS.hasYt = function () { return !!String(settings.ytKey || '').trim(); };
  CAS.hasGemini = function () { return !!String(settings.geminiKey || '').trim(); };
  CAS.preset = function () { return PRESETS[settings.preset] || PRESETS.general; };

  /* ---------- text helpers ---------- */
  CAS.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  CAS.num = function (n) {
    n = Number(n || 0);
    if (n >= 100000000) return (n / 100000000).toFixed(n >= 1000000000 ? 1 : 2).replace(/\.0+$/, '') + '억';
    if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 1 : 2).replace(/\.0+$/, '') + '만';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '천';
    return String(Math.round(n));
  };

  CAS.time = function (sec) {
    sec = Math.max(0, Number(sec || 0));
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  CAS.srtTime = function (sec) {
    sec = Math.max(0, Number(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    var ms = Math.round((sec - Math.floor(sec)) * 1000);
    if (ms === 1000) { ms = 0; s += 1; }
    function p(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
    return p(h, 2) + ':' + p(m, 2) + ':' + p(s, 2) + ',' + p(ms, 3);
  };

  CAS.toast = function (msg, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(CAS.toast._t);
    CAS.toast._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
  };

  CAS.copy = function (text, label) {
    function done() { CAS.toast((label || '복사') + ' 완료'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacy(); });
    } else { legacy(); }
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { CAS.toast('복사 실패 — 길게 눌러 선택하세요'); }
      document.body.removeChild(ta);
    }
  };

  CAS.download = function (filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  };

  CAS.setStatus = function (el, msg, kind) {
    if (!el) return;
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.className = 'status' + (kind ? ' ' + kind : '') + (kind === 'busy' ? ' busy' : '');
    el.textContent = msg || '';
  };

  CAS.busy = function (btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.prev = btn.disabled ? '1' : '0'; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    else { btn.disabled = btn.dataset.prev === '1'; btn.removeAttribute('aria-busy'); }
  };

  /* ---------- 탭 라우팅 ---------- */
  var TABS = ['analyzer', 'script', 'thumb', 'cut', 'settings'];
  var TITLES = {
    analyzer: '채널 · 영상 분석기',
    script: 'AI 기획 · 대본 스튜디오',
    thumb: '썸네일 · 카드뉴스 · 포스팅',
    cut: '자동 컷편집기',
    settings: '설정 · API 연결'
  };

  CAS.go = function (tab, silent) {
    if (TABS.indexOf(tab) < 0) tab = 'analyzer';
    TABS.forEach(function (t) {
      var panel = document.getElementById('panel-' + t);
      if (panel) panel.classList.toggle('hidden', t !== tab);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tabbar .tab'), function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    var sub = document.getElementById('topbarSub');
    if (sub) sub.textContent = TITLES[tab] || '';
    if (!silent) {
      try { history.replaceState(null, '', '#' + tab); } catch (e) {}
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }
    settings.lastTab = tab;
    store.set('settings', settings);
    document.dispatchEvent(new CustomEvent('cas:tab', { detail: tab }));
  };

  function updateModePill() {
    var pill = document.getElementById('modePill');
    if (!pill) return;
    var yt = CAS.hasYt(), g = CAS.hasGemini();
    if (yt && g) { pill.textContent = 'API 연결됨'; pill.classList.add('live'); }
    else if (yt || g) { pill.textContent = yt ? 'YouTube 연결' : 'Gemini 연결'; pill.classList.add('live'); }
    else { pill.textContent = '데모'; pill.classList.remove('live'); }
  }

  /* ---------- markdown-lite ---------- */
  CAS.md = function (text) {
    var esc = CAS.esc(text || '');
    var lines = esc.split(/\r?\n/);
    var out = [], list = null, para = [];
    function flushPara() {
      if (para.length) { out.push('<p>' + inline(para.join('<br>')) + '</p>'); para = []; }
    }
    function flushList() {
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
    }
    function inline(s) {
      return s
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    }
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.trim();
      if (!line) { flushPara(); flushList(); continue; }
      if (/^#{1,4}\s+/.test(line)) { flushPara(); flushList(); out.push('<h4>' + inline(line.replace(/^#{1,4}\s+/, '')) + '</h4>'); continue; }
      if (/^[-•*]\s+/.test(line)) { flushPara(); list = list || []; list.push('<li>' + inline(line.replace(/^[-•*]\s+/, '')) + '</li>'); continue; }
      if (/^\d+[.)]\s+/.test(line)) { flushPara(); list = list || []; list.push('<li>' + inline(line.replace(/^\d+[.)]\s+/, '')) + '</li>'); continue; }
      flushList();
      para.push(line);
    }
    flushPara(); flushList();
    return out.join('');
  };

  /* ---------- block renderer ---------- */
  CAS.block = function (title, text, opts) {
    opts = opts || {};
    var id = 'blk' + Math.random().toString(36).slice(2, 8);
    var html = '<div class="block">' +
      '<div class="block-head"><b>' + CAS.esc(title) + '</b>' +
      '<button class="btn tiny ghost" type="button" data-copy="' + id + '">복사</button></div>' +
      '<pre id="' + id + '">' + CAS.esc(text) + '</pre></div>';
    CAS._blocks = CAS._blocks || {};
    CAS._blocks[id] = text;
    return html;
  };

  CAS.bindCopy = function (root) {
    (root || document).querySelectorAll('[data-copy]').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-copy');
        var text = (CAS._blocks && CAS._blocks[id]) || (document.getElementById(id) || {}).textContent || '';
        CAS.copy(text, btn.getAttribute('data-label') || '복사');
      });
    });
  };

  /* ---------- 원클릭 세팅: #setup=<base64 또는 쿼리문자열> → localStorage ----------
     폰에서 키를 붙여넣지 않아도 되도록, 링크 한 번으로 yt/gem 키를 저장한다.
     · 저장 즉시 history.replaceState로 해시를 지워 주소창·방문 기록·공유에 키가 남지 않게 한다.
     · 저장소 코드에는 실제 키를 절대 넣지 않는다(키는 링크에만 있다). */
  var SETUP_PREFIX = '#setup=';

  function b64ToText(b64) {
    var s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    try {
      return decodeURIComponent(bin.split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch (e) { return bin; }
  }

  function safeDecode(s) {
    try { return decodeURIComponent(String(s).replace(/\+/g, '%20')); }
    catch (e) { return String(s); }
  }

  /* 링크의 값을 { yt, gem, model }로 해석 — base64url/base64/평문 쿼리/JSON 모두 허용 */
  CAS.parseSetup = function (raw) {
    var text = String(raw || '').trim();
    var out = { yt: '', gem: '', model: '' };
    if (!text) return out;
    var looksPlain = /^\{/.test(text) || /(^|&)(yt|gem|ytKey|geminiKey)=/.test(text);
    if (!looksPlain) {
      try {
        var dec = b64ToText(text);
        if (dec && /[\{\=]/.test(dec)) text = dec.trim();
      } catch (e) {}
    }
    var obj = null;
    if (text.charAt(0) === '{') {
      try { obj = JSON.parse(text); } catch (e) { obj = null; }
    }
    if (!obj) {
      obj = {};
      text.split('&').forEach(function (pair) {
        if (!pair) return;
        var i = pair.indexOf('=');
        if (i < 0) return;
        obj[safeDecode(pair.slice(0, i))] = safeDecode(pair.slice(i + 1));
      });
    }
    out.yt = String(obj.yt || obj.ytKey || obj.youtube || '').trim();
    out.gem = String(obj.gem || obj.geminiKey || obj.gemini || '').trim();
    out.model = String(obj.model || obj.geminiModel || '').trim();
    return out;
  };

  function fillKeyInputs() {
    var yt = document.getElementById('ytKey');
    var gem = document.getElementById('geminiKey');
    var sel = document.getElementById('geminiModel');
    if (yt) yt.value = settings.ytKey || '';
    if (gem) gem.value = settings.geminiKey || '';
    if (sel && settings.model) sel.value = settings.model;
  }

  function showSetupNotice() {
    var n = CAS._setupNotice;
    if (!n) return null;
    CAS._setupNotice = null;
    var names = [n.yt ? 'YouTube' : '', n.gem ? 'Gemini' : ''].filter(Boolean).join(' · ');
    CAS.toast(names + ' API 키가 자동으로 저장되었습니다!', 4200);
    CAS.setStatus('settingsStatus', names + ' 키를 자동으로 저장했습니다. 연결 테스트로 확인해 보세요.', 'ok');
    CAS.setStatus('anaStatus', names + ' 키가 준비됐습니다. 채널 주소를 넣고 분석하기를 누르면 실제 데이터로 분석합니다.', 'ok');
    fillKeyInputs();
    updateModePill();
    document.dispatchEvent(new CustomEvent('cas:settings', { detail: CAS.settings() }));
    return n;
  }
  CAS.showSetupNotice = showSetupNotice;

  /* 해시의 세팅 값을 읽어 저장하고, 해시는 무조건 지운다 */
  CAS.applySetup = function () {
    var h = location.hash || '';
    if (h.indexOf(SETUP_PREFIX) !== 0) return null;
    var payload = CAS.parseSetup(h.slice(SETUP_PREFIX.length));
    // 저장 성공 여부와 상관없이 먼저 주소창에서 키를 지운다
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    var patch = {};
    if (payload.yt) patch.ytKey = payload.yt;
    if (payload.gem) patch.geminiKey = payload.gem;
    if (payload.model) patch.model = payload.model;
    if (!patch.ytKey && !patch.geminiKey) {
      CAS.toast('세팅 링크에 키가 없습니다 — 링크를 다시 확인해 주세요', 3600);
      return null;
    }
    CAS.saveSettings(patch); // 저장 + 모드 배지 갱신 + cas:settings 이벤트
    CAS._setupNotice = { yt: !!patch.ytKey, gem: !!patch.geminiKey };
    if (CAS._booted) showSetupNotice();
    return CAS._setupNotice;
  };

  /* ---------- 초기화 ---------- */
  CAS.init = function () {
    updateModePill();

    // 탭
    Array.prototype.forEach.call(document.querySelectorAll('#tabbar .tab'), function (b) {
      b.addEventListener('click', function () { CAS.go(b.dataset.tab); });
    });
    var initial = (location.hash || '').replace('#', '');
    CAS.go(TABS.indexOf(initial) >= 0 ? initial : (settings.lastTab || 'analyzer'), true);

    var pill = document.getElementById('modePill');
    if (pill) pill.addEventListener('click', function () { CAS.go('settings'); });

    // 설정 화면
    var ytKey = document.getElementById('ytKey');
    var geminiKey = document.getElementById('geminiKey');
    var modelSel = document.getElementById('geminiModel');
    var worker = document.getElementById('workerUrl');
    if (ytKey) ytKey.value = settings.ytKey || '';
    if (geminiKey) geminiKey.value = settings.geminiKey || '';
    if (modelSel) {
      modelSel.value = settings.model || 'gemini-flash-latest';
      if (!modelSel.value) { modelSel.value = 'gemini-flash-latest'; CAS.saveSettings({ model: 'gemini-flash-latest' }); }
    }
    if (worker) worker.value = settings.workerUrl || '';

    var saveBtn = document.getElementById('btnSaveKeys');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      CAS.saveSettings({
        ytKey: (ytKey.value || '').trim(),
        geminiKey: (geminiKey.value || '').trim(),
        model: modelSel.value,
        workerUrl: (worker.value || '').trim().replace(/\/+$/, '')
      });
      CAS.setStatus('settingsStatus', '저장했습니다. 분석·대본 탭에서 바로 쓸 수 있어요.', 'ok');
      CAS.toast('설정 저장됨');
    });

    var clearBtn = document.getElementById('btnClearKeys');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      CAS.saveSettings({ ytKey: '', geminiKey: '' });
      if (ytKey) ytKey.value = '';
      if (geminiKey) geminiKey.value = '';
      CAS.setStatus('settingsStatus', '키를 지웠습니다. 데모 모드로 동작합니다.', 'ok');
    });

    var testYt = document.getElementById('btnTestYt');
    if (testYt) testYt.addEventListener('click', function () {
      var key = (ytKey.value || '').trim();
      if (!key) { CAS.setStatus('ytKeyStatus', '키를 먼저 입력하세요.', 'err'); return; }
      CAS.setStatus('ytKeyStatus', '확인 중…', 'busy');
      CAS.youtube.testKey(key).then(function (ok) {
        CAS.setStatus('ytKeyStatus', ok ? '정상 동작합니다' : '키가 거부되었습니다(사용 설정 확인)', ok ? 'ok' : 'err');
      }).catch(function (e) {
        CAS.setStatus('ytKeyStatus', CAS.errText(e), 'err');
      });
    });

    var testG = document.getElementById('btnTestGemini');
    if (testG) testG.addEventListener('click', function () {
      var key = (geminiKey.value || '').trim();
      if (!key) { CAS.setStatus('geminiKeyStatus', '키를 먼저 입력하세요.', 'err'); return; }
      CAS.setStatus('geminiKeyStatus', '확인 중…', 'busy');
      CAS.gemini.testKey(key, modelSel.value).then(function (ok) {
        CAS.setStatus('geminiKeyStatus', ok ? '정상 동작합니다' : '키가 거부되었습니다', ok ? 'ok' : 'err');
      }).catch(function (e) {
        CAS.setStatus('geminiKeyStatus', CAS.errText(e), 'err');
      });
    });

    // 프리셋
    var radios = document.querySelectorAll('input[name="preset"]');
    Array.prototype.forEach.call(radios, function (r) {
      r.checked = (r.value === settings.preset);
      r.addEventListener('change', function () {
        if (!r.checked) return;
        CAS.saveSettings({ preset: r.value });
        renderPresetNote();
        CAS.toast(CAS.preset().label + ' 프리셋 적용');
      });
    });
    renderPresetNote();

    var exp = document.getElementById('btnExportAll');
    if (exp) exp.addEventListener('click', function () {
      var copy = Object.assign({}, settings, { ytKey: settings.ytKey ? '(저장됨)' : '', geminiKey: settings.geminiKey ? '(저장됨)' : '' });
      CAS.download('creator-studio-settings.json', JSON.stringify(copy, null, 2), 'application/json');
      CAS.toast('설정 내보내기(키 제외)');
    });

    var inst = document.getElementById('btnInstallHelp');
    if (inst) inst.addEventListener('click', function () {
      CAS.setStatus('installStatus',
        '안드로이드 크롬: 우측 상단 ⋮ → "앱 설치" 또는 "홈 화면에 추가"\n아이폰 사파리: 하단 공유 → "홈 화면에 추가"', 'ok');
    });

    // 링크로 들어온 원클릭 세팅 안내(입력칸·배지가 갱신된 뒤에 표시)
    if (CAS._setupNotice) showSetupNotice();

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var active = document.querySelector('.panel:not(.hidden) .btn.primary');
        if (active && !active.disabled) active.click();
      }
    });
  };

  function renderPresetNote() {
    var p = CAS.preset();
    var note = document.getElementById('presetNote');
    if (!note) return;
    var text = p.summary;
    if (p.ban && p.ban.length) text += ' · 금지어: ' + p.ban.join(', ');
    if (p.tags && p.tags.length) text += ' · 기본 태그: ' + p.tags.join(' ');
    note.textContent = text;
  }
  CAS.renderPresetNote = renderPresetNote;

  CAS.errText = function (e) {
    if (!e) return '알 수 없는 오류';
    if (e.name === 'TypeError' || /Failed to fetch|NetworkError/i.test(e.message || '')) {
      return '네트워크 오류 — 인터넷 연결이나 API 키 제한(HTTP 리퍼러)을 확인하세요.';
    }
    return e.message || String(e);
  };

  CAS.setting = function (k) { return settings[k]; };
  CAS.defaults = defaults;
  CAS._blocks = CAS._blocks || {};

  /* 화면에 보이는 오류 배너 — 검증·사용 중 문제를 숨기지 않는다 */
  function showError(text) {
    var bar = document.getElementById('jsErrorBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'jsErrorBar';
      bar.style.cssText = 'position:fixed;left:8px;right:8px;bottom:calc(var(--tab-h) + 12px);z-index:80;' +
        'background:#3a1218;border:1px solid #ff6b6b;color:#ffd7d7;border-radius:12px;padding:10px 12px;' +
        'font-size:12px;line-height:1.45;box-shadow:0 8px 24px rgba(0,0,0,.4)';
      bar.addEventListener('click', function () { bar.remove(); });
      document.body.appendChild(bar);
    }
    bar.textContent = '⚠ ' + text + ' (탭하면 닫힘)';
  }
  CAS.showError = showError;
  window.addEventListener('error', function (e) {
    if (!e || !e.message) return;
    showError(e.message + (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    showError((r && (r.message || r)) || '알 수 없는 오류');
  });

  // 링크(#setup=...)가 있으면 부팅 전에 먼저 저장 — init이 갱신된 설정을 읽도록
  CAS.applySetup();
  window.addEventListener('hashchange', function () { CAS.applySetup(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (CAS.boot) CAS.boot(); });
  }
})();
