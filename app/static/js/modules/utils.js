/**
 * Common Utilities & String Formatting
 */

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const esc = escapeHtml(text);
    const re  = new RegExp(escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return esc.replace(re, m => `<mark>${m}</mark>`);
}

/** 조건식을 단축·정리하여 읽기 쉽게 변환 */
export function formatConditionShort(cond) {
    if (!cond || cond === 'Always' || cond === 'None') return null;
    let s = cond;

    // engine. 접두사 제거
    s = s.replace(/\bengine\./g, '');

    // operator.X → 기호/단어 (가독성 높은 표준 기호 사용)
    s = s.replace(/\boperator\.isinrangelist\b/g,       'in-range');
    s = s.replace(/\boperator\.isinlist\b/g,             'in-list');
    s = s.replace(/\boperator\.equals\b/g,               '==');
    s = s.replace(/\boperator\.lesstan\b/g,              '<');
    s = s.replace(/\boperator\.lessthan\b/g,             '<');
    s = s.replace(/\boperator\.greaterthan\b/g,          '>');
    s = s.replace(/\boperator\.lessthanorequal\b/g,      '<=');
    s = s.replace(/\boperator\.greaterthanorequal\b/g,   '>=');
    s = s.replace(/\boperator\.contains\b/g,             'contains');
    s = s.replace(/\boperator\.doesnotcontain\b/g,       'not-contains');
    s = s.replace(/\boperator\.startswith\b/g,           'starts-with');
    s = s.replace(/\boperator\.endswith\b/g,             'ends-with');
    s = s.replace(/\boperator\.matches\b/g,              'matches');
    s = s.replace(/\boperator\.notequals?\b/g,           '!=');
    s = s.replace(/\boperator\.\w+/g,                    m => m.replace('operator.', 'op:'));

    // "= type.boolean.true" → 제거
    s = s.replace(/\s*==\s*"type\.boolean\.true"/g, '');

    // 모듈 경로 단축
    s = s.replace(/\bdatetimefilter\.time\./g,     '');
    s = s.replace(/\bstringfilter\.string\./g,     '');
    s = s.replace(/\bheaderfilter\.headers\./g,    'header.');
    s = s.replace(/\bsystem\.url\./g,              'url.');
    s = s.replace(/\bsystem\.client\./g,           'client.');
    s = s.replace(/\bsystem\.request\./g,          'req.');
    s = s.replace(/\bsystem\.response\./g,         'res.');
    s = s.replace(/\bnetwork\./g,                  'net.');

    // timeinrangeiso(...) → [YYYY-MM-DD ~ YYYY-MM-DD]
    s = s.replace(/timeinrangeiso\s*\(\s*"(\d{4}-\d{2}-\d{2})[^"]*"\s*,\s*"(\d{4}-\d{2}-\d{2})[^"]*"\s*\)/gi,
        '[$1 ~ $2]');

    // 소문자 and/or → 대문자
    s = s.replace(/\band\b/g, 'AND').replace(/\bor\b/g, 'OR');

    return s.trim();
}

/** 포맷된 조건식에 HTML 구문 색상 적용 */
export function colorCondition(text, query = '') {
    if (!text || text === 'Always' || text === 'None') return text || '';
    
    // 1. 먼저 안전하게 이스케이프
    let s = escapeHtml(text);

    // 2. 이스케이프된 상태에서 구문 강조용 태그 삽입
    // 논리 연산자
    s = s.replace(/(^|[\s\(\)])(AND|OR|NOT)(?=$|[\s\(\)])/g, '$1<span class="cond-logic">$2</span>');
    
    // 비교 연산자 (이미 이스케이프된 연산자 포함 처리)
    const ops = ['==', '!=', '&lt;=', '&gt;=', '&lt;', '&gt;', 'in-range', 'in-list', 'contains', 'not-contains', 'starts-with', 'ends-with', 'matches'];
    ops.forEach(op => {
        const re = new RegExp(`(\\s)(${op})(\\s)`, 'g');
        s = s.replace(re, '$1<span class="cond-op">$2</span>$3');
    });

    // 함수명
    s = s.replace(/(\b\w[\w.]+)\s*(?=\()/g, '<span class="cond-fn">$1</span>');
    
    // 값 (따옴표 포함된 문자열) - &quot; 고려
    s = s.replace(/(&quot;.*?&quot;)/g, '<span class="cond-val">$1</span>');

    // 3. 검색어 하이라이트 (HTML 태그를 건드리지 않는 정규식 사용)
    if (query) {
        const qEsc = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${qEsc})(?![^<]*>)`, 'gi');
        s = s.replace(re, '<mark>$1</mark>');
    }

    return s;
}

/** 조건식에서 만료일 정보 추출 */
export function detectExpiry(cond) {
    if (!cond) return null;
    const m = cond.match(/timeinrangeiso\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/i);
    if (!m) return null;

    const startDate = new Date(m[1]);
    const endDate   = new Date(m[2]);
    if (isNaN(endDate)) return null;

    const now      = new Date();
    const daysLeft = Math.ceil((endDate - now) / 86400000);

    return {
        startDate, endDate, daysLeft,
        expired:      endDate < now,
        expiringSoon: daysLeft >= 0 && daysLeft <= 30
    };
}
