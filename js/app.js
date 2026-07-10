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
    transitionDirection: null,
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
  const routeDialog = document.getElementById('routeDialog');
  const routeDialogTitle = document.getElementById('routeDialogTitle');
  const routeList = document.getElementById('routeList');
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


  function stopPlaceName(stop) {
    return resolvePlace(stop).name;
  }

  function journeySummary(journey) {
    return safeText(
      journey.summary ||
      state.currentJourneyMeta?.summary ||
      state.currentJourneyMeta?.subtitle ||
      ''
    );
  }

  function timelineHtml(journey) {
    return journey.stops.map((stop, index) => {
      const status = index < state.stopIndex ? 'done' : index === state.stopIndex ? 'current' : 'upcoming';
      const arrow = index < journey.stops.length - 1 ? '<span class="timeline-arrow">→</span>' : '';
      return `
        <div class="timeline-stop ${status}">
          <button class="timeline-node" type="button" data-timeline-index="${index}" aria-label="${stopPlaceName(stop)}로 이동">
            <span class="dot" aria-hidden="true"></span>
            <span class="name">${safeText(stopPlaceName(stop))}</span>
          </button>
          ${arrow}
        </div>`;
    }).join('');
  }

  function bindTimeline() {
    main.querySelectorAll('[data-timeline-index]').forEach(button => {
      button.addEventListener('click', () => {
        const target = Number(button.dataset.timelineIndex);
        const direction = target >= state.stopIndex ? 'next' : 'prev';
        animateToStop(target, direction);
      });
    });

    const routeButton = document.getElementById('routeBtn');
    if (routeButton) routeButton.addEventListener('click', showRoute);

    requestAnimationFrame(() => {
      const current = main.querySelector('.timeline-stop.current .timeline-node');
      if (current) current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  function showRoute() {
    const journey = state.currentJourney;
    if (!journey) return;

    routeDialogTitle.textContent = journey.title || state.currentJourneyMeta?.title || '여정 경로';
    routeList.innerHTML = journey.stops.map((stop, index) => {
      const status = index < state.stopIndex ? 'done' : index === state.stopIndex ? 'current' : 'upcoming';
      return `
        <div class="route-item ${status}">
          <div class="route-index">${index + 1}</div>
          <div class="route-body">
            <button type="button" data-route-index="${index}">${safeText(stopPlaceName(stop))}</button>
            ${stop.label ? `<small>${safeText(stop.label)}</small>` : ''}
          </div>
        </div>`;
    }).join('');

    routeList.querySelectorAll('[data-route-index]').forEach(button => {
      button.addEventListener('click', () => {
        const target = Number(button.dataset.routeIndex);
        const direction = target >= state.stopIndex ? 'next' : 'prev';
        routeDialog.close();
        animateToStop(target, direction);
      });
    });

    routeDialog.showModal();
  }


  function animateToStop(nextIndex, direction) {
    const journey = state.currentJourney;
    if (!journey) return;
    if (nextIndex < 0 || nextIndex > journey.stops.length) return;

    const card = main.querySelector('.stop-card');
    if (!card) {
      state.stopIndex = nextIndex;
      state.transitionDirection = direction;
      renderStop();
      return;
    }

    card.classList.add(direction === 'next' ? 'page-out-left' : 'page-out-right');

    setTimeout(() => {
      state.stopIndex = nextIndex;
      state.transitionDirection = direction;
      renderStop();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 170);
  }

  function bindSwipeNavigation() {
    const card = main.querySelector('.stop-card');
    if (!card || !state.currentJourney) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    card.addEventListener('touchstart', event => {
      const touch = event.changedTouches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }, { passive: true });

    card.addEventListener('touchend', event => {
      if (!tracking) return;
      tracking = false;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.25) return;

      if (dx < 0) {
        const next = state.stopIndex + 1;
        if (next <= state.currentJourney.stops.length) animateToStop(next, 'next');
      } else {
        const prev = state.stopIndex - 1;
        if (prev >= 0) animateToStop(prev, 'prev');
      }
    }, { passive: true });
  }

  function applyEntryAnimation() {
    if (!state.transitionDirection) return;
    const card = main.querySelector('.stop-card');
    if (card) {
      card.classList.add(state.transitionDirection === 'next' ? 'page-in-left' : 'page-in-right');
      setTimeout(() => {
        card.classList.remove('page-in-left', 'page-in-right');
      }, 250);
    }
    state.transitionDirection = null;
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
        ${journeySummary(journey) ? `<p class="journey-summary">${journeySummary(journey)}</p>` : ''}
      </div>

      <section class="timeline-wrap" aria-label="여정 진행 현황">
        <div class="timeline-head">
          <strong>여정 진행 현황 <span class="current-mark">${current} / ${total}</span></strong>
          <button id="routeBtn" class="route-btn" type="button">전체 경로 보기</button>
        </div>
        <div class="timeline-scroll">
          <div class="timeline-track">${timelineHtml(journey)}</div>
        </div>
      </section>

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
      </div>
      <div class="swipe-hint">← 좌우로 밀어 장소 이동 →</div>
      <div class="swipe-dots" aria-hidden="true">
        ${journey.stops.map((_, i) => `<span class="swipe-dot ${i === state.stopIndex ? 'active' : ''}"></span>`).join('')}
      </div>`;

    document.getElementById('mapBtn').addEventListener('click', () => showMaps(resolved));
    document.getElementById('verseBtn').addEventListener('click', () => showVerse(stop));
    document.getElementById('prevBtn').addEventListener('click', () => {
      if (state.stopIndex > 0) animateToStop(state.stopIndex - 1, 'prev');
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      animateToStop(state.stopIndex + 1, 'next');
    });

    bindTimeline();
    bindSwipeNavigation();
    applyEntryAnimation();
  }

  const arr = value => Array.isArray(value) ? value : (value == null ? [] : [value]);
  const norm = value => safeText(value).toLowerCase().replace(/\s+/g, '').trim();
  const uniqByMap = links => {
    const seen = new Set();
    return links.filter(link => {
      const key = `${safeText(link.map_id)}|${linkUrl(link)}`;
      if (!linkUrl(link) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  function linkUrl(link) {
    return link?.preferred_url || link?.map_url || link?.alternate_url ||
      link?.primary_url || link?.official_url || '';
  }

  function isGoogleUrl(url) {
    return /(^https?:\/\/)?(www\.)?google\.[^/]+\/maps|google\.com\/maps/i.test(String(url || ''));
  }

  function directLinks(links) {
    return arr(links).filter(link => {
      const url = linkUrl(link);
      return [
        'direct_visible_on_bsk_map',
        'external_user_provided_map',
        'external_direct_map',
        'external_representative_map'
      ].includes(String(link.link_type || '')) && url && !isGoogleUrl(url);
    });
  }

  function linkPriority(link, resolved) {
    const place = resolved.place || {};
    const name = norm(resolved.name || place.official_name || place.canonical_name);
    const labels = arr(link.map_labels).map(norm);
    const title = norm(link.map_title);
    let score = 0;

    if (
      link?.user_provided_url === true ||
      String(link?.source || '') === 'user_260704' ||
      link?.representative === true
    ) score += 100000 + Number(link?.priority || 0);

    if (labels.some(label => label === name)) score += 1000;
    else if (labels.some(label => label.includes(name) || name.includes(label))) score += 600;

    if (link.alternate_url || String(link.preferred_url || '').includes('cms.ibep-prod.com')) score += 180;
    if (title.includes(name)) score += 120;

    if (/바울|여행|선교|예수|예루살렘|엘리야|엘리사|여호수아|전투/.test(String(link.map_title || ''))) score += 90;
    if (/세계|경계|지파|왕국|제국|시대|팔레스타인/.test(String(link.map_title || ''))) score -= 70;

    return score;
  }

  function trustedVisibleLinksForPlace(resolved) {
    const place = resolved.place || {};
    const all = directLinks(state.linksByPlace.get(resolved.id) || [])
      .sort((a, b) =>
        linkPriority(b, resolved) - linkPriority(a, resolved) ||
        safeText(a.map_id).localeCompare(safeText(b.map_id), 'ko')
      );

    const name = norm(resolved.name || place.official_name || place.canonical_name);
    const aliasKeys = [
      name,
      ...arr(place.aliases).map(norm),
      ...arr(place.search_keywords).map(norm)
    ].filter(Boolean);

    const userProvided = all.filter(link =>
      link?.user_provided_url === true ||
      String(link?.source || '').includes('user') ||
      String(link?.link_type || '').startsWith('external') ||
      String(link?.url_policy || '').includes('always_use_user_provided') ||
      link?.representative === true
    );

    let visible = all.filter(link => {
      const labels = arr(link.map_labels).map(norm).filter(Boolean);
      return labels.some(label => aliasKeys.some(key => label === key || label.includes(key)));
    });

    visible = uniqByMap([...userProvided, ...visible]);

    // CEN BibleMaps의 현재 운영 원칙:
    // 실제 표기가 확인된 링크가 하나도 없으면 임의의 범용지도를 보여주지 않습니다.
    const genericTitle = link =>
      /세계|경계|지파|왕국|제국|시대|팔레스타인/.test(String(link.map_title || ''));

    const specific = visible.filter(link => !genericTitle(link));
    if (specific.length) visible = specific;

    return visible;
  }

  function showMaps(resolved) {
    // BibleMaps 검색 결과와 동일한 판정 로직을 사용하고,
    // Journey에서는 가장 우선순위가 높은 지도 1개만 엽니다.
    const link = trustedVisibleLinksForPlace(resolved)[0];

    if (!link) {
      mapDialogTitle.textContent = resolved.name;
      mapOptions.innerHTML = `
        <div class="empty">
          해당 지명이 실제 표기된 지도를 찾지 못했습니다.<br>
          표기 확인이 안 된 지도는 표시하지 않습니다.
        </div>`;
      mapDialog.showModal();
      return;
    }

    window.open(linkUrl(link), '_blank', 'noopener,noreferrer');
  }

  function mapAnchor(title, url, id) {
    return `<a class="map-link" href="${safeText(url)}" target="_blank" rel="noopener noreferrer">
      <strong>🗺 ${safeText(title, '지도 보기')}</strong>
      <small>${safeText(id)} · 새 창에서 열림</small>
    </a>`;
  }

  function showVerse(stop) {
    const ref = safeText(stop.bibleRef || stop.verse, '').trim();
    if (!ref) {
      alert('연결할 대표 성경구절이 없습니다.');
      return;
    }

    const base = 'https://centiger.github.io/CEN-Bible2.0/';
    const url = stop.bibleUrl || `${base}?ref=${encodeURIComponent(ref)}&source=journey`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
  document.getElementById('closeRouteDialog').addEventListener('click', () => routeDialog.close());

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
