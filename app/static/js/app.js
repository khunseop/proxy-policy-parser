let policyData = null;
let filteredPolicies = [];

async function handleFileUpload() {
    const fileInput = document.getElementById('xml-upload');
    const statusMsg = document.getElementById('status-msg');
    const treeContent = document.getElementById('tree-content');

    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    statusMsg.innerText = "업로드 및 파싱 중...";
    treeContent.innerHTML = '<div class="loading">파싱 중입니다. 잠시만 기다려주세요...</div>';

    try {
        const response = await fetch('/api/v1/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("파싱 실패");

        policyData = await response.json();
        filteredPolicies = policyData.policies;
        
        renderTree(filteredPolicies);
        updateStats();
        statusMsg.innerText = "완료";
    } catch (err) {
        statusMsg.innerText = "오류 발생";
        treeContent.innerHTML = `<div class="error">${err.message}</div>`;
    }
}

function renderTree(policies) {
    const container = document.getElementById('tree-content');
    container.innerHTML = '';

    policies.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `tree-item ${item.Type.toLowerCase()}`;
        div.innerText = `${item.Type === 'Group' ? '📁' : '📄'} ${item.Name || 'Unnamed'}`;
        div.onclick = () => showDetail(item, div);
        
        // 계층에 따른 들여쓰기 (L1, L2 등 기반)
        const level = item.Level || 1;
        div.style.paddingLeft = `${level * 15}px`;
        
        container.appendChild(div);
    });
}

function showDetail(item, element) {
    // 선택 표시 제거 및 추가
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    const container = document.getElementById('detail-content');
    container.innerHTML = `
        <div class="detail-card">
            <h2>${item.Name || 'Unnamed'} <span class="badge ${item.Enabled === 'true' ? 'enabled' : 'disabled'}">${item.Enabled === 'true' ? 'Enabled' : 'Disabled'}</span></h2>
            <p style="color: #6c757d; margin-bottom: 20px;">${item.Path}</p>
            
            <div class="detail-row">
                <span class="label">Condition</span>
                <div class="value">${item.Condition || 'Always'}</div>
            </div>
            
            ${item.Type === 'Rule' ? `
                <div class="detail-row">
                    <span class="label">Actions</span>
                    <div class="value">${item.Actions || 'None'}</div>
                </div>
            ` : ''}

            <div class="detail-row">
                <span class="label">ID</span>
                <div class="value">${item.ID}</div>
            </div>

            <div class="detail-row">
                <span class="label">Tech Attributes</span>
                <div class="value">
                    CloudSynced: ${item.CloudSynced || 'N/A'}<br>
                    Cycle: ${item.CycleRequest ? 'Req' : ''} ${item.CycleResponse ? 'Res' : ''}<br>
                    ACElements: ${item.ACElements}
                </div>
            </div>

            <div class="detail-row">
                <span class="label">Description</span>
                <div class="value">${item.Description || '-'}</div>
            </div>
        </div>
    `;
}

function handleSearch() {
    const query = document.getElementById('global-search').value.toLowerCase();
    if (!policyData) return;

    filteredPolicies = policyData.policies.filter(p => 
        (p.Name && p.Name.toLowerCase().includes(query)) ||
        (p.Condition && p.Condition.toLowerCase().includes(query)) ||
        (p.Path && p.Path.toLowerCase().includes(query)) ||
        (p.Actions && p.Actions.toLowerCase().includes(query))
    );

    renderTree(filteredPolicies);
}

function updateStats() {
    const stats = document.getElementById('policy-stats');
    if (!policyData) return;
    stats.innerText = `Policies: ${policyData.summary.policy_entries_count}, Objects: ${policyData.summary.object_entries_count}`;
}
