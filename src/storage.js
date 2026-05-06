export function saveMapToLocal(map) {
    try { localStorage.setItem('dnd-town-map', JSON.stringify({ map })); } catch (e) { }
}

export function saveAllToLocal(obj) {
    try { localStorage.setItem('dnd-town-builder-state', JSON.stringify(obj)); } catch (e) { }
}

export function loadAllFromLocal() {
    try { const s = localStorage.getItem('dnd-town-builder-state'); return s ? JSON.parse(s) : null; } catch (e) { return null }
}

export function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
