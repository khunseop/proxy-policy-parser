import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml, highlight, formatConditionShort, colorCondition, detectExpiry } from './utils.js';
import { setExportBtn, setLoading, showNodeTooltip, hideNodeTooltip, moveNodeTooltip } from './ui.js';
import { openDetail } from './detail.js';

// ─── Policy Sidebar Tree ──────────────────────────────────────────────────────
export function renderPolicySidebar() {
    const body = document.getElementById('sidebar-body');
    if (!body) return;
    body.innerHTML = '';

    const searchDiv = document.createElement('div');
    searchDiv.className = 'sidebar-search';
    searchDiv.innerHTML = `<input type="text" id="sidebar-tree-search" placeholder="트리 검색...">`;
    body.appendChild(searchDiv);

    const root = document.createElement('div');
    root.id = 'policy-tree-root';
    body.appendChild(root);

    loadTreeLevel('', root, 0);
}

export async function loadTreeLevel(parentPath, container, level) {
    container.innerHTML = '<div class="tree-loading">로딩 중...</div>';
    try {
        const nodes = await api.fetchPolicies(state.currentSetId, parentPath);
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

// ─── Main Content ─────────────────────────────────────────────────────────────
export async function loadMainContent(parentPath) {
    if (!state.currentSetId) return;
    state.isSearchMode = false;
    state.currentPath  = parentPath;
    updateBreadcrumb(parentPath);
    setExportBtn(false);

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">로딩 중...</div>';

    try {
        const nodes = await api.fetchPolicies(state.currentSetId, parentPath);

        if (!nodes.length) {
            body.innerHTML = '<div class="empty-state">하위 항목이 없습니다.</div>';
            state.currentViewData = [];
            return;
        }

        body.innerHTML = '';
        state.currentViewData = nodes;
        const frag = document.createDocumentFragment();
        nodes.forEach(n => frag.appendChild(createPolicyRow(n, null)));
        body.appendChild(frag);
        document.getElementById('policy-stats').textContent = `${nodes.length}개 항목`;
        setExportBtn(true);
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        state.currentViewData = [];
    }
}

export async function loadAllPolicies() {
    if (!state.currentSetId) return;
    state.isSearchMode = false;
    state.currentPath  = '';
    updateBreadcrumb('');
    setExportBtn(false);

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">로딩 중...</div>';

    try {
        const nodes = await api.searchPolicies(state.currentSetId, { limit: 20000 });

        if (!nodes.length) {
            body.innerHTML = '<div class="empty-state">정책이 없습니다.</div>';
            state.currentViewData = [];
            return;
        }

        body.innerHTML = '';
        state.currentViewData = nodes;
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
        state.currentViewData = [];
    }
}

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
        // Note: Global click handler would be better, but keeping onclick for simplicity in this migration
        return `${prefix}<span class="path-seg" data-path="${escapeHtml(cumPath)}">${escapeHtml(seg)}</span>`;
    }).join('');
}

