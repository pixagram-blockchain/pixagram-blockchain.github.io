"use strict";

import { getProfiles } from "../../utils/api/account-cache";

// ── AccountImageStore — on-demand avatar hydration for account lists ─────
//
// The account lists (voters, followers / following, community members) show
// one avatar per row, and the avatar is the only thing a row needs from the
// account object. How each list used to get it:
//
//   · VotingListModal fetched EVERY voter's account up front, in one raw
//     api.accounts.getAccounts() call per open — a post with 1 200 votes
//     downloaded 1 200 full account objects to paint ~10 rows.
//   · FollowListModal / MembersListDialog hydrated every streamed page —
//     MembersListDialog streams up to 2 000 members, so 20 batches of 100
//     accounts went out while the user looked at the first screen.
//
// This store hydrates what is ON SCREEN instead. A list tells it which names
// its rendered window (plus a look-ahead block) covers; the store
//
//   · skips names it already resolved, has in flight, or saw fail;
//   · settles first — requests are trailing-debounced (FLUSH_MS), and each
//     caller's request REPLACES its previous one, so a fling across 2 000
//     rows hydrates where it stops, not every row it flew past;
//   · fetches the union through account-cache's getProfiles(): micro-batched
//     with every other view's requests, chunked, deduped in flight;
//   · keeps only the avatar URL per name (a short string, not the account),
//     "" for "resolved, no avatar" so it is never asked for again;
//   · notifies subscribers once per landed batch that brought a new image.
//
// Framework-agnostic on purpose: a class dialog creates one in its
// constructor and disposes it on close; <AccountList> creates its own when
// none is passed. Several lists may share one (both tabs of a dialog), each
// under its own request slot.
//
// Lifetime = the dialog's. Nothing is kept app-wide, in line with
// account-cache's no-stale-reads policy — and a closed dialog frees it all.

const FLUSH_MS = 80;
const norm = (name) => String(name || "").trim().toLowerCase();

export class AccountImageStore {
    /**
     * @param {object} api   the PixaProxyAPI instance (account-cache keys on it)
     * @param {object} [seed] { name: imageUrl } already known (e.g. voter
     *                        profiles pre-fetched by the page); falsy URLs are
     *                        ignored, so those names still get hydrated.
     */
    constructor(api, seed) {
        this.api = api || null;
        this._images = new Map();     // name → url ("" = no avatar)
        this._pending = new Set();    // in flight
        this._failed = new Set();     // transport error — not retried by this store
        this._wanted = new Map();     // slot → names[] (latest request per caller)
        this._listeners = new Set();
        this._timer = 0;
        this._gen = 0;                // bumped by dispose(): late answers are dropped
        this.version = 0;             // bumps whenever an image lands
        if (seed) this.seed(seed);
    }

    /** Merge { name: url } entries; only truthy URLs count as known. */
    seed(map) {
        if (!map || typeof map !== "object") return;
        let changed = false;
        for (const name in map) {
            const url = map[name];
            if (!url || typeof url !== "string") continue;
            const k = norm(name);
            if (k && this._images.get(k) !== url) { this._images.set(k, url); changed = true; }
        }
        if (changed) this._notify();
    }

    /** Avatar URL for `name`, or "" (unknown yet, or none). Never fetches. */
    get(name) {
        return this._images.get(norm(name)) || "";
    }

    /**
     * Ask for the avatars of `names` (what one list currently shows). Replaces
     * this slot's previous request; fetched after FLUSH_MS of quiet.
     */
    request(names, slot = "default") {
        if (!this.api || this._gen < 0) return;
        const list = [];
        for (const n of names || []) {
            const k = norm(n);
            if (!k || this._images.has(k) || this._pending.has(k) || this._failed.has(k)) continue;
            list.push(k);
        }
        if (list.length === 0) {
            this._wanted.delete(slot);
            return;
        }
        this._wanted.set(slot, list);
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(this._flush, FLUSH_MS);
    }

    _flush = () => {
        this._timer = 0;
        if (!this.api || this._wanted.size === 0) return;
        const names = new Set();
        for (const list of this._wanted.values()) {
            for (const k of list) {
                if (!this._images.has(k) && !this._pending.has(k) && !this._failed.has(k)) names.add(k);
            }
        }
        this._wanted.clear();
        if (names.size === 0) return;

        const batch = Array.from(names);
        for (const k of batch) this._pending.add(k);
        const gen = this._gen;
        getProfiles(this.api, batch).then((profiles) => {
            if (gen !== this._gen) return;
            let landed = false;
            for (const k of batch) {
                this._pending.delete(k);
                const p = profiles && profiles.get(k);
                const url = (p && p.image) || "";
                this._images.set(k, url);
                if (url) landed = true;
            }
            if (landed) this._notify();
        }, () => {
            if (gen !== this._gen) return;
            for (const k of batch) { this._pending.delete(k); this._failed.add(k); }
        });
    };

    _notify() {
        this.version++;
        for (const fn of Array.from(this._listeners)) {
            try { fn(this.version); } catch (e) { /* a listener's problem stays its own */ }
        }
    }

    /** fn(version) after each batch that brought an image. Returns unsubscribe. */
    subscribe(fn) {
        if (typeof fn !== "function") return () => {};
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    /**
     * Stop: pending answers are dropped, nothing is requested any more. The
     * URLs already resolved stay readable, so a closing dialog's rows keep
     * their avatars through its exit transition; the store goes with its
     * owner's last reference.
     */
    dispose() {
        this._gen = -1;
        if (this._timer) clearTimeout(this._timer);
        this._timer = 0;
        this._wanted.clear();
        this._pending.clear();
        this._listeners.clear();
    }
}

export const accountKey = norm;

export default AccountImageStore;
