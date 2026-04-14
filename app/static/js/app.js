let currentSetId = null;
let objectsMap = {};        // list_id   -> { name, type, entries[] }
let objectsNameToId = {};   // list_name -> list_id  (백엔드 이름 치환 이후 역참조용)
let activeListId = null;    // Lists 탭에서 현재 선택된 list_id

window.onload = () => {
    loadHistory();
    initResizer();
};

// 전역 클릭 시 검색 결과 닫기
document.addEventListener('click', (e) => {
    const searchResults = document.getElementById('search-results');
    if (searchResults && !e.target.closest('.search-container')) {
        searchResults.style.display = 'none';
    }
});

function initResizer() {
    const resizer = document.getElementById('drag-resizer');
    const panel = document.getElementById('detail-view');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        resizer.classList.add('resizing');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const width = window.innerWidth - e.clientX;
        if (width > 300 && width < 800) {
            panel.style.width = `${width}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
        resizer.classList.remove('resizing');
    });
}

function closeDetailView() {
    const panel = document.getElementById('detail-view');
    panel.style.display = 'none';
    const resizer = document.getElementById('drag-resizer');
    resizer.style.display = 'none';
}

function openDetailView() {
    const panel = document.getElementById('detail-view');
    panel.style.display = 'flex';
    const resizer = document.getElementById('drag-resizer');
    resizer.style.display = 'block';
}

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
                objectsMap[id] = {
                    name: obj.list_name,
                    type: obj.list_type_id,
                    entries: []
                };
                // 이름 → ID 역매핑 구성 (Condition 문자열이 list 이름으로 치환된 경우 복원용)
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
        return;
    }
    
    await loadObjects(currentSetId);
    initFinder();
}

async function handleDeleteCurrentSet() {
    const set_id = document.getElementById('history-select').value;
    if (!set_id) {
        alert("삭제할 정책 이력을 먼저 선택해주세요.");
        return;
    }

    if (!confirm("현재 선택된 정책 이력을 정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) return;

    try {
        const response = await fetch(`/api/v1/history/${set_id}`, { method: 'DELETE' });
        if (response.ok) {
            alert("삭제되었습니다.");
            await loadHistory();
            handleSetChange(); // 화면 초기화
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
            alert("전체 히스토리가 초기화되었습니다.");
            await loadHistory();
            handleSetChange(); // 화면 초기화
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
    document.getElementById('status-msg').innerText = "DB 저장 중...";

    try {
        const response = await fetch('/api/v1/upload', { method: 'POST', body: formData });
        const result = await response.json();
        currentSetId = result.set_id;
        await loadHistory();
        document.getElementById('history-select').value = currentSetId;
        
        await loadObjects(currentSetId);
        initFinder();
        document.getElementById('status-msg').innerText = "업로드 완료";
    } catch (err) {
        document.getElementById('status-msg').innerText = "오류: " + err.message;
    }
}

// ─── 탭 전환 ─────────────────────────────────────────────────────────────────

function showTab(tabName) {
    const treeContainer  = document.getElementById('tree-container');
    const listsContainer = document.getElementById('lists-container');
    const tabPolicies    = document.getElementById('tab-policies');
    const tabLists       = document.getElementById('tab-lists');

    if (tabName === 'policies') {
        treeContainer.style.display  = 'flex';
        listsContainer.classList.remove('visible');
        tabPolicies.classList.add('active');
        tabLists.classList.remove('active');
    } else {
        treeContainer.style.display  = 'none';
        listsContainer.classList.add('visible');
        tabLists.classList.add('active');
        tabPolicies.classList.remove('active');
        renderListsSidebar('');
    }
}

// ─── Lists 탭 ─────────────────────────────────────────────────────────────────

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
             onclick="selectList('${listId}')" title="${listId}">
            <span class="list-name-text">${obj.name}</span>
            <span class="list-count">${obj.entries.length}</span>
        </div>
    `).join('');
}

