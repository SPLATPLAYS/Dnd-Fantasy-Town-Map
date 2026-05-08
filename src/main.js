import MapEditor from './mapCanvas.js';
import BottomMenu from './bottomMenu.js';
import { loadAllFromLocal } from './storage.js';

const canvas = document.getElementById('map-canvas');

const initial = loadAllFromLocal() || {};

const editor = new MapEditor(canvas, initial.map || null);
const menu = new BottomMenu(editor, initial);

window.editor = editor;
window.menu = menu;

// Loading overlay elements
const overlay = document.getElementById('loading-overlay');
const fill = document.getElementById('loading-fill');
const percent = document.getElementById('loading-percent');
if (overlay) overlay.classList.remove('hidden');

window.addEventListener('texture-progress', (e) => {
    const { loaded, total } = e.detail || {};
    if (!fill || !percent) return;
    const p = Math.round((loaded / total) * 100);
    fill.style.width = p + '%';
    percent.textContent = p + '%';
});
window.addEventListener('texture-done', () => {
    if (overlay) overlay.classList.add('hidden');
});

editor.onChange = (map) => {
    menu.updateFromMap(map);
};

menu.init();
editor.startRenderLoop();
