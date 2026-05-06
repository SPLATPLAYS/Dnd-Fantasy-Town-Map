import { saveAllToLocal, downloadJSON } from './storage.js';
import { createEntitiesBulk } from './dataModels.js';

export default class Sidebar {
    constructor(root, editor, initial) {
        this.root = root; this.editor = editor; this.state = initial || {};
        this.mapName = (this.state.map && this.state.map.name) || 'my-town';
    }

    init() {
        this.root.innerHTML = '';
        this._renderTools();
        this._renderBuildingsPanel();
        this._renderEntitiesPanel();
        this._renderExportPanel();
    }

    _renderTools() {
        const panel = document.createElement('div'); panel.className = 'panel';
        panel.innerHTML = `<div class='tool-row'>
            <select id='tool-select'><option value='paint'>Paint</option><option value='rect'>Rect</option><option value='building'>Building</option><option value='pan'>Pan</option></select>
      <select id='terrain-select'><option value='grass'>Grass</option><option value='dirt'>Dirt</option><option value='water'>Water</option><option value='farmland'>Farmland</option><option value='road'>Road</option><option value='air'>Air (Clear)</option></select>
      <button id='undo'>Undo</button><button id='redo'>Redo</button>
    </div>`;
        this.root.appendChild(panel);
        panel.querySelector('#tool-select').addEventListener('change', e => this.editor.setTool(e.target.value));
        panel.querySelector('#terrain-select').addEventListener('change', e => this.editor.setTerrain(e.target.value));
        panel.querySelector('#undo').addEventListener('click', () => this.editor.undo());
        panel.querySelector('#redo').addEventListener('click', () => this.editor.redo());
    }

    _renderBuildingsPanel() {
        const panel = document.createElement('div'); panel.className = 'panel';
        panel.innerHTML = `<strong>Buildings</strong><div id='build-list' class='list'></div>
      <div class='small'>Place building by selecting tool and dragging on map.</div>
      <div class='tool-row'><input id='b-name' placeholder='Name'><select id='b-type'><option>house</option><option>tavern</option><option>blacksmith</option><option>farm</option></select><button id='add-manual'>Add Manual</button></div>`;
        this.root.appendChild(panel);
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
        const panel = document.createElement('div'); panel.className = 'panel';
        panel.innerHTML = `<strong>Entities</strong>
      <div class='small'>Bulk create inhabitants</div>
      <div class='tool-row'><input id='bulk-count' type='number' value='5' min='1' style='width:80px'><select id='bulk-race'><option>Human</option><option>Orc</option><option>Rock Gnome</option><option>Elf</option></select><select id='bulk-role'><option>Farmer</option><option>Guard</option><option>Chef</option><option>Merchant</option></select><button id='bulk-create'>Create</button></div>
      <div id='entities-list' class='list small'></div>`;
        this.root.appendChild(panel);
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
        const panel = document.createElement('div'); panel.className = 'panel';
        panel.innerHTML = `<strong>Export / GitHub</strong>
      <div class='small'>Town name: <input id='town-name' value='${this.mapName}'></div>
      <div class='tool-row'><button id='export-json'>Download JSON</button><button id='save-local'>Save Local</button></div>
      <details class='small'><summary>Commit to GitHub (optional)</summary>
        <div class='small'>Provide token, owner, repo and commit will attempt to push files via GitHub API.</div>
        <input id='gh-token' placeholder='ghp_...'>
        <input id='gh-owner' placeholder='owner'>
        <input id='gh-repo' placeholder='repo'>
        <div class='tool-row'><button id='gh-commit'>Commit</button></div>
      </details>
      <div class='small'>Export structure: /maps/${this.mapName}.json, /entities/${this.mapName}.json, /buildings/${this.mapName}.json</div>`;
        this.root.appendChild(panel);

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
            // Build payloads
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
        // Create or update file via GitHub REST API
        const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
        // Check if exists to get sha
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
        for (const b of this.map.buildings) {
            const el = document.createElement('div'); el.className = 'building-card';
            el.innerHTML = `<strong>${b.name}</strong> <div class='small'>${b.type} ${b.w}x${b.h}</div>`;
            this._buildListEl.appendChild(el);
        }
    }

    _renderEntitiesList() {
        if (!this.entitiesListEl) return;
        this.entitiesListEl.innerHTML = '';
        for (const e of (this.map.entities || [])) {
            const row = document.createElement('div'); row.className = 'small'; row.textContent = `${e.name} — ${e.race} ${e.role}`;
            this.entitiesListEl.appendChild(row);
        }
    }
}
