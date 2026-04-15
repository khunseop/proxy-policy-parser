import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml, highlight, formatConditionShort, colorCondition, detectExpiry } from './utils.js';
import { setExportBtn, showNodeTooltip, hideNodeTooltip, moveNodeTooltip } from './ui.js';
import { openDetail } from './detail.js';

// ─── Policy Sidebar Tree ──────────────────────────────────────────────────────
export function renderPolicySidebar() {
    const body = document.getElementById('sidebar-body');
    if (!body) return;
    body.innerHTML = '';

    const searchDiv = document.createElement('div');
    searchDiv.className = 'sidebar-search';
    searchDiv.innerHTML = `
        <input type="text" id="sidebar-tree-search" placeholder="트리 검색...">
        <button class="btn sm" id="find-expired-btn" style="width:100%;margin-top:5px;color:#c0392b;border-color:#f5c6c6;">⏰ 만료/임박 정책 찾기</button>
    `;
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
        const nodes = await api.searchPolicies(state.currentSetId, '');

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

// ─── Search ───────────────────────────────────────────────────────────────────
export async function performSearch(query) {
    if (!state.currentSetId || !query) return;
    state.isSearchMode = true;
    setExportBtn(false);

    const bar = document.getElementById('breadcrumb');
    bar.innerHTML = `<span style="color:var(--text-sec);">검색:</span> <strong>${escapeHtml(query)}</strong>`;

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">검색 중...</div>';

    try {
        const results = await api.searchPolicies(state.currentSetId, query);

        body.innerHTML = '';
        const header = document.createElement('div');
        header.className   = 'results-header';
        header.textContent = `"${query}" — ${results.length}개 결과`;
        body.appendChild(header);

        if (!results.length) {
            body.innerHTML += '<div class="empty-state">검색 결과가 없습니다.</div>';
            state.currentViewData = [];
        } else {
            state.currentViewData = results;
            document.getElementById('policy-stats').textContent = `${results.length}개 결과`;
            const frag = document.createDocumentFragment();
            results.forEach(n => frag.appendChild(createPolicyRow(n, query)));
            body.appendChild(frag);
            setExportBtn(true);
        }
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        state.currentViewData = [];
    }
}

export function clearSearch() {
    state.isSearchMode = false;
    const input = document.getElementById('main-search');
    if (input) input.value = '';
    document.getElementById('search-clear')?.classList.add('hidden');
    if (state.currentSetId && state.currentTab === 'policies') loadMainContent(state.currentPath);
}

/** 만료/임박 정책만 필터링해서 메인 패널에 표시 */
export async function findExpiredPolicies() {
    if (!state.currentSetId) return;
    state.isSearchMode = true;
    setExportBtn(false);

    const bar = document.getElementById('breadcrumb');
    bar.innerHTML = `<span style="color:#c0392b;font-weight:600;">⏰ 만료/임박 정책</span>`;

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">전체 정책 분석 중...</div>';

    try {
        const all = await api.searchPolicies(state.currentSetId, '');

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
            state.currentViewData = [];
        } else {
            state.currentViewData = results;
            const frag = document.createDocumentFragment();
            results.forEach(n => frag.appendChild(createPolicyRow(n, null, true)));
            body.appendChild(frag);
            setExportBtn(true);
        }
    } catch(err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
        state.currentViewData = [];
    }
}

export function exportCurrentView() {
    if (!state.currentViewData.length) { alert('내보낼 데이터가 없습니다.'); return; }
    const csv = [
        ['Name', 'Type', 'Enabled', 'Path', 'Condition', 'Actions'],
        ...state.currentViewData.map(n => [
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
    Object.assign(document.createElement('a'), { href: url, download: `policies-${state.currentSetId}-${ts}.csv` }).click();
    URL.revokeObjectURL(url);
}
