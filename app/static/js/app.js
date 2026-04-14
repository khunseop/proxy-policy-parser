// ─── 전역 상태 ────────────────────────────────────────────────────────────────
let currentSetId = null;
let objectsMap = {};        // list_id   -> { name, type, entries[] }
let objectsNameToId = {};   // list_name -> list_id (역참조용)
let activeListId = null;    // Lists 탭에서 현재 선택된 list_id

let statsData = [];         // Host 통계 원본 데이터
let statsSortedData = [];   // 현재 정렬 기준으로 정렬된 데이터
let statsSortCol = 'policy_count';
let statsSortDir = 'desc';

let listRefPolicies = [];   // List 역참조 정책 목록 (임시 저장)

// ─── 초기화 ──────────────────────────────────────────────────────────────────

window.onload = () => {
    loadHistory();
    initResizer();
    initListsPanel();
};

// 전역 클릭 시 검색 결과 닫기
document.addEventListener('click', (e) => {
    const searchResults = document.getElementById('search-results');
    const analysisResults = document.getElementById('analysis-results');
    if (searchResults && !e.target.closest('#search-results') && !e.target.closest('#global-search')) {
        searchResults.style.display = 'none';
    }
    if (analysisResults && !e.target.closest('#analysis-results') && !e.target.closest('#value-search')) {
        analysisResults.style.display = 'none';
    }
});

// ─── 로딩 상태 관리 ──────────────────────────────────────────────────────────

function setLoading(active, msg = '') {
    const uploadBtn = document.getElementById('xml-upload-btn');
    const historySelect = document.getElementById('history-select');
    const statusMsg = document.getElementById('status-msg');

    if (uploadBtn) uploadBtn.disabled = active;
    if (historySelect) historySelect.disabled = active;
    if (statusMsg) statusMsg.innerText = active ? msg : '준비됨';
}

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

function updateBreadcrumb(path) {
    const bar = document.getElementById('breadcrumb-bar');
    if (!bar) return;

    if (!path) {
        bar.innerHTML = '<span class="crumb crumb-root" onclick="initFinder()">Root</span>';
        return;
    }

    const segments = path.split(' > ');
    let html = '<span class="crumb crumb-root" onclick="initFinder()">Root</span>';
    let cumPath = '';

    segments.forEach((seg, i) => {
        cumPath = i === 0 ? seg : `${cumPath} > ${seg}`;
        const escapedPath = cumPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += `<span class="crumb-sep">›</span>`;
        if (i === segments.length - 1) {
            html += `<span class="crumb crumb-active">${escapeHtml(seg)}</span>`;
        } else {
            html += `<span class="crumb" onclick="navigateToBreadcrumb('${escapedPath}', ${i})">${escapeHtml(seg)}</span>`;
        }
    });

    bar.innerHTML = html;
    // 마지막 세그먼트가 보이도록 스크롤
    bar.scrollLeft = bar.scrollWidth;
}

async function navigateToBreadcrumb(targetPath, depth) {
    const container = document.getElementById('tree-container');
    // depth 이후 컬럼 제거
    const existingCols = container.querySelectorAll('.finder-column');
    existingCols.forEach((col, idx) => {
        if (idx > depth) col.remove();
    });
    // targetPath의 자식 컬럼 로드
    await addColumn(targetPath, depth + 1);
    updateBreadcrumb(targetPath);
}

// ─── 오버레이 위치 지정 ──────────────────────────────────────────────────────

