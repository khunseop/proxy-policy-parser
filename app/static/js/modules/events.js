import { state } from './state.js';
import { api } from './api.js';
import { setStatus, setLoading } from './ui.js';
import { 
    renderPolicySidebar, 
    loadAllPolicies, 
    performSearch, 
    clearSearch, 
    exportCurrentView,
    loadMainContent
} from './policy.js';
import { renderListsSidebar, selectList } from './lists.js';
import { renderStatsSidebar, loadStatsData } from './stats.js';
import { openDiffModal, closeDiffModal, runDiff, showDiffTab } from './diff.js';
import { closeDetail, showObjectDetail } from './detail.js';

export function bindEvents() {
    // ─── Header Events ────────────────────────────────────────────────────────
    const historySelect = document.getElementById('history-select');
    if (historySelect) {
        historySelect.addEventListener('change', handleSetChange);
    }

    const deleteSetBtn = document.getElementById('header-delete-btn');
    if (deleteSetBtn) deleteSetBtn.onclick = handleDeleteCurrentSet;

    const clearHistoryBtn = document.getElementById('header-clear-btn');
    if (clearHistoryBtn) clearHistoryBtn.onclick = handleClearAllHistory;

    const diffBtn = document.getElementById('diff-btn');
    if (diffBtn) diffBtn.onclick = openDiffModal;

    const xmlUploadInput = document.getElementById('xml-upload');
    const xmlUploadBtn = document.getElementById('xml-upload-btn');
    if (xmlUploadBtn && xmlUploadInput) {
        xmlUploadBtn.onclick = () => xmlUploadInput.click();
        xmlUploadInput.onchange = handleFileUpload;
    }

    // ─── Sidebar Tab Events ───────────────────────────────────────────────────
    document.querySelectorAll('.stab').forEach(btn => {
        btn.onclick = () => showTab(btn.dataset.tab);
    });

    // ─── Main Toolbar Events ──────────────────────────────────────────────────
    const mainSearch = document.getElementById('main-search');
    if (mainSearch) {
        mainSearch.oninput = (e) => {
            const q = e.target.value.trim();
            document.getElementById('search-clear').classList.toggle('hidden', !q);
            clearTimeout(state.searchTimer);
            if (!q) { clearSearch(); return; }
            state.searchTimer = setTimeout(() => performSearch(q), 350);
        };
        mainSearch.onkeydown = (e) => {
            if (e.key === 'Enter') {
                clearTimeout(state.searchTimer);
                const q = e.target.value.trim();
                if (q) performSearch(q);
            } else if (e.key === 'Escape') {
                clearSearch();
            }
        };
    }

    const searchClearBtn = document.getElementById('search-clear');
    if (searchClearBtn) searchClearBtn.onclick = clearSearch;

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.onclick = exportCurrentView;

    // ─── Detail Panel Events ──────────────────────────────────────────────────
    const detailCloseBtn = document.querySelector('.detail-panel .btn-icon');
    if (detailCloseBtn) detailCloseBtn.onclick = closeDetail;

    // ─── Diff Modal Events ────────────────────────────────────────────────────
    const diffModalCloseBtn = document.querySelector('#diff-modal .btn-icon');
    if (diffModalCloseBtn) diffModalCloseBtn.onclick = closeDiffModal;

    const diffRunBtn = document.getElementById('diff-run-btn');
    if (diffRunBtn) {
        diffRunBtn.onclick = () => runDiff(() => {
            showTab('diff');
        });
    }

    // ─── Global Delegation for dynamic elements ───────────────────────────────
    document.addEventListener('click', (e) => {
        // Breadcrumb clicks
        const crumb = e.target.closest('.crumb');
        if (crumb) {
            loadMainContent(crumb.dataset.path || '');
            return;
        }

        // List links in conditions
        const listLink = e.target.closest('.list-link');
        if (listLink) {
            showObjectDetail(listLink.dataset.listId);
            return;
        }

        // List ref items (Policies referring to a list)
        const refItem = e.target.closest('.list-ref-item');
        if (refItem) {
            const idx = parseInt(refItem.dataset.refIdx, 10);
            const node = state.listRefPolicies[idx];
            if (node) navigateToNode(node);
            return;
        }
    });
}

// ─── Action Handlers ──────────────────────────────────────────────────────────

async function handleSetChange() {
    state.currentSetId = document.getElementById('history-select').value;
    state.isSearchMode = false;
    state.currentPath  = '';
    state.selectedPk   = null;
    state.statsData    = [];
    state.policyStats  = null;
    closeDetail();
    clearSearch();

    if (!state.currentSetId) {
        document.getElementById('sidebar-body').innerHTML = '<div class="sidebar-placeholder">정책을 선택하세요.</div>';
        document.getElementById('main-body').innerHTML    = '<div class="empty-state">정책을 선택하거나 업로드하세요.</div>';
        document.getElementById('policy-stats').textContent = '';
        state.objectsMap = {};
        return;
    }

    setLoading(true, '로딩 중...');
    try {
        const objs = await api.fetchObjects(state.currentSetId);
        state.objectsMap = {};
        state.objectsNameToId = {};
        objs.forEach(obj => {
            const id = obj.list_id;
            if (!state.objectsMap[id]) {
                state.objectsMap[id] = { name: obj.list_name, type: obj.list_type_id, entries: [] };
                if (obj.list_name) state.objectsNameToId[obj.list_name] = id;
            }
            if (obj.entry_value) {
                state.objectsMap[id].entries.push({
                    value:   obj.entry_value,
                    type:    obj.entry_type || 'default',
                    details: obj.entry_details || ''
                });
            }
        });

        showTab('policies');
    } finally {
        setLoading(false);
    }
}

