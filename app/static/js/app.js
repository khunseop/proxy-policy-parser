// ─── Global State ─────────────────────────────────────────────────────────────
let currentSetId   = null;
let objectsMap     = {};   // list_id -> { name, type, entries[] }
let objectsNameToId= {};   // list_name -> list_id
let activeListId   = null;
let currentTab     = 'policies';
let currentPath    = '';   // currently browsed policy parent-path
let isSearchMode   = false;
let selectedPk     = null; // _pk_auto of selected policy row
let listRefPolicies= [];
let searchTimer    = null;
let currentViewData= [];   // currently displayed policy nodes (for CSV export)

let listSearchMode  = 'name';   // 'name' | 'value'
let listSearchTimer = null;

let statsData       = [];
let statsSortedData = [];
let statsSortCol    = 'policy_count';
let statsSortDir    = 'desc';
let policyStats     = null;

// Diff 상태
let diffData        = null;   // 마지막 diff 결과
let diffSetA        = null;   // 비교 A set_id
let diffSetB        = null;   // 비교 B set_id
let diffSection     = null;   // 현재 섹션: 'pol_added'|'pol_removed'|'pol_changed'|'lst_added'|'lst_removed'|'lst_changed'

// ─── Init ─────────────────────────────────────────────────────────────────────
window.onload = () => { loadHistory(); initResizers(); };

// ─── Utilities ────────────────────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const esc = escapeHtml(text);
    const re  = new RegExp(escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return esc.replace(re, m => `<mark>${m}</mark>`);
}

function setStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
}

function setLoading(active, msg = '') {
    document.getElementById('xml-upload-btn').disabled   = active;
    document.getElementById('history-select').disabled   = active;
    setStatus(active ? msg : '준비됨');
}

// ─── History & Upload ─────────────────────────────────────────────────────────
async function loadHistory() {
    try {
        const res  = await fetch('/api/v1/history');
        const list = await res.json();
        const sel  = document.getElementById('history-select');
        sel.innerHTML = '<option value="">정책 선택...</option>';
        list.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.upload_time} · ${s.filename}`;
            sel.appendChild(opt);
        });
    } catch (err) { console.error('히스토리 로드 실패:', err); }
}

async function loadObjects(setId) {
    const res  = await fetch(`/api/v1/objects/${setId}`);
    const objs = await res.json();
    objectsMap      = {};
    objectsNameToId = {};
    objs.forEach(obj => {
        const id = obj.list_id;
        if (!objectsMap[id]) {
            objectsMap[id] = { name: obj.list_name, type: obj.list_type_id, entries: [] };
            if (obj.list_name) objectsNameToId[obj.list_name] = id;
        }
        if (obj.entry_value) {
            objectsMap[id].entries.push({
                value:   obj.entry_value,
                type:    obj.entry_type || 'default',
                details: obj.entry_details || ''
            });
        }
    });
}

async function handleSetChange() {
    currentSetId  = document.getElementById('history-select').value;
    isSearchMode  = false;
    currentPath   = '';
    selectedPk    = null;
    statsData     = [];
    policyStats   = null;
    closeDetail();
    clearSearchInput();

    if (!currentSetId) {
        document.getElementById('sidebar-body').innerHTML = '<div class="sidebar-placeholder">정책을 선택하세요.</div>';
        document.getElementById('main-body').innerHTML    = '<div class="empty-state">정책을 선택하거나 업로드하세요.</div>';
        document.getElementById('policy-stats').textContent = '';
        objectsMap = {};
        return;
    }

    setLoading(true, '로딩 중...');
    try {
        await loadObjects(currentSetId);
        currentTab = 'policies';
        document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'policies'));
        showPoliciesTab();
    } finally {
        setLoading(false);
    }
}

async function handleDeleteCurrentSet() {
    const id = document.getElementById('history-select').value;
    if (!id) { alert('삭제할 정책 이력을 먼저 선택해주세요.'); return; }
    if (!confirm('현재 선택된 정책 이력을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/v1/history/${id}`, { method: 'DELETE' });
        if (res.ok) { await loadHistory(); handleSetChange(); }
    } catch (err) { alert('삭제 실패: ' + err.message); }
}

async function handleClearAllHistory() {
    if (!confirm('모든 정책 히스토리를 초기화하시겠습니까? 복구할 수 없습니다.')) return;
    try {
        const res = await fetch('/api/v1/history', { method: 'DELETE' });
        if (res.ok) { await loadHistory(); handleSetChange(); }
    } catch (err) { alert('초기화 실패: ' + err.message); }
}

async function handleFileUpload() {
    const input = document.getElementById('xml-upload');
    if (!input.files.length) return;
    const fd = new FormData();
    fd.append('file', input.files[0]);
    setLoading(true, 'XML 파싱 중...');
    try {
        const res = await fetch('/api/v1/upload', { method: 'POST', body: fd });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.statusText); }
        const result = await res.json();
        currentSetId = result.set_id;
        await loadHistory();
        document.getElementById('history-select').value = currentSetId;
        await loadObjects(currentSetId);
        statsData = [];
        showPoliciesTab();
        setStatus('업로드 완료');
        setTimeout(() => { if (document.getElementById('status-msg')?.textContent === '업로드 완료') setStatus('준비됨'); }, 2000);
    } catch (err) {
        setStatus('오류: ' + err.message);
    } finally {
        input.value = '';
        document.getElementById('xml-upload-btn').disabled = false;
    }
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'policies')  showPoliciesTab();
    else if (tab === 'lists') showListsTab();
    else if (tab === 'stats') showStatsTab();
    else if (tab === 'diff')  showDiffTab();
}

function showPoliciesTab() {
    document.getElementById('main-toolbar').style.display = 'flex';
    if (!currentSetId) {
        document.getElementById('sidebar-body').innerHTML = '<div class="sidebar-placeholder">정책을 선택하세요.</div>';
        document.getElementById('main-body').innerHTML    = '<div class="empty-state">정책을 선택하거나 업로드하세요.</div>';
        return;
    }
    renderPolicySidebar();
    if (!isSearchMode) loadAllPolicies();
}

function showListsTab() {
    document.getElementById('main-toolbar').style.display = 'none';
    renderListsSidebar('');
    if (listSearchMode === 'name') {
        if (activeListId && objectsMap[activeListId]) showListEntries(activeListId, '');
        else document.getElementById('main-body').innerHTML = '<div class="empty-state">왼쪽에서 List를 선택하세요.</div>';
    }
}

function showStatsTab() {
    document.getElementById('main-toolbar').style.display = 'none';
    renderStatsSidebar();
    loadStatsData();
}

// ─── Policy Sidebar Tree ──────────────────────────────────────────────────────
function renderPolicySidebar() {
    const body = document.getElementById('sidebar-body');
    body.innerHTML = '';

    const searchDiv = document.createElement('div');
    searchDiv.className = 'sidebar-search';
    searchDiv.innerHTML = `
        <input type="text" placeholder="트리 검색..." oninput="handleSidebarSearch(this.value)">
        <button class="btn sm" style="width:100%;margin-top:5px;color:#c0392b;border-color:#f5c6c6;"
                onclick="findExpiredPolicies()">⏰ 만료/임박 정책 찾기</button>
    `;
    body.appendChild(searchDiv);

    const root = document.createElement('div');
    root.id = 'policy-tree-root';
    body.appendChild(root);

    loadTreeLevel('', root, 0);
}

async function loadTreeLevel(parentPath, container, level) {
    container.innerHTML = '<div class="tree-loading">로딩 중...</div>';
    try {
        const res   = await fetch(`/api/v1/policies/${currentSetId}?parent_path=${encodeURIComponent(parentPath)}`);
        const nodes = await res.json();
        container.innerHTML = '';
        if (!nodes.length) {
            if (level === 0) container.innerHTML = '<div class="sidebar-placeholder" style="padding:16px;">정책 없음</div>';
            return;
        }
        nodes.forEach(node => appendTreeNode(node, container, level));
        if (level === 0) document.getElementById('policy-stats').textContent = `루트: ${nodes.length}`;
    } catch (err) {
        container.innerHTML = `<div style="padding:8px;color:red;font-size:11px;">${escapeHtml(err.message)}</div>`;
    }
}

