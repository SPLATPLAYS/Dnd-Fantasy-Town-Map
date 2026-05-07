import { saveMapToLocal } from './storage.js';
import { createDefaultMap } from './dataModels.js';

class MapEditor {
    constructor(canvas, initialMap = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = Math.max(1, window.devicePixelRatio || 1);
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this._resizeCanvas();

        this.tileSize = 32; // pixels per tile (represents 5ft)
        this.zoom = 1;
        this.offset = { x: 0, y: 0 };

        this.texture = null; // currently selected texture path (if any)

        this.map = initialMap || createDefaultMap(40, 30);

        this.dragging = false; this.last = null;
        this.tool = 'paint'; // paint, rect, erase, building, select, pan
        this.terrain = 'grass';

        this.buildingInProgress = null;
        this.buildingPreview = null;
        this.rectPreview = null;

        this.onChange = () => { };

        this._undo = [];
        this._redo = [];

        window.addEventListener('resize', () => this._resizeCanvas());
        this._bindEvents();
    }

    _resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.viewWidth = Math.max(1, rect.width || this.canvas.clientWidth || 1);
        this.viewHeight = Math.max(1, rect.height || this.canvas.clientHeight || 1);
        this.canvas.width = Math.max(1, Math.round(this.viewWidth * this.dpr));
        this.canvas.height = Math.max(1, Math.round(this.viewHeight * this.dpr));
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    _bindEvents() {
        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY) * 0.1;
            this.zoom = Math.min(3, Math.max(0.5, this.zoom + delta));
        }, { passive: false });

        this.canvas.addEventListener('mousedown', e => {
            if (this.tool === 'pan' && e.button === 0) {
                this.dragging = true;
                this.last = { x: e.clientX, y: e.clientY };
                this.canvas.style.cursor = 'grabbing';
                return;
            }
            const p = this._screenToWorld(e.offsetX, e.offsetY);
            this._startAction(p, e);
        });
        this.canvas.addEventListener('mousemove', e => {
            const p = this._screenToWorld(e.offsetX, e.offsetY);
            this._moveAction(p, e);
        });
        window.addEventListener('mouseup', e => {
            const p = this._screenToWorld((e.offsetX || 0), (e.offsetY || 0));
            this._endAction(p, e);
        });

        // pan with middle mouse or pan tool
        this.canvas.addEventListener('mousedown', e => {
            if (e.button === 1) {
                this.dragging = true; this.last = { x: e.clientX, y: e.clientY };
                this.canvas.style.cursor = 'grabbing';
            }
        });
        window.addEventListener('mousemove', e => {
            if (this.dragging && this.last) {
                const dx = (e.clientX - this.last.x) / (this.tileSize * this.zoom);
                const dy = (e.clientY - this.last.y) / (this.tileSize * this.zoom);
                this.offset.x -= dx; this.offset.y -= dy;
                this.last = { x: e.clientX, y: e.clientY };
            }
        });
        window.addEventListener('mouseup', e => {
            this.dragging = false;
            this.last = null;
            this.canvas.style.cursor = this.tool === 'pan' ? 'grab' : 'default';
        });
        this.canvas.style.cursor = this.tool === 'pan' ? 'grab' : 'default';
    }

    _screenToWorld(sx, sy) {
        const x = (sx - this.viewWidth / 2) / (this.tileSize * this.zoom) + this.offset.x;
        const y = (sy - this.viewHeight / 2) / (this.tileSize * this.zoom) + this.offset.y;
        return { x: Math.floor(x), y: Math.floor(y) };
    }

    _startAction(p, e) {
        if (e.button === 1) return; // ignore middle handled elsewhere
        this._pushUndo();
        if (this.tool === 'paint') {
            this._paintTile(p.x, p.y, this.terrain);
        } else if (this.tool === 'rect') {
            this._rectStart = { x: p.x, y: p.y };
            this.rectPreview = { x: p.x, y: p.y, w: 1, h: 1 };
        } else if (this.tool === 'building') {
            // start building placement
            this.buildingInProgress = {
                id: Date.now().toString(),
                startX: p.x,
                startY: p.y,
                endX: p.x,
                endY: p.y,
                x: p.x,
                y: p.y,
                w: 1,
                h: 1,
                type: 'house',
                name: 'New Building',
                function: 'residential'
            };
            this.buildingPreview = this._getBuildingFootprint(this.buildingInProgress.startX, this.buildingInProgress.startY, p.x, p.y);
        }
        this.onChange(this.map);
    }

    _moveAction(p, e) {
        if (this.tool === 'paint' && (e.buttons & 1)) {
            this._paintTile(p.x, p.y, this.terrain);
            this.onChange(this.map);
        } else if (this.tool === 'rect' && this._rectStart && (e.buttons & 1)) {
            this._rectCurrent = { x: p.x, y: p.y };
            this.rectPreview = this._getRectFootprint(this._rectStart.x, this._rectStart.y, p.x, p.y);
        } else if (this.tool === 'building' && this.buildingInProgress && (e.buttons & 1)) {
            this.buildingInProgress.endX = p.x;
            this.buildingInProgress.endY = p.y;
            this.buildingPreview = this._getBuildingFootprint(
                this.buildingInProgress.startX,
                this.buildingInProgress.startY,
                this.buildingInProgress.endX,
                this.buildingInProgress.endY
            );
        }
    }

    _endAction(p, e) {
        if (this.tool === 'rect') {
            if (this._rectStart && this._rectCurrent) {
                this._applyRect(this._rectStart, this._rectCurrent, this.terrain);
            }
            this._rectStart = null; this._rectCurrent = null;
            this.rectPreview = null;
        } else if (this.tool === 'building' && this.buildingInProgress) {
            // commit building
            const footprint = this.buildingPreview || this._getBuildingFootprint(
                this.buildingInProgress.startX,
                this.buildingInProgress.startY,
                p.x,
                p.y
            );
            this._commitBuilding({
                ...this.buildingInProgress,
                x: footprint.x,
                y: footprint.y,
                w: footprint.w,
                h: footprint.h
            });
            this.buildingInProgress = null;
            this.buildingPreview = null;
        }
        saveMapToLocal(this.map);
        this.onChange(this.map);
    }

    _paintTile(x, y, terrain) {
        if (!this.map) return;
        const key = `${x},${y}`;
        if (terrain === 'air') {
            delete this.map.tiles[key];
        } else {
            const tile = { terrain };
            if (this.texture) tile.texture = this.texture;
            this.map.tiles[key] = tile;
        }
    }

    _applyRect(a, b, terrain) {
        const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
        const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this._paintTile(x, y, terrain);
    }

    setTexture(src) { this.texture = src; }

    _commitBuilding(b) {
        const building = { id: b.id, name: b.name, type: b.type, function: b.function, x: b.x, y: b.y, w: b.w, h: b.h, slots: [] };
        this.map.buildings.push(building);
        // mark occupied tiles
        for (let dx = 0; dx < building.w; dx++) for (let dy = 0; dy < building.h; dy++) {
            const key = `${building.x + dx},${building.y + dy}`;
            this.map.tiles[key] = { ...(this.map.tiles[key] || {}), building: building.id };
        }
    }

    _getBuildingFootprint(startX, startY, endX, endY) {
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX) + 1;
        const h = Math.abs(endY - startY) + 1;
        return { x, y, w, h };
    }

    _getRectFootprint(startX, startY, endX, endY) {
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX) + 1;
        const h = Math.abs(endY - startY) + 1;
        return { x, y, w, h };
    }

    placeBuildingAt(x, y, opts) {
        const b = { id: opts.id || Date.now().toString(), name: opts.name || 'B', type: opts.type || 'house', function: opts.function || 'residential', x, y, w: opts.w || 1, h: opts.h || 1 };
        this.map.buildings.push(b);
        for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) {
            const key = `${x + dx},${y + dy}`;
            this.map.tiles[key] = { ...(this.map.tiles[key] || {}), building: b.id };
        }
        this.onChange(this.map);
    }

    setTool(t) {
        this.tool = t;
        this.canvas.style.cursor = this.tool === 'pan' ? 'grab' : 'default';
    }
    setTerrain(t) { this.terrain = t; }

    _pushUndo() { this._undo.push(JSON.stringify(this.map)); if (this._undo.length > 50) this._undo.shift(); this._redo = []; }
    undo() { if (this._undo.length) { this._redo.push(JSON.stringify(this.map)); this.map = JSON.parse(this._undo.pop()); this.onChange(this.map); } }
    redo() { if (this._redo.length) { this._undo.push(JSON.stringify(this.map)); this.map = JSON.parse(this._redo.pop()); this.onChange(this.map); } }

    startRenderLoop() {
        const loop = () => {
            this._render();
            requestAnimationFrame(loop);
        };
        loop();
    }

    _render() {
        const ctx = this.ctx; const w = this.canvas.clientWidth; const h = this.canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(this.tileSize * this.zoom, this.tileSize * this.zoom);
        ctx.translate(-this.offset.x, -this.offset.y);

        // draw terrain tiles
        for (const k in this.map.tiles) {
            const [x, y] = k.split(',').map(Number);
            const tile = this.map.tiles[k];
            const t = tile.terrain || 'grass';
            // if a texture is assigned and TextureManager available, draw it
            if (tile.texture && window.textureManager) {
                const img = window.textureManager.getImage(tile.texture);
                if (img) {
                    try { ctx.drawImage(img, x, y, 1, 1); }
                    catch (e) { ctx.fillStyle = this._terrainColor(t); ctx.fillRect(x, y, 1, 1); }
                } else {
                    ctx.fillStyle = this._terrainColor(t);
                    ctx.fillRect(x, y, 1, 1);
                }
            } else {
                ctx.fillStyle = this._terrainColor(t);
                ctx.fillRect(x, y, 1, 1);
            }
            // building overlay
            if (this.map.tiles[k].building) {
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.strokeRect(x, y, 1, 1);
            }
        }

        // draw building outlines
        ctx.lineWidth = 0.02;
        ctx.strokeStyle = '#ffd27f';
        for (const b of this.map.buildings) {
            ctx.strokeRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(b.x, b.y, b.w, b.h);
        }

        if (this.tool === 'building' && this.buildingPreview) {
            this._drawBuildingPreview(ctx, this.buildingPreview);
        }

        if (this.tool === 'rect' && this.rectPreview) {
            this._drawRectPreview(ctx, this.rectPreview);
        }

        // grid
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = Math.max(0.035, 1 / (this.tileSize * this.zoom));
        const startX = Math.floor(this.offset.x - (w / 2) / (this.tileSize * this.zoom)) - 1;
        const endX = Math.ceil(this.offset.x + (w / 2) / (this.tileSize * this.zoom)) + 1;
        const startY = Math.floor(this.offset.y - (h / 2) / (this.tileSize * this.zoom)) - 1;
        const endY = Math.ceil(this.offset.y + (h / 2) / (this.tileSize * this.zoom)) + 1;
        for (let x = startX; x <= endX; x++) {
            ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
        }
        for (let y = startY; y <= endY; y++) {
            ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
        }

        ctx.restore();
    }

    _drawBuildingPreview(ctx, footprint) {
        const { x, y, w, h } = footprint;
        ctx.save();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.lineWidth = 0.03;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        const midX = x + w / 2;
        const midY = y + h / 2;
        const arrow = 0.18;
        const tail = 0.08;

        // horizontal arrows
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.lineTo(x - arrow, midY);
        ctx.moveTo(x - arrow + tail, midY - tail);
        ctx.lineTo(x - arrow, midY);
        ctx.lineTo(x - arrow + tail, midY + tail);
        ctx.moveTo(x + w, midY);
        ctx.lineTo(x + w + arrow, midY);
        ctx.moveTo(x + w + arrow - tail, midY - tail);
        ctx.lineTo(x + w + arrow, midY);
        ctx.lineTo(x + w + arrow - tail, midY + tail);
        ctx.stroke();

        // vertical arrows
        ctx.beginPath();
        ctx.moveTo(midX, y);
        ctx.lineTo(midX, y - arrow);
        ctx.moveTo(midX - tail, y - arrow + tail);
        ctx.lineTo(midX, y - arrow);
        ctx.lineTo(midX + tail, y - arrow + tail);
        ctx.moveTo(midX, y + h);
        ctx.lineTo(midX, y + h + arrow);
        ctx.moveTo(midX - tail, y + h + arrow - tail);
        ctx.lineTo(midX, y + h + arrow);
        ctx.lineTo(midX + tail, y + h + arrow - tail);
        ctx.stroke();

        // dimension label
        ctx.fillStyle = 'rgba(7, 20, 40, 0.9)';
        const labelW = Math.max(0.55, Math.min(1.5, Math.max(String(w).length, String(h).length) * 0.22 + 0.25));
        const labelH = 0.42;
        ctx.fillRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);
        ctx.strokeStyle = 'rgba(255, 230, 180, 0.95)';
        ctx.lineWidth = 0.02;
        ctx.strokeRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);
        ctx.fillStyle = '#fff3db';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '0.22px sans-serif';
        ctx.fillText(`${w} x ${h}`, midX, midY);
        ctx.restore();
    }

    _drawRectPreview(ctx, footprint) {
        const { x, y, w, h } = footprint;
        ctx.save();
        ctx.fillStyle = 'rgba(107, 142, 35, 0.15)';
        ctx.strokeStyle = 'rgba(107, 142, 35, 0.95)';
        ctx.lineWidth = 0.03;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        const midX = x + w / 2;
        const midY = y + h / 2;
        const arrow = 0.18;
        const tail = 0.08;

        // horizontal arrows
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.lineTo(x - arrow, midY);
        ctx.moveTo(x - arrow + tail, midY - tail);
        ctx.lineTo(x - arrow, midY);
        ctx.lineTo(x - arrow + tail, midY + tail);
        ctx.moveTo(x + w, midY);
        ctx.lineTo(x + w + arrow, midY);
        ctx.moveTo(x + w + arrow - tail, midY - tail);
        ctx.lineTo(x + w + arrow, midY);
        ctx.lineTo(x + w + arrow - tail, midY + tail);
        ctx.stroke();

        // vertical arrows
        ctx.beginPath();
        ctx.moveTo(midX, y);
        ctx.lineTo(midX, y - arrow);
        ctx.moveTo(midX - tail, y - arrow + tail);
        ctx.lineTo(midX, y - arrow);
        ctx.lineTo(midX + tail, y - arrow + tail);
        ctx.moveTo(midX, y + h);
        ctx.lineTo(midX, y + h + arrow);
        ctx.moveTo(midX - tail, y + h + arrow - tail);
        ctx.lineTo(midX, y + h + arrow);
        ctx.lineTo(midX + tail, y + h + arrow - tail);
        ctx.stroke();

        // dimension label
        ctx.fillStyle = 'rgba(7, 20, 40, 0.9)';
        const labelW = Math.max(0.55, Math.min(1.5, Math.max(String(w).length, String(h).length) * 0.22 + 0.25));
        const labelH = 0.42;
        ctx.fillRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);
        ctx.strokeStyle = 'rgba(155, 215, 135, 0.95)';
        ctx.lineWidth = 0.02;
        ctx.strokeRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);
        ctx.fillStyle = '#d4f1d4';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '0.22px sans-serif';
        ctx.fillText(`${w} x ${h}`, midX, midY);
        ctx.restore();
    }

    _terrainColor(t) {
        switch (t) {
            case 'water': return '#264b7a';
            case 'dirt': return '#8b5a2b';
            case 'farmland': return '#6b8e23';
            case 'road': return '#9a8f7a';
            default: return '#2f7a3f';
        }
    }

    exportJSON() {
        return {
            map: this.map,
        };
    }
}

export default MapEditor;