async function handleDeleteCurrentSet() {
    const id = document.getElementById('history-select').value;
    if (!id) { alert('삭제할 정책 이력을 먼저 선택해주세요.'); return; }
    if (!confirm('현재 선택된 정책 이력을 삭제하시겠습니까?')) return;
    try {
        const res = await api.deleteHistoryItem(id);
        if (res.ok) { 
            await loadHistory(); 
            handleSetChange(); 
        }
    } catch (err) { alert('삭제 실패: ' + err.message); }
}

async function handleClearAllHistory() {
    if (!confirm('모든 정책 히스토리를 초기화하시겠습니까? 복구할 수 없습니다.')) return;
    try {
        const res = await api.clearAllHistory();
        if (res.ok) { 
            await loadHistory(); 
            handleSetChange(); 
        }
    } catch (err) { alert('초기화 실패: ' + err.message); }
}

async function handleFileUpload() {
    const input = document.getElementById('xml-upload');
    if (!input.files.length) return;
    
    setLoading(true, 'XML 파싱 중...');
    try {
        const result = await api.uploadXml(input.files[0]);
        state.currentSetId = result.set_id;
        await loadHistory();
        document.getElementById('history-select').value = state.currentSetId;
        
        // Reload objects
        const objs = await api.fetchObjects(state.currentSetId);
        state.objectsMap = {};
        objs.forEach(obj => {
            const id = obj.list_id;
            if (!state.objectsMap[id]) {
                state.objectsMap[id] = { name: obj.list_name, type: obj.list_type_id, entries: [] };
            }
            if (obj.entry_value) {
                state.objectsMap[id].entries.push({ value: obj.entry_value, type: obj.entry_type });
            }
        });

        showTab('policies');
        setStatus('업로드 완료');
        setTimeout(() => { if (document.getElementById('status-msg')?.textContent === '업로드 완료') setStatus('준비됨'); }, 2000);
    } catch (err) {
        setStatus('오류: ' + err.message);
    } finally {
        input.value = '';
    }
}

export async function loadHistory() {
    try {
        const list = await api.fetchHistory();
        const sel  = document.getElementById('history-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">정책 선택...</option>';
        list.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.upload_time} · ${s.filename}`;
            sel.appendChild(opt);
        });
    } catch (err) { console.error('히스토리 로드 실패:', err); }
}

export function showTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    
    if (tab === 'policies') {
        document.getElementById('main-toolbar').style.display = 'flex';
        if (!state.currentSetId) {
            document.getElementById('sidebar-body').innerHTML = '<div class="sidebar-placeholder">정책을 선택하세요.</div>';
            document.getElementById('main-body').innerHTML    = '<div class="empty-state">정책을 선택하거나 업로드하세요.</div>';
            return;
        }
        renderPolicySidebar();
        // Bind dynamic events for sidebar (tree search, expired btn)
        const treeSearch = document.getElementById('sidebar-tree-search');
        if (treeSearch) {
            treeSearch.oninput = (e) => {
                const val = e.target.value.trim();
                const mainSearch = document.getElementById('main-search');
                if (mainSearch) {
                    mainSearch.value = val;
                    if (!val) { clearSearch(); return; }
                    document.getElementById('search-clear').classList.remove('hidden');
                    clearTimeout(state.searchTimer);
                    state.searchTimer = setTimeout(() => performSearch(val), 300);
                }
            };
        }
        const expiredBtn = document.getElementById('find-expired-btn');
        if (expiredBtn) expiredBtn.onclick = findExpiredPolicies;

        if (!state.isSearchMode) loadAllPolicies();
    } 
    else if (tab === 'lists') {
        document.getElementById('main-toolbar').style.display = 'none';
        renderListsSidebar('');
    } 
    else if (tab === 'stats') {
        document.getElementById('main-toolbar').style.display = 'none';
        renderStatsSidebar();
        loadStatsData();
    } 
    else if (tab === 'diff') {
        showDiffTab();
    }
}

async function navigateToNode(node) {
    showTab('policies');
    state.isSearchMode = false;
    state.currentPath  = node.ParentPath || '';
    await loadMainContent(state.currentPath);
    openDetail(node);

    const rows = document.querySelectorAll('.policy-row');
    rows.forEach(r => {
        if (r.querySelector('.row-name')?.textContent === (node.Name || 'Unnamed')) {
            r.classList.add('active');
            r.scrollIntoView({ block: 'nearest' });
        }
    });
}
