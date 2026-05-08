export default class TextureManager {
    constructor(manifestPath = 'src/textures.json') {
        this.manifestPath = manifestPath;
        this.manifest = {};
        this.cache = new Map();
    }

    async init() {
        try {
            const res = await fetch(this.manifestPath);
            this.manifest = await res.json();
        } catch (err) {
            console.error('Failed to load textures manifest', err);
            this.manifest = {};
        }
        // preload images with progress events
        const all = Object.values(this.manifest).flat();
        const total = all.length;
        let loaded = 0;
        // expose globally early so event handlers can query images
        window.textureManager = this;
        for (const p of all) {
            await this._loadImage(p);
            loaded++;
            try { window.dispatchEvent(new CustomEvent('texture-progress', { detail: { loaded, total, path: p } })); } catch (e) { }
        }
        // finished
        try { window.dispatchEvent(new CustomEvent('texture-done', { detail: { total } })); } catch (e) { }
    }

    getCategories() {
        return Object.keys(this.manifest || {});
    }

    getVariations(category) {
        return (this.manifest && this.manifest[category]) || [];
    }

    getImage(path) {
        return this.cache.get(path);
    }

    getImageUrl(path) {
        // In our setup path is already a relative URL pointing to asset
        return encodeURI(path);
    }

    async _loadImage(path) {
        if (this.cache.has(path)) return this.cache.get(path);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.cache.set(path, img); resolve(img); };
            img.onerror = () => { console.warn('Failed to load', path); this.cache.set(path, null); resolve(null); };
            img.src = encodeURI(path);
        });
    }
}
