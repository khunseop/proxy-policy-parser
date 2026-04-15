import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml, colorCondition } from './utils.js';
import { closeDetail } from './detail.js';

export function openDiffModal() {
    const selA = document.getElementById('diff-select-a');
    const selB = document.getElementById('diff-select-b');
    const msg  = document.getElementById('diff-modal-msg');
    if (!selA || !selB || !msg) return;

    msg.classList.add('hidden');

    const histOpts = Array.from(document.getElementById('history-select').options)
        .filter(o => o.value);

    [selA, selB].forEach((sel, idx) => {
        sel.innerHTML = '<option value="">선택...</option>';
        histOpts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.textContent;
            sel.appendChild(opt);
        });
        if (histOpts[idx]) sel.value = histOpts[idx].value;
    });

    document.getElementById('diff-modal').classList.remove('hidden');
}

export function closeDiffModal() {
    const modal = document.getElementById('diff-modal');
    if (modal) modal.classList.add('hidden');
}

export async function runDiff(onSuccess) {
    const setA = document.getElementById('diff-select-a').value;
    const setB = document.getElementById('diff-select-b').value;
    const msg  = document.getElementById('diff-modal-msg');

    if (!setA || !setB) {
        msg.textContent = '비교할 파일 A와 B를 모두 선택해주세요.';
        msg.classList.remove('hidden');
        return;
    }
    if (setA === setB) {
        msg.textContent = '서로 다른 파일을 선택해주세요.';
        msg.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('diff-run-btn');
    btn.disabled = true;
    btn.textContent = '비교 중...';
    msg.classList.add('hidden');

    try {
        const data = await api.fetchDiff(setA, setB);
        state.diffData    = data;
        state.diffSetA    = parseInt(setA);
        state.diffSetB    = parseInt(setB);
        state.diffSection = null;

        closeDiffModal();
        if (onSuccess) onSuccess();
    } catch (err) {
        msg.textContent = '오류: ' + err.message;
        msg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = '비교 실행';
    }
}

export function showDiffTab() {
    const toolbar = document.getElementById('main-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    closeDetail();

    if (!state.diffData) {
        document.getElementById('sidebar-body').innerHTML = `
            <div class="sidebar-placeholder">
                헤더의 ⚖️ Diff 버튼을 클릭하여<br>비교할 파일 두 개를 선택하세요.
            </div>`;
        document.getElementById('main-body').innerHTML =
            '<div class="empty-state">Diff 결과가 없습니다.</div>';
        return;
    }
    renderDiffSidebar();
    if (state.diffSection) {
        renderDiffMain();
    } else {
        const order = ['pol_changed','pol_added','pol_removed','lst_changed','lst_added','lst_removed'];
        const counts = getDiffCounts();
        const first = order.find(s => counts[s] > 0);
        if (first) selectDiffSection(first);
        else document.getElementById('main-body').innerHTML =
            '<div class="diff-empty">두 파일 간 차이가 없습니다.</div>';
    }
}

function getDiffCounts() {
    if (!state.diffData) return {};
    return {
        pol_added:   state.diffData.policies.summary.added,
        pol_removed: state.diffData.policies.summary.removed,
        pol_changed: state.diffData.policies.summary.changed,
        lst_added:   state.diffData.lists.summary.added,
        lst_removed: state.diffData.lists.summary.removed,
        lst_changed: state.diffData.lists.summary.changed,
    };
}

export function renderDiffSidebar() {
    const body   = document.getElementById('sidebar-body');
    if (!body) return;
    const counts = getDiffCounts();
    const sa     = state.diffData.set_a;
    const sb     = state.diffData.set_b;

    const polSum = state.diffData.policies.summary;
    const lstSum = state.diffData.lists.summary;

    body.innerHTML = `
        <div class="diff-info-header">
            <div><strong>A</strong>: ${escapeHtml(sa.filename || '(알 수 없음)')}</div>
            <div><strong>B</strong>: ${escapeHtml(sb.filename || '(알 수 없음)')}</div>
        </div>
        <div class="diff-section-group">
            <div class="diff-section-label">정책 (Policy)</div>
            ${renderDiffSectionItem('pol_added',   '➕ 생성됨', counts.pol_added,   'added')}
            ${renderDiffSectionItem('pol_removed', '➖ 삭제됨', counts.pol_removed, 'removed')}
            ${renderDiffSectionItem('pol_changed', '✏️ 변경됨', counts.pol_changed, 'changed')}
        </div>
        <div class="diff-section-group">
            <div class="diff-section-label">리스트 (List)</div>
            ${renderDiffSectionItem('lst_added',   '➕ 생성됨', counts.lst_added,   'added')}
            ${renderDiffSectionItem('lst_removed', '➖ 삭제됨', counts.lst_removed, 'removed')}
            ${renderDiffSectionItem('lst_changed', '✏️ 변경됨', counts.lst_changed, 'changed')}
        </div>
        <div class="diff-info-header" style="margin-top:4px;font-size:10px;color:#aaa;">
            정책: ${polSum.unchanged}개 동일 · 리스트: ${lstSum.unchanged}개 동일
        </div>
    `;

    body.querySelectorAll('.diff-section-item:not(.empty)').forEach(el => {
        el.onclick = () => selectDiffSection(el.dataset.section);
    });
}

function renderDiffSectionItem(key, label, count, type) {
    const isEmpty  = count === 0;
    const isActive = state.diffSection === key;
    const cls = ['diff-section-item', isEmpty ? 'empty' : '', isActive ? 'active' : ''].join(' ').trim();
    const countCls = isEmpty ? 'zero' : type;
    return `<div class="${cls}" data-section="${key}">
        ${escapeHtml(label)}
        <span class="diff-count ${countCls}">${count}</span>
    </div>`;
}

export function selectDiffSection(section) {
    state.diffSection = section;
    renderDiffSidebar();
    renderDiffMain();
}

function renderDiffMain() {
    if (!state.diffData || !state.diffSection) return;
    const main = document.getElementById('main-body');

    switch (state.diffSection) {
        case 'pol_added':   renderPoliciesList(state.diffData.policies.added,   'added',   '생성된 정책'); break;
        case 'pol_removed': renderPoliciesList(state.diffData.policies.removed, 'removed', '삭제된 정책'); break;
        case 'pol_changed': renderPoliciesChanged(state.diffData.policies.changed); break;
        case 'lst_added':   renderListsList(state.diffData.lists.added,   'added',   '생성된 리스트'); break;
        case 'lst_removed': renderListsList(state.diffData.lists.removed, 'removed', '삭제된 리스트'); break;
        case 'lst_changed': renderListsChanged(state.diffData.lists.changed); break;
    }
}

function renderPoliciesList(items, cardType, title) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = `<div class="diff-empty">${escapeHtml(title)}이 없습니다.</div>`;
        return;
    }
    const cards = items.map(p => {
        const badge = `<span class="diff-type-badge">${escapeHtml(p.Type || '')}</span>`;
        const enabledBadge = p.Enabled === 'false'
            ? `<span class="diff-type-badge" style="background:#fdecea;color:#c0392b;">비활성</span>` : '';
        const condHtml = p.Condition
            ? `<div class="diff-field-row"><td class="diff-field-key">Condition</td><td class="diff-field-val">${colorCondition(p.Condition)}</td></div>` : '';
        const actHtml  = p.Actions
            ? `<div class="diff-field-row"><td class="diff-field-key">Actions</td><td class="diff-field-val" style="font-size:11px;color:#555;">${escapeHtml(p.Actions)}</td></div>` : '';
        return `
        <div class="diff-card ${escapeHtml(cardType)}">
            <div class="diff-card-header">
                ${badge} ${escapeHtml(p.Name || '(이름 없음)')} ${enabledBadge}
            </div>
            <div class="diff-card-sub">${escapeHtml(p.Path || p.PolicyID || '')}</div>
            <table class="diff-field-table">
                ${condHtml}${actHtml}
            </table>
        </div>`;
    }).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;
}

