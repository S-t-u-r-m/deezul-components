export default Deezul.Component({
    // Tabs — a container that shows one of the components placed inside it at a time, chosen from
    // a row of tabs: Overview / Services / Staff / Documents on a department page.
    //
    // PANELS are this component's own light-DOM children, shown through a native <slot>, the same
    // way the carousel and the CMS container blocks take their content. Each child is one tab; its
    // name comes from its data-tab-label attribute, else from `titles`, else "Tab 2":
    //   <dz-component dz-type="tabs" :label="'Health Department'">
    //       <dz-component dz-type="department_card" data-tab-label="Overview" ...></dz-component>
    //       <dz-component dz-type="staff_directory" data-tab-label="Staff" ...></dz-component>
    //   </dz-component>
    // Or list them as data and let the tabs create them, each by its dz-type:
    //   :items="[{ label: 'Overview', id: 'overview', type: 'department_card', props: { ... } }, ...]"
    // Items from `items` come after any children placed inside, and are replaced when it changes.
    // Children added or removed later are picked up.
    //
    // LINKING TO A TAB: every tab has an id — data-tab-id, the item's id, or its name in lowercase
    // with dashes ("Birth certificates" → birth-certificates). With `linkHash`, the address shows
    // the open tab (/departments/health#staff): that link opens the Staff tab, and so does a link
    // to #staff on the same page. The address is replaced, not added to, so Back leaves the page.
    //
    // ACCESSIBILITY (the WAI-ARIA tabs pattern):
    //   · a tablist named by `label`; each tab says whether it is selected;
    //   · Left and Right move between tabs and open them (wrapping around), Home and End go to
    //     the first and last; Tab moves on into the open panel;
    //   · the open panel is a tabpanel named by its tab, and can take focus itself (for panels
    //     that start with text rather than a link or field); the others are hidden entirely;
    //   · tabs that don't fit scroll sideways, and the open one is scrolled into view (the row
    //     scrolls, never the page).
    //
    // EDITOR: with window.DZ_EDITING set, every panel shows, stacked, so an author can see and
    // arrange all of them.
    //
    // OPTIONS:
    //   label       the tab list's name for screen readers (default 'Sections'); give each set of
    //               tabs on a page a different one
    //   items       panels by dz-type, see PANELS
    //   titles      tab names by position, for children without data-tab-label: ['Overview', 'Staff']
    //   selected    the tab open at first: a number from 0, or a tab id (default 0)
    //   linkHash    keep the open tab in the address (default false), see LINKING TO A TAB
    //   variant     'line' (default: an underline under the open tab) or 'boxed' (folder tabs over a
    //               bordered panel)
    //   labels      text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   tab-change   { index, id, label }   the visitor opened another tab
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js.
    schema: {
        inputs: {
            label:    { type: 'string', default: 'Sections', label: 'Name (screen readers)' },
            items:    { type: 'array', default: [], label: 'Panels ({ label, id, type: dz-type, props })' },
            titles:   { type: 'array', default: [], label: 'Tab names, in order (for children without data-tab-label)' },
            selected: { type: 'string', default: '0', label: 'Open at first (number from 0, or tab id)' },
            linkHash: { type: 'boolean', default: false, label: 'Show the open tab in the address' },
            variant:  { type: 'enum', options: ['line', 'boxed'], default: 'line', label: 'Style' },
            labels:   { type: 'object', default: {}, label: 'Text overrides' }
        },
        slots: {
            default: { label: 'Panels', allow: ['*'] }
        }
    },

    // `ref` only on the outermost element. The slot listener lives on the root element, outside
    // reactive data. Tab names live in `names`, set from the children in apply().
    template: html`
    <div class="tb" ref="root" :class="rootClass">
        <div class="tb-bar" :if="names.length && !editing">
            <div class="tb-list" role="tablist" :aria-label="label || ui.defaultLabel" @keydown="onKey($event)">
                <button type="button" class="tb-tab" role="tab" :for="tab in tabs" :key="tab.key"
                        :aria-selected="tab.selected ? 'true' : 'false'" :tabindex="tab.selected ? '0' : '-1'"
                        :data-index="tab.index" @click="choose(tab.index, $event)">{{ tab.label }}</button>
            </div>
        </div>
        <div class="tb-panels">
            <slot></slot>
        </div>
        <p class="tb-empty" :if="!names.length">{{ ui.empty }}</p>
    </div>
    `,

    data: () => ({
        label: 'Sections', items: [], titles: [], selected: '0', linkHash: false, variant: 'line', labels: {},
        names: [], active: 0, editing: false
    }),

    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        const state = root._tb = { itemsSignature: '', settings: '' };
        this.editing = !!window.DZ_EDITING;

        const slot = root.querySelector('slot');
        if (slot) {
            // Children added or removed later: keep the open tab by id where it still exists.
            state.onSlotChange = () => this.apply(this.indexFor(this.currentId(), -1));
            slot.addEventListener('slotchange', state.onSlotChange);
            state.slot = slot;
        }
        state.onHashChange = () => {
            if (!this.linkHash) return;
            const index = this.indexFor(this.hashId(), -1);
            if (index >= 0 && index !== this.active) this.apply(index);
        };
        window.addEventListener('hashchange', state.onHashChange);

        this.syncItems(root);
        state.settings = String(this.selected);
        this.apply(this.startIndex());
    },

    // New `items` are recreated; a host changing `selected` opens that tab.
    $updated() {
        const root = DzGlobal.raw(this.$refs.root);
        const state = root && root._tb;
        if (!state) return;
        this.syncItems(root);
        if (state.settings === String(this.selected)) return;
        state.settings = String(this.selected);
        this.apply(this.indexFor(this.selected, this.active));
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        const state = root && root._tb;
        if (!state) return;
        if (state.slot) state.slot.removeEventListener('slotchange', state.onSlotChange);
        window.removeEventListener('hashchange', state.onHashChange);
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                defaultLabel: 'Sections',
                tabName: 'Tab {n}',
                empty: 'Add components to show as tabs'
            }, this.labels);
        },

        rootClass() {
            return 'is-' + (this.variant === 'boxed' ? 'boxed' : 'line') + (this.editing ? ' is-editing' : '');
        },

        tabs() {
            return this.names.map((name, index) => ({ key: 't' + index + '~' + name.id, index, label: name.label, selected: index === this.active }));
        }
    },

    methods: {
        // Create the `items` entries as this component's own children, by dz-type, replacing the
        // ones made last time; only when `items` actually changed. Each gets its tab name and id.
        syncItems(root) {
            const state = root._tb;
            const list = DzGlobal.raw(this.items);
            const entries = (Array.isArray(list) ? list : []).filter(entry => entry && typeof entry === 'object' && DzGlobal.text(entry.type).trim());
            const signature = JSON.stringify(entries);
            if (state.itemsSignature === signature) return;
            state.itemsSignature = signature;
            const host = root.getRootNode().host;
            DzGlobal.renderItems(host, entries, 'data-tb-item');
            const made = Array.prototype.filter.call(host.children, el => el.hasAttribute('data-tb-item'));
            made.forEach((el, i) => {
                const label = DzGlobal.text(entries[i] && entries[i].label).trim();
                const id = DzGlobal.text(entries[i] && entries[i].id).trim();
                if (label) el.setAttribute('data-tab-label', label);
                if (id) el.setAttribute('data-tab-id', id);
            });
        },

        // The panels: element children in the default slot.
        panels() {
            const root = DzGlobal.raw(this.$refs.root);
            const host = root && root.getRootNode().host;
            if (!host) return [];
            return Array.prototype.filter.call(host.children, el => el.nodeType === 1 && !el.hasAttribute('slot'));
        },

        // Tab names and ids for the panels, in order. Ids repeat-proof: a second "faq" is "faq-2".
        readNames(kids) {
            const titles = Array.isArray(this.titles) ? this.titles : [];
            const seen = {};
            return kids.map((kid, index) => {
                const label = DzGlobal.text(kid.getAttribute('data-tab-label')).trim()
                    || DzGlobal.text(titles[index]).trim()
                    || DzGlobal.format(this.ui.tabName, { n: index + 1 });
                const base = this.slug(kid.getAttribute('data-tab-id')) || this.slug(label) || 'tab-' + (index + 1);
                seen[base] = (seen[base] || 0) + 1;
                return { label, id: seen[base] > 1 ? base + '-' + seen[base] : base };
            });
        },

        // 'Birth certificates' → 'birth-certificates' (letters and digits kept, the rest become dashes).
        slug(value) {
            const text = DzGlobal.text(value).trim().toLowerCase();
            let out = '';
            for (const ch of text) {
                const keep = (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
                if (keep) out += ch;
                else if (out && !out.endsWith('-')) out += '-';
            }
            return out.endsWith('-') ? out.slice(0, -1) : out;
        },

        currentId() {
            const name = this.names[this.active];
            return name ? name.id : '';
        },

        hashId() {
            const hash = DzGlobal.text(window.location.hash);
            try {
                return hash.length > 1 ? decodeURIComponent(hash.slice(1)) : '';
            } catch (error) {
                return hash.slice(1);
            }
        },

        // A tab by number (0-based) or id; `fallback` when there is none.
        indexFor(value, fallback) {
            const kids = this.panels();
            const names = this.readNames(kids);
            const text = DzGlobal.text(value).trim();
            if (!text) return fallback;
            const byId = names.findIndex(name => name.id === text || name.id === this.slug(text));
            if (byId >= 0) return byId;
            const n = Number(text);
            return Number.isInteger(n) && n >= 0 && n < names.length ? n : fallback;
        },

        // The address's tab (with linkHash), else `selected`, else the first.
        startIndex() {
            const fromHash = this.linkHash ? this.indexFor(this.hashId(), -1) : -1;
            return fromHash >= 0 ? fromHash : this.indexFor(this.selected, 0);
        },

        // Show panel `index` and mark every child: the open one is a named, focusable tabpanel, the
        // rest are hidden. Works from locals rather than re-reading data, which the proxy doesn't
        // refresh mid-method. Returns the index shown.
        apply(index) {
            const kids = this.panels();
            const names = this.readNames(kids);
            const count = kids.length;
            const active = count ? Math.min(Math.max(0, index < 0 ? this.active : index), count - 1) : 0;
            kids.forEach((kid, i) => {
                const open = this.editing || i === active;
                kid.setAttribute('role', 'tabpanel');
                kid.setAttribute('aria-label', names[i].label);
                kid.setAttribute('data-tab-panel', names[i].id);
                if (open) {
                    kid.removeAttribute('hidden');
                    kid.setAttribute('tabindex', '0');
                } else {
                    kid.setAttribute('hidden', '');
                    kid.removeAttribute('tabindex');
                }
            });
            this.names = names;
            this.active = active;
            this.reveal(active);
            return active;
        },

        // Scroll the tab row (only the row, never the page) so tab `index` is in view, once drawn.
        async reveal(index) {
            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            const root = DzGlobal.raw(this.$refs.root);
            const list = root && root.querySelector('.tb-list');
            const tab = list && list.querySelector('.tb-tab[data-index="' + index + '"]');
            if (!tab) return;
            const margin = 16;
            const left = tab.offsetLeft;   // the row is position: relative, so this is within the row
            const right = left + tab.offsetWidth;
            if (left - margin < list.scrollLeft) list.scrollLeft = Math.max(0, left - margin);
            else if (right + margin > list.scrollLeft + list.clientWidth) list.scrollLeft = right + margin - list.clientWidth;
        },

        // The visitor opened a tab: show it, keep the address in step, tell the page.
        choose(index, event) {
            const before = this.active;
            const active = this.apply(index);
            const name = this.names[active];
            if (!name) return;
            if (this.linkHash && this.hashId() !== name.id) {
                try {
                    window.history.replaceState(window.history.state, '', '#' + encodeURIComponent(name.id));
                } catch (error) { /* a sandboxed page: the tab still opens */ }
            }
            if (active !== before) this.$emit('tab-change', { index: active, id: name.id, label: name.label });
        },

        // Left and Right (wrapping), Home and End: move to that tab and open it.
        async onKey(event) {
            const count = this.names.length;
            if (!count) return;
            const moves = { ArrowRight: this.active + 1, ArrowLeft: this.active - 1, Home: 0, End: count - 1 };
            if (!(event.key in moves)) return;
            event.preventDefault();
            const index = ((moves[event.key] % count) + count) % count;
            const root = event.target.getRootNode();
            this.choose(index, event);
            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            const button = root.querySelector('.tb-tab[data-index="' + index + '"]');
            if (button) button.focus();
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .tb { font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }

        /* ---- The tab row. It scrolls sideways when the tabs don't fit; tabs are 44px tall. */
        /* The rule under the row is an inset shadow, drawn inside the row's own box and under the
           tabs, so nothing overflows (no stray scrollbar) and an open boxed tab can cover it. */
        .tb-list { position: relative; display: flex; gap: .25rem; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin;
                   box-shadow: inset 0 -1px 0 #c9ccd6; }
        .tb-tab { position: relative; flex: none; box-sizing: border-box; min-height: 2.75rem; padding: .55rem 1rem;
                  border: 0; background: none; font: inherit; font-size: .9375rem; font-weight: 600; white-space: nowrap;
                  color: #454a57; cursor: pointer; }
        .tb-tab:hover { color: var(--dz-color-heading, #1f2330); }
        .tb-tab:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -4px; border-radius: 8px; }

        /* line: the open tab is underlined (the bar, not color alone, marks it) and bolder. */
        .is-line .tb-tab::after { content: ""; position: absolute; left: .5rem; right: .5rem; bottom: 0; height: 3px;
                                  border-radius: 3px 3px 0 0; background: transparent; }
        .is-line .tb-tab:hover::after { background: #c9ccd6; }
        .is-line .tb-tab[aria-selected="true"] { color: #3b3ec2; font-weight: 700; }
        .is-line .tb-tab[aria-selected="true"]::after { background: #4a4dd6; }

        /* boxed: folder tabs; the open one joins the bordered panel below it. */
        .is-boxed .tb-list { gap: .2rem; padding: .25rem .5rem 0; box-shadow: inset 0 -1px 0 var(--dz-color-border, #d9dce5); }
        .is-boxed .tb-tab { border: 1px solid transparent; border-bottom: 0; border-radius: 10px 10px 0 0;
                            background: var(--dz-color-bg, #f3f4f8); }
        .is-boxed .tb-tab:hover { background: #e9ebf2; }
        .is-boxed .tb-tab[aria-selected="true"] { border-color: var(--dz-color-border, #d9dce5); background: var(--dz-color-surface, #fff);
                                                  color: var(--dz-color-heading, #1f2330); font-weight: 700;
                                                  box-shadow: inset 0 3px 0 #4a4dd6; }
        .is-boxed .tb-panels { padding: 1.25rem; border: 1px solid var(--dz-color-border, #d9dce5); border-top: 0;
                               border-radius: 0 0 12px 12px; background: var(--dz-color-surface, #fff); }

        /* ---- Panels. Hidden ones are gone entirely: out of view, the tab order and screen readers. */
        .tb-panels { padding-top: 1.25rem; }
        .tb-panels > slot::slotted([hidden]) { display: none !important; }
        .tb-panels > slot::slotted(:focus-visible) { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 4px; border-radius: 4px; }

        /* Editor: every panel, stacked. */
        .tb.is-editing .tb-panels { display: flex; flex-direction: column; gap: 1rem; }

        .tb-empty { display: flex; align-items: center; justify-content: center; min-height: 8rem; margin: 0;
                    border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px; font-style: italic;
                    color: var(--dz-color-muted, #6b7180); }
    `
});
