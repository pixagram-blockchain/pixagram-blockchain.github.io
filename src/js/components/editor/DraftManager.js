// NOTE: no static import of LacertaDB here — it is imported lazily inside
// _doInit() so the database layer stays out of the main bundle until needed.

// Simplified DraftManager
class DraftManager {
    constructor() {
        this.db = null;
        this.collection = null;
        this._initPromise = null;
        // Ids known to exist in the collection. Lets save() skip the
        // per-call existence get() once an id has been confirmed — the
        // autosave path (one save every 2 s of typing) was paying a
        // read + write round-trip pair on every tick.
        this._knownIds = new Set();
    }

    init() {
        // Memoize the promise (not the result): getMostRecent() on mount and
        // an early autosave can call init() concurrently — they must share
        // one initialization instead of opening the database twice.
        if (!this._initPromise) {
            this._initPromise = this._doInit();
        }
        return this._initPromise;
    }

    async _doInit() {
        try {
            const { LacertaDB } = await import('@pixagram/lacerta-db/index.js');
            const lacerta = new LacertaDB();
            this.db = await lacerta.getDatabase('drafts');
            this.collection = await this.db.createCollection('documents');
            return true;
        } catch (error) {
            console.error('DraftManager init failed:', error);
            this._initPromise = null; // allow a retry on the next call
            return false;
        }
    }

    async save(id, data) {
        await this.init();
        const doc = { ...data, lastModified: Date.now() };

        try {
            // Existence check hits the cache first; the get() only runs the
            // FIRST time an id is saved in this session, instead of on
            // every autosave.
            if (id && (this._knownIds.has(id) || await this.collection.get(id))) {
                const result = await this.collection.update(id, doc);
                if (result) this._knownIds.add(id);
                return result;
            }
            const created = await this.collection.add(doc);
            // add() resolves to the new id (callers store it as
            // currentDraftId and later get() with it) — remember it so the
            // very next autosave already skips the existence read.
            if (created) this._knownIds.add(created);
            return created;
        } catch (error) {
            console.error('Save failed:', error);
            return null;
        }
    }

    async getMostRecent() {
        await this.init();
        try {
            const drafts = await this.collection.query({}, {
                sort: { lastModified: -1 },
                limit: 1
            });
            const recent = drafts?.[0] || null;
            // Mount path: the editor restores this draft and keeps autosaving
            // into it — seed the cache so even the FIRST autosave of the
            // session skips the existence read.
            if (recent && recent._id != null) this._knownIds.add(recent._id);
            return recent;
        } catch (error) {
            console.error('Get recent failed:', error);
            return null;
        }
    }

    async get(id) {
        await this.init();
        try {
            const doc = await this.collection.get(id);
            if (doc) this._knownIds.add(id);
            return doc;
        } catch (error) {
            return null;
        }
    }

    async getAll() {
        await this.init();
        try {
            const drafts = await this.collection.query({}, {
                sort: { lastModified: -1 },
                limit: 50
            }) || [];
            // Every listed draft demonstrably exists — seed the cache so
            // "open drafts dialog → load draft → keep typing" autosaves
            // never pay the existence read.
            for (const d of drafts) {
                if (d && d._id != null) this._knownIds.add(d._id);
            }
            return drafts;
        } catch (error) {
            return [];
        }
    }

    async delete(id) {
        await this.init();
        try {
            await this.collection.delete(id);
            this._knownIds.delete(id);
            return true;
        } catch (error) {
            return false;
        }
    }
}

export default DraftManager;
