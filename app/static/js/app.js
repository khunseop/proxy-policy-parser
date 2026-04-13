let currentSetId = null;

// 초기 로딩 시 히스토리 가져오기
window.onload = loadHistory;

async function loadHistory() {
    try {
        const response = await fetch('/api/v1/history');
        const history = await response.json();
        const select = document.getElementById('history-select');
        
        // 기존 옵션 유지 (첫 번째 제외)
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
    const select = document.getElementById('history-select');
    currentSetId = select.value;
    if (!currentSetId) return;

    // 최상위 노드(ParentPath == "") 로드
    loadNodes("", document.getElementById('tree-content'), true);
}

async function handleFileUpload() {
    const fileInput = document.getElementById('xml-upload');
    const statusMsg = document.getElementById('status-msg');
    
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    statusMsg.innerText = "DB 저장 중 (대용량 대응)...";

    try {
        const response = await fetch('/api/v1/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("업로드 실패");

        const result = await response.json();
        currentSetId = result.set_id;
        
        await loadHistory();
        document.getElementById('history-select').value = currentSetId;
        
        loadNodes("", document.getElementById('tree-content'), true);
        statusMsg.innerText = "완료";
    } catch (err) {
        statusMsg.innerText = "오류 발생: " + err.message;
    }
}

async function loadNodes(parentPath, container, isRoot = false) {
    if (isRoot) container.innerHTML = '<div class="loading">로딩 중...</div>';

    try {
        const url = `/api/v1/policies/${currentSetId}?parent_path=${encodeURIComponent(parentPath)}`;
        const response = await fetch(url);
        const nodes = await response.json();

        if (isRoot) container.innerHTML = '';

        nodes.forEach(item => {
            const nodeEl = document.createElement('div');
            nodeEl.className = `tree-node-wrapper`;
            
            const itemEl = document.createElement('div');
            itemEl.className = `tree-item ${item.Type.toLowerCase()}`;
            itemEl.style.paddingLeft = `${item.Level * 12}px`;
            
            const icon = item.Type === 'Group' ? '📁' : '📄';
            itemEl.innerHTML = `<span class="toggle-icon">${item.Type === 'Group' ? '▶' : ''}</span> ${icon} ${item.Name || 'Unnamed'}`;
            
            itemEl.onclick = (e) => {
                e.stopPropagation();
                showDetail(item, itemEl);
                if (item.Type === 'Group') toggleGroup(item, nodeEl);
            };

            nodeEl.appendChild(itemEl);
            container.appendChild(nodeEl);
        });
    } catch (err) {
        console.error("노드 로드 실패:", err);
    }
}

async function toggleGroup(group, wrapper) {
    let childrenContainer = wrapper.querySelector('.children-container');
    const icon = wrapper.querySelector('.toggle-icon');

    if (childrenContainer) {
        // 토글 접기/펴기
        if (childrenContainer.style.display === 'none') {
            childrenContainer.style.display = 'block';
            icon.innerText = '▼';
        } else {
            childrenContainer.style.display = 'none';
            icon.innerText = '▶';
        }
    } else {
        // 하위 노드 최초 로드 (Lazy Load)
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';
        wrapper.appendChild(childrenContainer);
        icon.innerText = '▼';
        await loadNodes(group.Path, childrenContainer);
    }
}

function showDetail(item, element) {
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    const container = document.getElementById('detail-content');
    container.innerHTML = `
        <div class="detail-card">
            <h2>${item.Name || 'Unnamed'} <span class="badge ${item.Enabled === 'true' ? 'enabled' : 'disabled'}">${item.Enabled === 'true' ? 'Enabled' : 'Disabled'}</span></h2>
            <p class="path-text">${item.Path}</p>
            
            <div class="detail-row">
                <span class="label">Condition</span>
                <div class="value condition-text">${item.Condition || 'Always'}</div>
            </div>
            
            ${item.Type === 'Rule' ? `
                <div class="detail-row">
                    <span class="label">Actions</span>
                    <div class="value">${item.Actions || 'None'}</div>
                </div>
            ` : ''}

            <div class="detail-row">
                <span class="label">Tech Attributes</span>
                <div class="value grid-2">
                    <div><strong>ID:</strong> ${item.ID}</div>
                    <div><strong>Cloud:</strong> ${item.CloudSynced || 'N/A'}</div>
                    <div><strong>Cycle:</strong> ${item.CycleRequest ? 'Req' : ''} ${item.CycleResponse ? 'Res' : ''}</div>
                    <div><strong>Rights:</strong> ${item.DefaultRights}</div>
                </div>
            </div>

            <div class="detail-row">
                <span class="label">ACElements</span>
                <div class="value small-text">${item.ACElements}</div>
            </div>
        </div>
    `;
}

async function handleSearch(event) {
    if (event.key !== 'Enter') return;
    const query = document.getElementById('global-search').value;
    if (!query || !currentSetId) return;

    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "서버 검색 중...";

    try {
        const response = await fetch(`/api/v1/policies/${currentSetId}/search?query=${encodeURIComponent(query)}`);
        const results = await response.json();

        const container = document.getElementById('tree-content');
        container.innerHTML = `<div class="search-header">검색 결과: ${results.length}건 (최대 200건)</div>`;
        
        results.forEach(item => {
            const div = document.createElement('div');
            div.className = `tree-item search-result ${item.Type.toLowerCase()}`;
            div.innerHTML = `[${item.Type}] ${item.Name} <br><small>${item.Path}</small>`;
            div.onclick = () => showDetail(item, div);
            container.appendChild(div);
        });
        statusMsg.innerText = "검색 완료";
    } catch (err) {
        statusMsg.innerText = "검색 실패";
    }
}
