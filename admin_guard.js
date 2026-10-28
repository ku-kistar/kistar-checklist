/*
 * admin_guard.js — 직원(「관리자」 탭 권한이 「전체」가 아닌 사람)에게 권한 있는 화면만 보이게 한다.  (2026-10-20 · T94)
 *
 *  ① 관리자 화면 안의 바로가기 링크 중 권한 없는 화면으로 가는 것은 숨긴다 (나중에 그려지는 링크도 감시)
 *  ② 권한 없는 관리자 화면을 주소로 직접 열면 안내만 띄우고 대문으로 돌려보낸다
 *  「전체」(이지연)와 학생·로그인 전에는 아무것도 하지 않는다.
 *  데이터는 서버(데이터허브 GAS SubAuth.gs 관문)가 따로 거절한다 — 이 파일은 화면 표시용이다.
 *
 *  ▸ T98 · T99 (2026-10-20 · 데이터허브 GAS v131)
 *    ③ 내려받기 버튼 = data-dl 속성이 붙은 버튼 (엑셀·CSV·docx·인쇄·명단 복사)
 *       권한 「내려받기」 없는 직원 → 버튼 숨김 · 눌러도 막음 · 인쇄 화면은 빈 종이
 *    ④ 기록 — 내려받기·인쇄를 누르면 서버(adminEvent)에 한 줄 → 「관리자접근로그」 탭 (선임님 포함 전원)
 *       서버가 열람을 따로 남기지 않는 화면(LOG_VIEW)은 열 때 「열람」 한 줄
 *       기록이 실패해도 내려받기는 그대로 된다 (「전체」·「내려받기」 권한자)
 *
 *  새 관리자 화면을 만들면 아래 PAGE_PERM 에 「파일명 : 권한 이름」 한 줄을 넣는다.
 *  권한 이름 = 데이터허브 시트 「관리자」 탭 C열에 쓰는 이름 (SubAuth.gs SEC_SCREENS 키).
 *  '전체' = 이지연만. 목록에 없는 화면(대문 · 학생 현황판 · 배점 기준표 · 체크리스트)은 누구나.
 */