function renderPoliciesChanged(items) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = '<div class="diff-empty">변경된 정책이 없습니다.</div>';
        return;
    }
    const cards = items.map(item => {
        const badge = `<span class="diff-type-badge">${escapeHtml(item.Type || '')}</span>`;
        const name  = item.changes.Name
            ? `<del>${escapeHtml(item.changes.Name.a || '')}</del> → <ins>${escapeHtml(item.changes.Name.b || '')}</ins>`
            : escapeHtml(item.b?.Name || item.a?.Name || '');

        const fieldRows = Object.entries(item.changes).map(([field, vals]) => {
            let beforeHtml = escapeHtml(vals.a || '');
            let afterHtml  = escapeHtml(vals.b || '');
            if (field === 'Condition') {
                beforeHtml = colorCondition(vals.a || '');
                afterHtml  = colorCondition(vals.b || '');
            }
            return `<tr class="diff-field-row">
                <td class="diff-field-key">${escapeHtml(field)}</td>
                <td class="diff-field-val">
                    <div class="diff-val-before">${beforeHtml}</div>
                    <div class="diff-val-after">${afterHtml}</div>
                </td>
            </tr>`;
        }).join('');

        return `
        <div class="diff-card changed">
            <div class="diff-card-header">${badge} ${name}</div>
            <div class="diff-card-sub">${escapeHtml(item.b?.Path || item.a?.Path || item.PolicyID || '')}</div>
            <table class="diff-field-table">${fieldRows}</table>
        </div>`;
    }).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;
}

