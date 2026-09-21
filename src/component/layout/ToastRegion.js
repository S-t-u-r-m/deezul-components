export default Deezul.Component({
    // ToastRegion — short messages that don't interrupt: "Page saved", "Couldn't save the page",
    // "Deleted "Parks" · Undo". A stack in a corner of the screen; each toast closes itself after
    // a few seconds or stays until closed, and can carry one action button.
    //
    // Two ways to use it:
    //
    //   From code (toast.js, window.DzToast) — no markup; the first toast creates the region:
    //     DzToast.success('Page saved');
    //     const closed = await DzToast.show({ message: 'Deleted "Parks"', action: 'Undo' });
    //     if (closed.reason === 'action') restore();
    //   A page can place the region itself instead (source 'DzToast'), to choose where it goes.
    //
    //   As a block showing a page's own list (source 'items'): the page adds toasts to `items`
    //   and removes them on `close`.
    //
    // A TOAST: { id, message, title, tone: 'info' | 'success' | 'warning' | 'error', action: 'Undo'
    // or { label }, duration: ms (0 = until closed; blank = 6 s, 8 s for a warning, until closed for
    // an error or a toast with an action) }. See toast.js.
    //
    // ACCESSIBILITY:
    //   · each toast is read out as it appears, without moving focus: errors at once (role alert),
    //     the rest when the screen reader is free (role status). Errors and warnings are said with
    //     "Error:" and "Warning:", and shown with their own icon shape, not color alone;
    //   · a toast with an action adds "Press Alt+T to reach it." Alt+T (`hotkey`) moves focus to
    //     the newest toast; Escape closes the toast with focus, and focus goes to the next toast or
    //     back where it was;
    //   · timers stop while the pointer is over the stack, while focus is in it, and while the
    //     tab is in the background; errors and toasts with an action wait to be closed;
    //   · the stack is a region named "Notifications", so it can be found by landmark;
    //   · buttons are at least 36px, the close button named "Dismiss: <message>".
    //
    // OPTIONS:
    //   source     'DzToast' (default: the toasts from toast.js) or 'items' (the page's `items`)
    //   items      source 'items': the toasts to show, oldest first
    //   position   'bottom-right' (default), 'bottom-left', 'bottom-center', 'top-right',
    //              'top-center', or 'inline' (in the page's flow, where the block is placed)
    //   max        most toasts on screen at once (default 3); the rest wait their turn
    //   hotkey     key that moves focus to the toasts, 'Alt+T' (default); blank = none
    //   label      the region's name (default 'Notifications')
    //   labels     text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   action   { id }           its action button was used (a close with reason 'action' follows)
    //   close    { id, reason }   reason: 'action', 'close' (× or Escape) or 'timeout'. With
    //                             source 'items', the page removes the toast here.
    //
    // NEEDS: window.DzGlobal (global.js), window.DzToast (toast.js), both imported by main.js, and
    // the --dz-icon-check-circle, -info, -warning, -error and -close custom properties (assets/icons.css).
    schema: {
        inputs: {
            source:   { type: 'enum', options: ['DzToast', 'items'], default: 'DzToast', label: 'Toasts from' },
            items:    { type: 'array', default: [], label: 'Toasts (source items): { id, message, title, tone, action, duration }' },
            position: { type: 'enum', options: ['bottom-right', 'bottom-left', 'bottom-center', 'top-right', 'top-center', 'inline'], default: 'bottom-right', label: 'Position' },
            max:      { type: 'number', default: 3, label: 'Most on screen at once' },
            hotkey:   { type: 'string', default: 'Alt+T', label: 'Key to reach the toasts (blank = none)' },
            label:    { type: 'string', default: 'Notifications', label: 'Name (screen readers)' },
            labels:   { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. The two announcers are filled by hand (announce()),
    // outside reactive data, so each message is a new node a screen reader reads once.
    template: html`
    <div class="tr" ref="root" :class="rootClass">
        <div class="tr-sr tr-polite" role="status" aria-atomic="false"></div>
        <div class="tr-sr tr-assertive" role="alert" aria-atomic="false"></div>
        <section class="tr-stack" :if="shown.length" :aria-label="label || ui.region"
                 @mouseenter="hold('pointer', true)" @mouseleave="hold('pointer', false)"
                 @focusin="onFocusIn($event)" @focusout="onFocusOut($event)" @keydown="onKey($event)">
            <ul class="tr-list">
                <li class="tr-toast" :for="toast in shown" :key="toast.key" :class="'is-' + toast.tone" :data-toast-id="toast.id">
                    <span class="tr-icon" aria-hidden="true"></span>
                    <div class="tr-text">
                        <p class="tr-title" :if="toast.title"><span class="tr-sr">{{ toast.prefix }}</span>{{ toast.title }}</p>
                        <p class="tr-message" :if="toast.message"><span class="tr-sr" :if="!toast.title">{{ toast.prefix }}</span>{{ toast.message }}</p>
                    </div>
                    <div class="tr-buttons">
                        <button type="button" class="tr-action" :if="toast.action" @click="act(toast.id)">{{ toast.action }}</button>
                        <button type="button" class="tr-close" :aria-label="toast.closeName" :title="ui.close" @click="close(toast.id, 'close')">
                            <span class="tr-x" aria-hidden="true"></span>
                        </button>
                    </div>
                </li>
            </ul>
        </section>
    </div>
    `,

    data: () => ({
        source: 'DzToast', items: [], position: 'bottom-right', max: 3, hotkey: 'Alt+T', label: 'Notifications', labels: {},
        list: []
    }),

    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        // Timers, holds and what has been read out live on the element, outside reactive data.
        const state = root._tr = {
            timers: new Map(), holds: { pointer: false, focus: false, hidden: !!document.hidden },
            seen: new Set(), readyAt: Date.now() + 150, returnTo: null
        };
        // A page's own items already there are not read out; toasts from DzToast are (the first
        // one is why the region was made).
        if (this.source === 'items') this.all.forEach(toast => state.seen.add(toast.key));
        state.onVisibility = () => this.hold('hidden', !!document.hidden);
        state.onHotkey = event => this.onHotkey(event);
        document.addEventListener('visibilitychange', state.onVisibility);
        document.addEventListener('keydown', state.onHotkey);
        if (this.source === 'DzToast' && window.DzToast) {
            state.unsubscribe = window.DzToast.subscribe(list => { this.list = list; });
        }
        this.sync();
    },

    $updated() {
        this.sync();
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        const state = root && root._tr;
        if (!state) return;
        state.timers.forEach(timer => clearTimeout(timer.handle));
        state.timers.clear();
        document.removeEventListener('visibilitychange', state.onVisibility);
        document.removeEventListener('keydown', state.onHotkey);
        if (state.unsubscribe) state.unsubscribe();
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                region: 'Notifications',
                close: 'Dismiss',
                closeNamed: 'Dismiss: {text}',
                info: '',
                success: '',
                warning: 'Warning: ',
                error: 'Error: ',
                hotkeyHint: 'Press {hotkey} to reach it.'
            }, this.labels);
        },

        rootClass() {
            const known = ['bottom-right', 'bottom-left', 'bottom-center', 'top-right', 'top-center', 'inline'];
            const position = known.includes(this.position) ? this.position : 'bottom-right';
            return 'is-' + position + (position === 'inline' ? '' : ' is-fixed');
        },

        hotkeyText() {
            return DzGlobal.text(this.hotkey).trim();
        },

        // Every toast, waiting or shown, oldest first.
        all() {
            if (this.source !== 'items') return Array.isArray(this.list) ? this.list : [];
            const toast = window.DzToast;
            const items = Array.isArray(this.items) ? this.items : [];
            return items
                .map((item, index) => {
                    if (!toast || !item || typeof item !== 'object') return null;
                    const entry = toast.normalize(DzGlobal.raw(item), 'item-' + index);
                    return { ...entry, key: entry.id };
                })
                .filter(entry => entry && (entry.title || entry.message));
        },

        // The ones on screen, with what each shows and says.
        shown() {
            const count = Math.max(1, Math.floor(Number(this.max)) || 3);
            const ui = this.ui;
            return this.all.slice(0, count).map(toast => ({
                ...toast,
                prefix: ui[toast.tone] || '',
                closeName: DzGlobal.format(ui.closeNamed, { text: toast.title || toast.message })
            }));
        }
    },

    methods: {
        state() {
            const root = DzGlobal.raw(this.$refs.root);
            return root && root._tr;
        },

        // After every change: start timers for toasts that came on screen, drop the timers of
        // those gone, read out the new ones, and re-check the holds (a removed toast fires no
        // mouseleave or focusout).
        sync() {
            const root = DzGlobal.raw(this.$refs.root);
            const state = root && root._tr;
            if (!state) return;
            const shown = this.shown;
            const keys = new Set(shown.map(toast => toast.key));
            state.timers.forEach((timer, key) => {
                if (keys.has(key)) return;
                clearTimeout(timer.handle);
                state.timers.delete(key);
            });
            this.readHolds(root);
            shown.forEach(toast => {
                if (!state.seen.has(toast.key)) {
                    state.seen.add(toast.key);
                    this.announce(state, toast);
                }
                if (toast.duration > 0 && !state.timers.has(toast.key)) {
                    state.timers.set(toast.key, { id: toast.id, left: toast.duration, start: 0, handle: null });
                }
            });
            this.runTimers(state);
        },

        paused(state) {
            return state.holds.pointer || state.holds.focus || state.holds.hidden;
        },

        // The pointer and focus holds, read from the page rather than from events.
        readHolds(root) {
            const state = root._tr;
            const stack = root.querySelector('.tr-stack');
            state.holds.pointer = !!(stack && stack.matches(':hover'));
            state.holds.focus = !!(stack && stack.contains(root.getRootNode().activeElement));
            state.holds.hidden = !!document.hidden;
        },

        runTimers(state) {
            if (this.paused(state)) return;
            state.timers.forEach((timer, key) => {
                if (timer.handle) return;
                timer.start = Date.now();
                timer.handle = setTimeout(() => {
                    timer.handle = null;
                    // A last look before closing, in case a hold's event never came: still in use,
                    // it waits (the hold ending restarts it).
                    const root = DzGlobal.raw(this.$refs.root);
                    if (root) this.readHolds(root);
                    if (this.paused(state)) {
                        timer.left = 2000;
                        return;
                    }
                    state.timers.delete(key);
                    this.close(timer.id, 'timeout');
                }, timer.left);
            });
        },

        // Stop or restart every timer. After a pause each keeps what it had left, and at least
        // two seconds, so a toast doesn't vanish the moment the pointer leaves it.
        hold(kind, on) {
            const state = this.state();
            if (!state) return;
            const was = this.paused(state);
            state.holds[kind] = on;
            const now = this.paused(state);
            if (now && !was) {
                state.timers.forEach(timer => {
                    if (!timer.handle) return;
                    clearTimeout(timer.handle);
                    timer.handle = null;
                    timer.left = Math.max(2000, timer.left - (Date.now() - timer.start));
                });
            } else if (!now) {
                this.runTimers(state);
            }
        },

        // Read a toast out once. Each message is a new node in the live region, removed later, so
        // two toasts in a row are both heard. A region only just created holds them for a moment,
        // in order: screen readers skip changes to a live region they haven't registered yet.
        announce(state, toast) {
            const root = DzGlobal.raw(this.$refs.root);
            const box = root && root.querySelector(toast.tone === 'error' ? '.tr-assertive' : '.tr-polite');
            if (!box) return;
            const ui = this.ui;
            const parts = [(ui[toast.tone] || '') + [toast.title, toast.message].filter(Boolean).join('. ')];
            if (toast.action && this.hotkeyText) parts.push(DzGlobal.format(ui.hotkeyHint, { hotkey: this.hotkeyText }));
            state.queue = state.queue || [];
            state.queue.push({ box, text: parts.join(' ') });
            if (state.flushing) return;
            const flush = () => {
                state.flushing = null;
                state.queue.splice(0).forEach(entry => {
                    const line = document.createElement('p');
                    line.textContent = entry.text;
                    entry.box.appendChild(line);
                    setTimeout(() => line.remove(), 10000);
                });
            };
            const wait = state.readyAt - Date.now();
            if (wait > 0) state.flushing = setTimeout(flush, wait);
            else flush();
        },

        act(id) {
            this.$emit('action', { id });
            this.close(id, 'action');
        },

        // Close a toast. When focus was in it, move focus to the toast now in its place, or back
        // where it was before it came into the stack.
        async close(id, reason) {
            const root = DzGlobal.raw(this.$refs.root);
            if (!root) return;
            const shadow = root.getRootNode();
            const rows = [...root.querySelectorAll('.tr-toast')];
            const at = rows.findIndex(row => row.getAttribute('data-toast-id') === id);
            const hadFocus = at >= 0 && rows[at].contains(shadow.activeElement);
            if (this.source === 'DzToast' && window.DzToast) window.DzToast.dismiss(id, reason);
            this.$emit('close', { id, reason });
            if (!hadFocus) return;
            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            const rest = [...root.querySelectorAll('.tr-toast')].filter(row => row.getAttribute('data-toast-id') !== id);
            const next = rest[Math.min(at, rest.length - 1)];
            const button = next && next.querySelector('button');
            const state = root._tr;
            if (button) {
                button.focus();
            } else if (state && state.returnTo && state.returnTo.isConnected && typeof state.returnTo.focus === 'function') {
                state.returnTo.focus();
                state.returnTo = null;
            }
        },

        // Remember where focus came from, to go back there when the toasts are done with.
        onFocusIn(event) {
            const state = this.state();
            if (!state) return;
            const stack = event.currentTarget;
            const from = event.relatedTarget;
            if (from && !stack.contains(from) && !state.returnTo) state.returnTo = from;
            this.hold('focus', true);
        },

        onFocusOut(event) {
            const stack = event.currentTarget;
            if (event.relatedTarget && stack.contains(event.relatedTarget)) return;
            const state = this.state();
            if (state && event.relatedTarget) state.returnTo = null;
            this.hold('focus', false);
        },

        onKey(event) {
            if (event.key !== 'Escape') return;
            const row = event.target && event.target.closest ? event.target.closest('.tr-toast') : null;
            if (!row) return;
            event.preventDefault();
            this.close(row.getAttribute('data-toast-id'), 'close');
        },

        // The element that really has focus, looking inside shadow roots.
        focusedElement() {
            let el = document.activeElement;
            while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
            return el;
        },

        // 'Alt+T', 'Ctrl+Shift+N', 'F8': letters and digits match by physical key (Option+T on a
        // Mac types a symbol), other keys by name.
        matchesHotkey(event) {
            const parts = this.hotkeyText.toLowerCase().split('+').map(part => part.trim()).filter(Boolean);
            if (!parts.length) return false;
            const key = parts[parts.length - 1];
            const mods = parts.slice(0, -1);
            const wants = name => mods.includes(name);
            if (event.altKey !== wants('alt') || event.ctrlKey !== (wants('ctrl') || wants('control'))
                || event.shiftKey !== wants('shift') || event.metaKey !== (wants('meta') || wants('cmd'))) return false;
            if (key.length === 1 && key >= 'a' && key <= 'z') return event.code === 'Key' + key.toUpperCase();
            if (key.length === 1 && key >= '0' && key <= '9') return event.code === 'Digit' + key;
            return DzGlobal.text(event.key).toLowerCase() === key;
        },

        // The hotkey: focus the newest toast's first button.
        onHotkey(event) {
            if (!this.hotkeyText || !this.shown.length || !this.matchesHotkey(event)) return;
            const root = DzGlobal.raw(this.$refs.root);
            const rows = root ? [...root.querySelectorAll('.tr-toast')] : [];
            const button = rows.length ? rows[rows.length - 1].querySelector('button') : null;
            if (!button) return;
            event.preventDefault();
            const state = root._tr;
            const current = this.focusedElement();
            if (state && current && !root.contains(current)) state.returnTo = current;
            button.focus();
        }
    },

    styles: /*css*/ `
        :host { display: contents; }

        .tr { font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }

        .tr-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
                 clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

        /* ---- The stack: fixed in a corner above the page, clicks passing through the gaps. */
        .tr.is-fixed .tr-stack { position: fixed; z-index: 2147483000; box-sizing: border-box; width: min(24rem, calc(100vw - 2rem));
                                 pointer-events: none; }
        .is-bottom-right .tr-stack { right: 1rem; bottom: 1rem; }
        .is-bottom-left .tr-stack { left: 1rem; bottom: 1rem; }
        .is-bottom-center .tr-stack { left: 50%; bottom: 1rem; transform: translateX(-50%); }
        .is-top-right .tr-stack { right: 1rem; top: 1rem; }
        .is-top-center .tr-stack { left: 50%; top: 1rem; transform: translateX(-50%); }
        .is-inline .tr-stack { max-width: 24rem; }

        .tr-list { display: flex; flex-direction: column; gap: .6rem; margin: 0; padding: 0; list-style: none; }

        /* ---- A toast: a white card; the tone shows in its icon, whose shape differs by tone too.
           The tone colors are 5.7:1 and up against white. */
        .tr-toast { --tone: #3b3ec2; box-sizing: border-box; display: flex; align-items: flex-start; gap: .7rem;
                    padding: .8rem .55rem .8rem .9rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 14px;
                    background: var(--dz-color-surface, #fff); pointer-events: auto; overflow-wrap: anywhere;
                    box-shadow: 0 2px 6px rgba(15, 18, 28, .08), 0 14px 32px -12px rgba(15, 18, 28, .35); }
        .tr-toast.is-success { --tone: #146c3a; }
        .tr-toast.is-warning { --tone: #8a4600; }
        .tr-toast.is-error { --tone: #b42318; }

        .tr-icon { flex: none; width: 1.35rem; height: 1.35rem; margin-top: .05rem; background: var(--tone);
                   -webkit-mask: var(--dz-icon-info) center / contain no-repeat; mask: var(--dz-icon-info) center / contain no-repeat; }
        .is-success .tr-icon { -webkit-mask-image: var(--dz-icon-check-circle); mask-image: var(--dz-icon-check-circle); }
        .is-warning .tr-icon { -webkit-mask-image: var(--dz-icon-warning); mask-image: var(--dz-icon-warning); }
        .is-error .tr-icon { -webkit-mask-image: var(--dz-icon-error); mask-image: var(--dz-icon-error); }

        .tr-text { flex: 1; min-width: 0; padding-top: .05rem; font-size: .9375rem; line-height: 1.45; }
        .tr-title { margin: 0; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .tr-message { margin: 0; color: #3a3f4c; }
        .tr-title + .tr-message { margin-top: .15rem; color: #454a57; }

        /* ---- Buttons: the action as a tinted pill in the tone's color, the close button round. */
        .tr-buttons { display: flex; flex: none; align-items: center; gap: .25rem; margin: -.3rem 0 -.3rem auto; }
        .tr-action { min-height: 2.25rem; padding: 0 .85rem; border: 1px solid transparent; border-radius: 999px;
                     background: var(--dz-color-bg, #f3f4f8); font: inherit; font-size: .875rem; font-weight: 700;
                     color: #3b3ec2; cursor: pointer; transition: background-color .15s ease; }
        .tr-action:hover { background: #e6e7fb; }
        .tr-close { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem;
                    padding: 0; border: 0; border-radius: 999px; background: none; color: #555b69; cursor: pointer;
                    transition: background-color .15s ease, color .15s ease; }
        .tr-close:hover { background: var(--dz-color-bg, #f3f4f8); color: var(--dz-color-heading, #1f2330); }
        .tr-action:focus-visible, .tr-close:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px; }
        .tr-x { display: block; width: 1.1rem; height: 1.1rem; background: currentColor;
                -webkit-mask: var(--dz-icon-close) center / contain no-repeat; mask: var(--dz-icon-close) center / contain no-repeat; }

        @media (prefers-reduced-motion: no-preference) {
            .tr-toast { animation: tr-in .24s cubic-bezier(.2, .8, .2, 1); }
            .is-top-right .tr-toast, .is-top-center .tr-toast { animation-name: tr-down; }
        }
        @keyframes tr-in { from { opacity: 0; transform: translateY(10px) scale(.98); } }
        @keyframes tr-down { from { opacity: 0; transform: translateY(-10px) scale(.98); } }

        /* ---- Phones: full width, along the bottom (or top) edge. */
        @media (max-width: 640px) {
            .tr.is-fixed .tr-stack { left: .75rem; right: .75rem; width: auto; transform: none; }
            .is-bottom-right .tr-stack, .is-bottom-left .tr-stack, .is-bottom-center .tr-stack { bottom: .75rem; }
            .is-top-right .tr-stack, .is-top-center .tr-stack { top: .75rem; }
        }
    `
});
