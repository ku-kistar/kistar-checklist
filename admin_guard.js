/*
 * admin_guard.js — 직원(「관리자」 탭 권한이 「전체」가 아닌 사람)에게 권한 있는 화면만 보이게 한다.  (2026-10-20 · T94)
 *
 *  ① 관리자 화면 안의 바로가기 링크 중 권한 없는 화면으로 가는 것은 숨긴다 (나중에 그려지는 링크도 감시)
 *  ② 권한 없는 관리자 화면을 주소로 직접 열면 안내만 띄우고 대문으로 돌려보낸다
 *  「전체」(이지연)와 학생·로그인 전에는 아무것도 하지 않는다.
 *  데이터는 서버(데이터허브 GAS SubAuth.gs 관문)가 따로 거절한다 — 이 파일은 화면 표시용이다.
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
    'calendar.html':            '전체'
  };

  var auth = null;
  try { auth = JSON.parse(localStorage.getItem('kistar_auth_url2') || 'null'); } catch (e) {}
  var perms = auth && auth.isAdmin && auth.perms;
  if (!perms || !perms.length || perms.indexOf('전체') > -1) return;   // 이지연 · 학생 · 예전 로그인 → 손대지 않음

  function pageOf(href) {
    try { return new URL(href, location.href).pathname.split('/').pop() || 'index.html'; } catch (e) { return ''; }
  }
  function can(page) {
    var need = PAGE_PERM[page];
    return need === undefined || perms.indexOf(need) > -1;
  }
  window.ADMIN_CAN = can;

  // ② 권한 없는 화면에 직접 들어온 경우 (교과목허브는 조교·교수 로그인이 따로 있어 제외)
  var here = pageOf(location.href);
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
