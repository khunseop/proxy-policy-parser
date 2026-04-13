let currentSetId = null;

window.onload = loadHistory;

// 전역 클릭 시 검색 결과 닫기
document.addEventListener('click', (e) => {
    const searchResults = document.getElementById('search-results');
    if (!e.target.closest('.search-container')) {
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
    if (!currentSetId) return;
    initFinder();
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

/**
 * 특정 부모 경로에 대한 새로운 컬럼을 추가합니다.
 * @param {string} parentPath 부모 경로
 * @param {number} colIndex 컬럼 인덱스 (0부터 시작)
 */
async function addColumn(parentPath, colIndex) {
    // 1. 현재 인덱스보다 큰 기존 컬럼들 삭제 (macOS Finder 방식)
    const container = document.getElementById('tree-container');
    const existingCols = container.querySelectorAll('.finder-column');
    existingCols.forEach((col, idx) => {
        if (idx >= colIndex) col.remove();
    });

    // 2. 새 컬럼 생성 및 로딩 표시
    const colDiv = document.createElement('div');
    colDiv.className = 'finder-column';
    colDiv.innerHTML = '<div class="loading" style="padding:10px; font-size:12px; color:#999;">로딩 중...</div>';
    container.appendChild(colDiv);

    try {
        const url = `/api/v1/policies/${currentSetId}?parent_path=${encodeURIComponent(parentPath)}`;
        const response = await fetch(url);
        const nodes = await response.json();

        colDiv.innerHTML = ''; // 로딩 제거

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
                // 선택 표시 업데이트
                colDiv.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');

                // 상세 정보 표시
                showDetail(node, item);

                // 그룹이면 다음 컬럼 로드
                if (node.Type === 'Group') {
                    addColumn(node.Path, colIndex + 1);
                } else {
                    // 파일이면 이후 컬럼 모두 제거
                    const allCols = container.querySelectorAll('.finder-column');
                    allCols.forEach((c, i) => { if (i > colIndex) c.remove(); });
                }
            };
            colDiv.appendChild(item);
        });

        // 가로 스크롤을 맨 오른쪽으로 이동
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
                // 검색 결과 클릭 시 해당 경로를 자동으로 찾아서 컬럼을 펼치는 로직은 
                // 복잡도가 높으므로 일단 상세 정보만 보여줌
            };
            resultsOverlay.appendChild(div);
        });
    } catch (err) {
        console.error("검색 실패:", err);
    }
}