function filterListNames(value) {
    renderListsSidebar(value);
}

function selectList(listId) {
    activeListId = listId;
    // 사이드바 active 상태 갱신
    document.querySelectorAll('.list-name-item').forEach(el => el.classList.remove('active'));
    const clicked = [...document.querySelectorAll('.list-name-item')]
        .find(el => el.getAttribute('onclick') === `selectList('${listId}')`);
    if (clicked) clicked.classList.add('active');

    showListEntries(listId, '');
}

function showListEntries(listId, filterText) {
    const obj = objectsMap[listId];
    const panel = document.getElementById('lists-entries-panel');
    if (!obj) { panel.innerHTML = '<div class="lists-empty-state">List를 찾을 수 없습니다.</div>'; return; }

    const lower = (filterText || '').toLowerCase();
    const filtered = obj.entries.filter(e => !lower || (e.value || '').toLowerCase().includes(lower));

    const rows = filtered.map(e => `
        <tr>
            <td>${escapeHtml(e.value || '')}</td>
            <td>${e.details ? `<span title="${escapeHtml(e.details)}">${escapeHtml(e.details.substring(0, 60))}${e.details.length > 60 ? '…' : ''}</span>` : ''}</td>
            <td><span class="entry-badge">${e.type}</span></td>
        </tr>
    `).join('');

    panel.innerHTML = `
        <div class="lists-entries-header">
            <h3>${obj.name}</h3>
            <div class="list-meta">${listId} &nbsp;·&nbsp; ${filtered.length} / ${obj.entries.length} 항목</div>
        </div>
        <div class="lists-entries-search">
            <input type="text" placeholder="항목 검색..." value="${escapeHtml(filterText)}"
                   oninput="showListEntries('${listId}', this.value)">
        </div>
        <div class="lists-entries-table-wrap">
            <table class="lists-entries-table">
                <thead><tr><th>Value</th><th>Description</th><th>Type</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">항목 없음</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────

function initFinder() {
    const container = document.getElementById('tree-container');
    container.innerHTML = '';
    addColumn("", 0); // Root 컬럼 추가
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

        if (nodes.length === 0) {
            colDiv.innerHTML = '<div style="padding:20px; color:#ccc; font-style:italic; text-align:center; font-size:12px;">하위 항목 없음</div>';
            return;
        }

        nodes.forEach(node => {
            const item = document.createElement('div');
            item.className = `tree-item ${node.Type.toLowerCase()}`;
            const icon = node.Type === 'Group' ? '📁' : '📄';
            item.innerHTML = `
                <span class="icon">${icon}</span>
                <span class="name" title="${node.Name}">${node.Name || 'Unnamed'}</span>
                ${node.Type === 'Group' ? '<span class="arrow">▶</span>' : ''}
            `;

            item.onclick = (e) => {
                colDiv.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                showDetail(node);
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
        colDiv.innerHTML = `<div class="error" style="padding:10px; color:red;">에러: ${err.message}</div>`;
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

    resultsOverlay.innerHTML = '<div class="loading">분석 중...</div>';
    resultsOverlay.style.display = 'block';

    try {
        const response = await fetch(`/api/v1/analysis/${currentSetId}/value-lookup?value=${encodeURIComponent(value)}`);
        const result = await response.json();

        resultsOverlay.innerHTML = `
            <div style="padding:12px; border-bottom:1px solid #eee; background:#f9f9f9; font-weight:bold; font-size:12px;">
                "${value}" 검색 결과: ${result.count}개의 정책 발견
            </div>
        `;

        if (result.policies.length === 0) {
            resultsOverlay.innerHTML += '<div style="padding:15px; color:#999;">해당 값을 포함하는 리스트가 정책에서 사용되지 않았습니다.</div>';
            return;
        }

        result.policies.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <div class="name">[${item.Type}] ${item.Name}</div>
                <div class="path" style="margin-top:4px;">매칭 리스트: ${objectsMap[item.MatchedListID] ? objectsMap[item.MatchedListID].name : item.MatchedListID}</div>
                <div class="path">${item.Path}</div>
            `;
            div.onclick = () => {
                showDetail(item);
                resultsOverlay.style.display = 'none';
            };
            resultsOverlay.appendChild(div);
        });
    } catch (err) {
        resultsOverlay.innerHTML = `<div style="padding:15px; color:red;">에러: ${err.message}</div>`;
    }
}

