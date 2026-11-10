"""학수번호 코드집 대조 검사 — admin.html · pg_rules.js (2026-11-10 신설)

check_course_map.py 는 「번호가 화면의 몇 번째 줄을 가리키는가」만 본다.
이 스크립트는 번호 자체를 KUPID 코드집과 맞춘다. 둘 다 통과해야 올린다.

    python check_codes.py 코드집.xlsx
      코드집 = KUPID [학부]교과목코드집조회 → 폐지과목 「포함」 → 조회 → 엑셀
      (폐지 제외본이면 옛 번호 AMSE 등이 「없음」으로 나온다)

실패 조건 (exit 1)
  - 코드집에 없는 번호          (인제대 312KISE·313KISE 는 예외)
  - 번호의 과목명 ≠ 화면 과목명
  - 학부인정 학점 ≠ 코드집 학점  (1·2학점 과목을 3학점으로 세던 오류)
경고만
  - 화면 과목과 이름이 같은 같은 학과 번호가 맵에 없음 (옛 번호 누락 후보)
"""
import json, re, subprocess, sys
import openpyxl

INJE = {'312KISE', '313KISE'}
DEPTS = {'신소재공학부', '전기전자공학부', '화공생명공학과', '기계공학부', '물리학과', '차세대반도체융합전공'}
TRACK = {'socha': ['고급AI반도체소자', 'ASIC설계', '인공지능물리학'],
         'gongjeong': ['고급AI반도체공정및응용', '반도체프로세스', '디지털집적회로'],
         'sojai': ['AI반도체신소재개론', '반도체재료', '나노전자공학']}
FIX = {'ai': 'AI반도체개론', 'gd1': '반도체공정실습', 'gd2': '진공장비실습', 'gd3': '반도체머신러닝',
       'pkg1': '반도체패키징1', 'pkg2': '반도체패키징2', 'pbl1': 'PBL산학프로젝트1', 'pbl2': 'PBL산학프로젝트2',
       'col1': '차세대반도체콜로키움1', 'col2': '차세대반도체콜로키움2'}


def norm(s):
    s = re.sub(r'\(영강\)|\([^)]*\)', '', str(s or ''))
    for a, b in [('Ⅲ', '3'), ('Ⅱ', '2'), ('Ⅰ', '1'), ('III', '3'), ('II', '2')]:
        s = s.replace(a, b)
    s = re.sub(r'I(?![a-zA-Z])', '1', s)
    return re.sub(r'[\s·및\-]', '', s)


def load_book(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows[:10]) if r and '학수번호' in [str(c).strip() for c in r if c])
    h = [str(c).strip() if c else '' for c in rows[hi]]
    col = lambda name: next(i for i, x in enumerate(h) if x == name)
    ic, inm, icr, idp = col('학수번호'), col('교과목명'), col('학점'), col('학과명')
    book = {}
    for r in rows[hi + 1:]:
        if r[ic]:
            book.setdefault(str(r[ic]).strip(), []).append((r[inm], str(r[icr]), r[idp]))
    return book


def load_maps():
    js = r"""
const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('admin.html','utf8');
function grab(n){const i=h.indexOf('const '+n);let j=h.indexOf('{',i),d=0,k=j;for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return h.slice(j,k+1);}
const c={};vm.createContext(c);for(const n of ['COURSE_CODE_MAPS','RECOG_DATA','FREE_DATA'])vm.runInContext(n+'='+grab(n),c);
vm.runInContext(fs.readFileSync('pg_rules.js','utf8')+';this.CAT=CAT;',c);
console.log(JSON.stringify({M:c.COURSE_CODE_MAPS,R:c.RECOG_DATA,F:c.FREE_DATA,CAT:c.CAT}));"""
    return json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)


def main():
    book = load_book(sys.argv[1])
    d = load_maps()
    want = []   # (출처, 학과, 번호, 화면 과목명, 학점 or None)
    for dept, m in d['M'].items():
        F = d['F'][dept]
        R = {r['name'].replace(' ', ''): r.get('credit', 3) for r in d['R'][dept]}
        for code, i in m.items():
            a, cr = i['action'], None
            if a == 'recog':
                w = i['name']
                cr = next((v for n, v in R.items() if w.replace(' ', '') in n), None)
            elif a == 'free':
                w = F['self'][i['freeIndex']]['name']
            elif a == 'crossFree':
                w = F['cross'][i['crossIndex']]['name']
            elif a == 'track':
                w = {'row-bando': '반도체재료', 'row-digital': '디지털집적회로'}.get(i.get('rowId')) or TRACK[i['track']][i['rowIndex']]
            else:
                w = FIX[i.get('key') or i.get('id') or 'ai']
            want.append(('admin', dept, code, w, cr))
    for dept, rows in d['CAT'].items():
        for r in rows:
            for code in r['codes']:
                want.append(('pg_rules', dept, code, r['ui'], None))

    fail = []
    for src, dept, code, w, cr in want:
        if code in INJE:
            continue
        rs = book.get(code)
        if not rs:
            fail.append(f'[없음]   {src} {dept} {code} ({w}) — 코드집에 없는 번호')
            continue
        if not any(norm(n) == norm(w) for n, _, _ in rs):
            fail.append(f'[이름]   {src} {dept} {code} 화면「{w}」 ≠ 코드집「{"/".join(str(n) for n, _, _ in rs)}」')
        if cr is not None and not any(c == str(cr) for _, c, _ in rs):
            fail.append(f'[학점]   {src} {dept} {code} 화면 {cr}학점 ≠ 코드집 {"/".join(c for _, c, _ in rs)}학점')

    # 옛 번호 누락 후보 (경고)
    mapped = {c for _, _, c, _, _ in want}
    names = {norm(w) for _, _, _, w, _ in want}
    warn = sorted({f'{c} {n} ({dp})' for c, rs in book.items() for n, _, dp in rs
                   if dp in DEPTS and norm(n) in names and c not in mapped})

    print(f'검사 {len(want)}건 · 실패 {len(fail)}건 · 누락 후보 {len(warn)}건')
    for x in sorted(set(fail)):
        print('  ' + x)
    if warn:
        print('  [경고] 화면 과목과 이름이 같은데 맵에 없는 번호 — 2019년 이전 폐지분은 무시해도 됨')
        for x in warn:
            print('    ' + x)
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
