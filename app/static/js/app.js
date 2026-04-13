let currentSetId = null;

window.onload = loadHistory;

// 전역 클릭 시 검색 결과 닫기
document.addEventListener('click', (e) => {
    const searchResults = document.getElementById('search-results');
    if (searchResults && !e.target.closest('.search-container')) {
        searchResults.style.display = 'none';
    }
});

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

async function handleSetChange() {
    currentSetId = document.getElementById('history-select').value;
    const treeContainer = document.getElementById('tree-container');
    const detailContent = document.getElementById('detail-content');
    
    if (!currentSetId) {
        treeContainer.innerHTML = '<div class="loading" style="padding: 20px;">정책을 선택하거나 업로드하세요.</div>';
        detailContent.innerHTML = '<div class="empty-state" style="text-align:center; color:#999; margin-top:50px;">항목을 선택하여 상세 내용을 확인하세요.</div>';
        return;
    }
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
        initFinder();
        document.getElementById('status-msg').innerText = "업로드 완료";
    } catch (err) {
        document.getElementById('status-msg').innerText = "오류: " + err.message;
    }
}

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
            colDiv.innerHTML = '<div style="padding:10px; color:#ccc; font-style:italic;">하위 항목 없음</div>';
            return;
        }

        nodes.forEach(node => {
            const item = document.createElement('div');
            item.className = `tree-item ${node.Type.toLowerCase()}`;
            const icon = node.Type === 'Group' ? '📁' : '📄';
            item.innerHTML = `
                <span class="icon">${icon}</span>
                <span class="name">${node.Name || 'Unnamed'}</span>
                ${node.Type === 'Group' ? '<span class="arrow">▶</span>' : ''}
            `;

            item.onclick = (e) => {
                colDiv.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                showDetail(node, item);
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

function showDetail(item, element) {
    const container = document.getElementById('detail-content');
    container.innerHTML = `
        <div class="detail-card">
            <h2>${item.Name || 'Unnamed'} <span class="badge ${item.Enabled === 'true' ? 'enabled' : 'disabled'}">${item.Enabled === 'true' ? '활성' : '비활성'}</span></h2>
            <p class="path-text">${item.Path}</p>
            
            <div class="detail-row">
                <span class="label">Condition (조건)</span>
                <div class="value condition">${item.Condition || 'Always'}</div>
            </div>
            
            ${item.Type === 'Rule' ? `
                <div class="detail-row">
                    <span class="label">Actions (액션)</span>
                    <div class="value">${item.Actions || 'None'}</div>
                </div>
            ` : ''}

            <div class="detail-row">
                <span class="label">Technical Info</span>
                <div class="value grid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px;">
                    <div><strong>ID:</strong> ${item.ID}</div>
                    <div><strong>Cloud:</strong> ${item.CloudSynced || 'False'}</div>
                    <div><strong>Cycle:</strong> ${item.CycleRequest ? 'Req' : ''} ${item.CycleResponse ? 'Res' : ''}</div>
                    <div><strong>Rights:</strong> ${item.DefaultRights}</div>
                </div>
            </div>

            <div class="detail-row">
                <span class="label">ACElements</span>
                <div class="value" style="font-size:11px; overflow-x:auto;">${item.ACElements}</div>
            </div>

            <div class="detail-row">
                <span class="label">Description (설명)</span>
                <div class="value">${item.Description || '-'}</div>
            </div>
        </div>
    `;
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
                showDetail(item, null);
                resultsOverlay.style.display = 'none';
            };
            resultsOverlay.appendChild(div);
        });
    } catch (err) {
        console.error("검색 실패:", err);
    }
}