function appendTreeNode(node, container, level) {
    const wrap    = document.createElement('div');
    wrap.className = 'tree-node';

    const row     = document.createElement('div');
    row.className = 'tree-node-row';
    row.dataset.path = node.Path;
    row.dataset.pk   = node._pk_auto;

    const toggle  = document.createElement('span');
    toggle.className = 'node-toggle';
    toggle.textContent = node.Type === 'Group' ? '▶' : ' ';

    const icon    = document.createElement('span');
    icon.className  = 'node-icon';
    icon.textContent = node.Type === 'Group' ? '📁' : '📄';

    const name    = document.createElement('span');
    name.className  = 'node-name';
    name.textContent = node.Name || 'Unnamed';
    // Custom tooltip (shows when text is truncated)
    name.addEventListener('mouseenter', e => showNodeTooltip(e, node.Name || ''));
    name.addEventListener('mouseleave', hideNodeTooltip);
    name.addEventListener('mousemove', moveNodeTooltip);

    row.append(toggle, icon, name);

    const children = document.createElement('div');
    children.className = 'tree-node-children collapsed';

    row.onclick = () => {
        document.querySelectorAll('.tree-node-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        loadMainContent(node.Path);

        if (node.Type === 'Group') {
            if (children.classList.contains('collapsed')) {
                children.classList.remove('collapsed');
                toggle.textContent = '▼';
                if (!children.dataset.loaded) {
                    loadTreeLevel(node.Path, children, level + 1);
                    children.dataset.loaded = '1';
                }
            } else {
                children.classList.add('collapsed');
                toggle.textContent = '▶';
            }
        } else {
            openDetail(node);
        }
    };

    wrap.append(row, children);
    container.appendChild(wrap);
}

function handleSidebarSearch(value) {
    const mainSearch = document.getElementById('main-search');
    if (!mainSearch) return;
    mainSearch.value = value;
    if (!value.trim()) {
        clearSearch();
        return;
    }
    document.getElementById('search-clear').classList.remove('hidden');
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => performSearch(value.trim()), 300);
}

// ─── Main Content ─────────────────────────────────────────────────────────────
async function loadMainContent(parentPath) {
    if (!currentSetId) return;
    isSearchMode = false;
    currentPath  = parentPath;
    updateBreadcrumb(parentPath);
    setExportBtn(false);

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">로딩 중...</div>';

    try {
        const res   = await fetch(`/api/v1/policies/${currentSetId}?parent_path=${encodeURIComponent(parentPath)}`);
        const nodes = await res.json();

        if (!nodes.length) {
            body.innerHTML = '<div class="empty-state">하위 항목이 없습니다.</div>';
            currentViewData = [];
            return;
        }

        body.innerHTML = '';
        currentViewData = nodes;
        const frag = document.createDocumentFragment();
        nodes.forEach(n => frag.appendChild(createPolicyRow(n, null)));
        body.appendChild(frag);
        document.getElementById('policy-stats').textContent = `${nodes.length}개 항목`;
        setExportBtn(true);
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        currentViewData = [];
    }
}

async function loadAllPolicies() {
    if (!currentSetId) return;
    isSearchMode = false;
    currentPath  = '';
    updateBreadcrumb('');
    setExportBtn(false);

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">로딩 중...</div>';

    try {
        const res   = await fetch(`/api/v1/policies/${currentSetId}/search?query=`);
        const nodes = await res.json();

        if (!nodes.length) {
            body.innerHTML = '<div class="empty-state">정책이 없습니다.</div>';
            currentViewData = [];
            return;
        }

        body.innerHTML = '';
        currentViewData = nodes;
        const header = document.createElement('div');
        header.className   = 'results-header';
        header.textContent = `전체 정책 — ${nodes.length}개`;
        body.appendChild(header);

        const frag = document.createDocumentFragment();
        nodes.forEach(n => frag.appendChild(createPolicyRow(n, null, true)));
        body.appendChild(frag);
        document.getElementById('policy-stats').textContent = `${nodes.length}개 정책`;
        setExportBtn(true);
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        currentViewData = [];
    }
}

// 클릭 가능한 경로 렌더링 (각 세그먼트 → 해당 경로 이동)
function renderClickablePath(path) {
    if (!path) return '';
    const segs = path.split(' > ');
    return segs.map((seg, i) => {
        const isLast = i === segs.length - 1;
        const prefix = i > 0 ? '<span class="path-sep">›</span>' : '';
        if (isLast) {
            return `${prefix}<span class="path-seg-cur">${escapeHtml(seg)}</span>`;
        }
        const cumPath = segs.slice(0, i + 1).join(' > ').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `${prefix}<span class="path-seg" onclick="event.stopPropagation(); loadMainContent('${cumPath}')">${escapeHtml(seg)}</span>`;
    }).join('');
}

function createPolicyRow(node, query, showPath = false) {
    const row     = document.createElement('div');
    const isGroup = node.Type === 'Group';
    const enabled = node.Enabled === 'true';
    const doShowPath = showPath || !!query;

    row.className = `policy-row${isGroup ? ' group-row' : ''}`;
    if (node._pk_auto && node._pk_auto === selectedPk) row.classList.add('active');

    // Condition preview — formatted + syntax coloring
    let condPreview = '';
    const expiry = detectExpiry(node.Condition || '');
    if (node.Condition && node.Condition !== 'Always' && node.Condition !== 'None') {
        const formatted = formatConditionShort(node.Condition) || node.Condition;
        condPreview = `<span class="row-cond">${colorCondition(formatted, query)}</span>`;
    }

    // Expiry badge
    let expiryBadge = '';
    if (expiry) {
        if (expiry.expired) {
            expiryBadge = `<span class="badge expired">만료 (${expiry.endDate.toLocaleDateString('ko')})</span>`;
        } else if (expiry.expiringSoon) {
            expiryBadge = `<span class="badge expiring">D-${expiry.daysLeft} 만료</span>`;
        }
    }

    // Actions preview (short, rule only)
    let actionsPreview = '';
    if (!isGroup && node.Actions) {
        const raw = node.Actions.length > 90 ? node.Actions.slice(0, 90) + '…' : node.Actions;
        actionsPreview = `<span class="row-actions">${query ? highlight(raw, query) : escapeHtml(raw)}</span>`;
    }

    row.innerHTML = `
        <span class="row-icon">${isGroup ? '📁' : '📄'}</span>
        <div class="row-content">
            <div class="row-name">${query ? highlight(node.Name || 'Unnamed', query) : escapeHtml(node.Name || 'Unnamed')}</div>
            ${doShowPath ? `<div class="row-path">${renderClickablePath(node.Path || '')}</div>` : ''}
            <div class="row-meta">
                <div class="row-meta-inline">
                    <span class="badge ${enabled ? 'enabled' : 'disabled'}">${enabled ? '활성' : '비활성'}</span>
                    <span>${escapeHtml(node.Type)}</span>
                    ${expiryBadge}
                </div>
                ${condPreview}
                ${actionsPreview}
            </div>
        </div>
        ${isGroup ? '<span class="row-arrow">›</span>' : ''}
    `;

    row.onclick = () => {
        document.querySelectorAll('.policy-row.active').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        selectedPk = node._pk_auto;

        if (isGroup && !query && !showPath) {
            loadMainContent(node.Path);
            autoExpandTreeToPath(node.Path);
        } else {
            openDetail(node);
            autoExpandTreeToPath(node.Path);
        }
    };

    return row;
}

function syncTreeSelection(path) {
    document.querySelectorAll('.tree-node-row').forEach(r => {
        r.classList.toggle('selected', r.dataset.path === path);
    });
}

function getTreeRowByPath(path) {
    for (const row of document.querySelectorAll('.tree-node-row')) {
        if (row.dataset.path === path) return row;
    }
    return null;
}