function renderListsList(items, cardType, title) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = `<div class="diff-empty">${escapeHtml(title)}이 없습니다.</div>`;
        return;
    }
    const cards = items.map(l => `
        <div class="diff-card ${escapeHtml(cardType)}">
            <div class="diff-card-header">📦 ${escapeHtml(l.list_name || '(이름 없음)')}</div>
            <div class="diff-card-sub">${escapeHtml(l.list_id || '')}</div>
        </div>`
    ).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;
}

function renderListsChanged(items) {
    const main = document.getElementById('main-body');
    if (!items.length) {
        main.innerHTML = '<div class="diff-empty">변경된 리스트가 없습니다.</div>';
        return;
    }
    const PREVIEW = 20;
    const cards = items.map(l => {
        const added   = l.entries_added   || [];
        const removed = l.entries_removed || [];

        const renderEntries = (arr, type, listId) => {
            const shown = arr.slice(0, PREVIEW);
            const rest  = arr.length - shown.length;
            const rows  = shown.map(v =>
                `<div class="diff-entry-${escapeHtml(type)}">${escapeHtml(v)}</div>`
            ).join('');
            const more  = rest > 0
                ? `<button class="diff-more-btn" data-list-id="${escapeHtml(listId)}" data-type="${escapeHtml(type)}" data-all='${escapeHtml(JSON.stringify(arr))}'>▼ ${rest}개 더 보기</button>`
                : '';
            return rows + more;
        };

        return `
        <div class="diff-card changed">
            <div class="diff-card-header">📦 ${escapeHtml(l.list_name || '(이름 없음)')}</div>
            <div class="diff-card-sub">${escapeHtml(l.list_id || '')} · A: ${l.entry_count_a}개 → B: ${l.entry_count_b}개</div>
            ${renderEntries(added,   'added',   l.list_id)}
            ${renderEntries(removed, 'removed', l.list_id)}
        </div>`;
    }).join('');
    main.innerHTML = `<div class="diff-cards-wrap">${cards}</div>`;

    main.querySelectorAll('.diff-more-btn').forEach(btn => {
        btn.onclick = () => {
            const all = JSON.parse(btn.getAttribute('data-all'));
            const type = btn.dataset.type;
            const rows = all.map(v => `<div class="diff-entry-${escapeHtml(type)}">${escapeHtml(v)}</div>`).join('');
            btn.insertAdjacentHTML('beforebegin', rows);
            btn.remove();
        };
    });
}
