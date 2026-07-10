/*
 CEN Bible 2.0 - Journey deep-link patch
 사용 URL 예: https://centiger.github.io/CEN-Bible2.0/?ref=창세기%2012:1~4
 index.html의 기존 본문 스크립트 뒤, </body> 직전에 아래 한 줄을 추가하세요.
 <script src="./journey-deeplink.js"></script>
*/
(() => {
  'use strict';

  const BOOK_ALIASES = {
    '창':'창세기','출':'출애굽기','레':'레위기','민':'민수기','신':'신명기',
    '수':'여호수아','삿':'사사기','룻':'룻기','삼상':'사무엘상','삼하':'사무엘하',
    '왕상':'열왕기상','왕하':'열왕기하','대상':'역대상','대하':'역대하',
    '스':'에스라','느':'느헤미야','에':'에스더','욥':'욥기','시':'시편',
    '잠':'잠언','전':'전도서','아':'아가','사':'이사야','렘':'예레미야',
    '애':'예레미야애가','겔':'에스겔','단':'다니엘','호':'호세아','욜':'요엘',
    '암':'아모스','옵':'오바댜','욘':'요나','미':'미가','나':'나훔','합':'하박국',
    '습':'스바냐','학':'학개','슥':'스가랴','말':'말라기',
    '마':'마태복음','막':'마가복음','눅':'누가복음','요':'요한복음',
    '행':'사도행전','롬':'로마서','고전':'고린도전서','고후':'고린도후서',
    '갈':'갈라디아서','엡':'에베소서','빌':'빌립보서','골':'골로새서',
    '살전':'데살로니가전서','살후':'데살로니가후서','딤전':'디모데전서',
    '딤후':'디모데후서','딛':'디도서','몬':'빌레몬서','히':'히브리서',
    '약':'야고보서','벧전':'베드로전서','벧후':'베드로후서',
    '요일':'요한일서','요이':'요한이서','요삼':'요한삼서','유':'유다서','계':'요한계시록'
  };

  function parseRef(raw) {
    const cleaned = decodeURIComponent(raw || '')
      .replace(/[－–—]/g, '-')
      .replace(/[∼～]/g, '~')
      .replace(/\s+/g, ' ')
      .trim();

    const match = cleaned.match(/^(.+?)\s*(\d+)\s*:\s*(\d+)(?:\s*[~\-]\s*(\d+))?/);
    if (!match) return null;

    const rawBook = match[1].trim();
    return {
      book: BOOK_ALIASES[rawBook] || rawBook,
      chapter: Number(match[2]),
      verse: Number(match[3]),
      endVerse: Number(match[4] || match[3]),
      original: cleaned
    };
  }

  function findVerseElement(verse) {
    const selectors = [
      `.verse[data-verse="${verse}"]`,
      `.verse[data-v="${verse}"]`,
      `.verse[data-num="${verse}"]`,
      `#verse-${verse}`,
      `#v${verse}`
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    const verses = [...document.querySelectorAll('.verse')];
    return verses.find(el => {
      const n = el.querySelector('.vnum');
      return n && Number((n.textContent || '').replace(/\D/g, '')) === verse;
    }) || null;
  }

  async function openReference(ref) {
    // CEN Bible 2.0의 전역 state/loadChapter 구조를 사용합니다.
    if (typeof window.state === 'undefined' || typeof window.loadChapter !== 'function') {
      setTimeout(() => openReference(ref), 300);
      return;
    }

    window.state.book = ref.book;
    window.state.chap = ref.chapter;

    if (typeof window.saveSlots === 'function') {
      try { window.saveSlots(); } catch (_) {}
    }

    await window.loadChapter(false);

    setTimeout(() => {
      const el = findVerseElement(ref.verse);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('selected');
        setTimeout(() => el.classList.remove('selected'), 2600);
      }
    }, 250);
  }

  window.addEventListener('load', () => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('ref');
    if (!raw) return;

    const ref = parseRef(raw);
    if (!ref) return;

    // 기존 init이 끝날 시간을 조금 둡니다.
    setTimeout(() => openReference(ref), 700);
  });
})();
