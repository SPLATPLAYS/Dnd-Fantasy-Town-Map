import MapEditor from './mapCanvas.js';
import BottomMenu from './bottomMenu.js';
import { loadAllFromLocal } from './storage.js';

const canvas = document.getElementById('map-canvas');

const initial = loadAllFromLocal() || {};

const editor = new MapEditor(canvas, initial.map || null);
const menu = new BottomMenu(editor, initial);

window.editor = editor;
window.menu = menu;

editor.onChange = (map) => {
    menu.updateFromMap(map);
};

menu.init();
editor.startRenderLoop();
