import MapEditor from './mapCanvas.js';
import Sidebar from './sidebar.js';
import { loadAllFromLocal } from './storage.js';

const canvas = document.getElementById('map-canvas');
const sidebarEl = document.getElementById('sidebar');

const initial = loadAllFromLocal() || {};

const editor = new MapEditor(canvas, initial.map || null);
const sidebar = new Sidebar(sidebarEl, editor, initial);

window.editor = editor;
window.sidebar = sidebar;

editor.onChange = (map) => {
    sidebar.updateFromMap(map);
};

sidebar.init();
editor.startRenderLoop();
