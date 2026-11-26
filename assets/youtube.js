/* YouTube Data API v3 — 입력 파싱 · 조회 · 지표 계산 */
(function () {
  'use strict';
  var CAS = window.CAS;
  var API = 'https://www.googleapis.com/youtube/v3/';

  function key() { return String(CAS.getSetting('ytKey') || '').trim(); }

  function apiGet(path, params) {
    var p = Object.assign({}, params, { key: key() });
    var qs = Object.keys(p).filter(function (k) { return p[k] !== undefined && p[k] !== null && p[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(p[k]); }).join('&');
    return fetch(API + path + '?' + qs).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var msg = (body.error && body.error.message) || ('YouTube API 오류 ' + res.status);
          var err = new Error(msg);
          err.status = res.status;
          err.reason = body.error && body.error.errors && body.error.errors[0] && body.error.errors[0].reason;
          throw err;
        }
        return body;
      });
    });
  }

  /* ---------- 입력 해석 ---------- */
  function parseInput(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    var m;
    if ((m = s.match(/(?:youtu\.be\/|\/shorts\/|\/live\/|\/embed\/|[?&]v=)([A-Za-z0-9_-]{11})/))) return { type: 'video', id: m[1] };
    if ((m = s.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/))) return { type: 'channelId', id: m[1] };
    if ((m = s.match(/\/user\/([A-Za-z0-9_.-]+)/))) return { type: 'username', name: m[1] };
    if ((m = s.match(/\/@([A-Za-z0-9_.-]+)/))) return { type: 'handle', handle: m[1] };
    if ((m = s.match(/\/c\/([A-Za-z0-9_.-]+)/))) return { type: 'query', q: m[1] };
    if (/^UC[A-Za-z0-9_-]{22}$/.test(s)) return { type: 'channelId', id: s };
    if (/^@[A-Za-z0-9_.-]+$/.test(s)) return { type: 'handle', handle: s.slice(1) };
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { type: 'video', id: s };
    return { type: 'query', q: s };
  }

  function isoDuration(iso) {
    var m = String(iso || '').match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/);
    if (!m) return 0;
    return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + (Number(m[3] || 0) * 60) + Number(m[4] || 0);
  }

  function kst(iso) {
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return null;
    return new Date(t + 9 * 3600 * 1000); // KST wall clock
  }

  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /* ---------- 조회 ---------- */
  function resolveChannel(parsed) {
    var p;
    if (parsed.type === 'channelId') p = apiGet('channels', { part: 'snippet,statistics,contentDetails,brandingSettings', id: parsed.id });
    else if (parsed.type === 'handle') p = apiGet('channels', { part: 'snippet,statistics,contentDetails,brandingSettings', forHandle: parsed.handle });
    else if (parsed.type === 'username') p = apiGet('channels', { part: 'snippet,statistics,contentDetails,brandingSettings', forUsername: parsed.name });
    else p = apiGet('search', { part: 'snippet', type: 'channel', maxResults: 1, q: parsed.q || parsed.handle || '' })
      .then(function (r) {
        var id = r.items && r.items[0] && (r.items[0].id.channelId || r.items[0].snippet.channelId);
        if (!id) throw new Error('채널을 찾지 못했습니다: ' + (parsed.q || ''));
        return apiGet('channels', { part: 'snippet,statistics,contentDetails,brandingSettings', id: id });
      });
    return p.then(function (r) {
      var ch = r.items && r.items[0];
      if (!ch) throw new Error('채널을 찾지 못했습니다. 핸들(@)이나 채널 URL을 확인하세요.');
      return ch;
    });
  }

  function fetchUploads(ch, limit) {
    var playlist = ch.contentDetails && ch.contentDetails.relatedPlaylists && ch.contentDetails.relatedPlaylists.uploads;
    if (!playlist) return Promise.resolve({ ids: [], warning: '업로드 재생목록을 읽을 수 없습니다.' });
    limit = limit || 50;
    var ids = [];
    function page(token) {
      return apiGet('playlistItems', { part: 'contentDetails', playlistId: playlist, maxResults: 50, pageToken: token })
        .then(function (r) {
          (r.items || []).forEach(function (it) {
            var vid = it.contentDetails && it.contentDetails.videoId;
            if (vid) ids.push(vid);
          });
          if (r.nextPageToken && ids.length < limit) return page(r.nextPageToken);
          return ids.slice(0, limit);
        });
    }
    return page().then(function (list) { return { ids: list }; });
  }

  function fetchVideos(ids) {
    if (!ids.length) return Promise.resolve([]);
    var groups = chunk(ids, 50);
    return Promise.all(groups.map(function (g) {
      return apiGet('videos', { part: 'snippet,statistics,contentDetails', id: g.join(','), maxResults: 50 });
    })).then(function (res) {
      var byId = {};
      res.forEach(function (r) {
        (r.items || []).forEach(function (v) { byId[v.id] = v; });
      });
      return ids.map(function (id) { return byId[id]; }).filter(Boolean);
    });
  }

  /* ---------- 지표 계산 ---------- */
  function durationLabel(sec) {
    sec = Math.round(sec || 0);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function analyze(ch, videos) {
    videos = videos.slice().sort(function (a, b) {
      return new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt);
    });
    var rows = videos.map(function (v) {
      var d = isoDuration(v.contentDetails && v.contentDetails.duration);
      var k = kst(v.snippet.publishedAt);
      return {
        id: v.id,
        title: v.snippet.title,
        thumb: (v.snippet.thumbnails && (v.snippet.thumbnails.medium || v.snippet.thumbnails.default) || {}).url || '',
        publishedAt: v.snippet.publishedAt,
        views: Number((v.statistics && v.statistics.viewCount) || 0),
        likes: Number((v.statistics && v.statistics.likeCount) || 0),
        comments: Number((v.statistics && v.statistics.commentCount) || 0),
        duration: d,
        isShort: d > 0 && d <= 62,
        dow: k ? k.getUTCDay() : null,
        hour: k ? k.getUTCHours() : null
      };
    });

    var total = rows.reduce(function (a, r) { return a + r.views; }, 0);
    var likes = rows.reduce(function (a, r) { return a + r.likes; }, 0);
    var shorts = rows.filter(function (r) { return r.isShort; });
    var longs = rows.filter(function (r) { return !r.isShort; });
    function avg(list) { return list.length ? Math.round(list.reduce(function (a, r) { return a + r.views; }, 0) / list.length) : 0; }
    function median(list) {
      if (!list.length) return 0;
      var s = list.map(function (r) { return r.views; }).sort(function (a, b) { return a - b; });
      var mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
    }

    var dowCount = [0, 0, 0, 0, 0, 0, 0];
    var dowViews = [0, 0, 0, 0, 0, 0, 0];
    var hourCount = new Array(24).fill(0);
    var hourViews = new Array(24).fill(0);
    rows.forEach(function (r) {
      if (r.dow === null) return;
      dowCount[r.dow] += 1; dowViews[r.dow] += r.views;
      hourCount[r.hour] += 1; hourViews[r.hour] += r.views;
    });
    var slotCount = new Array(8).fill(0);
    var slotViews = new Array(8).fill(0);
    rows.forEach(function (r) {
      if (r.hour === null) return;
      var s = Math.floor(r.hour / 3);
      slotCount[s] += 1; slotViews[s] += r.views;
    });

    var top = rows.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, 5);
    var bottom = rows.filter(function (r) { return r.views > 0; }).sort(function (a, b) { return a.views - b.views; }).slice(0, 3);
    var bestDow = dowCount.map(function (c, i) { return { i: i, c: c, v: dowViews[i] }; })
      .sort(function (a, b) { return (b.v / (b.c || 1)) - (a.v / (a.c || 1)); })[0];
    var bestSlot = slotCount.map(function (c, i) { return { i: i, c: c, v: slotViews[i] }; })
      .filter(function (x) { return x.c > 0; })
      .sort(function (a, b) { return (b.v / b.c) - (a.v / a.c); })[0];

    var latest = rows[0] || null;
    var daysSince = latest ? Math.floor((Date.now() - new Date(latest.publishedAt).getTime()) / 86400000) : null;

    var engagement = 0;
    var engBase = rows.filter(function (r) { return r.views > 0; });
    if (engBase.length) {
      engagement = engBase.reduce(function (a, r) { return a + (r.likes + r.comments) / r.views; }, 0) / engBase.length * 100;
    }

    return {
      channel: {
        id: ch.id,
        title: ch.snippet.title,
        handle: ch.snippet.customUrl || '',
        description: ch.snippet.description || '',
        avatar: (ch.snippet.thumbnails && (ch.snippet.thumbnails.medium || ch.snippet.thumbnails.default) || {}).url || '',
        country: ch.snippet.country || '',
        subscribers: Number((ch.statistics && ch.statistics.hiddenSubscriberCount) ? 0 : (ch.statistics && ch.statistics.subscriberCount) || 0),
        hiddenSubs: !!(ch.statistics && ch.statistics.hiddenSubscriberCount),
        totalViews: Number((ch.statistics && ch.statistics.viewCount) || 0),
        videoCount: Number((ch.statistics && ch.statistics.videoCount) || 0)
      },
      rows: rows,
      summary: {
        sampled: rows.length,
        sampleViews: total,
        avgViews: Math.round(total / (rows.length || 1)),
        medianViews: median(rows),
        likeRate: total ? (likes / total) * 100 : 0,
        engagement: engagement,
        shortsCount: shorts.length,
        longCount: longs.length,
        shortsAvg: avg(shorts),
        longAvg: avg(longs),
        latestDays: daysSince,
        bestDow: bestDow && bestDow.c > 0 ? DOW[bestDow.i] + '요일' : null,
        bestDowAvg: bestDow && bestDow.c > 0 ? Math.round(bestDow.v / bestDow.c) : 0,
        bestSlot: bestSlot ? pad(bestSlot.i * 3) + ':00~' + pad(bestSlot.i * 3 + 3) + ':00' : null,
        bestSlotAvg: bestSlot ? Math.round(bestSlot.v / bestSlot.c) : 0
      },
      distributions: {
        dow: dowCount.map(function (c, i) { return { label: DOW[i], count: c, views: dowViews[i] }; }),
        hour: hourCount.map(function (c, i) { return { label: pad(i) + '시', count: c, views: hourViews[i] }; })
      },
      top: top,
      bottom: bottom
    };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- 공개 API ---------- */
  CAS.youtube = {
    parseInput: parseInput,
    durationLabel: durationLabel,

    testKey: function (testKeyValue) {
      var saved = CAS.getSetting('ytKey');
      if (testKeyValue && testKeyValue !== saved) CAS.saveSettings({ ytKey: testKeyValue });
      return apiGet('channels', { part: 'snippet', forHandle: 'YouTube' }).then(function () { return true; })
        .catch(function (e) {
          if (testKeyValue && testKeyValue !== saved) CAS.saveSettings({ ytKey: saved || '' });
          throw e;
        });
    },

    /* 채널 또는 영상 주소 → 분석 결과 */
    load: function (input, opts) {
      opts = opts || {};
      var parsed = parseInput(input);
      if (!parsed) return Promise.reject(new Error('주소를 입력하세요.'));

      if (parsed.type === 'video') {
        return apiGet('videos', { part: 'snippet,statistics,contentDetails', id: parsed.id })
          .then(function (r) {
            var v = r.items && r.items[0];
            if (!v) throw new Error('영상을 찾지 못했습니다(비공개이거나 삭제됨).');
            return apiGet('channels', { part: 'snippet,statistics,contentDetails,brandingSettings', id: v.snippet.channelId })
              .then(function (cr) {
                var ch = cr.items && cr.items[0];
                if (!ch) throw new Error('채널 정보를 읽지 못했습니다.');
                return { ch: ch, focusVideo: v };
              });
          })
          .then(function (ctx) { return finish(ctx.ch, ctx.focusVideo, opts); });
      }

      return resolveChannel(parsed)
        .then(function (ch) { return finish(ch, null, opts); });
    },

    channelById: function (id) {
      return resolveChannel({ type: 'channelId', id: id }).then(function (ch) { return finish(ch, null, {}); });
    }
  };

  function finish(ch, focusVideo, opts) {
    return fetchUploads(ch, opts.limit || 50).then(function (u) {
      return fetchVideos(u.ids).then(function (videos) {
        if (focusVideo && !videos.some(function (v) { return v.id === focusVideo.id; })) videos.unshift(focusVideo);
        var result = analyze(ch, videos);
        result.warning = u.warning || null;
        if (focusVideo) {
          result.focus = result.rows.filter(function (r) { return r.id === focusVideo.id; })[0] || null;
        }
        return result;
      });
    });
  }
})();
