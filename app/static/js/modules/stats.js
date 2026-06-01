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
            <div class="section-label">정책 추출</div>
            <button class="btn sm" style="width:100%;" id="stats-csv-btn">⬇️ 정책 Excel 내보내기</button>
            <div class="section-label">리스트 추출</div>
            <button class="btn sm" style="width:100%;" id="lists-export-all-btn">⬇️ 전체 리스트 Excel 저장</button>
            <div class="section-label">값 조회 (단건)</div>
            <div class="value-lookup-row">
                <input type="text" id="value-search-input" placeholder="IP, 도메인...">
                <button class="btn sm primary" id="value-lookup-btn">조회</button>
            </div>
            <div class="section-label">배치 값 조회</div>
            <textarea id="batch-value-input" placeholder="값을 콤마(,)로 구분하여 붙여넣으세요&#10;예: google.com, 10.0.0.1, ..."></textarea>
            <div class="batch-btn-row">
                <button class="btn sm primary" id="batch-lookup-btn">🔍 조회</button>
                <button class="btn sm" id="batch-export-btn">⬇️ Excel 저장</button>
            </div>
        </div>
    `;

    document.getElementById('stats-refresh-btn').onclick = loadStatsData;
    document.getElementById('stats-csv-btn').onclick = exportStatsCSV;
    document.getElementById('lists-export-all-btn').onclick = () => {
        if (!state.currentSetId) { alert('정책을 먼저 선택하세요.'); return; }
        const a = document.createElement('a');
        a.href = `/api/v1/objects/${state.currentSetId}/export-all`;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    document.getElementById('value-lookup-btn').onclick = doValueSearch;
    document.getElementById('value-search-input').onkeydown = (e) => { if(e.key==='Enter') doValueSearch(); };
    document.getElementById('batch-lookup-btn').onclick = doBatchLookup;
    document.getElementById('batch-export-btn').onclick = doBatchExport;
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

function parseBatchInput() {
    const raw = (document.getElementById('batch-value-input')?.value || '').trim();
    if (!raw) return [];
    return raw.split(',').map(v => v.trim()).filter(Boolean);
}

export async function doBatchLookup() {
    if (!state.currentSetId) { alert('정책을 먼저 선택하세요.'); return; }
    const values = parseBatchInput();
    if (!values.length) { alert('값을 입력하세요.'); return; }

    const body = document.getElementById('main-body');
    body.innerHTML = '<div class="loading">배치 조회 중...</div>';

    try {
        const result = await api.valueLookupBatch(state.currentSetId, values);
        renderBatchResults(result);
    } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:red;">${escapeHtml(err.message)}</div>`;
    }
}

export async function doBatchExport() {
    if (!state.currentSetId) { alert('정책을 먼저 선택하세요.'); return; }
    const values = parseBatchInput();
    if (!values.length) { alert('값을 입력하세요.'); return; }

    try {
        await api.downloadValueLookupBatch(state.currentSetId, values);
    } catch (err) {
        alert('Excel 저장 실패: ' + err.message);
    }
}

function renderBatchResults(result) {
    const body = document.getElementById('main-body');
    body.innerHTML = '';

    // 요약 헤더
    const header = document.createElement('div');
    header.className = 'results-header';
    header.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span>입력 <strong>${result.total_input}</strong>개 중 <strong>${result.matched_count}</strong>개 매칭 &nbsp;·&nbsp; 정책 <strong>${result.policy_count}</strong>개 발견</span>
            <button class="btn sm" id="batch-result-export-btn">⬇️ Excel 저장</button>
        </div>
    `;
    body.appendChild(header);
    document.getElementById('batch-result-export-btn').onclick = doBatchExport;

    // 미매칭 값
    if (result.unmatched_values?.length) {
        const unmatchedDiv = document.createElement('div');
        unmatchedDiv.className = 'batch-unmatched-wrap';
        unmatchedDiv.innerHTML = `
            <div class="batch-unmatched-header" id="batch-unmatched-toggle">
                ⚠️ 미매칭 값 ${result.unmatched_values.length}개 <span style="font-size:10px;opacity:0.6;">(클릭하여 펼치기)</span>
            </div>
            <div class="batch-unmatched-list hidden" id="batch-unmatched-list">
                ${result.unmatched_values.map(v => `<span class="batch-unmatched-item">${escapeHtml(v)}</span>`).join('')}
            </div>
        `;
        body.appendChild(unmatchedDiv);
        document.getElementById('batch-unmatched-toggle').onclick = () => {
            document.getElementById('batch-unmatched-list').classList.toggle('hidden');
        };
    }

    if (!result.policies?.length) {
        body.innerHTML += '<div class="empty-state">해당 값을 참조하는 정책이 없습니다.</div>';
        return;
    }

    // 정책 목록
    const bar = document.createElement('div');
    bar.className = 'vr-policies-bar';
    bar.textContent = `정책 목록 — ${result.policy_count}개`;
    body.appendChild(bar);

    const frag = document.createDocumentFragment();
    result.policies.forEach(p => {
        const row = createPolicyRow(p, '', true);
        // 관련 리스트 이름 표시
        if (p.list_name) {
            const meta = row.querySelector('.row-meta');
            if (meta) {
                const listSpan = document.createElement('span');
                listSpan.style.cssText = 'color:var(--primary);';
                listSpan.textContent = `📦 ${p.list_name}`;
                meta.appendChild(document.createTextNode(' · '));
                meta.appendChild(listSpan);
            }
        }
        frag.appendChild(row);
    });
    body.appendChild(frag);
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