async function autoExpandTreeToPath(fullPath) {
    if (!fullPath) return;
    const segs = fullPath.split(' > ');

    document.querySelectorAll('.tree-node-row.selected').forEach(r => r.classList.remove('selected'));

    let cumPath = '';
    for (let i = 0; i < segs.length; i++) {
        cumPath = i === 0 ? segs[i] : `${cumPath} > ${segs[i]}`;
        const isLast = i === segs.length - 1;

        // 부모 경로의 children 컨테이너를 확장해서 현재 cumPath 노드를 노출
        const parentPath = segs.slice(0, i).join(' > ');
        const parentRow  = parentPath ? getTreeRowByPath(parentPath) : null;

        if (parentPath && parentRow) {
            const childrenEl = parentRow.nextElementSibling;
            if (childrenEl && childrenEl.classList.contains('tree-node-children')) {
                if (!childrenEl.dataset.loaded) {
                    await loadTreeLevel(parentPath, childrenEl, 0);
                    childrenEl.dataset.loaded = '1';
                }
                childrenEl.classList.remove('collapsed');
                const toggle = parentRow.querySelector('.node-toggle');
                if (toggle) toggle.textContent = '▼';
            }
        } else if (!parentPath) {
            // 루트 레벨은 이미 로드되어 있음
        }

        const row = getTreeRowByPath(cumPath);
        if (!row) break;

        if (isLast) {
            row.classList.add('selected');
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            // 이 노드의 children도 미리 열어두기
            const childrenEl = row.nextElementSibling;
            if (childrenEl && childrenEl.classList.contains('tree-node-children')) {
                if (!childrenEl.dataset.loaded) {
                    await loadTreeLevel(cumPath, childrenEl, 0);
                    childrenEl.dataset.loaded = '1';
                }
                childrenEl.classList.remove('collapsed');
                const toggle = row.querySelector('.node-toggle');
                if (toggle) toggle.textContent = '▼';
            }
        }
    }
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function updateBreadcrumb(path) {
    const bar = document.getElementById('breadcrumb');
    if (!bar) return;

    if (!path) {
        bar.innerHTML = '<span class="crumb crumb-root" onclick="loadMainContent(\'\')">Root</span>';
        return;
    }

    const segs = path.split(' > ');
    let html   = '<span class="crumb crumb-root" onclick="loadMainContent(\'\')">Root</span>';
    let cum    = '';

    segs.forEach((seg, i) => {
        cum = i === 0 ? seg : `${cum} > ${seg}`;
        const cp = cum.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += '<span class="crumb-sep">›</span>';
        html += i < segs.length - 1
            ? `<span class="crumb" onclick="loadMainContent('${cp}')">${escapeHtml(seg)}</span>`
            : `<span class="crumb crumb-active">${escapeHtml(seg)}</span>`;
    });

    bar.innerHTML = html;
}

// ─── Search ───────────────────────────────────────────────────────────────────
function handleSearchInput(event) {
    clearTimeout(searchTimer);
    const q = event.target.value.trim();
    document.getElementById('search-clear').classList.toggle('hidden', !q);
    if (!q) { clearSearch(); return; }
    searchTimer = setTimeout(() => performSearch(q), 350);
}

function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
        clearTimeout(searchTimer);
        const q = event.target.value.trim();
        if (q) performSearch(q);
    } else if (event.key === 'Escape') {
        clearSearch();
    }
}

async function performSearch(query) {
    if (!currentSetId || !query) return;
    isSearchMode = true;
    setExportBtn(false);

    const bar = document.getElementById('breadcrumb');
    bar.innerHTML = `<span style="color:var(--text-sec);">검색:</span> <strong>${escapeHtml(query)}</strong>`;

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">검색 중...</div>';

    try {
        const res     = await fetch(`/api/v1/policies/${currentSetId}/search?query=${encodeURIComponent(query)}`);
        const results = await res.json();

        body.innerHTML = '';
        const header = document.createElement('div');
        header.className   = 'results-header';
        header.textContent = `"${query}" — ${results.length}개 결과`;
        body.appendChild(header);

        if (!results.length) {
            body.innerHTML += '<div class="empty-state">검색 결과가 없습니다.</div>';
            currentViewData = [];
        } else {
            currentViewData = results;
            document.getElementById('policy-stats').textContent = `${results.length}개 결과`;
            const frag = document.createDocumentFragment();
            results.forEach(n => frag.appendChild(createPolicyRow(n, query)));
            body.appendChild(frag);
            setExportBtn(true);
        }
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        currentViewData = [];
    }
}

function clearSearch() {
    isSearchMode = false;
    clearSearchInput();
    if (currentSetId && currentTab === 'policies') loadMainContent(currentPath);
}

// ─── Condition Formatting ─────────────────────────────────────────────────────

/** 조건식을 단축·정리하여 읽기 쉽게 변환 */
function formatConditionShort(cond) {
    if (!cond || cond === 'Always' || cond === 'None') return null;
    let s = cond;

    // engine. 접두사 제거
    s = s.replace(/\bengine\./g, '');

    // operator.X → 기호/단어
    s = s.replace(/\boperator\.isinrangelist\b/g,       '∈range');
    s = s.replace(/\boperator\.isinlist\b/g,             '∈');
    s = s.replace(/\boperator\.equals\b/g,               '=');
    s = s.replace(/\boperator\.lesstan\b/g,              '<');   // 오타 variant
    s = s.replace(/\boperator\.lessthan\b/g,             '<');
    s = s.replace(/\boperator\.greaterthan\b/g,          '>');
    s = s.replace(/\boperator\.lessthanorequal\b/g,      '≤');
    s = s.replace(/\boperator\.greaterthanorequal\b/g,   '≥');
    s = s.replace(/\boperator\.contains\b/g,             '∋');
    s = s.replace(/\boperator\.doesnotcontain\b/g,       '∌');
    s = s.replace(/\boperator\.startswith\b/g,           '^=');
    s = s.replace(/\boperator\.endswith\b/g,             '$=');
    s = s.replace(/\boperator\.matches\b/g,              '~=');
    s = s.replace(/\boperator\.notequals?\b/g,           '≠');
    s = s.replace(/\boperator\.\w+/g,                    m => m.replace('operator.', '?'));

    // "= type.boolean.true" → 제거 (이미 참을 의미)
    s = s.replace(/\s*=\s*"type\.boolean\.true"/g, '');

    // 모듈 경로 단축
    s = s.replace(/\bdatetimefilter\.time\./g,     '');
    s = s.replace(/\bstringfilter\.string\./g,     '');
    s = s.replace(/\bheaderfilter\.headers\./g,    'header.');
    s = s.replace(/\bsystem\.url\./g,              'url.');
    s = s.replace(/\bsystem\.client\./g,           'client.');
    s = s.replace(/\bsystem\.request\./g,          'req.');
    s = s.replace(/\bsystem\.response\./g,         'res.');
    s = s.replace(/\bnetwork\./g,                  'net.');

    // timeinrangeiso("YYYY-MM-DD ...", "YYYY-MM-DD ...") → [YYYY-MM-DD ~ YYYY-MM-DD]
    s = s.replace(/timeinrangeiso\s*\(\s*"(\d{4}-\d{2}-\d{2})[^"]*"\s*,\s*"(\d{4}-\d{2}-\d{2})[^"]*"\s*\)/gi,
        '[$1 ~ $2]');

    // 소문자 and/or → 대문자 (정확한 단어만)
    s = s.replace(/\band\b/g, 'AND').replace(/\bor\b/g, 'OR');

    return s.trim();
}

