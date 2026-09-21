export default Deezul.Component({
    // DynamicList — a general-purpose, single-level list: AccordionList without the nesting.
    // Rows are selectable, sorted, and can be added, edited, moved and deleted from a toolbar in
    // a dark title bar.
    //
    // NEEDS: window.DzGlobal (global.js, imported by main.js) for shared logic, and the
    // --dz-icon-* custom properties (assets/icons.css, linked in index.html) for icons.
    //
    // DATA: `items` is an array of objects of ANY shape. These props say which fields to read,
    // so a list from an API or a dataset never has to be reshaped first:
    //   labelKey  (default 'label')  the row text
    //   idKey     (default 'id')     a stable identity; falls back to the item's position
    //   orderKey  (default 'order')  a number to sort by. Items without one follow, A–Z by
    //                                label — so an unordered list is just A–Z.
    // `emptyText` (default 'No items') shows when the list is empty.
    // Give items ids when using the actions: without one, a key is the item's position, which
    // shifts when items are moved or deleted — and the selection is lost.
    //
    //   <dz-component dz-type="dynamic_list" :title="'Tags'" :items="tags"
    //                 :labelKey="'name'" :showAdd="true" :showMove="true"
    //                 @select="open($event.detail)" @move="tags = $event.detail.items"></dz-component>
    //
    // ACTIONS: each toolbar icon right of the title has its own switch in the component options —
    // showAdd, showEdit, showMove, showDelete (and showMenu, below). All are off by default.
    // Edit, move and delete act on the selected row. Props arrive as copies, so the component
    // never changes the list — it emits, and the host updates its own `items`. Where the change
    // needs no input, the event carries the finished array in `detail.items`:
    //   select   a row was selected                   detail: the item. Clicking the selected
    //                                                  row again unselects it (no event)
    //   add      { order }                            the next free order number, or null when
    //                                                  the list is A–Z
    //   edit     { item, index }
    //   move     { item, index, order, changes, items }  changes: [{ item, order }] for every
    //                                                  item renumbered (1..n)
    //   delete   { item, index, items }               confirming is the host's call
    // An `index` is the item's position in `items` as given (not the sorted display order).
    //
    // MENU: with showMenu on, `menu` adds a gear icon at the end of the toolbar that opens a
    // dropdown of custom actions — [{ event, label, needsSelection }]. Choosing one emits `event`
    // (so the host listens with @<event>) with { item, index }: the selection, or nulls when there
    // is none. needsSelection entries are off until something is selected. Don't reuse the
    // built-in event names above. The dropdown closes on Esc, a click outside, tabbing away or
    // choosing an entry; Up/Down move within it.
    //
    // MOVE MODE: the move icon marks the selection as moving and turns the dividers between rows
    // into drop targets (on touch screens, 44px "Place here" slots). Picking one puts the item
    // there and numbers the list 1..n, since a chosen position needs an order. Dividers that
    // wouldn't change anything are left out; Cancel or Esc leaves the mode.
    //
    // LABELS: every visible and screen-reader string can be replaced through `labels`, an object
    // of any of the keys in the `ui` computed below; {name}, {target} and {label} are filled in.
    //
    // SCREEN READERS: rows are toggle buttons (aria-pressed). A polite live region announces
    // entering move mode, cancelling it, and where the item landed. Adds, edits and deletes are
    // applied by the host, so announcing their outcome is the host's job.
    //
    // Unavailable tools use aria-disabled rather than disabled, so they keep focus.
    //
    // RUNTIME: every change rebuilds `rows`, so the keyed :for reuses rows for NEW objects. The
    // :if blocks inside them need deezul d494224 or later.
    schema: {
        inputs: {
            title:      { type: 'string', default: '', label: 'Title' },
            items:      { type: 'array', default: [], label: 'Items' },
            labelKey:   { type: 'string', default: 'label', label: 'Label field' },
            idKey:      { type: 'string', default: 'id', label: 'Id field' },
            orderKey:   { type: 'string', default: 'order', label: 'Order field' },
            emptyText:  { type: 'string', default: 'No items', label: 'Empty message' },
            showAdd:    { type: 'boolean', default: false, label: 'Show add' },
            showEdit:   { type: 'boolean', default: false, label: 'Show edit' },
            showMove:   { type: 'boolean', default: false, label: 'Show move' },
            showDelete: { type: 'boolean', default: false, label: 'Show delete' },
            showMenu:   { type: 'boolean', default: false, label: 'Show options menu' },
            menu:       { type: 'array', default: [], label: 'Menu entries ({ event, label, needsSelection })' },
            labels:     { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // :if sits on elements INSIDE the :for rows, never on the :for element (a compile error).
    // Bindings inside an :if never dereference something the :if tests for null: they refresh
    // before the :if removes them (hence statusParts and endGap are never null).
    template: html`
    <div class="dl" ref="root" @keydown="onKeydown">
        <div class="dl-top" :if="title || tools.any">
            <p class="dl-title" :if="title">{{ title }}</p>
            <div class="dl-tools" :if="tools.any && !moveNode" role="group" :aria-label="ui.actionsGroup">
                <button type="button" class="dl-tool" :if="tools.add"
                        :aria-label="ui.addItem" :title="ui.addItem" @click="add">
                    <span class="dl-icon i-add" aria-hidden="true"></span>
                </button>
                <button type="button" class="dl-tool" :if="tools.edit" :aria-disabled="tools.canAct ? 'false' : 'true'"
                        :aria-label="tools.editName" :title="tools.editName" @click="edit">
                    <span class="dl-icon i-edit" aria-hidden="true"></span>
                </button>
                <button type="button" class="dl-tool is-move" :if="tools.move" :aria-disabled="tools.canMove ? 'false' : 'true'"
                        :aria-label="tools.moveName" :title="tools.moveName" @click="startMove($event)">
                    <span class="dl-icon i-move" aria-hidden="true"></span>
                </button>
                <button type="button" class="dl-tool is-delete" :if="tools.remove" :aria-disabled="tools.canAct ? 'false' : 'true'"
                        :aria-label="tools.removeName" :title="tools.removeName" @click="remove">
                    <span class="dl-icon i-delete" aria-hidden="true"></span>
                </button>
                <div class="dl-menu" :if="tools.menu">
                    <button type="button" class="dl-tool is-gear" :aria-expanded="menuOpen ? 'true' : 'false'"
                            :aria-label="ui.menuButton" :title="ui.menuButton" @click="toggleMenu($event)">
                        <span class="dl-icon i-gear" aria-hidden="true"></span>
                    </button>
                    <ul class="dl-menu-list" :if="menuOpen">
                        <li :for="entry in menuEntries" :key="entry.key">
                            <button type="button" class="dl-menu-item" :aria-disabled="entry.disabled ? 'true' : 'false'"
                                    :title="entry.title" @click="runMenu(entry, $event)">{{ entry.label }}</button>
                        </li>
                    </ul>
                </div>
            </div>
            <div class="dl-tools" :if="moveNode" role="group" :aria-label="ui.moveGroup">
                <button type="button" class="dl-text-btn" @click="cancelMove($event)">{{ ui.cancel }}</button>
            </div>
        </div>
        <p class="dl-status" :if="moveNode">{{ statusParts.before }}<strong>{{ statusParts.value }}</strong>{{ statusParts.after }}</p>
        <ul class="dl-list" :class="moveNode ? 'is-placing' : ''">
            <li class="dl-row" :for="row in rows" :key="row.key"
                :class="(row.selected ? 'is-selected' : '') + (row.blocked ? ' is-moving' : '')">
                <button type="button" class="dl-gap" :if="row.gap"
                        :aria-label="row.gapName" :title="row.gapName" @click="drop(row.gapPos, $event)">
                    <span class="dl-gap-text" aria-hidden="true">{{ ui.placeHere }}</span>
                </button>
                <button type="button" class="dl-item" :data-key="row.key"
                        :aria-pressed="row.selected ? 'true' : 'false'" :aria-disabled="moveNode ? 'true' : 'false'"
                        @click="select(row)">
                    <span class="dl-label">{{ row.label }}</span>
                </button>
            </li>
        </ul>
        <div class="dl-end" :if="endGap.show">
            <button type="button" class="dl-gap" :aria-label="endGap.name" :title="endGap.name"
                    @click="drop(endGap.pos, $event)">
                <span class="dl-gap-text" aria-hidden="true">{{ ui.placeHere }}</span>
            </button>
        </div>
        <p class="dl-empty" :if="isEmpty">{{ emptyText }}</p>
        <p class="dl-sr" role="status" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
    </div>
    `,

    data: () => ({
        title: '', items: [], labelKey: 'label', idKey: 'id', orderKey: 'order', emptyText: 'No items',
        showAdd: false, showEdit: false, showMove: false, showDelete: false, showMenu: false,
        menu: [], labels: {}, menuOpen: false,
        selectedKey: '', movingKey: '', liveMessage: ''
    }),

    // The dropdown closes on a click outside the list, or when focus leaves it. The cleanup lives
    // on the root element, outside reactive data. `ref` is safe here only because it sits on the
    // outermost element: an :if before a ref shifts its compile-time path.
    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (root) root._dzCloseMenu = DzGlobal.closeOnOutside(root, () => this.menuOpen, () => { this.menuOpen = false; });
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (root && root._dzCloseMenu) root._dzCloseMenu();
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                actionsGroup: 'Item actions',
                addItem: 'Add item',
                edit: 'Edit {name}',
                editNone: 'Edit (select an item first)',
                move: 'Move {name}',
                moveNone: 'Move (select an item first)',
                remove: 'Delete {name}',
                removeNone: 'Delete (select an item first)',
                menuButton: 'More actions',
                menuUnavailable: '{label} (select an item first)',
                moveGroup: 'Move',
                cancel: 'Cancel',
                movingStatus: 'Moving {name}. Pick a spot between items.',
                moveBefore: 'Move {name} before {target}',
                moveToEnd: 'Move {name} to the end',
                placeHere: 'Place here',
                moveCancelled: 'Move cancelled',
                movedBefore: '{name} moved before {target}',
                movedToEnd: '{name} moved to the end'
            }, this.labels);
        },

        // The items as sorted nodes. A key is the id (or '#index' without one); `index` is the
        // position in the unsorted array.
        nodes() {
            const list = this.items;
            if (!Array.isArray(list)) return [];
            const labelKey = this.labelKey || 'label';
            const idKey = this.idKey || 'id';
            const orderKey = this.orderKey || 'order';
            const out = [];
            list.forEach((item, index) => {
                if (item === null || typeof item !== 'object') return;
                out.push({
                    key: DzGlobal.keyFor('', item[idKey], index).slice(1), item, index,
                    label: DzGlobal.text(item[labelKey]),
                    order: DzGlobal.orderOf(item, orderKey)
                });
            });
            return DzGlobal.sortNodes(out);
        },

        // The rows with move-mode dividers (see DzGlobal.placeGaps).
        placement() {
            const moving = this.moveNode;
            const name = moving ? moving.label : '';
            const ui = this.ui;
            return DzGlobal.placeGaps(this.nodes, moving ? moving.key : null, {
                before: target => DzGlobal.format(ui.moveBefore, { name, target }),
                end: () => DzGlobal.format(ui.moveToEnd, { name })
            });
        },

        rows() {
            const selectedKey = this.selectedKey;
            return this.placement.rows.map(row => ({ ...row, selected: row.key === selectedKey }));
        },

        // The divider under the last row. Never null, so its bindings survive the move ending.
        endGap() {
            return this.placement.endGap;
        },

        isEmpty() {
            return this.nodes.length === 0;
        },

        selection() {
            const key = this.selectedKey;
            return key ? this.nodes.find(node => node.key === key) || null : null;
        },

        // The item being moved, re-resolved against the current items; null ends move mode.
        moveNode() {
            const key = this.movingKey;
            return key ? this.nodes.find(node => node.key === key) || null : null;
        },

        // The move-mode status line, split around the item's name so the name can be bold.
        statusParts() {
            const moving = this.moveNode;
            return DzGlobal.parts(this.ui.movingStatus, 'name', moving ? moving.label : '');
        },

        menuEntries() {
            return DzGlobal.menuEntries(this.menu, !!this.selection, this.ui.menuUnavailable);
        },

        // Which tools show, which are available, and their accessible names.
        tools() {
            const ui = this.ui;
            const sel = this.selection;
            const name = sel ? sel.label : '';
            const add = !!this.showAdd, edit = !!this.showEdit, move = !!this.showMove, remove = !!this.showDelete;
            const menu = !!this.showMenu && this.menuEntries.length > 0;
            return {
                any: add || edit || move || remove || menu,
                add, edit, move, remove, menu,
                canAct: !!sel,
                canMove: !!sel && this.nodes.length > 1,
                editName: sel ? DzGlobal.format(ui.edit, { name }) : ui.editNone,
                moveName: sel ? DzGlobal.format(ui.move, { name }) : ui.moveNone,
                removeName: sel ? DzGlobal.format(ui.remove, { name }) : ui.removeNone
            };
        }
    },

    methods: {
        // The raw items (never this component's reactive proxies), so the host can take results.
        list() {
            const raw = DzGlobal.raw(this.items);
            return Array.isArray(raw) ? raw : [];
        },

        // Clicking the selected row again unselects it. The parent decides what choosing an item
        // means; this block only reports it.
        select(row) {
            if (this.moveNode) return;
            if (this.selectedKey === row.key) {
                this.selectedKey = '';
                return;
            }
            this.selectedKey = row.key;
            this.$emit('select', row.item);
        },

        // Esc closes the dropdown (focus back to the gear) before it cancels a move; Up/Down move
        // between dropdown entries.
        onKeydown(event) {
            const root = event.target.getRootNode();
            if (this.menuOpen && event.key === 'Escape') {
                this.menuOpen = false;
                DzGlobal.focusIn(root, '.is-gear');
                return;
            }
            if (this.menuOpen && DzGlobal.menuArrowKeys(event, root, '.dl-menu-item')) return;
            if (event.key === 'Escape' && this.moveNode) this.cancelMove(event);
        },

        toggleMenu(event) {
            this.menuOpen = !this.menuOpen;
            if (this.menuOpen) DzGlobal.focusIn(event.target.getRootNode(), '.dl-menu-item');
        },

        // Emit the entry's own event with the selection.
        runMenu(entry, event) {
            if (entry.disabled) return;
            const root = event.target.getRootNode();
            const sel = this.selection;
            this.menuOpen = false;
            this.$emit(entry.event, { item: sel ? this.list()[sel.index] : null, index: sel ? sel.index : null });
            DzGlobal.focusIn(root, '.is-gear');
        },

        // ---- Actions. Each re-checks its availability: aria-disabled buttons still click.
        add() {
            this.$emit('add', { order: DzGlobal.nextOrder(this.list(), this.orderKey || 'order') });
        },

        edit() {
            const sel = this.selection;
            if (!sel) return;
            this.$emit('edit', { item: this.list()[sel.index], index: sel.index });
        },

        remove() {
            const sel = this.selection;
            if (!sel) return;
            const list = this.list();
            this.$emit('delete', { item: list[sel.index], index: sel.index, items: list.filter((_, i) => i !== sel.index) });
        },

        startMove(event) {
            const sel = this.selection;
            if (!sel || this.nodes.length < 2) return;
            this.menuOpen = false;
            this.movingKey = sel.key;
            DzGlobal.announce(this, DzGlobal.format(this.ui.movingStatus, { name: sel.label }));
            DzGlobal.focusIn(event.target.getRootNode(), '.dl-gap');
        },

        cancelMove(event) {
            this.movingKey = '';
            DzGlobal.announce(this, this.ui.moveCancelled);
            DzGlobal.focusIn(event.target.getRootNode(), '.is-move');
        },

        // Place the moving item at position `pos` among the other rows, then number the list 1..n.
        async drop(pos, event) {
            const moving = this.moveNode;
            if (!moving) return;
            const root = event.target.getRootNode();
            const others = this.rows.filter(row => !row.blocked);
            const target = others[pos];
            const sequence = others.map(row => row.index);
            sequence.splice(pos, 0, moving.index);
            const list = this.list();
            const result = DzGlobal.renumber(list, sequence, this.orderKey || 'order');
            this.movingKey = '';
            this.$emit('move', { item: list[moving.index], index: moving.index, order: result.rank.get(moving.index),
                                 changes: result.changes, items: result.items });
            DzGlobal.announce(this, target
                ? DzGlobal.format(this.ui.movedBefore, { name: moving.label, target: target.label })
                : DzGlobal.format(this.ui.movedToEnd, { name: moving.label }));
            if (!(await DzGlobal.focusIn(root, '[data-key="' + CSS.escape(moving.key) + '"]'))) DzGlobal.focusIn(root, '.is-move');
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .dl { font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        /* Screen-reader-only text: the live region. */
        .dl-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
                 overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }

        /* ---- Title bar: dark, with the toolbar. Contrast on the default #1f2330 (WCAG AA — 4.5:1
           text, 3:1 icons and focus rings), and on the 12% white hover (#3a3d49):
             title          #fff     15.7:1
             icons          #c7c8ff   9.8:1 / 6.8:1   (also the focus ring)
             delete icon    #ffa3b1   8.3:1 / 5.7:1
           Unavailable icons are dimmed on purpose; WCAG exempts disabled controls. A host can
           override the --dl-bar-* colors; keep those ratios if it does.
           The title keeps its natural width (no min-width: 0, or the text runs under the icons), so
           when both don't fit the toolbar wraps onto its own line, still pushed right. */
        .dl { --dl-bar-bg: var(--dz-color-heading, #1f2330); --dl-bar-fg: #ffffff; --dl-bar-icon: #c7c8ff;
              --dl-bar-danger: #ffa3b1; --dl-bar-muted: #a9adbb; }
        .dl-top { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem .75rem; margin: 0;
                  padding: .35rem .5rem .35rem .75rem; background: var(--dl-bar-bg); color: var(--dl-bar-fg); }
        .dl-title { flex: 1 1 auto; margin: 0; padding: .45rem 0; font-family: var(--dz-font-heading, inherit);
                    font-size: 1.05rem; font-weight: 700; color: var(--dl-bar-fg); }

        /* ---- Toolbar. Icons are masks over currentColor, so they take the button's color. The
           shapes come from the --dz-icon-* custom properties in assets/icons.css. */
        .dl-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .15rem; margin-left: auto; }
        .dl-tool { display: inline-flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem;
                   padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
                   color: var(--dl-bar-icon); }
        .dl-tool:hover { background: rgba(255, 255, 255, .12); }
        .dl-tool.is-delete { color: var(--dl-bar-danger); }
        .dl-tool[aria-disabled="true"] { color: var(--dl-bar-muted); opacity: .5; cursor: not-allowed; background: transparent; }
        .dl-tool:focus-visible, .dl-text-btn:focus-visible { outline: 2px solid var(--dl-bar-icon); outline-offset: 1px; }

        .dl-icon { display: block; width: 1.5rem; height: 1.5rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-add    { --icon: var(--dz-icon-add); }
        .i-edit   { --icon: var(--dz-icon-edit); }
        .i-move   { --icon: var(--dz-icon-move); }
        .i-delete { --icon: var(--dz-icon-delete); }
        .i-gear   { --icon: var(--dz-icon-settings); }

        /* The dropdown: a light panel under the gear, right-aligned to it. Entries are dark text on
           white (13:1); off entries use the muted grey, which WCAG exempts as disabled. */
        .dl-menu { position: relative; }
        .dl-menu-list { position: absolute; right: 0; top: calc(100% + 4px); z-index: 10; min-width: 11rem;
                        margin: 0; padding: .25rem 0; list-style: none; background: var(--dz-color-surface, #fff);
                        border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 6px;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, .18); }
        .dl-menu-item { display: block; width: 100%; padding: .55rem .9rem; border: 0; background: none; font: inherit;
                        font-size: .9rem; text-align: left; white-space: nowrap; cursor: pointer;
                        color: var(--dz-color-text, #2b2f3a); }
        .dl-menu-item:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, var(--dz-color-surface, #fff)); }
        .dl-menu-item:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -2px; }
        .dl-menu-item[aria-disabled="true"] { color: var(--dz-color-muted, #6b7180); background: none; cursor: not-allowed; }

        .dl-text-btn { padding: .3rem .7rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 6px;
                       background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem; font-weight: 600;
                       color: var(--dz-color-heading, #1f2330); cursor: pointer; }

        .dl-status { margin: .5rem 0; padding: .45rem .75rem; border: 1px dashed var(--dz-color-primary, #5b5ef0);
                     border-radius: 6px; font-size: .875rem; color: var(--dz-color-text, #2b2f3a);
                     background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 6%, var(--dz-color-surface, #fff)); }

        /* ---- Rows. Directly under the bar the list needs no top border of its own. */
        .dl-list { list-style: none; margin: 0; padding: 0;
                   border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .dl-top + .dl-list { border-top: 0; }
        .dl-row { position: relative; border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }

        .dl-item { display: flex; align-items: center; gap: .6rem; width: 100%; padding: .6rem .75rem; border: 0;
                   background: transparent; font: inherit; color: inherit; text-align: left; cursor: pointer; }
        .dl-item:hover { background: var(--dz-color-bg, #f7f7fb); }
        .dl-item:hover .dl-label { color: var(--dz-color-primary, #5b5ef0); }
        .dl-item:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -2px; }
        .dl-row.is-selected > .dl-item { box-shadow: inset 3px 0 0 var(--dz-color-primary, #5b5ef0);
            background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 7%, var(--dz-color-surface, #fff)); }
        .dl-row.is-moving > .dl-item { opacity: .55; font-style: italic; cursor: not-allowed;
                                       outline: 1px dashed var(--dz-color-primary, #5b5ef0); outline-offset: -3px; }
        .is-placing .dl-item { cursor: default; }
        .dl-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }

        .dl-empty { margin: 0; padding: .9rem .75rem; color: var(--dz-color-muted, #6b7180); font-style: italic;
                    border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }

        /* ---- Drop targets (move mode). Each is a 14px band centred on the divider above its row
           (or under the last row), laid over the rows so the layout doesn't move. A faint line
           shows every spot; hover or focus draws it solid, with a dot at the start. */
        .dl-end { position: relative; }
        .dl-gap { position: absolute; left: 0; right: 0; top: -8px; z-index: 1; height: 14px; padding: 0; border: 0;
                  background: transparent; cursor: pointer; }
        .dl-gap::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px;
                          border-radius: 2px; background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 30%, transparent); }
        .dl-gap::after { content: ""; position: absolute; left: 0; top: 50%; width: 10px; height: 10px; margin-top: -5px;
                         box-sizing: border-box; border: 2px solid var(--dz-color-primary, #5b5ef0); border-radius: 50%;
                         background: var(--dz-color-surface, #fff); opacity: 0; }
        .dl-gap:hover::before, .dl-gap:focus-visible::before { height: 3px; margin-top: -1.5px; background: var(--dz-color-primary, #5b5ef0); }
        .dl-gap:hover::after, .dl-gap:focus-visible::after { opacity: 1; }
        .dl-gap:focus { outline: none; }
        .dl-gap-text { display: none; }

        /* Touch screens have no hover and fingers need ~44px, so the bands become visible
           "Place here" slots that take up space between the rows instead of overlaying them. The
           text is a real (aria-hidden) element so the placeHere label can change it. */
        @media (pointer: coarse) {
            .dl-gap { position: relative; top: auto; display: block; width: 100%; height: 2.75rem; }
            .dl-end .dl-gap { border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
            .dl-gap::before, .dl-gap:hover::before, .dl-gap:focus-visible::before {
                inset: .35rem .5rem; height: auto; margin: 0; border: 1.5px dashed var(--dz-color-primary, #5b5ef0);
                border-radius: 6px; background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 6%, transparent); }
            .dl-gap:active::before { border-style: solid;
                background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 18%, transparent); }
            .dl-gap::after, .dl-gap:hover::after, .dl-gap:focus-visible::after { display: none; }
            .dl-gap-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                           font: inherit; font-size: .8rem; font-weight: 600; color: var(--dz-color-primary, #5b5ef0); }
            .dl-gap:focus-visible::before { border-style: solid; border-width: 2px; }
        }
    `
});
