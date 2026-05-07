import { saveAllToLocal, downloadJSON } from './storage.js';
import { createEntitiesBulk } from './dataModels.js';

export default class BottomMenu {
    constructor(editor, initial) {
        this.editor = editor;
        this.state = initial || {};
        this.mapName = (this.state.map && this.state.map.name) || 'my-town';
        this.activeTool = 'paint';
    }

    init() {
        this._bindMenuButtons();
        this._bindToolButtons();
        this._bindPanelButtons();
        this._renderBuildingsPanel();
        this._renderEntitiesPanel();
        this._renderExportPanel();
    }

    _bindMenuButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const terrainSelector = document.getElementById('terrain-selector');

        if (undoBtn) undoBtn.addEventListener('click', () => this.editor.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => this.editor.redo());
        if (terrainSelector) {
            terrainSelector.addEventListener('change', e => {
                this.editor.setTerrain(e.target.value);
            });
        }
    }

    _bindToolButtons() {
        const paintBtn = document.getElementById('paint-btn');
        const rectBtn = document.getElementById('rect-btn');
        const panBtn = document.getElementById('pan-btn');

        if (paintBtn) {
            paintBtn.addEventListener('click', () => {
                this.activeTool = 'paint';
                this.editor.setTool('paint');
                this._updateToolButtons();
            });
        }
        if (rectBtn) {
            rectBtn.addEventListener('click', () => {
                this.activeTool = 'rect';
                this.editor.setTool('rect');
                this._updateToolButtons();
            });
        }
        if (panBtn) {
            panBtn.addEventListener('click', () => {
                this.activeTool = 'pan';
                this.editor.setTool('pan');
                this._updateToolButtons();
            });
        }
    }

    _updateToolButtons() {
        const paintBtn = document.getElementById('paint-btn');
        const rectBtn = document.getElementById('rect-btn');
        const panBtn = document.getElementById('pan-btn');

        [paintBtn, rectBtn, panBtn].forEach(btn => btn?.classList.remove('active'));

        if (this.activeTool === 'paint' && paintBtn) paintBtn.classList.add('active');
        if (this.activeTool === 'rect' && rectBtn) rectBtn.classList.add('active');
        if (this.activeTool === 'pan' && panBtn) panBtn.classList.add('active');
    }

    _bindPanelButtons() {
        const buildingsBtn = document.getElementById('buildings-btn');
        const entitiesBtn = document.getElementById('entities-btn');
        const exportBtn = document.getElementById('export-btn');

        const buildingsPanel = document.getElementById('buildings-panel');
        const entitiesPanel = document.getElementById('entities-panel');
        const exportPanel = document.getElementById('export-panel');

        if (buildingsBtn) {
            buildingsBtn.addEventListener('click', () => {
                this._togglePanel(buildingsPanel);
                entitiesPanel?.classList.add('hidden');
                exportPanel?.classList.add('hidden');
            });
        }

        if (entitiesBtn) {
            entitiesBtn.addEventListener('click', () => {
                this._togglePanel(entitiesPanel);
                buildingsPanel?.classList.add('hidden');
                exportPanel?.classList.add('hidden');
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this._togglePanel(exportPanel);
                buildingsPanel?.classList.add('hidden');
                entitiesPanel?.classList.add('hidden');
            });
        }
    }

    _togglePanel(panel) {
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }

    _renderBuildingsPanel() {
        const panel = document.getElementById('buildings-panel');
        if (!panel) return;

        panel.innerHTML = `
            <strong>Buildings</strong>
            <div class='small'>Place building by selecting Building tool and dragging on map.</div>
            <div style='display:flex;gap:4px;margin-bottom:8px'>
                <input id='b-name' placeholder='Name' style='flex:1'>
                <select id='b-type' style='flex:1'>
                    <option>house</option>
                    <option>tavern</option>
                    <option>blacksmith</option>
                    <option>farm</option>
                </select>
            </div>
            <button id='add-manual'>Add Building</button>
            <div id='build-list' style='margin-top:10px;max-height:150px;overflow-y:auto'></div>
        `;

        panel.querySelector('#add-manual').addEventListener('click', () => {
            const name = panel.querySelector('#b-name').value || 'Bldg';
            const type = panel.querySelector('#b-type').value;
            this.editor.placeBuildingAt(0, 0, { name, type, w: 2, h: 2 });
            this.updateFromMap(this.editor.map);
        });

        this._buildListEl = panel.querySelector('#build-list');
        this.updateFromMap(this.editor.map);
    }

    _renderEntitiesPanel() {
        const panel = document.getElementById('entities-panel');
        if (!panel) return;

        panel.innerHTML = `
            <strong>Entities</strong>
            <div class='small'>Bulk create inhabitants</div>
            <div style='display:flex;gap:4px;margin-bottom:8px'>
                <input id='bulk-count' type='number' value='5' min='1' style='flex:0.5;width:60px'>
                <select id='bulk-race' style='flex:1'>
                    <option>Human</option>
                    <option>Orc</option>
                    <option>Rock Gnome</option>
                    <option>Elf</option>
                </select>
            </div>
            <div style='display:flex;gap:4px;margin-bottom:8px'>
                <select id='bulk-role' style='flex:1'>
                    <option>Farmer</option>
                    <option>Guard</option>
                    <option>Chef</option>
                    <option>Merchant</option>
                </select>
                <button id='bulk-create' style='flex:0.7'>Create</button>
            </div>
            <div id='entities-list' style='max-height:150px;overflow-y:auto'></div>
        `;

        panel.querySelector('#bulk-create').addEventListener('click', () => {
            const count = parseInt(panel.querySelector('#bulk-count').value || '0');
            const race = panel.querySelector('#bulk-race').value;
            const role = panel.querySelector('#bulk-role').value;
            const arr = createEntitiesBulk(count, race, role, this.mapName);
            this.editor.map.entities = this.editor.map.entities.concat(arr);
            this.updateFromMap(this.editor.map);
        });

        this.entitiesListEl = panel.querySelector('#entities-list');
        this.updateFromMap(this.editor.map);
    }

    _renderExportPanel() {
        const panel = document.getElementById('export-panel');
        if (!panel) return;

        panel.innerHTML = `
            <strong>Export / GitHub</strong>
            <div class='small'>Town name:</div>
            <input id='town-name' value='${this.mapName}' style='margin-bottom:8px'>
            <button id='export-json'>Download JSON</button>
            <button id='save-local'>Save Local</button>
            <details style='margin-top:8px'>
                <summary style='cursor:pointer;color:#fcd34d;margin-bottom:6px'>GitHub Commit (Optional)</summary>
                <div class='small' style='margin-bottom:6px'>Provide token, owner, repo</div>
                <input id='gh-token' placeholder='ghp_...' style='margin-bottom:4px'>
                <input id='gh-owner' placeholder='owner' style='margin-bottom:4px'>
                <input id='gh-repo' placeholder='repo' style='margin-bottom:4px'>
                <button id='gh-commit'>Commit</button>
            </details>
        `;

        panel.querySelector('#export-json').addEventListener('click', () => {
            const name = panel.querySelector('#town-name').value || this.mapName;
            downloadJSON(this.editor.map, `maps/${name}.json`);
            downloadJSON(this.editor.map.entities || [], `entities/${name}.json`);
            downloadJSON(this.editor.map.buildings || [], `buildings/${name}.json`);
        });

        panel.querySelector('#save-local').addEventListener('click', () => {
            saveAllToLocal({ map: this.editor.map });
            alert('Saved to browser localStorage');
        });

        panel.querySelector('#gh-commit').addEventListener('click', async () => {
            const token = panel.querySelector('#gh-token').value.trim();
            const owner = panel.querySelector('#gh-owner').value.trim();
            const repo = panel.querySelector('#gh-repo').value.trim();
            if (!token || !owner || !repo) { alert('Provide token, owner and repo'); return; }
            const town = panel.querySelector('#town-name').value || this.mapName;
            const files = [
                { path: `maps/${town}.json`, content: JSON.stringify(this.editor.map, null, 2) },
                { path: `entities/${town}.json`, content: JSON.stringify(this.editor.map.entities || [], null, 2) },
                { path: `buildings/${town}.json`, content: JSON.stringify(this.editor.map.buildings || [], null, 2) }
            ];
            try {
                for (const f of files) {
                    await this._putFileToGitHub(token, owner, repo, f.path, f.content, `Add ${f.path} from DND Town Builder`);
                }
                alert('Committed files (check repo)');
            } catch (err) { console.error(err); alert('Commit failed: ' + err.message); }
        });
    }

    async _putFileToGitHub(token, owner, repo, path, content, message) {
        const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
        const head = await fetch(api, { headers: { Authorization: `token ${token}` } });
        let sha = null;
        if (head.status === 200) { const d = await head.json(); sha = d.sha; }
        const body = { message, content: btoa(unescape(encodeURIComponent(content))), committer: { name: 'DND Town Builder', email: 'noreply@example.com' } };
        if (sha) body.sha = sha;
        const res = await fetch(api, { method: 'PUT', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('GitHub API error ' + res.status);
        return res.json();
    }

    updateFromMap(map) {
        this.map = map;
        this._renderBuildingList();
        this._renderEntitiesList();
    }

    _renderBuildingList() {
        if (!this._buildListEl) return;
        this._buildListEl.innerHTML = '';
        for (const b of this.editor.map.buildings) {
            const el = document.createElement('div');
            el.style.cssText = 'padding:6px;border:1px solid rgba(255,255,255,0.03);margin-bottom:4px;border-radius:4px;font-size:0.85rem';
            el.innerHTML = `<strong>${b.name}</strong> <div style='font-size:0.8rem;color:#94a3b8'>${b.type} ${b.w}x${b.h}</div>`;
            this._buildListEl.appendChild(el);
        }
    }

    _renderEntitiesList() {
        if (!this.entitiesListEl) return;
        this.entitiesListEl.innerHTML = '';
        for (const e of (this.editor.map.entities || [])) {
            const row = document.createElement('div');
            row.style.cssText = 'font-size:0.8rem;padding:4px;border-bottom:1px solid rgba(255,255,255,0.02)';
            row.textContent = `${e.name} — ${e.race} ${e.role}`;
            this.entitiesListEl.appendChild(row);
        }
    }
}