function positionOverlay(overlayId, anchorId) {
    const overlay = document.getElementById(overlayId);
    const anchor = document.getElementById(anchorId);
    if (!overlay || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    overlay.style.top = `${rect.bottom + 4}px`;
    overlay.style.left = `${Math.min(rect.left, window.innerWidth - 490)}px`;
}

// ─── 히스토리 / 업로드 ───────────────────────────────────────────────────────

async function loadHistory() {
    try {
        const response = await fetch('/api/v1/history');
        const history = await response.json();
        const select = document.getElementById('history-select');
        select.innerHTML = '<option value="">정책 히스토리 선택...</option>';
        history.forEach(set => {
            const opt = document.createElement('option');
            opt.value = set.id;
            opt.innerText = `${set.upload_time} - ${set.filename}`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("히스토리 로드 실패:", err);
    }
}

async function loadObjects(set_id) {
    try {
        const response = await fetch(`/api/v1/objects/${set_id}`);
        const objects = await response.json();
        objectsMap = {};
        objectsNameToId = {};
        objects.forEach(obj => {
            const id = obj.list_id;
            if (!objectsMap[id]) {
                objectsMap[id] = { name: obj.list_name, type: obj.list_type_id, entries: [] };
                if (obj.list_name) objectsNameToId[obj.list_name] = id;
            }
            if (obj.entry_value) {
                objectsMap[id].entries.push({
                    value: obj.entry_value,
                    type: obj.entry_type || 'default',
                    details: obj.entry_details || ''
                });
            }
        });
    } catch (err) {
        console.error("객체 데이터 로드 실패:", err);
    }
}

async function handleSetChange() {
    currentSetId = document.getElementById('history-select').value;
    const treeContainer = document.getElementById('tree-container');
    const detailContent = document.getElementById('detail-content');

    if (!currentSetId) {
        treeContainer.innerHTML = '<div class="loading" style="padding: 20px;">정책을 선택하거나 업로드하세요.</div>';
        detailContent.innerHTML = '<div class="empty-state" style="text-align:center; color:#999; margin-top:50px;">항목을 선택하여 상세 내용을 확인하세요.</div>';
        objectsMap = {};
        statsData = [];
        updateBreadcrumb('');
        return;
    }

    setLoading(true, '정책 로딩 중...');
    try {
        await loadObjects(currentSetId);
        initFinder();
        statsData = []; // 통계 캐시 초기화
    } finally {
        setLoading(false);
    }
}

async function handleDeleteCurrentSet() {
    const set_id = document.getElementById('history-select').value;
    if (!set_id) { alert("삭제할 정책 이력을 먼저 선택해주세요."); return; }
    if (!confirm("현재 선택된 정책 이력을 정말 삭제하시겠습니까?")) return;

    try {
        const response = await fetch(`/api/v1/history/${set_id}`, { method: 'DELETE' });
        if (response.ok) {
            await loadHistory();
            handleSetChange();
        }
    } catch (err) {
        alert("삭제 실패: " + err.message);
    }
}

async function handleClearAllHistory() {
    if (!confirm("모든 정책 히스토리를 초기화하시겠습니까? 복구할 수 없습니다.")) return;
    try {
        const response = await fetch(`/api/v1/history`, { method: 'DELETE' });
        if (response.ok) {
            await loadHistory();
            handleSetChange();
        }
    } catch (err) {
        alert("초기화 실패: " + err.message);
    }
}

async function handleFileUpload() {
    const fileInput = document.getElementById('xml-upload');
    if (!fileInput.files.length) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    setLoading(true, 'XML 파싱 및 DB 저장 중...');

    try {
        const response = await fetch('/api/v1/upload', { method: 'POST', body: formData });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || response.statusText);
        }
        const result = await response.json();
        currentSetId = result.set_id;
        await loadHistory();
        document.getElementById('history-select').value = currentSetId;

        await loadObjects(currentSetId);
        statsData = [];
        initFinder();
        setLoading(false, '업로드 완료');
        setTimeout(() => {
            const statusMsg = document.getElementById('status-msg');
            if (statusMsg && statusMsg.innerText === '업로드 완료') statusMsg.innerText = '준비됨';
        }, 2000);
    } catch (err) {
        setLoading(false);
        document.getElementById('status-msg').innerText = '오류: ' + err.message;
    } finally {
        fileInput.value = ''; // 같은 파일 재업로드 허용
    }
}

// ─── 탭 전환 ─────────────────────────────────────────────────────────────────

function showTab(tabName) {
    const treeContainer  = document.getElementById('tree-container');
    const listsContainer = document.getElementById('lists-container');
    const breadcrumbBar  = document.getElementById('breadcrumb-bar');
    const tabPolicies    = document.getElementById('tab-policies');
    const tabLists       = document.getElementById('tab-lists');

    if (tabName === 'policies') {
        treeContainer.style.display  = 'flex';
        listsContainer.classList.remove('visible');
        breadcrumbBar.style.display  = 'flex';
        tabPolicies.classList.add('active');
        tabLists.classList.remove('active');
    } else {
        treeContainer.style.display  = 'none';
        listsContainer.classList.add('visible');
        breadcrumbBar.style.display  = 'none';
        tabLists.classList.add('active');
        tabPolicies.classList.remove('active');
        // 현재 서브탭에 맞게 갱신
        const subtabLists = document.getElementById('subtab-lists');
        if (subtabLists && subtabLists.classList.contains('active')) {
            renderListsSidebar(document.getElementById('list-name-filter').value || '');
        }
    }
}

function showListsSubTab(name) {
    const listsView  = document.getElementById('lists-view');
    const statsView  = document.getElementById('stats-view');
    const btnLists   = document.getElementById('subtab-lists');
    const btnStats   = document.getElementById('subtab-stats');

    if (name === 'lists') {
        listsView.style.display = 'flex';
        statsView.classList.remove('visible');
        btnLists.classList.add('active');
        btnStats.classList.remove('active');
        renderListsSidebar(document.getElementById('list-name-filter').value || '');
    } else {
        listsView.style.display = 'none';
        statsView.classList.add('visible');
        btnStats.classList.add('active');
        btnLists.classList.remove('active');
        loadStatsData();
    }
}

// ─── Lists 탭 ─────────────────────────────────────────────────────────────────

function initListsPanel() {
    // 이벤트 위임: 사이드바 클릭 처리
    const panel = document.getElementById('lists-names-panel');
    if (panel) {
        panel.addEventListener('click', e => {
            const item = e.target.closest('.list-name-item');
            if (item && item.dataset.listId) {
                selectList(item.dataset.listId);
            }
        });
    }
}

function renderListsSidebar(filterText) {
    const panel = document.getElementById('lists-names-panel');
    const lowerFilter = (filterText || '').toLowerCase();

    const entries = Object.entries(objectsMap)
        .filter(([, obj]) => !lowerFilter || obj.name.toLowerCase().includes(lowerFilter))
        .sort(([, a], [, b]) => a.name.localeCompare(b.name));

    if (entries.length === 0) {
        panel.innerHTML = '<div class="lists-empty-state">표시할 List가 없습니다.</div>';
        return;
    }

    panel.innerHTML = entries.map(([listId, obj]) => `
        <div class="list-name-item ${listId === activeListId ? 'active' : ''}"
             data-list-id="${escapeHtml(listId)}" title="${escapeHtml(listId)}">
            <span class="list-name-text">${escapeHtml(obj.name)}</span>
            <span class="list-count">${obj.entries.length}</span>
        </div>
    `).join('');
}

function filterListNames(value) {
    renderListsSidebar(value);
}

function selectList(listId) {
    activeListId = listId;
    document.querySelectorAll('.list-name-item').forEach(el => {
        el.classList.toggle('active', el.dataset.listId === listId);
    });
    showListEntries(listId, '');
}

function showListEntries(listId, filterText) {
    const obj = objectsMap[listId];
    const panel = document.getElementById('lists-entries-panel');
    if (!obj) {
        panel.innerHTML = '<div class="lists-empty-state">List를 찾을 수 없습니다.</div>';
        return;
    }

    const lower = (filterText || '').toLowerCase();
    const filtered = obj.entries.filter(e => !lower || (e.value || '').toLowerCase().includes(lower));

    const rows = filtered.map(e => `
        <tr>
            <td>${escapeHtml(e.value || '')}</td>
            <td>${e.details ? `<span title="${escapeHtml(e.details)}">${escapeHtml(e.details.substring(0, 60))}${e.details.length > 60 ? '…' : ''}</span>` : ''}</td>
            <td><span class="entry-badge">${escapeHtml(e.type)}</span></td>
        </tr>
    `).join('');

    panel.innerHTML = `
        <div class="lists-entries-header">
            <h3>${escapeHtml(obj.name)}</h3>
            <div class="list-meta">${escapeHtml(listId)} &nbsp;·&nbsp; ${filtered.length} / ${obj.entries.length} 항목</div>
        </div>
        <div class="lists-entries-search">
            <input type="text" placeholder="항목 검색..." value="${escapeHtml(filterText)}"
                   oninput="showListEntries('${escapeHtml(listId)}', this.value)">
        </div>
        <div class="lists-entries-table-wrap">
            <table class="lists-entries-table">
                <thead><tr><th>Value</th><th>Description</th><th>Type</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">항목 없음</td></tr>'}</tbody>
            </table>
        </div>
        <div class="list-refs-section">
            <div class="list-refs-header">이 List를 참조하는 정책</div>
            <div id="list-refs-content">
                <div style="padding:10px; color:#999; font-size:12px;">로딩 중...</div>
            </div>
        </div>
    `;

    loadListRefs(listId);
}

async function loadListRefs(listId) {
    const obj = objectsMap[listId];
    const refsEl = document.getElementById('list-refs-content');
    if (!obj || !currentSetId || !refsEl) return;

    try {
        // Condition 필드에 list 이름이 포함되어 있으므로 이름으로 검색
        const response = await fetch(`/api/v1/policies/${currentSetId}/search?query=${encodeURIComponent(obj.name)}`);
        listRefPolicies = await response.json();

        if (!listRefPolicies.length) {
            refsEl.innerHTML = '<div style="padding:10px 16px; color:#999; font-size:12px;">참조하는 정책 없음</div>';
            return;
        }

        refsEl.innerHTML = listRefPolicies.map((p, i) => `
            <div class="list-ref-item" data-ref-idx="${i}">
                <div class="ref-name">
                    <span class="entry-badge">${escapeHtml(p.Type)}</span>
                    ${escapeHtml(p.Name)}
                </div>
                <div class="ref-path">${escapeHtml(p.Path)}</div>
            </div>
        `).join('');

        // 이벤트 위임
        refsEl.onclick = e => {
            const item = e.target.closest('.list-ref-item');
            if (item) {
                const idx = parseInt(item.dataset.refIdx, 10);
                navigateToNode(listRefPolicies[idx]);
            }
        };
    } catch (err) {
        refsEl.innerHTML = `<div style="padding:10px 16px; color:red; font-size:12px;">에러: ${escapeHtml(err.message)}</div>`;
    }
}

// ─── Host 통계 ───────────────────────────────────────────────────────────────

async function loadStatsData() {
    const content = document.getElementById('stats-content');
    if (!currentSetId) {
        content.innerHTML = '<div class="lists-empty-state">정책을 먼저 선택하세요.</div>';
        return;
    }

    content.innerHTML = '<div class="loading">통계 분석 중...</div>';

    try {
        const response = await fetch(`/api/v1/analysis/${currentSetId}/top-hosts?limit=200`);
        statsData = await response.json();
        renderStatsTable();
    } catch (err) {
        content.innerHTML = `<div style="padding:20px; color:red;">에러: ${escapeHtml(err.message)}</div>`;
    }
}

function renderStatsTable() {
    const content = document.getElementById('stats-content');
    if (!statsData.length) {
        content.innerHTML = '<div class="lists-empty-state">데이터가 없습니다.</div>';
        return;
    }

    const sorted = [...statsData].sort((a, b) => {
        let va = a[statsSortCol], vb = b[statsSortCol];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
        if (va < vb) return statsSortDir === 'asc' ? -1 : 1;
        if (va > vb) return statsSortDir === 'asc' ? 1 : -1;
        return 0;
    });
    statsSortedData = sorted;

    const sortIcon = col => {
        if (col !== statsSortCol) return '<span class="sort-icon">⇅</span>';
        return `<span class="sort-icon active">${statsSortDir === 'asc' ? '↑' : '↓'}</span>`;
    };

    content.innerHTML = `
        <table class="stats-table">
            <thead>
                <tr>
                    <th onclick="sortStats('entry_value')">Value (Host/IP) ${sortIcon('entry_value')}</th>
                    <th onclick="sortStats('policy_count')" style="text-align:right;">참조 정책 수 ${sortIcon('policy_count')}</th>
                    <th>소속 Lists</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map((r, i) => `
                    <tr data-stats-idx="${i}">
                        <td>${escapeHtml(r.entry_value || '')}</td>
                        <td style="text-align:right; font-weight:bold; color:var(--primary-color);">${r.policy_count}</td>
                        <td style="color:var(--secondary-text); font-size:11px;">${escapeHtml(r.list_names || '')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // 이벤트 위임
    content.onclick = e => {
        const row = e.target.closest('tr[data-stats-idx]');
        if (row) {
            const idx = parseInt(row.dataset.statsIdx, 10);
            const r = statsSortedData[idx];
            if (r) statsRowClick(r.entry_value || '');
        }
    };
}

function sortStats(col) {
    if (statsSortCol === col) {
        statsSortDir = statsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        statsSortCol = col;
        statsSortDir = col === 'policy_count' ? 'desc' : 'asc';
    }
    renderStatsTable();
}

function statsRowClick(value) {
    const valueInput = document.getElementById('value-search');
    valueInput.value = value;
    handleValueSearch({ key: 'Enter' });
}

function exportStatsCSV() {
    if (!statsData.length) { alert('내보낼 데이터가 없습니다.'); return; }
    const header = ['Value (Host/IP)', '참조 정책 수', '소속 Lists'];
    const rows = statsSortedData.length ? statsSortedData : statsData;
    const csvRows = rows.map(r => [
        `"${(r.entry_value || '').replace(/"/g, '""')}"`,
        r.policy_count,
        `"${(r.list_names || '').replace(/"/g, '""')}"`
    ]);
    const csv = [header, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `host-stats-${currentSetId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Miller Columns ──────────────────────────────────────────────────────────

function initFinder() {
    const container = document.getElementById('tree-container');
    container.innerHTML = '';
    updateBreadcrumb('');
    addColumn("", 0);
}

async function addColumn(parentPath, colIndex) {
    const container = document.getElementById('tree-container');
    const existingCols = container.querySelectorAll('.finder-column');
    existingCols.forEach((col, idx) => {
        if (idx >= colIndex) col.remove();
    });

    const colDiv = document.createElement('div');
    colDiv.className = 'finder-column';
    colDiv.innerHTML = '<div class="loading" style="padding:10px; font-size:12px; color:#999;">로딩 중...</div>';
    container.appendChild(colDiv);

    try {
        const url = `/api/v1/policies/${currentSetId}?parent_path=${encodeURIComponent(parentPath)}`;
        const response = await fetch(url);
        const nodes = await response.json();

        colDiv.innerHTML = '';

        if (!Array.isArray(nodes) || nodes.length === 0) {
            colDiv.innerHTML = '<div style="padding:20px; color:#ccc; font-style:italic; text-align:center; font-size:12px;">하위 항목 없음</div>';
            return colDiv;
        }

        nodes.forEach(node => {
            const item = document.createElement('div');
            item.className = `tree-item ${node.Type.toLowerCase()}`;
            const icon = node.Type === 'Group' ? '📁' : '📄';
            item.innerHTML = `
                <span class="icon">${icon}</span>
                <span class="name" title="${escapeHtml(node.Name)}">${escapeHtml(node.Name || 'Unnamed')}</span>
                ${node.Type === 'Group' ? '<span class="arrow">▶</span>' : ''}
            `;

            item.onclick = () => {
                colDiv.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                showDetail(node);
                updateBreadcrumb(node.Path);
                if (node.Type === 'Group') {
                    addColumn(node.Path, colIndex + 1);
                } else {
                    const allCols = container.querySelectorAll('.finder-column');
                    allCols.forEach((c, i) => { if (i > colIndex) c.remove(); });
                }
            };
            colDiv.appendChild(item);
        });

        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
    } catch (err) {
        colDiv.innerHTML = `<div class="error" style="padding:10px; color:red;">에러: ${escapeHtml(err.message)}</div>`;
    }

    return colDiv;
}

// ─── 트리 자동 탐색 ──────────────────────────────────────────────────────────

async function navigateToNode(node) {
    showTab('policies');

    const container = document.getElementById('tree-container');
    container.innerHTML = ''; // 전체 초기화

    const segments = node.Path.split(' > ');
    let parentPath = '';

    for (let i = 0; i < segments.length; i++) {
        await addColumn(parentPath, i);

        // 해당 세그먼트 아이템 선택 표시
        const cols = container.querySelectorAll('.finder-column');
        const col = cols[i];
        if (col) {
            col.querySelectorAll('.tree-item').forEach(item => {
                const nameEl = item.querySelector('.name');
                if (nameEl && nameEl.title === segments[i]) {
                    col.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                }
            });
        }

        parentPath = parentPath ? `${parentPath} > ${segments[i]}` : segments[i];
    }

    // Group이면 자식 컬럼도 펼치기
    if (node.Type === 'Group') {
        await addColumn(node.Path, segments.length);
    }

    showDetail(node);
    updateBreadcrumb(node.Path);
    container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
}

// ─── 검색 ────────────────────────────────────────────────────────────────────

async function handleSearch(event) {
    if (event.key !== 'Enter') return;
    const query = document.getElementById('global-search').value;
    const resultsOverlay = document.getElementById('search-results');

    if (!query || !currentSetId) {
        resultsOverlay.style.display = 'none';
        return;
    }

    positionOverlay('search-results', 'global-search');
    resultsOverlay.innerHTML = '<div class="loading">검색 중...</div>';
    resultsOverlay.style.display = 'block';

    try {
        const response = await fetch(`/api/v1/policies/${currentSetId}/search?query=${encodeURIComponent(query)}`);
        const results = await response.json();

        resultsOverlay.innerHTML = `
            <div style="padding:10px 18px; border-bottom:1px solid #eee; background:#f9f9f9; font-weight:bold; font-size:12px; color:#555;">
                "${escapeHtml(query)}" — ${results.length}개 결과
            </div>
        `;

        if (results.length === 0) {
            resultsOverlay.innerHTML += '<div style="padding:15px; color:#999;">검색 결과가 없습니다.</div>';
            return;
        }

        results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <div class="name">[${escapeHtml(item.Type)}] ${escapeHtml(item.Name)}</div>
                <div class="path">${escapeHtml(item.Path)}</div>
            `;
            div.onclick = () => {
                resultsOverlay.style.display = 'none';
                navigateToNode(item);
            };
            resultsOverlay.appendChild(div);
        });
    } catch (err) {
        resultsOverlay.innerHTML = `<div style="padding:15px; color:red;">에러: ${escapeHtml(err.message)}</div>`;
    }
}

