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
        // preload images
        const all = Object.values(this.manifest).flat();
        await Promise.all(all.map(p => this._loadImage(p)));
        // expose globally for renderer access
        window.textureManager = this;
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