/** 포맷된 조건식에 HTML 구문 색상 적용 */
function colorCondition(text, query = '') {
    // 1. HTML 이스케이프
    let s = escapeHtml(text);
    // 2. 검색어 하이라이트
    if (query) {
        const re = new RegExp(escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        s = s.replace(re, m => `<mark>${m}</mark>`);
    }
    // 3. AND/OR 강조
    s = s.replace(/\b(AND|OR)\b/g, '<span class="cond-logic">$1</span>');
    // 4. 연산자 기호 강조
    s = s.replace(/(∈range|∈|≤|≥|∋|∌|\^=|\$=|~=|≠|[<>=])/g,
        '<span class="cond-op">$1</span>');
    // 5. 함수 호출 강조 (word followed by "(")
    s = s.replace(/(\b\w[\w.]+)\s*(?=\()/g,
        '<span class="cond-fn">$1</span>');
    // 6. 문자열 리터럴 강조
    s = s.replace(/(&quot;[^&]*?&quot;)/g,
        '<span class="cond-val">$1</span>');
    return s;
}

/** 조건식에서 만료일 정보 추출 */
function detectExpiry(cond) {
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

/** 만료/임박 정책만 필터링해서 메인 패널에 표시 */
async function findExpiredPolicies() {
    if (!currentSetId) return;
    isSearchMode = true;
    setExportBtn(false);

    const bar = document.getElementById('breadcrumb');
    bar.innerHTML = `<span style="color:#c0392b;font-weight:600;">⏰ 만료/임박 정책</span>`;

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">전체 정책 분석 중...</div>';

    try {
        const res = await fetch(`/api/v1/policies/${currentSetId}/search?query=`);
        const all = await res.json();

        const expired      = [];
        const expiringSoon = [];
        all.forEach(n => {
            const exp = detectExpiry(n.Condition || '');
            if (!exp) return;
            if (exp.expired)      expired.push(n);
            else if (exp.expiringSoon) expiringSoon.push(n);
        });

        const results = [...expired, ...expiringSoon];
        body.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'results-header';
        header.innerHTML = `⏰ 만료/임박 정책 &nbsp;—&nbsp; `
            + `<span style="color:#c0392b;font-weight:600;">${expired.length}개 만료</span>`
            + ` / <span style="color:#b7690a;font-weight:600;">${expiringSoon.length}개 30일 내 만료</span>`;
        body.appendChild(header);

        if (!results.length) {
            body.innerHTML += '<div class="empty-state">만료된 정책이 없습니다.</div>';
            currentViewData = [];
        } else {
            currentViewData = results;
            const frag = document.createDocumentFragment();
            results.forEach(n => frag.appendChild(createPolicyRow(n, null, true)));
            body.appendChild(frag);
            setExportBtn(true);
        }
    } catch(err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        currentViewData = [];
    }
}

function clearSearchInput() {
    const input = document.getElementById('main-search');
    if (input) input.value = '';
    document.getElementById('search-clear')?.classList.add('hidden');
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function openDetail(node) {
    const panel   = document.getElementById('detail-panel');
    const body    = document.getElementById('detail-body');
    const title   = document.getElementById('detail-title');
    panel.classList.remove('hidden');
    title.textContent = node.Type === 'Group' ? '그룹 정보' : '규칙 정보';

    const enabled = node.Enabled === 'true';
    const expiry  = detectExpiry(node.Condition || '');
    let expiryBadge = '';
    if (expiry) {
        if (expiry.expired) {
            expiryBadge = `<span class="badge expired">만료 (${expiry.endDate.toLocaleDateString('ko')})</span>`;
        } else if (expiry.expiringSoon) {
            expiryBadge = `<span class="badge expiring">D-${expiry.daysLeft} 만료</span>`;
        } else {
            expiryBadge = `<span class="badge enabled">유효 (∼${expiry.endDate.toLocaleDateString('ko')})</span>`;
        }
    }

    body.innerHTML = `
        <div class="detail-name">
            ${node.Type === 'Group' ? '📁' : '📄'}
            ${escapeHtml(node.Name || 'Unnamed')}
            <span class="badge ${enabled ? 'enabled' : 'disabled'}">${enabled ? '활성' : '비활성'}</span>
            ${expiryBadge}
        </div>
        <div class="detail-path">${escapeHtml(node.Path || '')}</div>

        <div class="detail-section">
            <span class="detail-label">조건 (Condition)</span>
            <div class="detail-value condition">${formatCondition(node.Condition)}</div>
        </div>

        ${node.Type === 'Rule' && node.Actions ? `
        <div class="detail-section">
            <span class="detail-label">액션 (Actions)</span>
            <div class="detail-value">${escapeHtml(node.Actions)}</div>
        </div>` : ''}

        ${node.Description ? `
        <div class="detail-section">
            <span class="detail-label">설명</span>
            <div class="detail-value" style="font-family:sans-serif;font-size:12px;">${escapeHtml(node.Description)}</div>
        </div>` : ''}

        <div class="detail-section">
            <span class="detail-label">기술 정보</span>
            <div class="tech-grid">
                <div class="tech-item"><div class="tech-key">Type</div><div class="tech-val">${escapeHtml(node.Type)}</div></div>
                <div class="tech-item"><div class="tech-key">Level</div><div class="tech-val">${node.Level ?? '-'}</div></div>
                <div class="tech-item"><div class="tech-key">Cloud Sync</div><div class="tech-val">${node.CloudSynced === 'true' ? '✓' : '✗'}</div></div>
                <div class="tech-item"><div class="tech-key">Cycle</div><div class="tech-val">Req:${node.CycleRequest === 'true' ? '✓' : '✗'} / Res:${node.CycleResponse === 'true' ? '✓' : '✗'}</div></div>
            </div>
        </div>

        <div class="detail-section">
            <span class="detail-label">Policy ID</span>
            <div class="detail-value" style="font-size:10px;background:#fafafa;">${escapeHtml(node.PolicyID || '-')}</div>
        </div>

        <div id="object-inline-view"></div>
    `;
}

function closeDetail() {
    document.getElementById('detail-panel').classList.add('hidden');
    document.querySelectorAll('.policy-row.active').forEach(r => r.classList.remove('active'));
    selectedPk = null;
}

function formatCondition(cond) {
    if (!cond || cond === 'Always')
        return '<span style="color:#999;font-style:italic;">Always (항상 적용)</span>';
    if (cond === 'None')
        return '<span style="color:#aaa;font-style:italic;">조건 없음</span>';

    return cond.replace(/List\(([^)]+)\)/g, (match, nameOrId) => {
        let listId = nameOrId;
        let obj    = objectsMap[nameOrId];
        if (!obj && objectsNameToId[nameOrId]) {
            listId = objectsNameToId[nameOrId];
            obj    = objectsMap[listId];
        }
        const display = obj ? (obj.name || nameOrId) : nameOrId;
        return `<span class="list-link" onclick="showObjectDetail('${escapeHtml(listId)}')" title="${escapeHtml(listId)}">${escapeHtml(display)}</span>`;
    });
}

function showObjectDetail(listId) {
    const obj  = objectsMap[listId];
    const wrap = document.getElementById('object-inline-view');
    if (!obj || !wrap) return;

    wrap.innerHTML = `
        <div class="object-view">
            <div class="object-view-header">
                <span>📦 ${escapeHtml(obj.name)}</span>
                <button class="btn-icon" style="font-size:10px;" onclick="document.getElementById('object-inline-view').innerHTML=''">✕</button>
            </div>
            <ul class="object-list">
                ${obj.entries.length
                    ? obj.entries.map(e => `<li><span>${escapeHtml(e.value || '')}</span><span class="entry-type-badge">${escapeHtml(e.type)}</span></li>`).join('')
                    : '<li style="color:#999;justify-content:center;font-style:italic;">항목 없음</li>'
                }
            </ul>
        </div>
    `;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Navigate to a specific node ─────────────────────────────────────────────
async function navigateToNode(node) {
    showTab('policies');
    isSearchMode = false;
    currentPath  = node.ParentPath || '';
    await loadMainContent(currentPath);
    openDetail(node);

    // Highlight the row if visible
    const rows = document.querySelectorAll('.policy-row');
    rows.forEach(r => {
        if (r.querySelector('.row-name')?.textContent === (node.Name || 'Unnamed')) {
            r.classList.add('active');
            r.scrollIntoView({ block: 'nearest' });
        }
    });
}

// ─── Lists Tab ────────────────────────────────────────────────────────────────
function renderListsSidebar(filterText) {
    const body = document.getElementById('sidebar-body');

    if (!currentSetId || !Object.keys(objectsMap).length) {
        body.innerHTML = '<div class="sidebar-placeholder">정책을 먼저 선택하세요.</div>';
        return;
    }

    const isValue = listSearchMode === 'value';
    body.innerHTML = `
        <div class="list-mode-tabs">
            <button class="lm-tab ${!isValue ? 'active' : ''}" onclick="setListSearchMode('name')">📋 이름 검색</button>
            <button class="lm-tab ${isValue ? 'active' : ''}" onclick="setListSearchMode('value')">🔍 값 검색</button>
        </div>
        <div class="list-filter-wrap">
            <input type="text" id="list-search-input"
                   placeholder="${isValue ? '값 검색 (예: google.com)...' : 'List 이름 검색...'}"
                   value="${escapeHtml(filterText)}"
                   oninput="handleListSearch(this.value)">
        </div>
        ${isValue && !filterText ? `<div class="list-value-hint">값을 입력하면 해당 값이 포함된<br>모든 List와 참조 정책을 한눈에 표시합니다.</div>` : ''}
        <div id="list-names-panel"></div>
    `;

    if (isValue) {
        if (filterText.trim()) searchListsByValue(filterText.trim());
        else document.getElementById('main-body').innerHTML =
            '<div class="empty-state">검색할 값을 왼쪽에 입력하세요.</div>';
    } else {
        filterAndRenderLists(filterText);
    }
}

function setListSearchMode(mode) {
    listSearchMode = mode;
    activeListId   = null;
    renderListsSidebar('');
    if (mode === 'name')
        document.getElementById('main-body').innerHTML =
            '<div class="empty-state">왼쪽에서 List를 선택하세요.</div>';
}

function handleListSearch(value) {
    clearTimeout(listSearchTimer);
    if (listSearchMode === 'name') {
        filterAndRenderLists(value);
    } else {
        if (!value.trim()) {
            document.getElementById('list-names-panel').innerHTML = '';
            document.getElementById('main-body').innerHTML =
                '<div class="empty-state">검색할 값을 입력하세요.</div>';
            return;
        }
        listSearchTimer = setTimeout(() => searchListsByValue(value.trim()), 250);
    }
}

function filterAndRenderLists(filterText) {
    const panel = document.getElementById('list-names-panel');
    if (!panel) return;

    const lower   = (filterText || '').toLowerCase();
    const entries = Object.entries(objectsMap)
        .filter(([, o]) => !lower || o.name.toLowerCase().includes(lower))
        .sort(([, a], [, b]) => a.name.localeCompare(b.name));

    if (!entries.length) {
        panel.innerHTML = '<div class="sidebar-placeholder">표시할 List 없음</div>';
        return;
    }

    panel.innerHTML = entries.map(([id, o]) => `
        <div class="list-name-item ${id === activeListId ? 'active' : ''}"
             data-list-id="${escapeHtml(id)}"
             onclick="selectList('${escapeHtml(id)}')"
             title="${escapeHtml(id)}">
            <span class="list-name-text">${escapeHtml(o.name)}</span>
            <span class="list-count">${o.entries.length}</span>
        </div>
    `).join('');
}

function selectList(listId) {
    activeListId = listId;
    document.querySelectorAll('.list-name-item').forEach(el =>
        el.classList.toggle('active', el.dataset.listId === listId)
    );
    showListEntries(listId, '');
}

/** 값으로 전체 리스트 검색 (클라이언트 사이드) */
function searchListsByValue(value) {
    const lower = value.toLowerCase();
    const matchingLists = [];

    for (const [id, obj] of Object.entries(objectsMap)) {
        const matches = obj.entries.filter(e =>
            (e.value || '').toLowerCase().includes(lower)
        );
        if (matches.length) matchingLists.push({ id, obj, matches });
    }
    matchingLists.sort((a, b) => b.matches.length - a.matches.length);

    // 사이드바: 매칭 목록
    const panel = document.getElementById('list-names-panel');
    if (panel) {
        if (!matchingLists.length) {
            panel.innerHTML = '<div class="sidebar-placeholder">일치하는 항목 없음</div>';
        } else {
            panel.innerHTML = matchingLists.map(({ id, obj, matches }) => `
                <div class="list-name-item ${id === activeListId ? 'active' : ''}"
                     data-list-id="${escapeHtml(id)}"
                     onclick="selectList('${escapeHtml(id)}')"
                     title="${escapeHtml(id)}">
                    <span class="list-name-text">${escapeHtml(obj.name)}</span>
                    <span class="list-count" style="background:var(--primary);color:white;">${matches.length}</span>
                </div>
            `).join('');
        }
    }

    // 메인 패널: 통합 결과 뷰
    renderValueSearchResults(value, matchingLists);
}

/** 값 검색 통합 결과 메인 패널 렌더링 */
function renderValueSearchResults(value, matchingLists) {
    const body = document.getElementById('main-body');
    const totalEntries = matchingLists.reduce((s, l) => s + l.matches.length, 0);

    body.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'results-header';
    if (!matchingLists.length) {
        header.innerHTML = `🔍 "<strong>${escapeHtml(value)}</strong>" — 일치하는 항목이 없습니다.`;
        body.appendChild(header);
        return;
    }
    header.innerHTML =
        `🔍 "<strong>${escapeHtml(value)}</strong>" — `
        + `${matchingLists.length}개 리스트, ${totalEntries}개 항목`;
    body.appendChild(header);

    // 매칭 리스트 + 항목
    matchingLists.forEach(({ id, obj, matches }) => {
        const block = document.createElement('div');
        block.className = 'vr-list-block';
        block.innerHTML = `
            <div class="vr-list-header" onclick="selectList('${escapeHtml(id)}')">
                <span>📦</span>
                <span style="flex:1;">${escapeHtml(obj.name)}</span>
                <span class="vr-match-count">${matches.length}건 매칭</span>
                <span class="vr-total-count">전체 ${obj.entries.length}개 중</span>
            </div>
            <div class="vr-entries">
                ${matches.slice(0, 8).map(e => `
                    <div class="vr-entry">
                        <span style="flex:1;">${highlight(e.value || '', value)}</span>
                        <span class="entry-badge">${escapeHtml(e.type)}</span>
                    </div>
                `).join('')}
                ${matches.length > 8 ? `<div class="vr-entry-more">…외 ${matches.length - 8}개 더</div>` : ''}
            </div>
        `;
        body.appendChild(block);
    });

    // 참조 정책 섹션
    const policiesBar = document.createElement('div');
    policiesBar.className = 'vr-policies-bar';
    policiesBar.id = 'vr-policies-bar';
    policiesBar.textContent = '이 리스트를 참조하는 정책 — 로딩 중...';
    body.appendChild(policiesBar);

    const policiesContainer = document.createElement('div');
    policiesContainer.id = 'vr-policies-container';
    policiesContainer.innerHTML = '<div class="loading" style="padding:16px;">정책 검색 중...</div>';
    body.appendChild(policiesContainer);

    loadPoliciesForLists(value, matchingLists, policiesBar, policiesContainer);
}

/** 매칭된 리스트를 참조하는 정책 비동기 로드 */
async function loadPoliciesForLists(value, matchingLists, barEl, containerEl) {
    if (!currentSetId || !matchingLists.length) {
        barEl.textContent = '참조 정책 없음';
        containerEl.innerHTML = '';
        return;
    }
    try {
        const seen     = new Set();
        const policies = [];
        for (const { obj } of matchingLists) {
            const res  = await fetch(
                `/api/v1/policies/${currentSetId}/search?query=${encodeURIComponent(obj.name)}`
            );
            const list = await res.json();
            list.forEach(p => {
                if (!seen.has(p._pk_auto)) {
                    seen.add(p._pk_auto);
                    policies.push(p);
                }
            });
        }

        barEl.textContent = `이 리스트를 참조하는 정책 — ${policies.length}개`;
        containerEl.innerHTML = '';

        if (!policies.length) {
            containerEl.innerHTML = '<div style="padding:12px 14px;color:#999;font-size:12px;">참조하는 정책이 없습니다.</div>';
            return;
        }

        const frag = document.createDocumentFragment();
        policies.forEach(p => frag.appendChild(createPolicyRow(p, value, true)));
        containerEl.appendChild(frag);
    } catch(err) {
        containerEl.innerHTML =
            `<div style="padding:12px 14px;color:red;font-size:12px;">${escapeHtml(err.message)}</div>`;
    }
}

function showListEntries(listId, filterText) {
    const obj  = objectsMap[listId];
    const body = document.getElementById('main-body');

    if (!obj) {
        body.innerHTML = '<div class="empty-state">List를 찾을 수 없습니다.</div>';
        return;
    }

    const lower    = (filterText || '').toLowerCase();
    const filtered = obj.entries.filter(e => !lower || (e.value || '').toLowerCase().includes(lower));

    body.innerHTML = `
        <div class="lists-main-header">
            <h3>${escapeHtml(obj.name)}</h3>
            <div class="list-meta">${escapeHtml(listId)} &nbsp;·&nbsp; ${filtered.length} / ${obj.entries.length} 항목</div>
        </div>
        <div class="lists-search-wrap">
            <input type="text" placeholder="항목 검색..." value="${escapeHtml(filterText)}"
                   oninput="showListEntries('${escapeHtml(listId)}', this.value)">
        </div>
        <table class="lists-table">
            <thead><tr><th>Value</th><th>Description</th><th>Type</th></tr></thead>
            <tbody>${filtered.length
                ? filtered.map(e => `
                    <tr>
                        <td>${escapeHtml(e.value || '')}</td>
                        <td>${e.details ? `<span title="${escapeHtml(e.details)}">${escapeHtml(e.details.slice(0,60))}${e.details.length > 60 ? '…' : ''}</span>` : ''}</td>
                        <td><span class="entry-badge">${escapeHtml(e.type)}</span></td>
                    </tr>`).join('')
                : '<tr><td colspan="3" style="text-align:center;padding:16px;color:#999;">항목 없음</td></tr>'
            }</tbody>
        </table>
        <div class="list-refs-header-bar">이 List를 참조하는 정책</div>
        <div id="list-refs-content">
            <div style="padding:8px 12px;color:#999;font-size:11px;">로딩 중...</div>
        </div>
    `;

    loadListRefs(listId);
}

async function loadListRefs(listId) {
    const obj   = objectsMap[listId];
    const refsEl = document.getElementById('list-refs-content');
    if (!obj || !currentSetId || !refsEl) return;

    try {
        const res = await fetch(`/api/v1/policies/${currentSetId}/search?query=${encodeURIComponent(obj.name)}`);
        listRefPolicies = await res.json();

        if (!listRefPolicies.length) {
            refsEl.innerHTML = '<div style="padding:8px 12px;color:#999;font-size:11px;">참조하는 정책 없음</div>';
            return;
        }

        refsEl.innerHTML = listRefPolicies.map((p, i) => `
            <div class="list-ref-item" data-ref-idx="${i}">
                <div class="ref-name"><span class="entry-badge">${escapeHtml(p.Type)}</span> ${escapeHtml(p.Name)}</div>
                <div class="ref-path">${escapeHtml(p.Path)}</div>
            </div>
        `).join('');

        refsEl.onclick = e => {
            const item = e.target.closest('.list-ref-item');
            if (item) navigateToNode(listRefPolicies[parseInt(item.dataset.refIdx, 10)]);
        };
    } catch (err) {
        refsEl.innerHTML = `<div style="padding:8px 12px;color:red;font-size:11px;">${escapeHtml(err.message)}</div>`;
    }
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function renderStatsSidebar() {
    document.getElementById('sidebar-body').innerHTML = `
        <div class="stats-sidebar-wrap">
            <button class="btn sm" style="width:100%;" onclick="loadStatsData()">🔄 새로고침</button>
            <button class="btn sm" style="width:100%;" onclick="exportStatsCSV()">⬇️ CSV 내보내기</button>
            <div class="section-label">값 조회</div>
            <div class="value-lookup-row">
                <input type="text" id="value-search-input" placeholder="IP, 도메인..."
                       onkeydown="if(event.key==='Enter') doValueSearch()">
                <button class="btn sm primary" onclick="doValueSearch()">조회</button>
            </div>
            <div style="font-size:10px;color:var(--text-sec);margin-top:4px;line-height:1.5;">
                값을 입력하면 해당 값이 포함된 정책을 찾아줍니다.
            </div>
        </div>
    `;
}

async function loadStatsData() {
    const body = document.getElementById('main-body');
    if (!currentSetId) {
        body.innerHTML = '<div class="empty-state">정책을 먼저 선택하세요.</div>';
        return;
    }
    body.innerHTML = '<div class="loading">통계 분석 중...</div>';
    try {
        const [hostRes, policyStatsRes] = await Promise.all([
            fetch(`/api/v1/analysis/${currentSetId}/top-hosts?limit=200`),
            fetch(`/api/v1/analysis/${currentSetId}/policy-stats`)
        ]);
        statsData   = await hostRes.json();
        policyStats = await policyStatsRes.json();
        renderStatsPage();
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
    }
}

function renderStatsPage() {
    const body = document.getElementById('main-body');
    body.innerHTML = `
        <div class="policy-stats-section" id="policy-stats-cards"></div>
        <div id="stats-table-container"></div>
    `;
    if (policyStats) {
        document.getElementById('policy-stats-cards').innerHTML = renderPolicyStatsCards(policyStats);
    }
    renderStatsTable();
}

function renderPolicyStatsCards(s) {
    const pct = (v, t) => t > 0 ? Math.round(v / t * 100) : 0;
    const cards = [
        { label: '전체 정책',   value: s.total,          sub: `Rule ${s.rules} · Group ${s.groups}`,             color: 'var(--primary)', icon: '📋' },
        { label: '활성 정책',   value: s.enabled,         sub: `전체 Rule의 ${pct(s.enabled,  s.rules)}%`,         color: '#1a7a3d',        icon: '✅' },
        { label: '비활성 정책', value: s.disabled,        sub: `전체 Rule의 ${pct(s.disabled, s.rules)}%`,         color: '#86868b',        icon: '⏸' },
        { label: '차단 정책',   value: s.block,           sub: `전체 Rule의 ${pct(s.block,    s.rules)}%`,         color: '#c0392b',        icon: '🚫' },
        { label: '무조건 실행', value: s.unconditional,   sub: '조건 없는 Rule',                                  color: '#d4680a',        icon: '⚡' },
        { label: '비활성 차단', value: s.disabled_block,  sub: '꺼진 차단 정책',                                  color: '#8e44ad',        icon: '🔕' },
    ];
    return `
        <div class="stats-section-header">
            <span class="stats-title">📊 정책 통계</span>
        </div>
        <div class="policy-stats-grid">
            ${cards.map(c => `
                <div class="stat-card">
                    <div class="stat-card-icon">${c.icon}</div>
                    <div class="stat-card-body">
                        <div class="stat-card-value" style="color:${c.color};">${c.value.toLocaleString()}</div>
                        <div class="stat-card-label">${c.label}</div>
                        <div class="stat-card-sub">${c.sub}</div>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

function renderStatsTable() {
    const body = document.getElementById('stats-table-container') || document.getElementById('main-body');
    if (!statsData.length) {
        body.innerHTML = '<div class="empty-state">데이터가 없습니다.</div>';
        return;
    }

    const sorted = [...statsData].sort((a, b) => {
        let va = a[statsSortCol], vb = b[statsSortCol];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
        return va < vb ? (statsSortDir === 'asc' ? -1 : 1) : va > vb ? (statsSortDir === 'asc' ? 1 : -1) : 0;
    });
    statsSortedData = sorted;

    const si = col => col !== statsSortCol
        ? '<span class="sort-icon">⇅</span>'
        : `<span class="sort-icon active">${statsSortDir === 'asc' ? '↑' : '↓'}</span>`;

    body.innerHTML = `
        <div class="stats-toolbar-bar">
            <span class="stats-title">📊 Host 통계</span>
            <span style="font-size:11px;color:var(--text-sec);">${sorted.length}개 항목</span>
        </div>
        <table class="stats-table">
            <thead>
                <tr>
                    <th onclick="sortStats('entry_value')">Value (Host/IP) ${si('entry_value')}</th>
                    <th onclick="sortStats('policy_count')" style="text-align:right;">참조 정책 수 ${si('policy_count')}</th>
                    <th>소속 Lists</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map((r, i) => `
                    <tr data-stats-idx="${i}">
                        <td>${escapeHtml(r.entry_value || '')}</td>
                        <td style="text-align:right;font-weight:700;color:var(--primary);">${r.policy_count}</td>
                        <td style="color:var(--text-sec);font-size:11px;">${escapeHtml(r.list_names || '')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    body.querySelector('tbody').onclick = e => {
        const row = e.target.closest('tr[data-stats-idx]');
        if (row) {
            const r = statsSortedData[parseInt(row.dataset.statsIdx, 10)];
            if (r) doValueSearchFor(r.entry_value || '');
        }
    };
}

function sortStats(col) {
    statsSortDir = statsSortCol === col ? (statsSortDir === 'asc' ? 'desc' : 'asc') : (col === 'policy_count' ? 'desc' : 'asc');
    statsSortCol = col;
    renderStatsTable();
}

async function doValueSearch() {
    const input = document.getElementById('value-search-input');
    if (input?.value.trim()) doValueSearchFor(input.value.trim());
}

async function doValueSearchFor(value) {
    if (!value || !currentSetId) return;

    showTab('policies');
    isSearchMode = true;

    const bar = document.getElementById('breadcrumb');
    bar.innerHTML = `<span style="color:var(--text-sec);">값 조회:</span> <strong>${escapeHtml(value)}</strong>`;

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">분석 중...</div>';

    try {
        const res    = await fetch(`/api/v1/analysis/${currentSetId}/value-lookup?value=${encodeURIComponent(value)}`);
        const result = await res.json();

        body.innerHTML = '';
        const header = document.createElement('div');
        header.className   = 'results-header';
        header.textContent = `"${value}" 포함 정책 — ${result.count}개 발견`;
        body.appendChild(header);

        if (!result.policies.length) {
            body.innerHTML += '<div class="empty-state">해당 값을 포함하는 정책이 없습니다.</div>';
            return;
        }

        document.getElementById('policy-stats').textContent = `${result.count}개 결과`;
        result.policies.forEach(item => {
            const listName = objectsMap[item.MatchedListID]?.name || item.MatchedListID;
            const row      = createPolicyRow(item, value);
            const meta     = row.querySelector('.row-meta');
            if (meta) {
                const listSpan = document.createElement('span');
                listSpan.style.cssText = 'color:var(--primary);';
                listSpan.textContent   = `📦 ${listName}`;
                meta.appendChild(document.createTextNode(' · '));
                meta.appendChild(listSpan);
            }
            body.appendChild(row);
        });
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
    }
}

function exportStatsCSV() {
    if (!statsData.length) { alert('내보낼 데이터가 없습니다.'); return; }
    const rows = statsSortedData.length ? statsSortedData : statsData;
    const csv  = [
        ['Value (Host/IP)', '참조 정책 수', '소속 Lists'],
        ...rows.map(r => [
            `"${(r.entry_value || '').replace(/"/g, '""')}"`,
            r.policy_count,
            `"${(r.list_names || '').replace(/"/g, '""')}"`
        ])
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `host-stats-${currentSetId}.csv` }).click();
    URL.revokeObjectURL(url);
}

// ─── CSV Export (current view) ────────────────────────────────────────────────
function setExportBtn(visible) {
    const btn = document.getElementById('export-btn');
    if (btn) btn.style.display = visible ? '' : 'none';
}

function exportCurrentView() {
    if (!currentViewData.length) { alert('내보낼 데이터가 없습니다.'); return; }
    const csv = [
        ['Name', 'Type', 'Enabled', 'Path', 'Condition', 'Actions'],
        ...currentViewData.map(n => [
            n.Name || '',
            n.Type || '',
            n.Enabled === 'true' ? '활성' : '비활성',
            n.Path || '',
            n.Condition || '',
            n.Actions || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`))
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const ts   = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    Object.assign(document.createElement('a'), { href: url, download: `policies-${currentSetId}-${ts}.csv` }).click();
    URL.revokeObjectURL(url);
}

// ─── Resizers ─────────────────────────────────────────────────────────────────
function initResizers() {
    setupResizer(
        document.getElementById('sidebar-resizer'),
        document.getElementById('sidebar'),
        180, 400, false
    );
    setupResizer(
        document.getElementById('detail-resizer'),
        document.getElementById('detail-panel'),
        300, 700, true
    );
}

function setupResizer(handle, target, min, max, reverse) {
    if (!handle || !target) return;
    let startX, startW;

    handle.addEventListener('mousedown', e => {
        e.preventDefault();
        startX = e.clientX;
        startW = target.getBoundingClientRect().width;
        handle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = e => {
            const delta = (e.clientX - startX) * (reverse ? -1 : 1);
            target.style.width = Math.max(min, Math.min(max, startW + delta)) + 'px';
        };
        const onUp = () => {
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ─── Tree Node Tooltip ────────────────────────────────────────────────────────
let _tooltipEl = null;

function showNodeTooltip(e, text) {
    // Only show if text is actually truncated
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;

    hideNodeTooltip();
    _tooltipEl = document.createElement('div');
    _tooltipEl.className = 'node-tooltip';
    _tooltipEl.textContent = text;
    document.body.appendChild(_tooltipEl);
    positionTooltip(e);
}

function hideNodeTooltip() {
    if (_tooltipEl) { _tooltipEl.remove(); _tooltipEl = null; }
}

function moveNodeTooltip(e) {
    if (_tooltipEl) positionTooltip(e);
}

function positionTooltip(e) {
    if (!_tooltipEl) return;
    const x = e.clientX + 14;
    const y = e.clientY + 14;
    const w = _tooltipEl.offsetWidth;
    const h = _tooltipEl.offsetHeight;
    _tooltipEl.style.left = (x + w > window.innerWidth  ? x - w - 20 : x) + 'px';
    _tooltipEl.style.top  = (y + h > window.innerHeight ? y - h - 20 : y) + 'px';
}

// ─── Diff Feature ─────────────────────────────────────────────────────────────

function openDiffModal() {
    const selA = document.getElementById('diff-select-a');
    const selB = document.getElementById('diff-select-b');
    const msg  = document.getElementById('diff-modal-msg');
    msg.classList.add('hidden');

    // history 드롭다운을 그대로 복제
    const histOpts = Array.from(document.getElementById('history-select').options)
        .filter(o => o.value);

    [selA, selB].forEach((sel, idx) => {
        sel.innerHTML = '<option value="">선택...</option>';
        histOpts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.textContent;
            sel.appendChild(opt);
        });
        // 기본 선택: A=첫번째, B=두번째
        if (histOpts[idx]) sel.value = histOpts[idx].value;
    });

    document.getElementById('diff-modal').classList.remove('hidden');
}

function closeDiffModal() {
    document.getElementById('diff-modal').classList.add('hidden');
}

async function runDiff() {
    const setA = document.getElementById('diff-select-a').value;
    const setB = document.getElementById('diff-select-b').value;
    const msg  = document.getElementById('diff-modal-msg');

    if (!setA || !setB) {
        msg.textContent = '비교할 파일 A와 B를 모두 선택해주세요.';
        msg.classList.remove('hidden');
        return;
    }
    if (setA === setB) {
        msg.textContent = '서로 다른 파일을 선택해주세요.';
        msg.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('diff-run-btn');
    btn.disabled = true;
    btn.textContent = '비교 중...';
    msg.classList.add('hidden');

    try {
        const res = await fetch(`/api/v1/diff?set_a=${setA}&set_b=${setB}`);
        if (!res.ok) {
            const e = await res.json();
            throw new Error(e.detail || res.statusText);
        }
        diffData    = await res.json();
        diffSetA    = parseInt(setA);
        diffSetB    = parseInt(setB);
        diffSection = null;

        closeDiffModal();
        // Diff 탭으로 전환
        document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'diff'));
        currentTab = 'diff';
        showDiffTab();
    } catch (err) {
        msg.textContent = '오류: ' + err.message;
        msg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = '비교 실행';
    }
}

function showDiffTab() {
    document.getElementById('main-toolbar').style.display = 'none';
    closeDetail();
    if (!diffData) {
        document.getElementById('sidebar-body').innerHTML = `
            <div class="sidebar-placeholder">
                헤더의 ⚖️ Diff 버튼을 클릭하여<br>비교할 파일 두 개를 선택하세요.
            </div>`;
        document.getElementById('main-body').innerHTML =
            '<div class="empty-state">Diff 결과가 없습니다.</div>';
        return;
    }
    renderDiffSidebar();
    if (diffSection) {
        renderDiffMain();
    } else {
        // 첫 진입 시 변경된 항목이 있는 첫 섹션 자동 선택
        const order = ['pol_changed','pol_added','pol_removed','lst_changed','lst_added','lst_removed'];
        const counts = getDiffCounts();
        const first = order.find(s => counts[s] > 0);
        if (first) selectDiffSection(first);
        else document.getElementById('main-body').innerHTML =
            '<div class="diff-empty">두 파일 간 차이가 없습니다.</div>';
    }
}

function getDiffCounts() {
    if (!diffData) return {};
    return {
        pol_added:   diffData.policies.summary.added,
        pol_removed: diffData.policies.summary.removed,
        pol_changed: diffData.policies.summary.changed,
        lst_added:   diffData.lists.summary.added,
        lst_removed: diffData.lists.summary.removed,
        lst_changed: diffData.lists.summary.changed,
    };
}

function renderDiffSidebar() {
    const body   = document.getElementById('sidebar-body');
    const counts = getDiffCounts();
    const sa     = diffData.set_a;
    const sb     = diffData.set_b;

    const sections = [
        { key: 'pol_added',   label: '생성된 정책',  type: 'added'   },
        { key: 'pol_removed', label: '삭제된 정책',  type: 'removed' },
        { key: 'pol_changed', label: '변경된 정책',  type: 'changed' },
        { key: 'lst_added',   label: '생성된 리스트', type: 'added'   },
        { key: 'lst_removed', label: '삭제된 리스트', type: 'removed' },
        { key: 'lst_changed', label: '변경된 리스트', type: 'changed' },
    ];

    const polSum = diffData.policies.summary;
    const lstSum = diffData.lists.summary;

    body.innerHTML = `
        <div class="diff-info-header">
            <div><strong>A</strong>: ${escapeHtml(sa.filename || '(알 수 없음)')}</div>
            <div><strong>B</strong>: ${escapeHtml(sb.filename || '(알 수 없음)')}</div>
        </div>
        <div class="diff-section-group">
            <div class="diff-section-label">정책 (Policy)</div>
            ${renderDiffSectionItem('pol_added',   '➕ 생성됨', counts.pol_added,   'added')}
            ${renderDiffSectionItem('pol_removed', '➖ 삭제됨', counts.pol_removed, 'removed')}
            ${renderDiffSectionItem('pol_changed', '✏️ 변경됨', counts.pol_changed, 'changed')}
        </div>
        <div class="diff-section-group">
            <div class="diff-section-label">리스트 (List)</div>
            ${renderDiffSectionItem('lst_added',   '➕ 생성됨', counts.lst_added,   'added')}
            ${renderDiffSectionItem('lst_removed', '➖ 삭제됨', counts.lst_removed, 'removed')}
            ${renderDiffSectionItem('lst_changed', '✏️ 변경됨', counts.lst_changed, 'changed')}
        </div>
        <div class="diff-info-header" style="margin-top:4px;font-size:10px;color:#aaa;">
            정책: ${polSum.unchanged}개 동일 · 리스트: ${lstSum.unchanged}개 동일
        </div>
    `;
}

function renderDiffSectionItem(key, label, count, type) {
    const isEmpty  = count === 0;
    const isActive = diffSection === key;
    const cls = ['diff-section-item', isEmpty ? 'empty' : '', isActive ? 'active' : ''].join(' ').trim();
    const countCls = isEmpty ? 'zero' : type;
    return `<div class="${cls}" onclick="${isEmpty ? '' : `selectDiffSection('${key}')`}">
        ${escapeHtml(label)}
        <span class="diff-count ${countCls}">${count}</span>
    </div>`;
}

function selectDiffSection(section) {
    diffSection = section;
    renderDiffSidebar();  // 활성 상태 갱신
    renderDiffMain();
}

function renderDiffMain() {
    if (!diffData || !diffSection) return;
    const main = document.getElementById('main-body');

    switch (diffSection) {
        case 'pol_added':   renderPoliciesList(diffData.policies.added,   'added',   '생성된 정책'); break;
        case 'pol_removed': renderPoliciesList(diffData.policies.removed, 'removed', '삭제된 정책'); break;
        case 'pol_changed': renderPoliciesChanged(diffData.policies.changed); break;
        case 'lst_added':   renderListsList(diffData.lists.added,   'added',   '생성된 리스트'); break;
        case 'lst_removed': renderListsList(diffData.lists.removed, 'removed', '삭제된 리스트'); break;
        case 'lst_changed': renderListsChanged(diffData.lists.changed); break;
    }
}

// 정책 추가/삭제 목록 렌더링
function renderPoliciesList(items, cardType, title) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = `<div class="diff-empty">${escapeHtml(title)}이 없습니다.</div>`;
        return;
    }
    const cards = items.map(p => {
        const badge = `<span class="diff-type-badge">${escapeHtml(p.Type || '')}</span>`;
        const enabledBadge = p.Enabled === 'false'
            ? `<span class="diff-type-badge" style="background:#fdecea;color:#c0392b;">비활성</span>` : '';
        const condHtml = p.Condition
            ? `<div class="diff-field-row"><td class="diff-field-key">Condition</td><td class="diff-field-val">${colorCondition(p.Condition)}</td></div>` : '';
        const actHtml  = p.Actions
            ? `<div class="diff-field-row"><td class="diff-field-key">Actions</td><td class="diff-field-val" style="font-size:11px;color:#555;">${escapeHtml(p.Actions)}</td></div>` : '';
        return `
        <div class="diff-card ${escapeHtml(cardType)}">
            <div class="diff-card-header">
                ${badge} ${escapeHtml(p.Name || '(이름 없음)')} ${enabledBadge}
            </div>
            <div class="diff-card-sub">${escapeHtml(p.Path || p.PolicyID || '')}</div>
            <table class="diff-field-table">
                ${condHtml}${actHtml}
            </table>
        </div>`;
    }).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;
}

// 변경된 정책 렌더링
function renderPoliciesChanged(items) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = '<div class="diff-empty">변경된 정책이 없습니다.</div>';
        return;
    }
    const cards = items.map(item => {
        const badge = `<span class="diff-type-badge">${escapeHtml(item.Type || '')}</span>`;
        const name  = item.changes.Name
            ? `<del>${escapeHtml(item.changes.Name.a || '')}</del> → <ins>${escapeHtml(item.changes.Name.b || '')}</ins>`
            : escapeHtml(item.b?.Name || item.a?.Name || '');

        const fieldRows = Object.entries(item.changes).map(([field, vals]) => {
            let beforeHtml = escapeHtml(vals.a || '');
            let afterHtml  = escapeHtml(vals.b || '');
            if (field === 'Condition') {
                beforeHtml = colorCondition(vals.a || '');
                afterHtml  = colorCondition(vals.b || '');
            }
            return `<tr class="diff-field-row">
                <td class="diff-field-key">${escapeHtml(field)}</td>
                <td class="diff-field-val">
                    <div class="diff-val-before">${beforeHtml}</div>
                    <div class="diff-val-after">${afterHtml}</div>
                </td>
            </tr>`;
        }).join('');

        return `
        <div class="diff-card changed">
            <div class="diff-card-header">${badge} ${name}</div>
            <div class="diff-card-sub">${escapeHtml(item.b?.Path || item.a?.Path || item.PolicyID || '')}</div>
            <table class="diff-field-table">${fieldRows}</table>
        </div>`;
    }).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;
}

// 리스트 추가/삭제 목록 렌더링
function renderListsList(items, cardType, title) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = `<div class="diff-empty">${escapeHtml(title)}이 없습니다.</div>`;
        return;
    }
    const cards = items.map(l => `
        <div class="diff-card ${escapeHtml(cardType)}">
            <div class="diff-card-header">📦 ${escapeHtml(l.list_name || '(이름 없음)')}</div>
            <div class="diff-card-sub">${escapeHtml(l.list_id || '')}</div>
        </div>`
    ).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;
}

// 변경된 리스트 렌더링
function renderListsChanged(items) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = '<div class="diff-empty">변경된 리스트가 없습니다.</div>';
        return;
    }
    const PREVIEW = 20;
    const cards = items.map(l => {
        const added   = l.entries_added   || [];
        const removed = l.entries_removed || [];

        const renderEntries = (arr, type, listId) => {
            const shown = arr.slice(0, PREVIEW);
            const rest  = arr.length - shown.length;
            const rows  = shown.map(v =>
                `<div class="diff-entry-${escapeHtml(type)}">${escapeHtml(v)}</div>`
            ).join('');
            const more  = rest > 0
                ? `<button class="diff-more-btn" onclick="diffExpandEntries(this,'${escapeHtml(listId)}','${escapeHtml(type)}')" data-all='${escapeHtml(JSON.stringify(arr))}'>▼ ${rest}개 더 보기</button>`
                : '';
            return rows + more;
        };

        return `
        <div class="diff-card changed">
            <div class="diff-card-header">📦 ${escapeHtml(l.list_name || '(이름 없음)')}</div>
            <div class="diff-card-sub">${escapeHtml(l.list_id || '')} · A: ${l.entry_count_a}개 → B: ${l.entry_count_b}개</div>
            ${renderEntries(added,   'added',   l.list_id)}
            ${renderEntries(removed, 'removed', l.list_id)}
        </div>`;
    }).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;
}

function diffExpandEntries(btn, listId, type) {
    const all = JSON.parse(btn.getAttribute('data-all'));
    const rows = all.map(v => `<div class="diff-entry-${escapeHtml(type)}">${escapeHtml(v)}</div>`).join('');
    btn.insertAdjacentHTML('beforebegin', rows);
    btn.remove();
}