async function handleValueSearch(event) {
    if (event.key !== 'Enter') return;
    const value = document.getElementById('value-search').value;
    const resultsOverlay = document.getElementById('analysis-results');

    if (!value || !currentSetId) {
        resultsOverlay.style.display = 'none';
        return;
    }

    positionOverlay('analysis-results', 'value-search');
    resultsOverlay.innerHTML = '<div class="loading">분석 중...</div>';
    resultsOverlay.style.display = 'block';

    try {
        const response = await fetch(`/api/v1/analysis/${currentSetId}/value-lookup?value=${encodeURIComponent(value)}`);
        const result = await response.json();

        resultsOverlay.innerHTML = `
            <div style="padding:10px 18px; border-bottom:1px solid #eee; background:#f9f9f9; font-weight:bold; font-size:12px; color:#555;">
                "${escapeHtml(value)}" — ${result.count}개의 정책 발견
            </div>
        `;

        if (!result.policies.length) {
            resultsOverlay.innerHTML += '<div style="padding:15px; color:#999;">해당 값을 포함하는 리스트가 정책에서 사용되지 않았습니다.</div>';
            return;
        }

        result.policies.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            const listName = objectsMap[item.MatchedListID]?.name || item.MatchedListID;
            div.innerHTML = `
                <div class="name">[${escapeHtml(item.Type)}] ${escapeHtml(item.Name)}</div>
                <div class="path" style="margin-top:2px;">매칭 리스트: ${escapeHtml(listName)}</div>
                <div class="path">${escapeHtml(item.Path)}</div>
            `;
            div.onclick = () => {
                resultsOverlay.style.display = 'none';
                navigateToNode(item);
            };
            resultsOverlay.appendChild(div);
        });
    } catch (err) {
        resultsOverlay.innerHTML = `<div style="padding:15px; color:red;">에러: ${escapeHtml(err.message)}</div>`;
    }
}

