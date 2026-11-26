/* Gemini API — 프롬프트 구성 · 호출 · JSON 파싱 */
(function () {
  'use strict';
  var CAS = window.CAS;
  var BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
  var FALLBACK = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash'];

  function key() { return String(CAS.getSetting('geminiKey') || '').trim(); }
  // 예전에 저장된 모델 이름(2025년식)은 더 이상 신규 사용자에게 제공되지 않으므로 최신 모델로 옮긴다.
  var LEGACY_MODEL = { 'gemini-2.5-flash': 'gemini-flash-latest', 'gemini-2.0-flash': 'gemini-flash-latest', 'gemini-2.5-pro': 'gemini-3.8-flash' };
  function model() {
    var m = String(CAS.getSetting('model') || '').trim() || 'gemini-flash-latest';
    return LEGACY_MODEL[m] || m;
  }

  // 2.5 이상(Gemini 3.x · flash-latest 별칭 포함)은 thinking이 출력 토큰과 시간을 잡아먹어 JSON이 잘릴 수 있어 끈다.
  function noThinking(modelName) { return !/^gemini-(1\.5|2\.0)/.test(modelName); }

  function buildBody(modelName, system, prompt, gen, thinkingOff) {
    var cfg = Object.assign({}, gen);
    if (noThinking(modelName) && thinkingOff !== false) cfg.thinkingConfig = { thinkingBudget: 0 };
    return {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: cfg
    };
  }

  /* thinking 끄기(thinkingBudget 0)를 지원하지 않는 모델은 400을 돌려주므로, 그때만 thinking을 켜고 한 번 재시도한다. */
  function generate(modelName, system, prompt, gen) {
    return call(modelName, buildBody(modelName, system, prompt, gen, true)).catch(function (e) {
      if (e.status === 400 && noThinking(modelName)) return call(modelName, buildBody(modelName, system, prompt, gen, false));
      throw e;
    });
  }

  function call(modelName, body) {
    return fetch(BASE + modelName + ':generateContent?key=' + encodeURIComponent(key()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var msg = (data.error && data.error.message) || ('Gemini 오류 ' + res.status);
          var err = new Error(msg);
          err.status = res.status;
          throw err;
        }
        var cands = data.candidates || [];
        if (!cands.length) {
          var block = data.promptFeedback && data.promptFeedback.blockReason;
          throw new Error(block ? ('요청이 안전 정책으로 차단되었습니다: ' + block) : 'Gemini가 빈 응답을 돌려줬습니다.');
        }
        var parts = (cands[0].content && cands[0].content.parts) || [];
        var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
        if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
        return text;
      });
    });
  }

  function systemPrompt(extra) {
    var p = CAS.preset();
    var ban = (p.ban && p.ban.length) ? '\n[금지 표현] 다음 단어는 쓰지 않는다: ' + p.ban.join(', ') : '';
    var tags = (p.tags && p.tags.length) ? '\n[기본 해시태그] hashtags 배열은 이 태그들로 시작하고, 주제에 맞는 태그를 뒤에 덧붙인다: ' + p.tags.join(' ') : '';
    var sign = p.signature ? '\n[고정 엔딩 멘트] 대본의 마지막 구간 line은 다음 문장 그대로 끝맺는다: "' + p.signature + '"' : '';
    return '너는 한국어 유튜브 채널 운영을 돕는 실무 PD 겸 카피라이터다.\n'
      + '[채널 스타일]\n' + p.style + ban + tags + sign + '\n'
      + '[공통 규칙]\n'
      + '- 수치나 사실을 만들지 않는다. 모르면 "확인 필요"라고 적는다.\n'
      + '- 한국어로, 실제로 말할 수 있는 문장으로 쓴다. 광고 문구처럼 과장하지 않는다.\n'
      + '- 결과는 요청한 JSON 형식만 출력한다.\n'
      + (extra ? '\n' + extra : '');
  }

  function parseJson(text) {
    var s = String(text || '').trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var start = s.search(/[\{\[]/);
    var end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      var slice = s.slice(start, end + 1);
      try { return JSON.parse(slice); } catch (e2) {}
      // 흔한 오류: 뒤에 붙은 쉼표
      try { return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')); } catch (e3) {}
    }
    throw new Error('Gemini 응답을 JSON으로 읽지 못했습니다. 다시 시도해 주세요.');
  }

  CAS.gemini = {
    ready: function () { return !!key(); },

    /* 프롬프트 복사용 — 프리셋 규칙(말토·금지어·기본 태그·고정 멘트)까지 한 덩어리로 만들어 준다. */
    copyPrompt: function (userPrompt, schemaText) {
      var head = systemPrompt();
      if (schemaText) head += '\n\n[출력 형식] 아래 JSON 형식만 출력한다.\n' + schemaText;
      return head + '\n\n[요청]\n' + userPrompt;
    },

    testKey: function (testValue, testModel) {
      var saved = CAS.getSetting('geminiKey');
      var savedModel = CAS.getSetting('model');
      if (testValue && testValue !== saved) CAS.saveSettings({ geminiKey: testValue.trim() });
      if (testModel) CAS.saveSettings({ model: testModel });
      var m = testModel || model();
      // 실제 생성과 같은 요청 형태(thinking 끄기 포함)로 확인한다. 토큰이 16이면 thinking만 쓰고 본문이 비어 실패로 보인다.
      return generate(m, 'You are a health check.', '한 단어로 "ok"라고만 답해.', { temperature: 0, maxOutputTokens: 64 }).then(function (t) {
        if (testValue && testValue !== saved) CAS.saveSettings({ geminiKey: saved || '' });
        if (testModel) CAS.saveSettings({ model: savedModel });
        return /ok/i.test(t);
      }).catch(function (e) {
        if (testValue && testValue !== saved) CAS.saveSettings({ geminiKey: saved || '' });
        if (testModel) CAS.saveSettings({ model: savedModel });
        throw e;
      });
    },

    /* 자유 텍스트 생성 */
    text: function (userPrompt, opts) {
      opts = opts || {};
      var gen = {
        temperature: opts.temperature == null ? 0.85 : opts.temperature,
        maxOutputTokens: opts.maxTokens || 4096
      };
      var system = opts.system || systemPrompt();
      var order = [model()].concat(FALLBACK.filter(function (m) { return m !== model(); }));
      function attempt(i) {
        return generate(order[i], system, userPrompt, gen).catch(function (e) {
          var retryable = e.status === 404 || e.status === 429 || e.status === 503 || (e.status === 400 && /model|thinking/i.test(e.message || ''));
          if (retryable && i < order.length - 1) return attempt(i + 1);
          throw e;
        });
      }
      return attempt(0);
    },

    /* JSON 생성 */
    json: function (userPrompt, opts) {
      opts = opts || {};
      var instruction = systemPrompt(opts.extraSystem)
        + '\n\n아래 JSON 스키마에 정확히 맞춰 JSON 하나만 출력한다.\n' + (opts.schemaHint || '');
      var gen = {
        temperature: opts.temperature == null ? 0.8 : opts.temperature,
        maxOutputTokens: opts.maxTokens || 8192,
        responseMimeType: 'application/json'
      };
      var order = [model()].concat(FALLBACK.filter(function (m) { return m !== model(); }));
      function attempt(i) {
        return generate(order[i], instruction, userPrompt, gen).catch(function (e) {
          var retryable = e.status === 404 || e.status === 429 || e.status === 503 || (e.status === 400 && /model|response|thinking/i.test(e.message || ''));
          if (retryable && i < order.length - 1) return attempt(i + 1);
          throw e;
        });
      }
      return attempt(0).then(parseJson);
    },

    systemPrompt: systemPrompt
  };
})();
