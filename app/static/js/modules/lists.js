import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml, highlight } from './utils.js';
import { createPolicyRow } from './policy.js';

export function renderListsSidebar(filterText = '') {
    const body = document.getElementById('sidebar-body');
    if (!body) return;

    if (!state.currentSetId || !Object.keys(state.objectsMap).length) {
        body.innerHTML = '<div class="sidebar-placeholder">정책을 먼저 선택하세요.</div>';
        return;
    }

    const isValue = state.listSearchMode === 'value';
    body.innerHTML = `
        <div class="list-mode-tabs">
            <button class="lm-tab ${!isValue ? 'active' : ''}" id="list-mode-name-btn">📋 이름 검색</button>
            <button class="lm-tab ${isValue ? 'active' : ''}" id="list-mode-value-btn">🔍 값 검색</button>
        </div>
        <div class="list-filter-wrap">
            <input type="text" id="list-search-input"
                   placeholder="${isValue ? '값 검색 (예: google.com)...' : 'List 이름 검색...'}"
                   value="${escapeHtml(filterText)}">
        </div>
        ${isValue && !filterText ? `<div class="list-value-hint">값을 입력하면 해당 값이 포함된<br>모든 List와 참조 정책을 한눈에 표시합니다.</div>` : ''}
        <div id="list-names-panel"></div>
    `;

    document.getElementById('list-mode-name-btn').onclick = () => setListSearchMode('name');
    document.getElementById('list-mode-value-btn').onclick = () => setListSearchMode('value');
    document.getElementById('list-search-input').oninput = (e) => handleListSearch(e.target.value);

    if (isValue) {
        if (filterText.trim()) searchListsByValue(filterText.trim());
        else document.getElementById('main-body').innerHTML =
            '<div class="empty-state">검색할 값을 왼쪽에 입력하세요.</div>';
    } else {
        filterAndRenderLists(filterText);
    }
}

export function setListSearchMode(mode) {
    state.listSearchMode = mode;
    state.activeListId   = null;
    renderListsSidebar('');
    if (mode === 'name')
        document.getElementById('main-body').innerHTML =
            '<div class="empty-state">왼쪽에서 List를 선택하세요.</div>';
}

export function handleListSearch(value) {
    clearTimeout(state.listSearchTimer);
    if (state.listSearchMode === 'name') {
        filterAndRenderLists(value);
    } else {
        if (!value.trim()) {
            const panel = document.getElementById('list-names-panel');
            if (panel) panel.innerHTML = '';
            document.getElementById('main-body').innerHTML =
                '<div class="empty-state">검색할 값을 입력하세요.</div>';
            return;
        }
        state.listSearchTimer = setTimeout(() => searchListsByValue(value.trim()), 250);
    }
}

export function filterAndRenderLists(filterText) {
    const panel = document.getElementById('list-names-panel');
    if (!panel) return;

    const lower   = (filterText || '').toLowerCase();
    const entries = Object.entries(state.objectsMap)
        .filter(([, o]) => !lower || o.name.toLowerCase().includes(lower))
        .sort(([, a], [, b]) => a.name.localeCompare(b.name));

    if (!entries.length) {
        panel.innerHTML = '<div class="sidebar-placeholder">표시할 List 없음</div>';
        return;
    }

    panel.innerHTML = entries.map(([id, o]) => `
        <div class="list-name-item ${id === state.activeListId ? 'active' : ''}"
             data-list-id="${escapeHtml(id)}"
             title="${escapeHtml(id)}">
            <span class="list-name-text">${escapeHtml(o.name)}</span>
            <span class="list-count">${o.entries.length}</span>
        </div>
    `).join('');

    panel.querySelectorAll('.list-name-item').forEach(el => {
        el.onclick = () => selectList(el.dataset.listId);
    });
}

export function selectList(listId) {
    state.activeListId = listId;
    document.querySelectorAll('.list-name-item').forEach(el =>
        el.classList.toggle('active', el.dataset.listId === listId)
    );
    showListEntries(listId, '');
}

export function searchListsByValue(value) {
    const lower = value.toLowerCase();
    const matchingLists = [];

    for (const [id, obj] of Object.entries(state.objectsMap)) {
        const matches = obj.entries.filter(e =>
            (e.value || '').toLowerCase().includes(lower)
        );
        if (matches.length) matchingLists.push({ id, obj, matches });
    }
    matchingLists.sort((a, b) => b.matches.length - a.matches.length);

    const panel = document.getElementById('list-names-panel');
    if (panel) {
        if (!matchingLists.length) {
            panel.innerHTML = '<div class="sidebar-placeholder">일치하는 항목 없음</div>';
        } else {
            panel.innerHTML = matchingLists.map(({ id, obj, matches }) => `
                <div class="list-name-item ${id === state.activeListId ? 'active' : ''}"
                     data-list-id="${escapeHtml(id)}"
                     title="${escapeHtml(id)}">
                    <span class="list-name-text">${escapeHtml(obj.name)}</span>
                    <span class="list-count" style="background:var(--primary);color:white;">${matches.length}</span>
                </div>
            `).join('');
            panel.querySelectorAll('.list-name-item').forEach(el => {
                el.onclick = () => selectList(el.dataset.listId);
            });
        }
    }

    renderValueSearchResults(value, matchingLists);
}

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

    matchingLists.forEach(({ id, obj, matches }) => {
        const block = document.createElement('div');
        block.className = 'vr-list-block';
        block.innerHTML = `
            <div class="vr-list-header" data-list-id="${escapeHtml(id)}">
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
        block.querySelector('.vr-list-header').onclick = () => selectList(id);
        body.appendChild(block);
    });

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

async function loadPoliciesForLists(value, matchingLists, barEl, containerEl) {
    if (!state.currentSetId || !matchingLists.length) {
        barEl.textContent = '참조 정책 없음';
        containerEl.innerHTML = '';
        return;
    }
    try {
        const seen     = new Set();
        const policies = [];
        for (const { obj } of matchingLists) {
            const list = await api.searchPolicies(state.currentSetId, obj.name);
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

export function showListEntries(listId, filterText) {
    const obj  = state.objectsMap[listId];
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
            <input type="text" id="list-entry-search" placeholder="항목 검색..." value="${escapeHtml(filterText)}">
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

    document.getElementById('list-entry-search').oninput = (e) => showListEntries(listId, e.target.value);
    loadListRefs(listId);
}

async function loadListRefs(listId) {
    const obj   = state.objectsMap[listId];
    const refsEl = document.getElementById('list-refs-content');
    if (!obj || !state.currentSetId || !refsEl) return;

    try {
        const list = await api.searchPolicies(state.currentSetId, obj.name);
        state.listRefPolicies = list;

        if (!state.listRefPolicies.length) {
            refsEl.innerHTML = '<div style="padding:8px 12px;color:#999;font-size:11px;">참조하는 정책 없음</div>';
            return;
        }

        refsEl.innerHTML = state.listRefPolicies.map((p, i) => `
            <div class="list-ref-item" data-ref-idx="${i}">
                <div class="ref-name"><span class="entry-badge">${escapeHtml(p.Type)}</span> ${escapeHtml(p.Name)}</div>
                <div class="ref-path">${escapeHtml(p.Path)}</div>
            </div>
        `).join('');

        // Note: NavigateToNode should be imported and called. Let's assume it's in a shared module or main.
        // For now, using a Custom Event or similar is better, but let's keep it simple.
    } catch (err) {
        refsEl.innerHTML = `<div style="padding:8px 12px;color:red;font-size:11px;">${escapeHtml(err.message)}</div>`;
    }
}