// ─── 상세 정보 패널 ───────────────────────────────────────────────────────────

function formatCondition(condition) {
    if (!condition || condition === 'Always') return 'Always';
    if (condition === 'None') return '<span style="color:#aaa; font-style:italic;">조건 없음</span>';

    return condition.replace(/List\(([^)]+)\)/g, (match, nameOrId) => {
        let listId = nameOrId;
        let obj = objectsMap[nameOrId];

        if (!obj && objectsNameToId[nameOrId]) {
            listId = objectsNameToId[nameOrId];
            obj = objectsMap[listId];
        }

        if (obj) {
            const displayName = obj.name || nameOrId;
            return `<span class="list-link" onclick="showObjectDetail('${escapeHtml(listId)}')" title="내용 보기: ${escapeHtml(listId)}">${escapeHtml(displayName)}</span>`;
        }

        return `<span class="list-link" style="color:#e67e22; border-bottom:1px dotted;" title="목록에서 찾지 못함: ${escapeHtml(nameOrId)}">${escapeHtml(nameOrId)}</span>`;
    });
}

function showObjectDetail(listId) {
    const obj = objectsMap[listId];
    const inlineView = document.getElementById('object-inline-view');
    if (!obj || !inlineView) return;

    inlineView.innerHTML = `
        <div class="object-view">
            <div class="object-view-header">
                <span>📦 List: ${escapeHtml(obj.name)} <small style="color:#999; font-weight:400;">(${escapeHtml(obj.type || '')})</small></span>
                <button class="btn-icon" style="font-size:10px; float:right;" onclick="document.getElementById('object-inline-view').innerHTML=''">✕</button>
            </div>
            <ul class="object-list">
                ${obj.entries.length
                    ? obj.entries.map(e => `<li><span>${escapeHtml(e.value || '')}</span><span class="entry-type">${escapeHtml(e.type || '')}</span></li>`).join('')
                    : '<li style="color:#999; font-style:italic;">항목 없음</li>'
                }
            </ul>
        </div>
    `;
    inlineView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showDetail(item) {
    openDetailView();
    const container = document.getElementById('detail-content');
    container.innerHTML = `
        <div class="detail-card">
            <h2>${escapeHtml(item.Name || 'Unnamed')} <span class="badge ${item.Enabled === 'true' ? 'enabled' : 'disabled'}">${item.Enabled === 'true' ? '활성' : '비활성'}</span></h2>
            <p class="path-text">${escapeHtml(item.Path)}</p>

            <div class="detail-row" id="condition-row">
                <span class="label">Condition (조건)</span>
                <div class="value condition">${formatCondition(item.Condition)}</div>
            </div>

            ${item.Type === 'Rule' ? `
                <div class="detail-row">
                    <span class="label">Actions (액션)</span>
                    <div class="value">${escapeHtml(item.Actions || 'None')}</div>
                </div>
            ` : ''}

            <div class="detail-row">
                <span class="label">Technical Info</span>
                <div class="value" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12px; font-family: sans-serif;">
                    <div><span style="color:#888">Policy ID:</span> ${escapeHtml(item.PolicyID || item.ID || 'N/A')}</div>
                    <div><span style="color:#888">Cloud:</span> ${item.CloudSynced === 'true' ? 'Yes' : 'No'}</div>
                    <div><span style="color:#888">Type:</span> ${escapeHtml(item.Type)}</div>
                    <div><span style="color:#888">Level:</span> ${item.Level ?? 'N/A'}</div>
                </div>
            </div>

            <div class="detail-row">
                <span class="label">ACElements</span>
                <div class="value" style="font-size:11px; overflow-x:auto; background:#fafafa;">${escapeHtml(item.ACElements || 'None')}</div>
            </div>

            <div class="detail-row">
                <span class="label">Description (설명)</span>
                <div class="value" style="font-family: sans-serif;">${escapeHtml(item.Description || '-')}</div>
            </div>

            <div id="object-inline-view"></div>
        </div>
    `;
}

function closeDetailView() {
    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('drag-resizer').style.display = 'none';
}

function openDetailView() {
    document.getElementById('detail-view').style.display = 'flex';
    document.getElementById('drag-resizer').style.display = 'block';
}

// ─── Resizer ─────────────────────────────────────────────────────────────────

function initResizer() {
    const resizer = document.getElementById('drag-resizer');
    const panel = document.getElementById('detail-view');
    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        resizer.classList.add('resizing');
    });

    document.addEventListener('mousemove', e => {
        if (!isResizing) return;
        const width = window.innerWidth - e.clientX;
        if (width > 300 && width < 800) panel.style.width = `${width}px`;
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
        resizer.classList.remove('resizing');
    });
}

// ─── 유틸리티 ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
