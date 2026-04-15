import { state } from './state.js';
import { escapeHtml, colorCondition } from './utils.js';
import { detectExpiry } from './utils.js';

export function openDetail(node) {
    const panel   = document.getElementById('detail-panel');
    const body    = document.getElementById('detail-body');
    const title   = document.getElementById('detail-title');
    if (!panel || !body || !title) return;

    panel.classList.remove('hidden');
    title.textContent = node.Type === 'Group' ? '그룹 정보' : '규칙 정보';

    const enabled = node.Enabled === 'true';
    const expiry  = detectExpiry(node.Condition || '');
    let expiryBadge = '';
    if (expiry) {
        if (expiry.expired) {
            expiryBadge = `<span class="badge expired">만료 (${expiry.endDate.toLocaleDateString('ko')})</span>`;
        } else if (expiry.expiringSoon) {
            expiryBadge = `<span class="badge expiring">D-${expiry.daysLeft} 만료</span>`;
        } else {
            expiryBadge = `<span class="badge enabled">유효 (∼${expiry.endDate.toLocaleDateString('ko')})</span>`;
        }
    }

    body.innerHTML = `
        <div class="detail-name">
            ${node.Type === 'Group' ? '📁' : '📄'}
            ${escapeHtml(node.Name || 'Unnamed')}
            <span class="badge ${enabled ? 'enabled' : 'disabled'}">${enabled ? '활성' : '비활성'}</span>
            ${expiryBadge}
        </div>
        <div class="detail-path">${escapeHtml(node.Path || '')}</div>

        <div class="detail-section">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="detail-label">조건 (Condition)</span>
            </div>
            <div class="detail-value condition" id="detail-cond-formatted">${formatCondition(node.Condition)}</div>
        </div>

        ${node.Type === 'Rule' && node.Actions ? `
        <div class="detail-section">
            <span class="detail-label">액션 (Actions)</span>
            <div class="detail-value">${escapeHtml(node.Actions)}</div>
        </div>` : ''}

        ${node.Description ? `
        <div class="detail-section">
            <span class="detail-label">설명</span>
            <div class="detail-value" style="font-family:sans-serif;font-size:12px;">${escapeHtml(node.Description)}</div>
        </div>` : ''}

        <div class="detail-section">
            <span class="detail-label">기술 정보</span>
            <div class="tech-grid">
                <div class="tech-item"><div class="tech-key">Type</div><div class="tech-val">${escapeHtml(node.Type)}</div></div>
                <div class="tech-item"><div class="tech-key">Level</div><div class="tech-val">${node.Level ?? '-'}</div></div>
                <div class="tech-item"><div class="tech-key">Cloud Sync</div><div class="tech-val">${node.CloudSynced === 'true' ? '✓' : '✗'}</div></div>
                <div class="tech-item"><div class="tech-key">Cycle</div><div class="tech-val">Req:${node.CycleRequest === 'true' ? '✓' : '✗'} / Res:${node.CycleResponse === 'true' ? '✓' : '✗'}</div></div>
            </div>
        </div>

        <div class="detail-section">
            <span class="detail-label">Policy ID</span>
            <div class="detail-value" style="font-size:10px;background:#fafafa;">${escapeHtml(node.PolicyID || '-')}</div>
        </div>

        <div id="object-inline-view"></div>
    `;

    // DOM 반영 후 이벤트 리스너 바인딩 (짧은 지연시간 부여)
    setTimeout(() => {
        const condFmt = document.getElementById('detail-cond-formatted');
        if (condFmt) {
            condFmt.querySelectorAll('.list-link').forEach(el => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    showObjectDetail(el.dataset.listId);
                };
            });
        }
    }, 10);
}

export function closeDetail() {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.add('hidden');
    document.querySelectorAll('.policy-row.active').forEach(r => r.classList.remove('active'));
    state.selectedPk = null;
}

export function formatCondition(cond) {
    if (!cond || cond === 'Always')
        return '<span style="color:#999;font-style:italic;">Always (항상 적용)</span>';
    if (cond === 'None')
        return '<span style="color:#aaa;font-style:italic;">조건 없음</span>';

    // 1. 구문 강조 적용
    let s = colorCondition(cond);

    // 2. List(...) 패턴을 링크로 변환 (공백 허용 보강)
    // <span class="cond-fn">List</span> ( ... ) 형태 대응
    const re = /(?:<span class="cond-fn">)?List(?:<\/span>)?\s*\(([^)]+)\)/g;
    s = s.replace(re, (match, nameOrId) => {
        let listId = nameOrId;
        let obj = state.objectsMap[nameOrId];
        if (!obj && state.objectsNameToId[nameOrId]) {
            listId = state.objectsNameToId[nameOrId];
            obj    = state.objectsMap[listId];
        }
        
        const display = obj ? (obj.name || nameOrId) : nameOrId;
        return `<span class="list-link" data-list-id="${escapeHtml(listId)}" title="${escapeHtml(listId)}">${escapeHtml(display)}</span>`;
    });

    return s;
}

export function showObjectDetail(listId) {
    const obj  = state.objectsMap[listId];
    const wrap = document.getElementById('object-inline-view');
    if (!obj || !wrap) return;

    wrap.innerHTML = `
        <div class="object-view">
            <div class="object-view-header">
                <span>📦 ${escapeHtml(obj.name)}</span>
                <button class="btn-icon" id="close-object-inline-btn" style="font-size:10px;">✕</button>
            </div>
            <ul class="object-list">
                ${obj.entries.length
                    ? obj.entries.map(e => `<li><span>${escapeHtml(e.value || '')}</span><span class="entry-type-badge">${escapeHtml(e.type)}</span></li>`).join('')
                    : '<li style="color:#999;justify-content:center;font-style:italic;">항목 없음</li>'
                }
            </ul>
        </div>
    `;
    
    document.getElementById('close-object-inline-btn').onclick = (e) => { 
        e.stopPropagation();
        wrap.innerHTML = ''; 
    };
    
    // 부드럽게 스크롤
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
