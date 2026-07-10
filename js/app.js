(() => {
  'use strict';

  const PATHS = {
    journeys: './data/journeys.json',
    places: './data/places-master.json',
    links: './data/place-map-links-master.json'
  };

  const state = {
    screen: 'home',
    group: null,
    journeys: [],
    places: new Map(),
    linksByPlace: new Map(),
    currentJourneyMeta: null,
    currentJourney: null,
    stopIndex: 0,
    history: []
  };

  const main = document.getElementById('main');
  const backBtn = document.getElementById('backBtn');
  const homeBtn = document.getElementById('homeBtn');
  const headerSubtitle = document.getElementById('headerSubtitle');
  const mapDialog = document.getElementById('mapDialog');
  const mapDialogTitle = document.getElementById('mapDialogTitle');
  const mapOptions = document.getElementById('mapOptions');
  const guideDialog = document.getElementById('guideDialog');
  const installBtn = document.getElementById('installBtn');
  let deferredInstallPrompt = null;

  const safeText = (value, fallback = '') => value == null ? fallback : String(value);

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} 로드 실패 (${response.status})`);
    return response.json();
  }

  async function boot() {
    renderLoading();
    try {
      const [journeys, places, links] = await Promise.all([
        fetchJson(PATHS.journeys),
        fetchJson(PATHS.places),
        fetchJson(PATHS.links)
      ]);

      state.journeys = Array.isArray(journeys) ? journeys : journeys.journeys || [];
      for (const place of places) state.places.set(place.id, place);
      for (const link of links) {
        if (!state.linksByPlace.has(link.place_id)) state.linksByPlace.set(link.place_id, []);
        state.linksByPlace.get(link.place_id).push(link);
      }
      renderHome(false);
    } catch (error) {
      renderError(error);
    }
  }

  function renderLoading() {
    main.innerHTML = `<div class="empty">엔진과 데이터베이스를 불러오는 중입니다…</div>`;
  }

  function renderError(error) {
    main.innerHTML = `
      <div class="error">
        <strong>데이터를 불러오지 못했습니다.</strong>
        <p>${safeText(error.message)}</p>
        <p>GitHub Pages나 로컬 웹서버에서 실행했는지 확인해 주세요. file:// 직접 실행은 JSON 로딩이 차단될 수 있습니다.</p>
      </div>`;
  }

  function setHeader(subtitle, canBack, canHome) {
    headerSubtitle.textContent = subtitle;
    backBtn.classList.toggle('hidden', !canBack);
    homeBtn.classList.toggle('hidden', !canHome);
  }

  function pushHistory(entry) {
    state.history.push(entry);
  }

  function renderHome(record = true) {
    if (record && state.screen !== 'home') pushHistory({ screen: state.screen, group: state.group });
    state.screen = 'home';
    state.group = null;
    state.currentJourneyMeta = null;
    state.currentJourney = null;
    state.stopIndex = 0;
    setHeader('성경을 따라 걷는 탐험', false, false);

    main.innerHTML = `
      <section class="hero">
        <div class="hero-mark">🚶</div>
        <h1>CEN Journey Explorer</h1>
        <p>성경의 중요한 여정들을<br>지도와 함께 탐험해 보세요.</p>
      </section>

      <section class="home-grid" aria-label="성경 구분 선택">
        <button class="big-tile" data-group="OT" type="button">
          <span>📜</span><strong>구약 여정</strong><small>족장·출애굽·왕국·선지자</small>
        </button>
        <button class="big-tile" data-group="NT" type="button">
          <span>✝️</span><strong>신약 여정</strong><small>예수님·초대교회·선교</small>
        </button>
      </section>

      <div class="secondary-row">
        <button id="allJourneysBtn" class="btn btn-secondary" type="button">전체 여정</button>
        <button id="guideBtn" class="btn btn-ghost" type="button">사용안내</button>
      </div>`;

    main.querySelectorAll('[data-group]').forEach(btn => {
      btn.addEventListener('click', () => renderJourneyList(btn.dataset.group));
    });
    document.getElementById('allJourneysBtn').addEventListener('click', () => renderJourneyList('ALL'));
    document.getElementById('guideBtn').addEventListener('click', () => guideDialog.showModal());
  }

  function renderJourneyList(group, record = true) {
    if (record) pushHistory({ screen: state.screen, group: state.group });
    state.screen = 'list';
    state.group = group;
    const list = state.journeys.filter(j => group === 'ALL' || j.group === group);
    const title = group === 'OT' ? '구약 여정' : group === 'NT' ? '신약 여정' : '전체 여정';
    setHeader(title, true, true);

    main.innerHTML = `
      <div class="section-head">
        <div><h1>${title}</h1><p>원하는 여정을 선택하세요.</p></div>
        <span class="count-chip">${list.length}개</span>
      </div>
      <div class="journey-list">
        ${list.length ? list.map((j, index) => `
          <button class="journey-card" type="button" data-id="${safeText(j.id)}">
            <span class="journey-num">${String(index + 1).padStart(2, '0')}</span>
            <span>
              <strong>${safeText(j.title)}</strong>
              <small>${safeText(j.subtitle, j.description || '지도·사건·대표 성경구절')}</small>
            </span>
            <span class="arrow">›</span>
          </button>`).join('') :
          `<div class="empty">등록된 여정이 없습니다.<br>journeys.json에 여정을 추가하면 자동으로 표시됩니다.</div>`}
      </div>`;

    main.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => openJourney(btn.dataset.id));
    });
  }

  async function openJourney(id) {
    const meta = state.journeys.find(j => j.id === id);
    if (!meta) return;
    pushHistory({ screen: state.screen, group: state.group });
    renderLoading();
    try {
      const path = `./journeys/${meta.file}`;
      const journey = await fetchJson(path);
      if (!journey || !Array.isArray(journey.stops)) throw new Error('여정 JSON의 stops 배열이 없습니다.');
      state.currentJourneyMeta = meta;
      state.currentJourney = journey;
      state.stopIndex = 0;
      state.screen = 'viewer';
      renderStop();
    } catch (error) {
      renderError(error);
    }
  }

  function resolvePlace(stop) {
    const place = state.places.get(stop.placeId);
    return {
      id: stop.placeId,
      name: stop.placeName || place?.display_name || place?.canonical_name || stop.placeId || '미지정 장소',
      place
    };
  }

  function renderStop() {
    const journey = state.currentJourney;
    if (!journey) return renderHome(false);

    if (state.stopIndex >= journey.stops.length) return renderComplete();

    const stop = journey.stops[state.stopIndex];
    const resolved = resolvePlace(stop);
    const total = journey.stops.length;
    const current = state.stopIndex + 1;
    const percent = Math.round((current / total) * 100);
    setHeader('여정 탐험', true, true);

    main.innerHTML = `
      <div class="viewer-head">
        <h1>${safeText(journey.title || state.currentJourneyMeta?.title)}</h1>
        <small>${current} / ${total}</small>
        <div class="progress"><span style="width:${percent}%"></span></div>
      </div>

      <article class="stop-card">
        <div class="stop-kicker">
          <span>📍 ${current}번째 장소</span>
          <span>${safeText(stop.label, '')}</span>
        </div>
        <h2 class="place-title">${safeText(resolved.name)}</h2>

        <section class="info-block">
          <h2>📖 사건 요약</h2>
          <p>${safeText(stop.summary, '사건 요약을 입력해 주세요.')}</p>
        </section>

        <section class="info-block">
          <h2>📜 대표 성경구절</h2>
          <p class="verse-ref">${safeText(stop.verse, '성경구절을 입력해 주세요.')}</p>
          ${stop.verseText ? `<p style="margin-top:8px">${safeText(stop.verseText)}</p>` : ''}
        </section>

        <div class="actions">
          <button id="mapBtn" class="btn btn-secondary" type="button">🗺 지도 보기</button>
          <button id="verseBtn" class="btn btn-ghost" type="button">📖 말씀 보기</button>
        </div>
      </article>

      <div class="nav-actions">
        <button id="prevBtn" class="btn btn-ghost" type="button" ${state.stopIndex === 0 ? 'disabled' : ''}>← 이전 장소</button>
        <button id="nextBtn" class="btn btn-primary" type="button">${current === total ? '여정 완료' : '다음 장소 →'}</button>
      </div>`;

    document.getElementById('mapBtn').addEventListener('click', () => showMaps(resolved));
    document.getElementById('verseBtn').addEventListener('click', () => showVerse(stop));
    document.getElementById('prevBtn').addEventListener('click', () => {
      if (state.stopIndex > 0) {
        state.stopIndex -= 1;
        renderStop();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      state.stopIndex += 1;
      renderStop();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function preferredUrl(link) {
    return link.preferred_url || link.official_url || link.primary_url || link.map_url || link.alternate_url || '';
  }

  function uniqueMaps(placeId) {
    const links = state.linksByPlace.get(placeId) || [];
    const seen = new Set();
    return links.filter(link => {
      const url = preferredUrl(link);
      const key = `${link.map_id}|${url}`;
      if (!url || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => safeText(a.map_id).localeCompare(safeText(b.map_id)));
  }

  function showMaps(resolved) {
    const maps = uniqueMaps(resolved.id);
    mapDialogTitle.textContent = resolved.name;

    if (!maps.length) {
      const fallbackMaps = resolved.place?.bsk_map_urls || [];
      mapOptions.innerHTML = fallbackMaps.length
        ? fallbackMaps.map(m => mapAnchor(m.map_title, m.primary_url || m.url || m.alternate_url, m.map_id)).join('')
        : `<div class="empty">이 장소에 연결된 지도가 없습니다.</div>`;
    } else {
      mapOptions.innerHTML = maps.map(m =>
        mapAnchor(m.map_title || m.map_id, preferredUrl(m), m.map_id)
      ).join('');
    }
    mapDialog.showModal();
  }

  function mapAnchor(title, url, id) {
    return `<a class="map-link" href="${safeText(url)}" target="_blank" rel="noopener noreferrer">
      <strong>🗺 ${safeText(title, '지도 보기')}</strong>
      <small>${safeText(id)} · 새 창에서 열림</small>
    </a>`;
  }

  function showVerse(stop) {
    if (stop.bibleUrl) {
      window.open(stop.bibleUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    alert(`${safeText(stop.verse, '대표 성경구절')}\n\n성경읽기 연결 URL은 각 여정 JSON의 bibleUrl 필드에 추가할 수 있습니다.`);
  }

  function renderComplete() {
    state.screen = 'complete';
    setHeader('여정 완료', true, true);
    const title = state.currentJourney?.title || state.currentJourneyMeta?.title || '성경여정';
    main.innerHTML = `
      <section class="complete">
        <div class="emoji">🏁</div>
        <h1>여정 완료</h1>
        <p><strong>${safeText(title)}</strong>을<br>끝까지 탐험했습니다.</p>
        <div class="secondary-row">
          <button id="restartBtn" class="btn btn-secondary" type="button">처음부터</button>
          <button id="listBtn" class="btn btn-primary" type="button">여정 목록</button>
        </div>
      </section>`;
    document.getElementById('restartBtn').addEventListener('click', () => {
      state.stopIndex = 0;
      state.screen = 'viewer';
      renderStop();
    });
    document.getElementById('listBtn').addEventListener('click', () => renderJourneyList(state.currentJourneyMeta?.group || state.group || 'ALL'));
  }

  function goBack() {
    if (state.screen === 'viewer' || state.screen === 'complete') {
      renderJourneyList(state.currentJourneyMeta?.group || state.group || 'ALL', false);
      return;
    }
    if (state.screen === 'list') {
      renderHome(false);
      return;
    }
    renderHome(false);
  }

  backBtn.addEventListener('click', goBack);
  homeBtn.addEventListener('click', () => renderHome(false));
  document.getElementById('closeMapDialog').addEventListener('click', () => mapDialog.close());
  document.getElementById('closeGuideDialog').addEventListener('click', () => guideDialog.close());

  window.addEventListener('popstate', () => goBack());

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.add('hidden');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(console.error);
    });
  }

  boot();
})();