function formatCondition(condition) {
    if (!condition || condition === 'Always') return 'Always';
    if (condition === 'None') return '<span style="color:#aaa; font-style:italic;">조건 없음</span>';

    // List(값) 패턴을 찾아 클릭 가능한 링크로 변환.
    // 백엔드가 list 이름으로 치환한 경우(List(이름))와 원본 ID 그대로인 경우(List(id)) 모두 처리.
    return condition.replace(/List\(([^)]+)\)/g, (match, nameOrId) => {
        // 1) list_id로 직접 조회 (원본 ID가 그대로 남은 경우)
        let listId = nameOrId;
        let obj = objectsMap[nameOrId];

        // 2) list 이름으로 역조회 (백엔드가 이름으로 치환한 경우)
        if (!obj && objectsNameToId[nameOrId]) {
            listId = objectsNameToId[nameOrId];
            obj = objectsMap[listId];
        }

        if (obj) {
            const displayName = obj.name || nameOrId;
            return `<span class="list-link" onclick="showObjectDetail('${listId}')" title="내용 보기: ${listId}">${displayName}</span>`;
        }

        // 어느 쪽으로도 찾지 못한 경우 — 원문 그대로 표시
        return `<span class="list-link" style="color:#e67e22; border-bottom:1px dotted;" title="목록에서 찾지 못함: ${nameOrId}">${nameOrId}</span>`;
    });
}

