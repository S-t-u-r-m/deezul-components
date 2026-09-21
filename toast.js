/*
 * toast.js — short messages that don't interrupt, published as window.DzToast: "Page saved",
 * "Couldn't save the page", "Deleted "Parks" · Undo". The toast_region component shows them.
 *
 *   DzToast.success('Page saved');
 *   DzToast.error({ title: 'Couldn’t save the page', message: 'Check your connection and try again.' });
 *   const closed = await DzToast.show({ message: 'Deleted "Parks"', action: 'Undo' });
 *   if (closed.reason === 'action') restore();
 *   DzToast.info({ id: 'save', message: 'Saving…' });  ...  DzToast.success({ id: 'save', message: 'Saved' });
 *
 * OPTIONS (a message string, or an object):
 *   message    the text
 *   title      a bold line above it (optional)
 *   tone       'info' (default), 'success', 'warning' or 'error'; success(), info(), warning()
 *              and error() set it
 *   action     a button in the toast: 'Undo', or { label: 'Undo' }. Clicking it closes the toast
 *              with reason 'action'
 *   duration   milliseconds on screen; 0 = until closed. Blank: 6 s, 8 s for a warning, and until
 *              closed for an error or a toast with an action — a visitor using a screen reader or
 *              the keyboard must be able to get to them in time
 *   id         a toast with the same id is replaced in place (its timer starts over)
 *
 * Each call returns a promise of { id, reason } for when the toast closes. reason: 'action',
 * 'close' (its × button or Escape), 'timeout', 'replaced', 'cleared' (clear()), or 'code'
 * (dismiss()). The promise also carries the toast's `id` and a `dismiss()` shortcut.
 *
 * WHERE THEY SHOW: the first toast creates a toast_region at the end of <body>, unless a page
 * has placed its own (source 'DzToast'). Call configure({ position, max, hotkey, labels }) before
 * that to set its options; see toast_region. More than `max` at once wait their turn.
 *
 * Kept free of regex and backslash escapes on purpose (see global.js).
 */
const TONES = ['info', 'success', 'warning', 'error'];
const listeners = new Set();
const waiting = new Map();   // id → resolve of the promise show() returned
let toasts = [];             // oldest first
let counter = 0;
let region = null;
let config = { position: 'bottom-right', max: 3, hotkey: 'Alt+T', labels: {} };

const optionsOf = options => (options && typeof options === 'object' ? { ...options } : { message: String(options === undefined || options === null ? '' : options) });
const text = value => (value === undefined || value === null ? '' : String(value)).trim();

// A toast as the region shows it. `fallbackId` names one given without an id.
function normalize(options, fallbackId) {
    const source = optionsOf(options);
    const tone = TONES.includes(source.tone) ? source.tone : 'info';
    const action = source.action && typeof source.action === 'object' ? text(source.action.label) : text(source.action);
    const given = Number(source.duration);
    const explicit = source.duration !== undefined && source.duration !== null && source.duration !== '' && Number.isFinite(given) && given >= 0;
    const duration = explicit ? Math.round(given) : (tone === 'error' || action ? 0 : tone === 'warning' ? 8000 : 6000);
    return { id: text(source.id) || fallbackId, tone, title: text(source.title), message: text(source.message), action, duration };
}

function notify() {
    const copy = DzToast.list();
    listeners.forEach(listener => listener(copy));
}

function settle(id, reason) {
    const resolve = waiting.get(id);
    waiting.delete(id);
    if (resolve) resolve({ id, reason });
}

// The shared region, made once, when a toast arrives and nothing is showing them.
function ensureRegion() {
    if (listeners.size || (region && region.isConnected)) return;
    region = document.createElement('dz-component');
    region.setAttribute('dz-type', 'toast_region');
    region.setAttribute('data-dz-toast', '');
    region._props = JSON.parse(JSON.stringify({ ...config, source: 'DzToast' }));
    document.body.appendChild(region);
}

const DzToast = {
    normalize,

    show(options) {
        const toast = normalize(options, 'toast-' + (counter + 1));
        let resolve;
        const closed = new Promise(done => { resolve = done; });
        closed.id = toast.id;
        closed.dismiss = () => DzToast.dismiss(toast.id);
        if (!toast.title && !toast.message) {
            resolve({ id: toast.id, reason: 'empty' });
            return closed;
        }
        counter += 1;
        toast.key = toast.id + '~' + counter;   // a replaced toast is a new row, with a fresh timer
        const at = toasts.findIndex(entry => entry.id === toast.id);
        if (at >= 0) {
            settle(toast.id, 'replaced');
            toasts = toasts.map((entry, i) => (i === at ? toast : entry));
        } else {
            toasts = [...toasts, toast];
        }
        waiting.set(toast.id, resolve);
        ensureRegion();
        notify();
        return closed;
    },

    info(options) { return DzToast.show({ ...optionsOf(options), tone: 'info' }); },
    success(options) { return DzToast.show({ ...optionsOf(options), tone: 'success' }); },
    warning(options) { return DzToast.show({ ...optionsOf(options), tone: 'warning' }); },
    error(options) { return DzToast.show({ ...optionsOf(options), tone: 'error' }); },

    // Close one toast. Returns false when there was no such toast.
    dismiss(id, reason) {
        const key = text(id);
        if (!toasts.some(entry => entry.id === key)) return false;
        toasts = toasts.filter(entry => entry.id !== key);
        settle(key, reason || 'code');
        notify();
        return true;
    },

    clear() {
        const ids = toasts.map(entry => entry.id);
        toasts = [];
        ids.forEach(id => settle(id, 'cleared'));
        notify();
    },

    // The toasts waiting or on screen, oldest first (copies).
    list() {
        return toasts.map(entry => ({ ...entry }));
    },

    // Call `listener(list)` now and on every change; returns the unsubscribe function.
    subscribe(listener) {
        listeners.add(listener);
        listener(DzToast.list());
        return () => listeners.delete(listener);
    },

    // Options for the region DzToast creates: position, max, hotkey, labels (see toast_region).
    configure(options) {
        const next = options && typeof options === 'object' ? options : {};
        config = { ...config, ...next };
        const proxy = region && region.component && region.component.proxy;
        Object.keys(next).forEach(key => {
            if (proxy) proxy[key] = JSON.parse(JSON.stringify(next[key]));
            else if (region && region._props) region._props[key] = next[key];
        });
    }
};

window.DzToast = DzToast;
export default DzToast;