export function createPolicyRow(node, query, showPath = false) {
    const row     = document.createElement('div');
    const isGroup = node.Type === 'Group';
    const enabled = node.Enabled === 'true';
    const doShowPath = showPath || !!query;

    row.className = `policy-row${isGroup ? ' group-row' : ''}`;
    if (node._pk_auto && node._pk_auto === state.selectedPk) row.classList.add('active');

    let condPreview = '';
    const expiry = detectExpiry(node.Condition || '');
    if (node.Condition && node.Condition !== 'Always' && node.Condition !== 'None') {
        const formatted = formatConditionShort(node.Condition) || node.Condition;
        condPreview = `<span class="row-cond">${colorCondition(formatted, query)}</span>`;
    }

    let expiryBadge = '';
    if (expiry) {
        if (expiry.expired) {
            expiryBadge = `<span class="badge expired">만료 (${expiry.endDate.toLocaleDateString('ko')})</span>`;
        } else if (expiry.expiringSoon) {
            expiryBadge = `<span class="badge expiring">D-${expiry.daysLeft} 만료</span>`;
        }
    }

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

    row.onclick = (e) => {
        const pathSeg = e.target.closest('.path-seg');
        if (pathSeg) {
            e.stopPropagation();
            loadMainContent(pathSeg.dataset.path);
            return;
        }

        document.querySelectorAll('.policy-row.active').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        state.selectedPk = node._pk_auto;

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

export function getTreeRowByPath(path) {
    for (const row of document.querySelectorAll('.tree-node-row')) {
        if (row.dataset.path === path) return row;
    }
    return null;
}

export async function autoExpandTreeToPath(fullPath) {
    if (!fullPath) return;
    const segs = fullPath.split(' > ');

    document.querySelectorAll('.tree-node-row.selected').forEach(r => r.classList.remove('selected'));

    let cumPath = '';
    for (let i = 0; i < segs.length; i++) {
        cumPath = i === 0 ? segs[i] : `${cumPath} > ${segs[i]}`;
        const isLast = i === segs.length - 1;

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
        }

        const row = getTreeRowByPath(cumPath);
        if (!row) break;

        if (isLast) {
            row.classList.add('selected');
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
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
export function updateBreadcrumb(path) {
    const bar = document.getElementById('breadcrumb');
    if (!bar) return;

    if (!path) {
        bar.innerHTML = '<span class="crumb crumb-root" data-path="">Root</span>';
        return;
    }

    const segs = path.split(' > ');
    let html   = '<span class="crumb crumb-root" data-path="">Root</span>';
    let cum    = '';

    segs.forEach((seg, i) => {
        cum = i === 0 ? seg : `${cum} > ${seg}`;
        const cp = cum.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += '<span class="crumb-sep">›</span>';
        html += i < segs.length - 1
            ? `<span class="crumb" data-path="${escapeHtml(cp)}">${escapeHtml(seg)}</span>`
            : `<span class="crumb crumb-active">${escapeHtml(seg)}</span>`;
    });

    bar.innerHTML = html;
}

// ─── Filter Helpers ───────────────────────────────────────────────────────────
export function isFiltersActive() {
    return (
        (document.getElementById('filter-enabled')?.value || '')    !== ''        ||
        (document.getElementById('filter-expiry')?.value  || '')    !== ''        ||
        (document.getElementById('filter-fields')?.value  || 'all') !== 'all'     ||
        (document.getElementById('filter-match')?.value   || 'contains') !== 'contains'
    );
}

function updateFilterUI() {
    const hasActive = isFiltersActive() || !!(document.getElementById('main-search')?.value.trim());
    document.getElementById('filter-reset-btn')?.classList.toggle('hidden', !hasActive);

    const defaults = { 'filter-enabled': '', 'filter-expiry': '', 'filter-fields': 'all', 'filter-match': 'contains' };
    Object.entries(defaults).forEach(([id, def]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('filter-active', el.value !== def);
    });
}

export function applyFilters() {
    updateFilterUI();
    if (!state.currentSetId) return;
    const query = document.getElementById('main-search')?.value.trim() || '';
    if (!query && !isFiltersActive()) { clearSearch(); return; }
    performFilteredSearch(query);
}

export function resetFilters() {
    ['filter-enabled', 'filter-expiry', 'filter-fields', 'filter-match'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0;
    });
    document.querySelectorAll('.toolbar-search-row select').forEach(s => s.classList.remove('filter-active'));
    document.getElementById('filter-reset-btn')?.classList.add('hidden');
    const query = document.getElementById('main-search')?.value.trim() || '';
    if (!query) clearSearch(); else performFilteredSearch(query);
}

// ─── Search ───────────────────────────────────────────────────────────────────
export async function performFilteredSearch(query) {
    if (!state.currentSetId) return;

    const enabledFilter = document.getElementById('filter-enabled')?.value || '';
    const expiryFilter  = document.getElementById('filter-expiry')?.value  || '';
    const fieldsFilter  = document.getElementById('filter-fields')?.value  || 'all';
    const matchFilter   = document.getElementById('filter-match')?.value   || 'contains';
    const exact         = matchFilter === 'exact';

    if (!query && !isFiltersActive()) { clearSearch(); return; }

    state.isSearchMode = true;
    setExportBtn(false);

    // Breadcrumb label
    const parts = [];
    if (query)                       parts.push(`"${escapeHtml(query)}"`);
    if (enabledFilter === 'true')    parts.push('활성');
    if (enabledFilter === 'false')   parts.push('비활성');
    if (expiryFilter  === 'expired') parts.push('만료됨');
    if (expiryFilter  === 'expiring')parts.push('D-30 임박');
    if (fieldsFilter  !== 'all')     parts.push({ name: '이름', condition: '조건', actions: '액션' }[fieldsFilter] || fieldsFilter);
    if (exact)                       parts.push('정확히 매칭');

    document.getElementById('breadcrumb').innerHTML =
        `<span style="color:var(--text-sec);">필터:</span> ${parts.join(' · ')}`;

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">검색 중...</div>';

    try {
        const results = await api.searchPolicies(state.currentSetId, {
            query,
            enabled: enabledFilter,
            exact: exact ? '1' : '0',
            fields: fieldsFilter,
            limit: 20000,
        });

        // Client-side expiry filter (timeinrangeiso is embedded in Condition text)
        const filtered = expiryFilter
            ? results.filter(n => {
                const exp = detectExpiry(n.Condition || '');
                if (!exp) return false;
                return expiryFilter === 'expired' ? exp.expired : exp.expiringSoon;
              })
            : results;

        body.innerHTML = '';
        const header = document.createElement('div');
        header.className   = 'results-header';
        const scopeNote = `전체 정책에서 검색`;
        header.textContent = `${parts.join(' · ')} — ${filtered.length}개 결과 (${scopeNote})`;
        body.appendChild(header);

        if (!filtered.length) {
            body.innerHTML += '<div class="empty-state">검색 결과가 없습니다.</div>';
            state.currentViewData = [];
        } else {
            state.currentViewData = filtered;
            document.getElementById('policy-stats').textContent = `${filtered.length}개 결과`;
            const frag = document.createDocumentFragment();
            filtered.forEach(n => frag.appendChild(createPolicyRow(n, query || null, true)));
            body.appendChild(frag);
            setExportBtn(true);
        }
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        state.currentViewData = [];
    }
}

// backward-compat alias used by tree-search
export const performSearch = performFilteredSearch;

export function clearSearch() {
    state.isSearchMode = false;
    const input = document.getElementById('main-search');
    if (input) input.value = '';
    document.getElementById('search-clear')?.classList.add('hidden');
    updateFilterUI();
    if (state.currentSetId && state.currentTab === 'policies') loadMainContent(state.currentPath);
}

export function exportCurrentView() {
    if (!state.currentViewData.length) { alert('내보낼 데이터가 없습니다.'); return; }

    setLoading(true, '엑셀 파일 생성 중...');

    try {
        const sheet1Data = [
            ['Name', 'Type', 'Enabled', 'Path', 'Condition', 'Actions', 'Referenced Lists']
        ];

        const referencedLists = new Set();
        const policyRefs = [];

        // 참조 리스트 추출
        state.currentViewData.forEach(n => {
            const cond = n.Condition || '';
            const listIds = [];
            const re = /List\(([^)]+)\)/g;
            let match;
            while ((match = re.exec(cond)) !== null) {
                const nameOrId = match[1];
                let listId = nameOrId;
                if (!state.objectsMap[nameOrId] && state.objectsNameToId[nameOrId]) {
                    listId = state.objectsNameToId[nameOrId];
                }
                if (state.objectsMap[listId]) {
                    listIds.push(listId);
                    referencedLists.add(listId);
                }
            }
            policyRefs.push(listIds);
        });

        // Sheet 2: Referenced Lists 데이터 구성
        const sheet2Data = [
            ['List Name', 'List ID', 'Value', 'Type', 'Description']
        ];
        const listRowMap = {};
        let currentRow = 2; // 헤더는 1행

        referencedLists.forEach(listId => {
            listRowMap[listId] = currentRow;
            const obj = state.objectsMap[listId];
            if (obj && obj.entries) {
                if (obj.entries.length === 0) {
                    sheet2Data.push([obj.name || '', listId, '(빈 리스트)', '', '']);
                    currentRow++;
                } else {
                    obj.entries.forEach(e => {
                        sheet2Data.push([
                            obj.name || '',
                            listId,
                            e.value || '',
                            e.type || '',
                            e.details || ''
                        ]);
                        currentRow++;
                    });
                }
            }
        });

        // Sheet 1: Policies 데이터 구성
        state.currentViewData.forEach((n, idx) => {
            const listsUsed = policyRefs[idx];
            const listNames = listsUsed.map(id => state.objectsMap[id].name).join(', ');

            sheet1Data.push([
                n.Name || '',
                n.Type || '',
                n.Enabled === 'true' ? '활성' : '비활성',
                n.Path || '',
                n.Condition || '',
                n.Actions || '',
                listNames
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
        const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

        // 하이퍼링크 적용 (첫 번째 참조 리스트로 연결)
        policyRefs.forEach((listsUsed, idx) => {
            if (listsUsed.length > 0) {
                const firstListId = listsUsed[0];
                const targetRow = listRowMap[firstListId];
                if (targetRow) {
                    const cellRef = XLSX.utils.encode_cell({ c: 6, r: idx + 1 });
                    if (!ws1[cellRef]) ws1[cellRef] = { t: 's', v: sheet1Data[idx + 1][6] };
                    ws1[cellRef].l = { 
                        Target: `#'Referenced Lists'!A${targetRow}`, 
                        Tooltip: "클릭하여 리스트 상세 정보로 이동" 
                    };
                }
            }
        });

        XLSX.utils.book_append_sheet(wb, ws1, "Policies");
        XLSX.utils.book_append_sheet(wb, ws2, "Referenced Lists");

        const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        XLSX.writeFile(wb, `policies-${state.currentSetId}-${ts}.xlsx`);
    } catch (err) {
        console.error('엑셀 내보내기 실패:', err);
        alert('엑셀 파일 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
        setLoading(false);
    }
}
