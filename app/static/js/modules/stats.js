import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { createPolicyRow } from './policy.js';

export function renderStatsSidebar() {
    const body = document.getElementById('sidebar-body');
    if (!body) return;
    body.innerHTML = `
        <div class="stats-sidebar-wrap">
            <button class="btn sm" style="width:100%;" id="stats-refresh-btn">🔄 새로고침</button>
            <button class="btn sm" style="width:100%;" id="stats-csv-btn">⬇️ CSV 내보내기</button>
            <div class="section-label">값 조회</div>
            <div class="value-lookup-row">
                <input type="text" id="value-search-input" placeholder="IP, 도메인...">
                <button class="btn sm primary" id="value-lookup-btn">조회</button>
            </div>
            <div style="font-size:10px;color:var(--text-sec);margin-top:4px;line-height:1.5;">
                값을 입력하면 해당 값이 포함된 정책을 찾아줍니다.
            </div>
        </div>
    `;

    document.getElementById('stats-refresh-btn').onclick = loadStatsData;
    document.getElementById('stats-csv-btn').onclick = exportStatsCSV;
    document.getElementById('value-lookup-btn').onclick = doValueSearch;
    document.getElementById('value-search-input').onkeydown = (e) => { if(e.key==='Enter') doValueSearch(); };
}

export async function loadStatsData() {
    const body = document.getElementById('main-body');
    if (!state.currentSetId) {
        body.innerHTML = '<div class="empty-state">정책을 먼저 선택하세요.</div>';
        return;
    }
    body.innerHTML = '<div class="loading">통계 분석 중...</div>';
    try {
        const [hostData, policyStats] = await Promise.all([
            api.fetchTopHosts(state.currentSetId),
            api.fetchPolicyStats(state.currentSetId)
        ]);
        state.statsData   = hostData;
        state.policyStats = policyStats;
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
    if (state.policyStats) {
        document.getElementById('policy-stats-cards').innerHTML = renderPolicyStatsCards(state.policyStats);
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

export function renderStatsTable() {
    const body = document.getElementById('stats-table-container');
    if (!body || !state.statsData.length) {
        if (body) body.innerHTML = '<div class="empty-state">데이터가 없습니다.</div>';
        return;
    }

    const sorted = [...state.statsData].sort((a, b) => {
        let va = a[state.statsSortCol], vb = b[state.statsSortCol];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
        return va < vb ? (state.statsSortDir === 'asc' ? -1 : 1) : va > vb ? (state.statsSortDir === 'asc' ? 1 : -1) : 0;
    });
    state.statsSortedData = sorted;

    const si = col => col !== state.statsSortCol
        ? '<span class="sort-icon">⇅</span>'
        : `<span class="sort-icon active">${state.statsSortDir === 'asc' ? '↑' : '↓'}</span>`;

    body.innerHTML = `
        <div class="stats-toolbar-bar">
            <span class="stats-title">📊 Host 통계</span>
            <span style="font-size:11px;color:var(--text-sec);">${sorted.length}개 항목</span>
        </div>
        <table class="stats-table">
            <thead>
                <tr>
                    <th id="sort-val-btn">Value (Host/IP) ${si('entry_value')}</th>
                    <th id="sort-count-btn" style="text-align:right;">참조 정책 수 ${si('policy_count')}</th>
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

    document.getElementById('sort-val-btn').onclick = () => sortStats('entry_value');
    document.getElementById('sort-count-btn').onclick = () => sortStats('policy_count');

    body.querySelector('tbody').onclick = e => {
        const row = e.target.closest('tr[data-stats-idx]');
        if (row) {
            const r = state.statsSortedData[parseInt(row.dataset.statsIdx, 10)];
            if (r) doValueSearchFor(r.entry_value || '');
        }
    };
}

export function sortStats(col) {
    state.statsSortDir = state.statsSortCol === col ? (state.statsSortDir === 'asc' ? 'desc' : 'asc') : (col === 'policy_count' ? 'desc' : 'asc');
    state.statsSortCol = col;
    renderStatsTable();
}

export async function doValueSearch() {
    const input = document.getElementById('value-search-input');
    if (input?.value.trim()) doValueSearchFor(input.value.trim());
}

export async function doValueSearchFor(value) {
    if (!value || !state.currentSetId) return;

    // Switch to policies tab view (this logic needs to be coordinated with main.js)
    state.isSearchMode = true;
    const bar = document.getElementById('breadcrumb');
    if (bar) bar.innerHTML = `<span style="color:var(--text-sec);">값 조회:</span> <strong>${escapeHtml(value)}</strong>`;

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">분석 중...</div>';

    try {
        const result = await api.fetchValueLookup(state.currentSetId, value);

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
            const listName = state.objectsMap[item.MatchedListID]?.name || item.MatchedListID;
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

export function exportStatsCSV() {
    if (!state.statsData.length) { alert('내보낼 데이터가 없습니다.'); return; }
    const rows = state.statsSortedData.length ? state.statsSortedData : state.statsData;
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
    Object.assign(document.createElement('a'), { href: url, download: `host-stats-${state.currentSetId}.csv` }).click();
    URL.revokeObjectURL(url);
}