function showObjectDetail(listId) {
    const obj = objectsMap[listId];
    if (!obj) return;

    // 기존 상세 정보 아래에 객체 정보 추가하거나 팝업?
    // 여기서는 간단하게 detail-content에 덮어씌우지 않고 추가 정보를 보여줌
    const existingObjView = document.getElementById('object-view-container');
    if (existingObjView) existingObjView.remove();

    const container = document.createElement('div');
    container.id = 'object-view-container';
    container.className = 'object-view';
    container.innerHTML = `
        <div class="object-view-header">
            <span>List: ${obj.name} (${obj.type})</span>
            <button class="btn-icon" style="font-size: 10px; float:right;" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <ul class="object-list">
            ${obj.entries.map(e => `<li><span>${e.value}</span> <span class="entry-type">${e.type}</span></li>`).join('')}
            ${obj.entries.length === 0 ? '<li style="color:#999; font-style:italic;">항목 없음</li>' : ''}
        </ul>
    `;
    
    const detailContainer = document.getElementById('detail-content');
    // Condition 영역 바로 다음에 삽입 시도
    const conditionRow = detailContainer.querySelector('.detail-row:nth-child(3)');
    if (conditionRow) {
        conditionRow.after(container);
    } else {
        detailContainer.appendChild(container);
    }
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showDetail(item) {
    openDetailView();
    const container = document.getElementById('detail-content');
    container.innerHTML = `
        <div class="detail-card">
            <h2>${item.Name || 'Unnamed'} <span class="badge ${item.Enabled === 'true' ? 'enabled' : 'disabled'}">${item.Enabled === 'true' ? '활성' : '비활성'}</span></h2>
            <p class="path-text">${item.Path}</p>
            
            <div class="detail-row">
                <span class="label">Condition (조건)</span>
                <div class="value condition">${formatCondition(item.Condition)}</div>
            </div>
            
            ${item.Type === 'Rule' ? `
                <div class="detail-row">
                    <span class="label">Actions (액션)</span>
                    <div class="value">${item.Actions || 'None'}</div>
                </div>
            ` : ''}

            <div class="detail-row">
                <span class="label">Technical Info</span>
                <div class="value" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12px; font-family: sans-serif;">
                    <div><span style="color:#888">Policy ID:</span> ${item.PolicyID || item.ID || 'N/A'}</div>
                    <div><span style="color:#888">Cloud:</span> ${item.CloudSynced === 'true' ? 'Yes' : 'No'}</div>
                    <div><span style="color:#888">Type:</span> ${item.Type}</div>
                    <div><span style="color:#888">Level:</span> ${item.Level}</div>
                </div>
            </div>

            <div class="detail-row">
                <span class="label">ACElements</span>
                <div class="value" style="font-size:11px; overflow-x:auto; background: #fafafa;">${item.ACElements || 'None'}</div>
            </div>

            <div class="detail-row">
                <span class="label">Description (설명)</span>
                <div class="value" style="font-family: sans-serif;">${item.Description || '-'}</div>
            </div>
        </div>
    `;
}

async function showTopHosts() {
    if (!currentSetId) {
        alert("정책 이력을 먼저 선택해주세요.");
        return;
    }

    const resultsOverlay = document.getElementById('analysis-results');
    resultsOverlay.innerHTML = '<div class="loading">통계 분석 중...</div>';
    resultsOverlay.style.display = 'block';

    try {
        const response = await fetch(`/api/v1/analysis/${currentSetId}/top-hosts?limit=30`);
        const results = await response.json();

        resultsOverlay.innerHTML = `
            <div style="padding:12px; border-bottom:1px solid #eee; background:#f9f9f9; font-weight:bold; font-size:12px; display:flex; justify-content:space-between;">
                <span>가장 많이 허용/참조된 Host TOP 30</span>
                <button class="btn-icon" style="font-size:10px;" onclick="document.getElementById('analysis-results').style.display='none'">✕</button>
            </div>
            <div style="max-height: 450px; overflow-y: auto;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead style="position:sticky; top:0; background:#eee;">
                        <tr>
                            <th style="padding:8px; text-align:left; border-bottom:1px solid #ddd;">Value (Host/IP)</th>
                            <th style="padding:8px; text-align:right; border-bottom:1px solid #ddd;">Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(r => `
                            <tr class="search-item" onclick="document.getElementById('value-search').value='${r.entry_value}'; handleValueSearch({key:'Enter'})">
                                <td style="padding:8px; border-bottom:1px solid #eee;">
                                    <div style="font-weight:bold;">${r.entry_value}</div>
                                    <div style="font-size:10px; color:#888;">Lists: ${r.list_names}</div>
                                </td>
                                <td style="padding:8px; text-align:right; border-bottom:1px solid #eee; font-weight:bold; color:var(--primary-color);">
                                    ${r.policy_count}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        resultsOverlay.innerHTML = `<div style="padding:15px; color:red;">에러: ${err.message}</div>`;
    }
}

async function handleSearch(event) {
    if (event.key !== 'Enter') return;
    const query = document.getElementById('global-search').value;
    const resultsOverlay = document.getElementById('search-results');

    if (!query || !currentSetId) {
        resultsOverlay.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/v1/policies/${currentSetId}/search?query=${encodeURIComponent(query)}`);
        const results = await response.json();

        resultsOverlay.innerHTML = '';
        resultsOverlay.style.display = 'block';

        if (results.length === 0) {
            resultsOverlay.innerHTML = '<div style="padding:15px; color:#999;">검색 결과가 없습니다.</div>';
            return;
        }

        results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <div class="name">[${item.Type}] ${item.Name}</div>
                <div class="path">${item.Path}</div>
            `;
            div.onclick = () => {
                showDetail(item);
                resultsOverlay.style.display = 'none';
                // TODO: 트리를 해당 항목까지 확장하는 기능은 추후 구현
            };
            resultsOverlay.appendChild(div);
        });
    } catch (err) {
        console.error("검색 실패:", err);
    }
}