(function () {
  var PAGE_PERM = {
    'admin_mileage.html':       '마일리지대시보드',
    'admin_board.html':         '활동현황',
    'admin_progress.html':      '이수현황',
    'admin.html':               '성적입력',
    'admin_curriculum.html':    '개설과목',
    'admin_schedule.html':      '일정조사',
    'admin_bulk_pdf.html':      '서류조회',
    'admin_mileage_input.html': '마일리지입력',   // T46 비교과 담당자 입력 화면 (만들면 자동 적용)
    'hub_course.html':          '교과목허브',
    'calendar.html':            '전체',
    'admin_staff.html':         '전체',           // T97 권한 관리 (2026-10-20)
    'admin_ext_judge.html':     '외부마일리지',   // T115 외부마일리지 판정도구 (2026-10-24 — 내 PC 파일 → 대문 연결)
    'admin_cert.html':          '전체'            // T130 과정 이수 처리 · 수료증 (2026-10-28 — 직인 사용이라 「전체」만)
  };

  var EXEC_URL = 'https://script.google.com/macros/s/AKfycbz-RfQ4-4xNSY4TZS1Mx31qEogYpvKTRZ7aqQVV3csrUDCJlC6u05rNaCs7j-mlQPZo/exec';
  var DL_PAGES = { 'admin_board.html': 1, 'admin_progress.html': 1, 'admin_mileage.html': 1 };       // 내려받기 버튼이 있는 화면
  var LOG_VIEW = { 'admin_curriculum.html': 1, 'admin_bulk_pdf.html': 1, 'admin_staff.html': 1, 'admin_cert.html': 1 };    // 서버가 열람을 안 남기는 화면

  var auth = null;
  try { auth = JSON.parse(localStorage.getItem('kistar_auth_url2') || 'null'); } catch (e) {}
  if (!auth || !auth.isAdmin || !auth.perms || !auth.perms.length) return;   // 학생 · 로그인 전 · 예전 로그인 → 손대지 않음
  var perms = auth.perms;
  var full  = perms.indexOf('전체') > -1;
  var canDL = full || perms.indexOf('내려받기') > -1;

  function pageOf(href) {
    try { return new URL(href, location.href).pathname.split('/').pop() || 'index.html'; } catch (e) { return ''; }
  }
  var here = pageOf(location.href);

  // ④ 기록 — 실패해도 화면 동작에는 영향 없음
  function logEvent(kind, detail) {
    try {
      if (!/^\d{24}$/.test(String(auth.birth || ''))) return;     // 출입증이 아니면 서버가 어차피 거절
      var body = new URLSearchParams({ action: 'adminEvent', adminId: auth.studentId, adminBirth: auth.birth,
        kind: kind, page: here.replace(/\.html$/, ''), detail: detail || '', userAgent: navigator.userAgent || '' });
      fetch(EXEC_URL, { method: 'POST', body: body, credentials: 'omit', keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  window.ADMIN_LOG = logEvent;

  // ③ 내려받기 버튼 — 숨김(권한 없음) · 클릭 기록
  if (DL_PAGES[here] || LOG_VIEW[here]) {
    if (!canDL) {
      var st = document.createElement('style');
      st.textContent = '[data-dl]{display:none!important}@media print{body{visibility:hidden!important}}';
      (document.head || document.documentElement).appendChild(st);
    }
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-dl]') : null;
      if (!el) return;
      if (!canDL) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        logEvent('내려받기', el.getAttribute('data-dl') + ' (권한 없음)');
        return;
      }
      if (el.getAttribute('data-dl') !== '인쇄') logEvent('내려받기', el.getAttribute('data-dl'));
    }, true);
    window.addEventListener('beforeprint', function () { logEvent('내려받기', canDL ? '인쇄' : '인쇄 (권한 없음 · 빈 화면)'); });
  }
  function can(page) {
    if (full) return true;
    var need = PAGE_PERM[page];
    return need === undefined || perms.indexOf(need) > -1;
  }
  window.ADMIN_CAN = can;
  window.ADMIN_CAN_DL = canDL;

  // ④ 서버가 열람을 안 남기는 화면 — 들어올 수 있을 때만 「열람」 한 줄
  if (LOG_VIEW[here] && (full || can(here))) logEvent('열람', '');

  if (full) return;   // 「전체」(이지연) — 화면·링크 숨김 없음

  // ② 권한 없는 화면에 직접 들어온 경우 (교과목허브는 조교·교수 로그인이 따로 있어 제외)
  if (here !== 'hub_course.html' && !can(here)) {
    document.documentElement.style.visibility = 'hidden';
    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML =
        '<div style="max-width:420px;margin:90px auto;padding:30px;border:1px solid #dde3ec;border-radius:12px;' +
        'background:#fff;font-family:\'Pretendard\',\'Malgun Gothic\',sans-serif;text-align:center;color:#1a2535">' +
        '<div style="font-size:16px;font-weight:700;margin-bottom:8px">이 화면을 볼 권한이 없습니다</div>' +
        '<div style="font-size:13px;color:#5a6a7e;line-height:1.7;margin-bottom:18px">필요하면 담당자(이지연)에게 문의해 주세요.</div>' +
        '<a href="portal_survey.html" style="display:inline-block;padding:9px 18px;border-radius:8px;background:#1e4d8c;' +
        'color:#fff;font-size:13px;font-weight:700;text-decoration:none">데이터허브 대문으로</a></div>';
      document.body.style.background = '#f4f6f9';
      document.documentElement.style.visibility = '';
    });
    return;
  }

  // ① 바로가기 링크 숨김
  function hideLinks(root) {
    var list = (root || document).querySelectorAll ? (root || document).querySelectorAll('a[href]') : [];
    Array.prototype.forEach.call(list, function (a) {
      var h = a.getAttribute('href') || '';
      if (!/\.html/i.test(h)) return;
      if (!can(pageOf(a.href))) a.style.display = 'none';
    });
  }
  function start() {
    hideLinks(document);
    try {
      new MutationObserver(function (ms) {
        ms.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes || [], function (n) {
            if (n.nodeType !== 1) return;
            if (n.tagName === 'A') hideLinks(n.parentNode || document); else hideLinks(n);
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
