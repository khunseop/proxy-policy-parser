/**
 * General UI Helpers
 */

export function setStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
}

export function setLoading(active, msg = '') {
    const uploadBtn = document.getElementById('xml-upload-btn');
    const historySel = document.getElementById('history-select');
    if (uploadBtn) uploadBtn.disabled = active;
    if (historySel) historySel.disabled = active;
    setStatus(active ? msg : '준비됨');
}

export function setExportBtn(visible) {
    const btn = document.getElementById('export-btn');
    if (btn) btn.style.display = visible ? '' : 'none';
}

// ─── Resizers ─────────────────────────────────────────────────────────────────
export function initResizers() {
    setupResizer(
        document.getElementById('sidebar-resizer'),
        document.getElementById('sidebar'),
        180, 400, false
    );
    setupResizer(
        document.getElementById('detail-resizer'),
        document.getElementById('detail-panel'),
        300, 700, true
    );
}

function setupResizer(handle, target, min, max, reverse) {
    if (!handle || !target) return;
    let startX, startW;

    handle.addEventListener('mousedown', e => {
        e.preventDefault();
        startX = e.clientX;
        startW = target.getBoundingClientRect().width;
        handle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = e => {
            const delta = (e.clientX - startX) * (reverse ? -1 : 1);
            target.style.width = Math.max(min, Math.min(max, startW + delta)) + 'px';
        };
        const onUp = () => {
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ─── Tree Node Tooltip ────────────────────────────────────────────────────────
let _tooltipEl = null;

export function showNodeTooltip(e, text) {
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;

    hideNodeTooltip();
    _tooltipEl = document.createElement('div');
    _tooltipEl.className = 'node-tooltip';
    _tooltipEl.textContent = text;
    document.body.appendChild(_tooltipEl);
    positionTooltip(e);
}

export function hideNodeTooltip() {
    if (_tooltipEl) { _tooltipEl.remove(); _tooltipEl = null; }
}

export function moveNodeTooltip(e) {
    if (_tooltipEl) positionTooltip(e);
}

function positionTooltip(e) {
    if (!_tooltipEl) return;
    const x = e.clientX + 14;
    const y = e.clientY + 14;
    const w = _tooltipEl.offsetWidth;
    const h = _tooltipEl.offsetHeight;
    _tooltipEl.style.left = (x + w > window.innerWidth  ? x - w - 20 : x) + 'px';
    _tooltipEl.style.top  = (y + h > window.innerHeight ? y - h - 20 : y) + 'px';
}
