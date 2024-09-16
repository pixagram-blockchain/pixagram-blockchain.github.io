import dispatcher from "../dispatcher";

export function trigger_sfx(name, volume = 1, pack = "md") {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "TRIGGER_SFX",
            data: { pack, name, volume}
        });
    }else {

        setTimeout(() => {

            trigger_sfx(name, volume, pack);
        }, 10);
    }
}

export function trigger_qr_open() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "OPEN_QR",
            data: {}
        });
    }else {

        setTimeout(() => {

            trigger_qr_open();
        }, 10);
    }
}

export const trigger_votes = (data = {}) => {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "VOTES",
            data: data
        });
    }else {

        setTimeout(() => {

            trigger_votes(data);
        }, 10);
    }
};

export function trigger_logout() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "LOGOUT",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_sfx();
        }, 10);
    }
}

/**
 * Trigger the login dialog
 * @param {Object} options - Options for the login dialog
 * @param {string} options.requiredKeyType - Force specific key type ('posting'|'active'|'owner'|'memo')
 * @param {string} options.requiredKeyHint - Hint text when specific key is required
 * @param {string} options.defaultUsername - Pre-filled username
 * @param {number} options.defaultSessionTimeout - Default session timeout in minutes
 * @param {number} options.defaultPinTimeout - Default PIN timeout in minutes
 * @param {function} options.onLogin - Callback when login succeeds
 */
export function trigger_login(options = {}) {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "LOGIN",
            data: options
        });
    }else {

        setTimeout(() => {

            trigger_login(options);
        }, 10);
    }
}

/**
 * Trigger the unlock dialog to prompt user for PIN or missing key
 * @param {Object} options - Options for the unlock dialog
 * @param {string} options.username - Account username
 * @param {string} options.requiredKeyType - Required key type ('posting'|'active'|'owner'|'memo')
 * @param {string} options.actionDescription - Description of the action requiring the key
 * @param {boolean} options.keyMissing - If true, forces 'addKey' mode (key not in vault)
 * @param {boolean} options.allowModeSwitch - Allow user to switch between PIN and addKey modes
 * @param {string} options.mode - Initial mode ('pin' | 'addKey')
 * @param {function} options.onUnlock - Callback when PIN unlock succeeds
 * @param {function} options.onKeyAdded - Callback when key is added successfully
 */
export function trigger_unlock(options = {}) {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "UNLOCK",
            data: options
        });
    }else {

        setTimeout(() => {

            trigger_unlock(options);
        }, 10);
    }
}

export function trigger_witnesses() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "WITNESSES",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_witnesses();
        }, 10);
    }
}

export function trigger_ico() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "ICO",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_ico();
        }, 10);
    }
}

export function trigger_wallet() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "WALLET",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_wallet();
        }, 10);
    }
}

export function text_editor(options = {}) {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "TEXT",
            data: options
        });
    }else {

        setTimeout(() => {

            text_editor(options);
        }, 10);
    }
}
export function trigger_account() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "ACCOUNT",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_account();
        }, 10);
    }
}

export function trigger_edit_profile() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "EDIT_PROFILE",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_edit_profile();
        }, 10);
    }
}

/**
 * Open the "Create an account with credits" dialog. Unlike trigger_account
 * (which opens the full sign-up flow for new users), this is invoked from
 * within an existing logged-in session and lets the user spend their own
 * PXA / PXS / PXP credits to gift a fresh on-chain account to someone.
 */
export function trigger_add_account() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "ADD_ACCOUNT",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_add_account();
        }, 10);
    }
}


/**
 * Open the Favorite Manager dialog (FavoriteManagerDialog): the user's
 * bookmarked artworks and blog posts, persisted per-account in LacertaDB.
 * Routed through pages/Index.js — dispatcher case "FAVORITES" → dialog
 * registry entry 'favorites'. Entry points: MenuContent Apps → Bookmarks.
 */
export function trigger_favorites() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "FAVORITES",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_favorites();
        }, 10);
    }
}


/**
 * Show the full-screen post-publish loader overlay (the WebGL logo animation).
 * Dispatched right after a successful broadcast, once the NewPost dialog has
 * closed. The overlay owns its own ~5s animation timeline and refreshes the
 * page when it completes.
 */
export function trigger_publish_loader() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "PUBLISH_LOADER",
            data: { }
        });
    }else {

        setTimeout(() => {

            trigger_publish_loader();
        }, 10);
    }
}

export function trigger_voice(name, volume = 1, pack = "cn") {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "TRIGGER_VOICE",
            data: { pack, name, volume}
        });
    }else {

        setTimeout(() => {

            trigger_voice(name, volume, pack);
        }, 10);
    }
}

export function trigger_music(name, volume = 0.75, pack = "redeclipse") {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "TRIGGER_MUSIC",
            data: { pack, name, volume}
        });
    }else {

        setTimeout(() => {

            trigger_music(name, volume, pack);
        }, 10);
    }
}

export function stop_sound() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "STOP_SOUND",
            data: {}
        });
    }else {

        setTimeout(() => {

            stop_sound();
        }, 10);
    }
}

export function trigger_share(url = "https://pixagram.com/", title = "Pixagram is fantastic.", text = "Check this out!") {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "TRIGGER_SHARE",
            data: {url, title, text}
        });
    }else {

        setTimeout(() => {

            trigger_share(url, title, text);
        }, 10);
    }
}

export function trigger_snackbar(message = "", auto_hide_duration = 3500) {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "SNACKBAR",
            data: { message, auto_hide_duration }
        });
    }else {

        setTimeout(() => {

            trigger_snackbar(message, auto_hide_duration);
        }, 10);
    }
}

export function trigger_login_update() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "LOGIN_UPDATE",
            data: {}
        });
    }else {

        setTimeout(() => {

            trigger_login_update();
        }, 10);
    }
}

export function trigger_settings_update() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "SETTINGS_UPDATE",
            data: {}
        });
    }else {

        setTimeout(() => {

            trigger_settings_update();
        }, 10);
    }
}

export function trigger_loading_update(percent) {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "LOADING_UPDATE",
            data: {percent}
        });
    }else {

        setTimeout(() => {

            trigger_loading_update(percent);
        }, 10);
    }
}

export function trigger_page_render_complete() {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "PAGE_RENDER_COMPLETE",
            data: {}
        });
    }else {

        setTimeout(() => {

            trigger_page_render_complete();
        }, 10);
    }
}

export function trigger_data_viewer(data = {}) {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "DATA_VIEWER",
            data: { data }
        });
    }else {

        setTimeout(() => {

            trigger_data_viewer(data);
        }, 10);
    }
}

export function trigger_canvas_action(name) {

    if(!dispatcher.isDispatching()) {

        dispatcher.dispatch({
            type: "TRIGGER_CANVAS_ACTION",
            data: {
                name: name.toUpperCase()
            }
        });
    }else {

        setTimeout(() => {

            trigger_canvas_action(name);
        }, 10);
    }
}