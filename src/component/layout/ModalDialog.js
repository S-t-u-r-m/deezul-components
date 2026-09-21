export default Deezul.Component({
    // ModalDialog — a generic modal dialog: a title, then whatever is put in its slots. Built on
    // the native <dialog> element: showModal() puts it in the top layer and makes everything
    // behind it inert — focus moves inside, Tab can't leave it, screen readers can't wander
    // behind it, and Esc closes it.
    //
    // CONTENT goes in slots, like any container block:
    //   default   the body — text, a form, components; it scrolls when taller than the screen
    //   footer    buttons or anything else, pinned under the body (the bar hides when empty)
    //
    //   <dz-component dz-type="modal_dialog" :triggerLabel="'Delete'" :title="'Delete this listing?'">
    //       <p>This cannot be undone.</p>
    //       <dz-component slot="footer" dz-type="dz-button" data-modal-close="cancel" ...></dz-component>
    //       <dz-component slot="footer" dz-type="dz-button" data-modal-close="delete" ...></dz-component>
    //   </dz-component>
    //
    // Components can also be listed as data, `items` [{ type: dz-type, props, slot }], and created
    // by the module handler (slot blank = the body).
    //
    // CLOSING FROM THE CONTENT: clicking anything inside that carries a `data-modal-close`
    // attribute closes the dialog, and the attribute's value comes back in the close event — so
    // footer buttons need no wiring: data-modal-close="delete" → close { reason: 'action', value: 'delete' }.
    //
    // FIRST FOCUS: opening moves focus to the first thing inside that can take it (the close
    // button when shown). Content can pick its own: the first element inside carrying
    // data-modal-focus (any value but "false") gets focus instead — a text field, or Cancel on a
    // destructive confirmation.
    //
    // OPENING: either its own trigger button (`triggerLabel`), or the page, through `open`. When
    // the visitor closes it, it closes itself and emits `close`, so the page can set `open` back.
    //
    // OPTIONS:
    //   triggerLabel     text of the button that opens it (blank = no button; the page uses `open`)
    //   open             open state, for a page controlling it (default false)
    //   title            the heading, and the dialog's accessible name
    //   label            the accessible name when there is no title
    //   description      a sentence under the title, read out with the name when the dialog opens
    //                    (aria-describedby); for a question such as "Delete this listing?"
    //   role             'dialog' (default) or 'alertdialog', for a dialog that interrupts to ask
    //                    or warn (prompt_dialog uses it)
    //   items            components by dz-type, see CONTENT
    //   size             'small', 'medium' (default), 'large' or 'full'
    //   showClose        the round × button (default true)
    //   closeOnBackdrop  a click outside the dialog closes it (default true)
    //   headingLevel     level of the title (default 2)
    //   labels           text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   open    { reason: 'trigger' | 'host' }
    //   close   { reason: 'close-button' | 'escape' | 'backdrop' | 'action' | 'host', value }
    //           (value: the data-modal-close value for 'action', else '')
    //
    // While open, the page behind doesn't scroll; closing returns focus to whatever had it before.
    // It fades and scales in and out (none for visitors who prefer reduced motion), over a
    // blurred backdrop; on narrow screens it rises from the bottom as a sheet.
    //
    // NEEDS: window.DzGlobal (global.js, imported by main.js) and the --dz-icon-close custom
    // property (assets/icons.css).
    schema: {
        inputs: {
            triggerLabel:    { type: 'string', default: '', label: 'Button text (blank = opened by the page)' },
            open:            { type: 'boolean', default: false, label: 'Open' },
            title:           { type: 'string', default: '', label: 'Title' },
            label:           { type: 'string', default: '', label: 'Name for screen readers (when there is no title)' },
            description:     { type: 'string', default: '', label: 'Description (read out on opening)' },
            role:            { type: 'enum', options: ['dialog', 'alertdialog'], default: 'dialog', label: 'Role' },
            items:           { type: 'array', default: [], label: 'Components ({ type: dz-type, props, slot })' },
            size:            { type: 'enum', options: ['small', 'medium', 'large', 'full'], default: 'medium', label: 'Size' },
            showClose:       { type: 'boolean', default: true, label: 'Show close button' },
            closeOnBackdrop: { type: 'boolean', default: true, label: 'Close when clicking outside' },
            headingLevel:    { type: 'number', default: 2, label: 'Title heading level' },
            labels:          { type: 'object', default: {}, label: 'Text overrides' }
        },
        slots: {
            default: { label: 'Content', allow: ['*'] },
            footer:  { label: 'Footer (buttons)', allow: ['*'] }
        }
    },

    // `ref` only on the outermost element; the <dialog> and slots are found from it. The footer
    // is always rendered (so its slot exists to receive content) and hidden while empty. The name
    // is bound as aria-label: a conditional aria-labelledby would render "null".
    template: html`
    <div class="md" ref="root">
        <button type="button" class="md-trigger" :if="triggerLabel" @click="show('trigger')">{{ triggerLabel }}</button>
        <dialog class="md-dialog" :class="'is-' + sizeName" :aria-label="dialogName" :role="roleName" :aria-describedby="description ? 'md-desc' : ''"
                @mousedown="onBackdropDown($event)" @click="onDialogClick($event)">
            <div class="md-panel">
                <div class="md-head" :class="title ? '' : 'is-bare'" :if="title || showClose">
                    <p class="md-title" :if="title" role="heading" :aria-level="level">{{ title }}</p>
                    <button type="button" class="md-close" :if="showClose" :aria-label="ui.close" :title="ui.close"
                            @click="hide('close-button')">
                        <span class="md-icon" aria-hidden="true"></span>
                    </button>
                </div>
                <div class="md-body">
                    <p class="md-desc" id="md-desc" :if="description">{{ description }}</p>
                    <slot></slot>
                </div>
                <div class="md-foot" :class="hasFooter ? '' : 'is-empty'">
                    <slot name="footer"></slot>
                </div>
            </div>
        </dialog>
    </div>
    `,

    data: () => ({
        triggerLabel: '', open: false, title: '', label: '', description: '', role: 'dialog', items: [], size: 'medium',
        showClose: true, closeOnBackdrop: true, headingLevel: 2, labels: {},
        isOpen: false, hasFooter: false
    }),

    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        const dialog = root.querySelector('dialog');
        const footer = root.querySelector('slot[name="footer"]');
        const state = root._md = { dialog, footer, reason: '', value: '', openProp: !!this.open, itemsSignature: '' };
        // Esc: the browser closes the dialog; note why first.
        state.onCancel = () => { state.reason = state.reason || 'escape'; };
        // Every way of closing ends here, so state, scrolling and focus are restored once.
        state.onClose = () => this.afterClose();
        state.onFooterChange = () => { this.hasFooter = footer.assignedNodes({ flatten: true }).length > 0; };
        dialog.addEventListener('cancel', state.onCancel);
        dialog.addEventListener('close', state.onClose);
        if (footer) footer.addEventListener('slotchange', state.onFooterChange);
        this.syncItems(root);
        if (footer) state.onFooterChange();
        if (this.open) this.show('host');
    },

    // A page toggling `open` opens or closes the dialog; new `items` are recreated.
    $updated() {
        const root = DzGlobal.raw(this.$refs.root);
        const state = root && root._md;
        if (!state) return;
        this.syncItems(root);
        const wanted = !!this.open;
        if (wanted === state.openProp) return;
        state.openProp = wanted;
        if (wanted) this.show('host');
        else this.hide('host');
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        const state = root && root._md;
        if (!state) return;
        state.dialog.removeEventListener('cancel', state.onCancel);
        state.dialog.removeEventListener('close', state.onClose);
        if (state.footer) state.footer.removeEventListener('slotchange', state.onFooterChange);
        if (state.dialog.open) state.dialog.close();
        this.unlockScroll(state);
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({ close: 'Close', dialog: 'Dialog' }, this.labels);
        },

        sizeName() {
            return ['small', 'medium', 'large', 'full'].includes(this.size) ? this.size : 'medium';
        },

        roleName() {
            return this.role === 'alertdialog' ? 'alertdialog' : 'dialog';
        },

        dialogName() {
            return DzGlobal.text(this.title).trim() || DzGlobal.text(this.label).trim() || this.ui.dialog;
        },

        level() {
            const n = Math.round(Number(this.headingLevel));
            return n >= 1 && n <= 6 ? n : 2;
        }
    },

    methods: {
        syncItems(root) {
            const state = root._md;
            const list = DzGlobal.raw(this.items);
            const signature = JSON.stringify(Array.isArray(list) ? list : []);
            if (state.itemsSignature === signature) return;
            state.itemsSignature = signature;
            DzGlobal.renderItems(root.getRootNode().host, list, 'data-md-item');
        },

        state() {
            const root = DzGlobal.raw(this.$refs.root);
            return root && root._md;
        },

        // The element that really has focus, looking inside shadow roots.
        focusedElement() {
            let el = document.activeElement;
            while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
            return el;
        },

        show(reason) {
            const state = this.state();
            if (!state || state.dialog.open) return;
            state.returnTo = this.focusedElement();
            state.reason = '';
            state.value = '';
            state.dialog.showModal();
            // Content can choose what gets focus first (see FIRST FOCUS).
            const host = state.dialog.getRootNode().host;
            const chosen = host ? [...host.querySelectorAll('[data-modal-focus]')].find(el => el.getAttribute('data-modal-focus') !== 'false') : null;
            if (chosen && typeof chosen.focus === 'function') chosen.focus();
            this.isOpen = true;
            this.lockScroll(state);
            this.$emit('open', { reason });
        },

        // Close for a reason; the dialog's close event does the rest (afterClose).
        hide(reason, value) {
            const state = this.state();
            if (!state || !state.dialog.open) return;
            state.reason = reason;
            state.value = value || '';
            state.dialog.close();
        },

        afterClose() {
            const state = this.state();
            if (!state) return;
            const reason = state.reason || 'escape';
            const value = state.value || '';
            state.reason = '';
            state.value = '';
            this.isOpen = false;
            this.unlockScroll(state);
            if (reason !== 'host') state.openProp = false;
            const target = state.returnTo;
            state.returnTo = null;
            if (target && target.isConnected && typeof target.focus === 'function') target.focus();
            this.$emit('close', { reason, value });
        },

        // The page behind stays where it is while the dialog is open.
        lockScroll(state) {
            const page = document.documentElement;
            state.pageOverflow = page.style.overflow;
            page.style.overflow = 'hidden';
        },

        unlockScroll(state) {
            if (state.pageOverflow === undefined) return;
            document.documentElement.style.overflow = state.pageOverflow;
            state.pageOverflow = undefined;
        },

        onBackdropDown(event) {
            const state = this.state();
            if (state) state.downOnBackdrop = event.target === state.dialog;
        },

        // Two kinds of click reach the dialog. One on the dialog element itself is the backdrop
        // (the panel fills its inside); it must also have started there, so selecting text and
        // releasing outside doesn't close it. One whose path passes an element with
        // data-modal-close — slotted content included — is a close request with a value.
        onDialogClick(event) {
            const state = this.state();
            if (!state) return;
            const fromBackdrop = event.target === state.dialog && state.downOnBackdrop;
            state.downOnBackdrop = false;
            if (fromBackdrop) {
                if (this.closeOnBackdrop) this.hide('backdrop');
                return;
            }
            const path = event.composedPath();
            const stop = path.indexOf(state.dialog);
            const closer = path.slice(0, stop < 0 ? path.length : stop)
                .find(el => el && el.nodeType === 1 && el.hasAttribute('data-modal-close'));
            if (closer) this.hide('action', closer.getAttribute('data-modal-close'));
        }
    },

    styles: /*css*/ `
        :host { display: contents; }

        .md { font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }

        /* White on primary, 4.9:1. */
        .md-trigger { padding: .6rem 1.1rem; border: 0; border-radius: 999px; background: var(--dz-color-primary, #5b5ef0);
                      font: inherit; font-weight: 600; color: #fff; cursor: pointer;
                      box-shadow: 0 1px 2px rgba(15, 18, 28, .12), 0 4px 12px -4px rgba(91, 94, 240, .45);
                      transition: background-color .15s ease, transform .15s ease; }
        .md-trigger:hover { background: #4a4dd6; }
        .md-trigger:active { transform: translateY(1px); }
        .md-trigger:focus-visible, .md-close:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 3px; }

        /* ---- The dialog: a rounded card with a layered shadow over a blurred, dimmed page. It
           fades and scales in and out: the closed state is the starting point, and display and
           overlay transition discretely so the exit animation plays before it leaves the top layer. */
        .md-dialog { box-sizing: border-box; width: min(34rem, calc(100vw - 2rem)); max-width: none;
                     max-height: calc(100dvh - 2rem); margin: auto; padding: 0; border: 0; border-radius: 20px;
                     overflow: hidden; background: var(--dz-color-surface, #fff); color: var(--dz-color-text, #2b2f3a);
                     font-family: var(--dz-font-body, inherit);
                     box-shadow: 0 0 0 1px rgba(15, 18, 28, .06), 0 2px 6px rgba(15, 18, 28, .08), 0 24px 64px -16px rgba(15, 18, 28, .45);
                     opacity: 0; transform: translateY(12px) scale(.96); }
        .md-dialog[open] { opacity: 1; transform: none; }
        .md-dialog.is-small { width: min(26rem, calc(100vw - 2rem)); }
        .md-dialog.is-large { width: min(52rem, calc(100vw - 2rem)); }
        .md-dialog.is-full { width: calc(100vw - 2rem); height: calc(100dvh - 2rem); }
        .md-dialog::backdrop { background: rgba(15, 18, 28, 0); backdrop-filter: blur(0); }
        .md-dialog[open]::backdrop { background: rgba(15, 18, 28, .45); backdrop-filter: blur(6px); }

        @media (prefers-reduced-motion: no-preference) {
            .md-dialog { transition: opacity .22s ease, transform .22s cubic-bezier(.2, .8, .2, 1),
                                     overlay .22s ease allow-discrete, display .22s ease allow-discrete; }
            .md-dialog::backdrop { transition: background-color .22s ease, backdrop-filter .22s ease,
                                               overlay .22s ease allow-discrete, display .22s ease allow-discrete; }
            @starting-style {
                .md-dialog[open] { opacity: 0; transform: translateY(12px) scale(.96); }
                .md-dialog[open]::backdrop { background: rgba(15, 18, 28, 0); backdrop-filter: blur(0); }
            }
        }

        .md-panel { box-sizing: border-box; display: flex; flex-direction: column; max-height: calc(100dvh - 2rem); }
        .md-dialog.is-full .md-panel { height: 100%; }

        /* ---- Header: no rule under it; the title and a round, quiet close button. */
        .md-head { display: flex; align-items: flex-start; gap: 1rem; padding: 1.35rem 1.1rem .35rem 1.6rem; }
        .md-head.is-bare { padding-bottom: 0; }
        .md-title { flex: 1; margin: .3rem 0 0; font-family: var(--dz-font-heading, inherit); font-size: 1.3rem; font-weight: 650;
                    line-height: 1.3; letter-spacing: -.01em; color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .md-close { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem;
                    margin-left: auto; padding: 0; border: 0; border-radius: 999px; cursor: pointer;
                    background: var(--dz-color-bg, #f3f4f8); color: var(--dz-color-heading, #1f2330);
                    transition: background-color .15s ease, transform .15s ease; }
        .md-close:hover { background: #e6e8ef; transform: rotate(90deg); }
        .md-icon { display: block; width: 1.25rem; height: 1.25rem; background: currentColor;
                   -webkit-mask: var(--dz-icon-close) center / contain no-repeat; mask: var(--dz-icon-close) center / contain no-repeat; }

        /* ---- Body: scrolls on its own; slotted text gets comfortable defaults. */
        .md-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: .75rem 1.6rem 1.5rem;
                   line-height: 1.6; }
        .md-dialog.is-full .md-body { flex: 1 1 0; }
        .md-desc { margin: 0; color: #454a57; overflow-wrap: anywhere; }
        .md-body > slot::slotted(p) { margin: 0 0 1rem; overflow-wrap: anywhere; }
        .md-body > slot::slotted(p:last-child) { margin-bottom: 0; }
        .md-desc + slot::slotted(*) { margin-top: 1rem; }

        /* ---- Footer: pinned under the body, items to the right; hidden while its slot is empty. */
        .md-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .6rem;
                   padding: 1rem 1.6rem 1.25rem; border-top: 1px solid var(--dz-color-border, #eceef4); }
        .md-foot.is-empty { display: none; }

        /* ---- Phones: a sheet rising from the bottom, full width, with a grab handle. */
        @media (max-width: 640px) {
            .md-dialog, .md-dialog.is-small, .md-dialog.is-large, .md-dialog.is-full {
                width: 100vw; max-height: 92dvh; margin: auto 0 0; border-radius: 22px 22px 0 0; transform: translateY(40px); }
            .md-dialog[open] { transform: none; }
            @media (prefers-reduced-motion: no-preference) {
                @starting-style { .md-dialog[open] { transform: translateY(40px); } }
            }
            .md-dialog.is-full { height: 92dvh; }
            .md-panel { max-height: 92dvh; }
            .md-panel::before { content: ""; align-self: center; flex: none; width: 2.5rem; height: .3rem; margin-top: .6rem;
                                border-radius: 999px; background: #c9ccd6; }
            .md-head { padding-top: .75rem; }
            .md-foot { padding-bottom: 1.5rem; }
        }
    `
});
