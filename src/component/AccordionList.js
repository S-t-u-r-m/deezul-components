export default Deezul.Component({
    // AccordionList — a drill-down tree. Only one level shows at a time: the open parent as a
    // highlighted header, then its children, un-indented. Clicking a child that has children
    // drills into it; the header is the path back up. At the top level there is no header.
    //   fits:          [home] / Executive office / Operations / Information technology
    //   overflows:     [home] / ... / Operations / Information technology
    //   still too long [home] / ... / Information technology   (then the current name wraps)
    // Every segment is a link up; the home icon returns to the top. Ancestors fold into "..."
    // from the top only while the path is wider than the list, and "..." opens the nearest
    // hidden one. Any depth.
    //
    // NEEDS: window.DzGlobal (global.js, imported by main.js) for shared logic, and the
    // --dz-icon-* custom properties (assets/icons.css, linked in index.html) for icons.
    //
    // DATA: `items` is an array of objects of ANY shape. These props say which fields to read,
    // so a list from an API or a dataset never has to be reshaped first:
    //   labelKey    (default 'label')     the row text
    //   childrenKey (default 'children')  the child array — missing, empty or not an array = a leaf.
    //                                     An OPEN parent whose last child is deleted stays open
    //                                     (showing emptyText) rather than jumping up a level.
    //   idKey       (default 'id')        a stable identity; falls back to the item's position
    //   orderKey    (default 'order')     a number to sort siblings by. Siblings without one
    //                                     follow, A–Z by label — so an unordered list is just A–Z.
    // `rootLabel` (default 'All') names the top level for screen readers.
    // Give items ids when using the actions: without one, a key is the item's position, which
    // shifts when items are moved or deleted — and the view loses its place.
    //
    //   <dz-component dz-type="accordion_list" :items="records"
    //                 :labelKey="'name'" :childrenKey="'subs'" :idKey="'code'"
    //                 @select="open($event.detail)"></dz-component>
    //
    // SELECTION: clicking a row selects it, and clicking it again unselects it. Opening a parent
    // selects that parent; its name in the header toggles it the same way. Climbing up selects
    // the row just left.
    //
    // ACTIONS: each toolbar icon right of the title has its own switch in the component options —
    // showAdd, showEdit, showMove, showDelete (and showMenu, below). All are off by default.
    // They act on the selection. 'add' adds a child to the selection — which is how an item gets
    // its first child — or, with nothing selected, to the level on screen. Props arrive as
    // copies, so the component never changes the tree — it emits, and the host updates its own
    // `items`. Where the change needs no input, the event carries the finished tree in
    // `detail.items`:
    //   select   a leaf was clicked                   detail: the item
    //   add      { parent, path, order }              parent is where the new item goes, null for
    //                                                  the top level; it may have no children
    //                                                  array yet. order is the next free number
    //                                                  there, or null when that level is A–Z
    //   edit     { item, path }
    //   move     { item, from, to, fromPath, toPath, order, changes, items }
    //                                                  changes: [{ item, order }] for every item
    //                                                  at the destination renumbered (1..n)
    //   delete   { item, path, items }                 confirming is the host's call
    // A `path` is the item's index at each level of `items`, top down.
    //
    // MENU: with showMenu on, `menu` adds a gear icon at the end of the toolbar that opens a
    // dropdown of custom actions — [{ event, label, needsSelection }]. Choosing one emits `event`
    // (so the host listens with @<event>) with { item, path, parent, parentPath }: the selection
    // (null when none) and the parent on screen (null at the top level). needsSelection entries
    // are off until something is selected. Don't reuse the built-in event names above. The
    // dropdown closes on Esc, a click outside, tabbing away or choosing an entry; Up/Down move
    // within it.
    //
    // MOVE MODE: the move icon marks the selection as moving and turns the dividers between rows
    // into drop targets. Navigate to any level — the same one to reorder — and click a divider:
    // the item goes there, and that level is numbered 1..n, since a chosen position needs an
    // order. Dividers that wouldn't change anything are left out, the item itself can't be
    // entered, and Cancel or Esc leaves the mode.
    //
    // LABELS: every visible and screen-reader string can be replaced through `labels`, an object
    // of any of the keys in the `ui` computed below; {name}, {target} and {label} are filled in.
    //   <dz-component dz-type="accordion_list" :labels="{ cancel: 'Annuler', addItem: 'Ajouter' }">
    //
    // SCREEN READERS: selectable rows are toggle buttons (aria-pressed); a selected parent row,
    // which navigates rather than toggles, says "selected" in its name. A polite live region
    // announces entering move mode, cancelling it, and where the item landed. Adds, edits and
    // deletes are applied by the host, so announcing their outcome is the host's job.
    //
    // FOCUS: navigating replaces the clicked button, so focus is moved on purpose — to the
    // current path segment after drilling in, and to the row just left after climbing up.
    // Unavailable tools use aria-disabled rather than disabled, so they keep focus.
    //
    // RUNTIME: every change rebuilds `rows` and `crumbs`, so the keyed :for loops reuse rows for
    // NEW objects. The :if blocks inside them need deezul d494224 or later — older runtimes
    // froze :if blocks in reused keyed rows on the first object they rendered.
    schema: {
        inputs: {
            title:       { type: 'string', default: '', label: 'Title' },
            items:       { type: 'array', default: [], label: 'Items' },
            labelKey:    { type: 'string', default: 'label', label: 'Label field' },
            childrenKey: { type: 'string', default: 'children', label: 'Children field' },
            idKey:       { type: 'string', default: 'id', label: 'Id field' },
            orderKey:    { type: 'string', default: 'order', label: 'Order field' },
            rootLabel:   { type: 'string', default: 'All', label: 'Top level name (screen readers)' },
            emptyText:   { type: 'string', default: 'No items', label: 'Empty level message' },
            showAdd:     { type: 'boolean', default: false, label: 'Show add' },
            showEdit:    { type: 'boolean', default: false, label: 'Show edit' },
            showMove:    { type: 'boolean', default: false, label: 'Show move' },
            showDelete:  { type: 'boolean', default: false, label: 'Show delete' },
            showMenu:    { type: 'boolean', default: false, label: 'Show options menu' },
            menu:        { type: 'array', default: [], label: 'Menu entries ({ event, label, needsSelection })' },
            labels:      { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // :if sits on elements INSIDE the :for rows, never on the :for element (a compile error).
    // The path separators are CSS, so screen readers get the segments, not a string of slashes.
    // Bindings inside an :if never dereference something the :if tests for null: they refresh
    // before the :if removes them (hence statusParts and endGap are never null).
    template: html`
    <div class="acc" ref="root" @keydown="onKeydown">
        <div class="acc-top" :if="title || tools.any">
            <p class="acc-title" :if="title">{{ title }}</p>
            <div class="acc-tools" :if="tools.any && !moveNode" role="group" :aria-label="ui.actionsGroup">
                <button type="button" class="acc-tool" :if="tools.add"
                        :aria-label="tools.addName" :title="tools.addName" @click="add">
                    <span class="acc-icon i-add" aria-hidden="true"></span>
                </button>
                <button type="button" class="acc-tool" :if="tools.edit" :aria-disabled="tools.canAct ? 'false' : 'true'"
                        :aria-label="tools.editName" :title="tools.editName" @click="edit">
                    <span class="acc-icon i-edit" aria-hidden="true"></span>
                </button>
                <button type="button" class="acc-tool is-move" :if="tools.move" :aria-disabled="tools.canAct ? 'false' : 'true'"
                        :aria-label="tools.moveName" :title="tools.moveName" @click="startMove($event)">
                    <span class="acc-icon i-move" aria-hidden="true"></span>
                </button>
                <button type="button" class="acc-tool is-delete" :if="tools.remove" :aria-disabled="tools.canAct ? 'false' : 'true'"
                        :aria-label="tools.removeName" :title="tools.removeName" @click="remove">
                    <span class="acc-icon i-delete" aria-hidden="true"></span>
                </button>
                <div class="acc-menu" :if="tools.menu">
                    <button type="button" class="acc-tool is-gear" :aria-expanded="menuOpen ? 'true' : 'false'"
                            :aria-label="ui.menuButton" :title="ui.menuButton" @click="toggleMenu($event)">
                        <span class="acc-icon i-gear" aria-hidden="true"></span>
                    </button>
                    <ul class="acc-menu-list" :if="menuOpen">
                        <li :for="entry in menuEntries" :key="entry.key">
                            <button type="button" class="acc-menu-item" :aria-disabled="entry.disabled ? 'true' : 'false'"
                                    :title="entry.title" @click="runMenu(entry, $event)">{{ entry.label }}</button>
                        </li>
                    </ul>
                </div>
            </div>
            <div class="acc-tools" :if="moveNode" role="group" :aria-label="ui.moveGroup">
                <button type="button" class="acc-text-btn" @click="cancelMove($event)">{{ ui.cancel }}</button>
            </div>
        </div>
        <p class="acc-status" :if="moveNode">{{ statusParts.before }}<strong>{{ statusParts.value }}</strong>{{ statusParts.after }}</p>
        <nav class="acc-head" :class="(hereSelected ? 'is-selected' : '') + (wrapPath ? ' is-wrapping' : '')"
             :if="trail.length" :aria-label="ui.path">
            <ol class="acc-path">
                <li class="acc-crumb" :for="crumb in crumbs" :key="crumb.key">
                    <button type="button" class="acc-up" :class="crumb.home ? 'is-home' : ''" :if="!crumb.current"
                            :aria-label="crumb.name" :title="crumb.name" @click="goTo(crumb, $event)">
                        <span class="acc-icon acc-home-icon i-home" aria-hidden="true"></span>{{ crumb.label }}
                    </button>
                    <button type="button" class="acc-here" :if="crumb.current" aria-current="location"
                            :aria-pressed="hereSelected ? 'true' : 'false'" @click="selectHere">{{ crumb.label }}</button>
                </li>
            </ol>
        </nav>
        <ul class="acc-list" :class="moveNode ? 'is-placing' : ''">
            <li class="acc-row" :for="row in rows" :key="row.key"
                :class="(row.selected ? 'is-selected' : '') + (row.blocked ? ' is-moving' : '')">
                <button type="button" class="acc-gap" :if="row.gap"
                        :aria-label="row.gapName" :title="row.gapName" @click="drop(row.gapPos, $event)">
                    <span class="acc-gap-text" aria-hidden="true">{{ ui.placeHere }}</span>
                </button>
                <button type="button" class="acc-parent" :if="row.hasChildren" :data-key="row.key"
                        :aria-disabled="row.blocked ? 'true' : 'false'" @click="drill(row, $event)">
                    <span class="acc-label">{{ row.label }}</span>
                    <span class="acc-sr" :if="row.selected">{{ row.selectedText }}</span>
                    <span class="acc-chevron" aria-hidden="true">›</span>
                </button>
                <button type="button" class="acc-leaf" :if="!row.hasChildren" :data-key="row.key"
                        :aria-pressed="row.selected ? 'true' : 'false'" :aria-disabled="moveNode ? 'true' : 'false'"
                        @click="select(row)">
                    <span class="acc-label">{{ row.label }}</span>
                </button>
            </li>
        </ul>
        <div class="acc-end" :if="endGap.show">
            <button type="button" class="acc-gap" :aria-label="endGap.name" :title="endGap.name"
                    @click="drop(endGap.pos, $event)">
                <span class="acc-gap-text" aria-hidden="true">{{ ui.placeHere }}</span>
            </button>
        </div>
        <p class="acc-empty" :if="!rows.length">{{ emptyText }}</p>
        <p class="acc-sr" role="status" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
    </div>
    `,

    data: () => ({
        title: '', items: [], labelKey: 'label', childrenKey: 'children', idKey: 'id', orderKey: 'order',
        rootLabel: 'All', emptyText: 'No items', showAdd: false, showEdit: false, showMove: false, showDelete: false, showMenu: false,
        menu: [], labels: {}, menuOpen: false,
        openPath: [], selectedKey: '', movingPath: null,
        collapsed: 0, wrapPath: false, liveMessage: ''
    }),

    // The path is measured, so it is fitted once mounted, whenever the list's width changes, and
    // after any update that changes the path's text (navigating, or an ancestor renamed). The
    // observer, menu listeners and last-fitted signature live on the root element, outside
    // reactive data. `ref` is safe here only because it sits on the outermost element: an :if
    // before a ref shifts its compile-time path.
    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        root._dzCloseMenu = DzGlobal.closeOnOutside(root, () => this.menuOpen, () => { this.menuOpen = false; });
        if (typeof ResizeObserver !== 'undefined') {
            let width = root.clientWidth;
            root._dzPathObserver = new ResizeObserver(() => {
                if (root.clientWidth === width) return;
                width = root.clientWidth;
                this.fitPath();
            });
            root._dzPathObserver.observe(root);
        }
        this.fitPath();
    },

    $updated() {
        const root = DzGlobal.raw(this.$refs.root);
        if (root && root._dzPathSignature !== this.pathSignature()) this.fitPath();
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        if (root._dzPathObserver) root._dzPathObserver.disconnect();
        if (root._dzCloseMenu) root._dzCloseMenu();
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                actionsGroup: 'Item actions',
                addItem: 'Add item',
                addItemTo: 'Add item to {name}',
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
                movingStatus: 'Moving {name}. Open any level, then pick a spot between items.',
                moveBefore: 'Move {name} before {target}',
                moveToEnd: 'Move {name} to the end',
                moveHere: 'Move {name} here',
                placeHere: 'Place here',
                moveCancelled: 'Move cancelled',
                movedBefore: '{name} moved before {target}',
                movedToEnd: '{name} moved to the end',
                path: 'Path',
                upTo: 'Up to {name}',
                selected: 'selected'
            }, this.labels);
        },

        // The parents drilled through, top down, as resolved nodes. Any child ARRAY keeps a parent
        // open, even an empty one: deleting the last child leaves the view where it is.
        trail() {
            const out = [];
            for (const node of this.walk(this.openPath)) {
                if (!Array.isArray(node.children)) break;
                out.push(node);
            }
            return out;
        },

        // The level on screen, with move-mode dividers (see DzGlobal.placeGaps).
        placement() {
            const trail = this.trail;
            const last = trail[trail.length - 1];
            const nodes = last ? this.nodesOf(last.children, last.key) : this.nodesOf(this.items, '');
            const moving = this.moveNode;
            const name = moving ? moving.node.label : '';
            const ui = this.ui;
            return DzGlobal.placeGaps(nodes, moving ? moving.node.key : null, {
                before: target => DzGlobal.format(ui.moveBefore, { name, target }),
                end: any => DzGlobal.format(any ? ui.moveToEnd : ui.moveHere, { name })
            });
        },

        rows() {
            const selectedKey = this.selectedKey;
            const selectedText = ', ' + this.ui.selected;
            return this.placement.rows.map(row => ({ ...row, selected: row.key === selectedKey, selectedText }));
        },

        // The divider under the last row. Never null, so its bindings survive the move ending.
        endGap() {
            return this.placement.endGap;
        },

        // Path segments for the header: home / ancestors / current parent. The top `collapsed`
        // ancestors (set by fitPath, only while the path overflows) fold into "...", which opens
        // the nearest hidden one. `depth` is how many openPath entries clicking a segment keeps;
        // `name` is its accessible name. Item keys all start with '/', so '~' keys can't collide.
        crumbs() {
            const trail = this.trail;
            const n = trail.length;
            if (!n) return [];
            const hidden = Math.min(this.collapsed, n - 1);
            const out = [{ key: '~home', home: true, label: '', name: this.rootLabel || 'All', depth: 0, current: false }];
            if (hidden) out.push({ key: '~up', home: false, label: '...', depth: hidden, current: false,
                                   name: DzGlobal.format(this.ui.upTo, { name: trail[hidden - 1].label }) });
            for (let i = hidden; i < n - 1; i++) {
                out.push({ key: trail[i].key, home: false, label: trail[i].label, name: trail[i].label, depth: i + 1, current: false });
            }
            out.push({ key: trail[n - 1].key, home: false, label: trail[n - 1].label, name: '', depth: n, current: true });
            return out;
        },

        // The header band is highlighted only while the open parent itself is the selection.
        hereSelected() {
            const trail = this.trail;
            return trail.length > 0 && this.selectedKey === trail[trail.length - 1].key;
        },

        // The selected node and the parents above it. It is either a row on screen or the open
        // parent itself; anything else selects nothing.
        selection() {
            const key = this.selectedKey;
            if (!key) return null;
            const trail = this.trail;
            const last = trail[trail.length - 1];
            const ancestors = last && last.key === key ? trail.slice(0, -1) : trail;
            const parent = ancestors[ancestors.length - 1];
            const node = this.nodesOf(parent ? parent.children : this.items, parent ? parent.key : '')
                             .find(n => n.key === key);
            return node ? { node, ancestors } : null;
        },

        // The item being moved, re-resolved against the current items; null ends move mode.
        moveNode() {
            const keys = this.movingPath;
            if (!keys) return null;
            const nodes = this.walk(keys);
            if (nodes.length !== keys.length) return null;
            return { node: nodes[nodes.length - 1], ancestors: nodes.slice(0, -1) };
        },

        // The move-mode status line, split around the item's name so the name can be bold.
        statusParts() {
            const moving = this.moveNode;
            return DzGlobal.parts(this.ui.movingStatus, 'name', moving ? moving.node.label : '');
        },

        menuEntries() {
            return DzGlobal.menuEntries(this.menu, !!this.selection, this.ui.menuUnavailable);
        },

        // Which tools show, which are available, and their accessible names.
        tools() {
            const ui = this.ui;
            const sel = this.selection;
            const trail = this.trail;
            const here = sel ? sel.node : trail[trail.length - 1];
            const name = sel ? sel.node.label : '';
            const add = !!this.showAdd, edit = !!this.showEdit, move = !!this.showMove, remove = !!this.showDelete;
            const menu = !!this.showMenu && this.menuEntries.length > 0;
            return {
                any: add || edit || move || remove || menu,
                add, edit, move, remove, menu,
                canAct: !!sel,
                addName: here ? DzGlobal.format(ui.addItemTo, { name: here.label }) : ui.addItem,
                editName: sel ? DzGlobal.format(ui.edit, { name }) : ui.editNone,
                moveName: sel ? DzGlobal.format(ui.move, { name }) : ui.moveNone,
                removeName: sel ? DzGlobal.format(ui.remove, { name }) : ui.removeNone
            };
        }
    },

    methods: {
        fields() {
            return {
                labelKey: this.labelKey || 'label', childrenKey: this.childrenKey || 'children',
                idKey: this.idKey || 'id', orderKey: this.orderKey || 'order'
            };
        },

        // One list level as sorted nodes. A key is the parent's key plus this item's id (or
        // '#index' without one), so it is unique across levels and stable for :key. `index` is
        // the position in the unsorted array, for paths.
        nodesOf(list, parentKey) {
            if (!Array.isArray(list)) return [];
            const { labelKey, childrenKey, idKey, orderKey } = this.fields();
            const out = [];
            list.forEach((item, index) => {
                if (item === null || typeof item !== 'object') return;
                const children = item[childrenKey];
                out.push({
                    key: DzGlobal.keyFor(parentKey, item[idKey], index), item, children, index,
                    label: DzGlobal.text(item[labelKey]),
                    order: DzGlobal.orderOf(item, orderKey),
                    hasChildren: Array.isArray(children) && children.length > 0
                });
            });
            return DzGlobal.sortNodes(out);
        },

        // Resolve a list of keys top down; stops at the first key that no longer matches.
        walk(keys) {
            const out = [];
            let list = this.items;
            let parentKey = '';
            for (const key of keys || []) {
                const node = this.nodesOf(list, parentKey).find(n => n.key === key);
                if (!node) break;
                out.push(node);
                list = node.children;
                parentKey = node.key;
            }
            return out;
        },

        // ---- Tree edits. They work on the raw items (never this component's reactive proxies)
        // and copy only the arrays and objects along the path, so the host can take the result.
        tree() {
            return DzGlobal.raw(this.items) || [];
        },

        itemAt(path) {
            const { childrenKey } = this.fields();
            let list = this.tree();
            let item = null;
            for (const index of path) {
                item = Array.isArray(list) ? list[index] : null;
                list = item ? item[childrenKey] : null;
            }
            return item;
        },

        // Replace the child array at `path` (a parent's index path; [] is the top level) with fn(copy).
        updateAt(list, path, fn) {
            if (!path.length) return fn(Array.isArray(list) ? list.slice() : []);
            const { childrenKey } = this.fields();
            const copy = list.slice();
            const [index, ...rest] = path;
            copy[index] = { ...copy[index], [childrenKey]: this.updateAt(copy[index][childrenKey], rest, fn) };
            return copy;
        },

        // What the path shows, as text: fitPath reruns only when this changes.
        pathSignature() {
            return JSON.stringify(this.trail.map(n => [n.key, n.label]));
        },

        // Fit the path on one line: show every ancestor, then fold them into "..." from the top
        // until it fits; if even home / ... / current overflows, let the current name wrap.
        // nextTick is a microtask, so the whole loop runs before the browser paints — no
        // intermediate state is ever seen.
        async fitPath() {
            const root = DzGlobal.raw(this.$refs.root);
            if (!root) return;
            root._dzPathSignature = this.pathSignature();
            this.collapsed = 0;
            this.wrapPath = false;
            await Deezul.nextTick();
            const most = Math.max(0, this.trail.length - 1);
            for (;;) {
                const path = root.querySelector('.acc-path');
                if (!path || path.scrollWidth <= path.clientWidth) return;
                if (this.collapsed >= most) {
                    this.wrapPath = true;
                    return;
                }
                this.collapsed += 1;
                await Deezul.nextTick();
            }
        },

        // ---- Navigation and selection. openPath is rebuilt from `trail`, never mutated, so a
        // stale tail is dropped too.
        drill(row, event) {
            if (row.blocked) return;
            this.openPath = [...this.trail.map(n => n.key), row.key];
            this.selectedKey = row.key;
            DzGlobal.focusIn(event.target.getRootNode(), '.acc-here');
        },

        goTo(crumb, event) {
            const left = this.trail[crumb.depth];
            this.openPath = this.trail.slice(0, crumb.depth).map(n => n.key);
            this.selectedKey = left ? left.key : '';
            if (left) DzGlobal.focusIn(event.target.getRootNode(), '[data-key="' + CSS.escape(left.key) + '"]');
        },

        selectHere() {
            const trail = this.trail;
            if (!trail.length) return;
            const key = trail[trail.length - 1].key;
            this.selectedKey = this.selectedKey === key ? '' : key;
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
            if (this.menuOpen && DzGlobal.menuArrowKeys(event, root, '.acc-menu-item')) return;
            if (event.key === 'Escape' && this.moveNode) this.cancelMove(event);
        },

        toggleMenu(event) {
            this.menuOpen = !this.menuOpen;
            if (this.menuOpen) DzGlobal.focusIn(event.target.getRootNode(), '.acc-menu-item');
        },

        // Emit the entry's own event with the selection and the parent on screen.
        runMenu(entry, event) {
            if (entry.disabled) return;
            const root = event.target.getRootNode();
            const sel = this.selection;
            const path = sel ? [...sel.ancestors.map(n => n.index), sel.node.index] : null;
            const parentPath = this.trail.map(n => n.index);
            this.menuOpen = false;
            this.$emit(entry.event, {
                item: path ? this.itemAt(path) : null, path,
                parent: parentPath.length ? this.itemAt(parentPath) : null, parentPath
            });
            DzGlobal.focusIn(root, '.is-gear');
        },

        // ---- Actions. Each re-checks its availability: aria-disabled buttons still click.
        // Into the selection when there is one, else into the level on screen.
        add() {
            const sel = this.selection;
            const path = sel ? [...sel.ancestors.map(n => n.index), sel.node.index] : this.trail.map(n => n.index);
            const parent = path.length ? this.itemAt(path) : null;
            const list = parent ? parent[this.fields().childrenKey] : this.tree();
            this.$emit('add', { parent, path, order: DzGlobal.nextOrder(list, this.fields().orderKey) });
        },

        edit() {
            const sel = this.selection;
            if (!sel) return;
            const path = [...sel.ancestors.map(n => n.index), sel.node.index];
            this.$emit('edit', { item: this.itemAt(path), path });
        },

        remove() {
            const sel = this.selection;
            if (!sel) return;
            const path = [...sel.ancestors.map(n => n.index), sel.node.index];
            const items = this.updateAt(this.tree(), path.slice(0, -1), list => list.filter((_, i) => i !== sel.node.index));
            this.$emit('delete', { item: this.itemAt(path), path, items });
        },

        // Moving the open parent steps out of it first, so it can't be dropped inside itself.
        startMove(event) {
            const sel = this.selection;
            if (!sel) return;
            this.menuOpen = false;
            const ancestorKeys = sel.ancestors.map(n => n.key);
            this.movingPath = [...ancestorKeys, sel.node.key];
            if (this.trail.some(n => n.key === sel.node.key)) this.openPath = ancestorKeys;
            DzGlobal.announce(this, DzGlobal.format(this.ui.movingStatus, { name: sel.node.label }));
            DzGlobal.focusIn(event.target.getRootNode(), '.acc-gap');
        },

        cancelMove(event) {
            this.movingPath = null;
            DzGlobal.announce(this, this.ui.moveCancelled);
            DzGlobal.focusIn(event.target.getRootNode(), '.is-move');
        },

        // Place the moving item at position `pos` among the other rows on screen, then number
        // that level 1..n. From another level, the item is appended to the destination array
        // first — which shifts no existing index, so the source path still holds for the removal.
        async drop(pos, event) {
            const moving = this.moveNode;
            if (!moving) return;
            const root = event.target.getRootNode();
            const { childrenKey, orderKey, idKey } = this.fields();
            const trail = this.trail;
            const destKey = trail.length ? trail[trail.length - 1].key : '';
            const fromKey = moving.ancestors.length ? moving.ancestors[moving.ancestors.length - 1].key : '';
            const sameLevel = destKey === fromKey;
            const fromPath = [...moving.ancestors.map(n => n.index), moving.node.index];
            const toPath = trail.map(n => n.index);
            const tree = this.tree();
            const item = this.itemAt(fromPath);
            const from = fromPath.length > 1 ? this.itemAt(fromPath.slice(0, -1)) : null;
            const to = toPath.length ? this.itemAt(toPath) : null;
            const destination = (to ? to[childrenKey] : tree) || [];

            const others = this.rows.filter(row => !row.blocked);
            const target = others[pos];
            const newIndex = sameLevel ? moving.node.index : destination.length;
            const sequence = others.map(row => row.index);
            sequence.splice(pos, 0, newIndex);

            let result = null;
            let items;
            if (sameLevel) {
                items = this.updateAt(tree, toPath, list => (result = DzGlobal.renumber(list, sequence, orderKey)).items);
            } else {
                items = this.updateAt(tree, toPath, list => (result = DzGlobal.renumber([...list, item], sequence, orderKey)).items);
                items = this.updateAt(items, fromPath.slice(0, -1), list => list.filter((_, i) => i !== moving.node.index));
            }

            this.movingPath = null;
            this.selectedKey = sameLevel ? moving.node.key : DzGlobal.keyFor(destKey, item[idKey], newIndex);
            this.$emit('move', { item, from, to, fromPath, toPath, order: result.rank.get(newIndex), changes: result.changes, items });
            DzGlobal.announce(this, target
                ? DzGlobal.format(this.ui.movedBefore, { name: moving.node.label, target: target.label })
                : DzGlobal.format(this.ui.movedToEnd, { name: moving.node.label }));
            if (!(await DzGlobal.focusIn(root, '[data-key="' + CSS.escape(this.selectedKey) + '"]'))) DzGlobal.focusIn(root, '.is-move');
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .acc { font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        /* Screen-reader-only text: the live region and a selected parent's "selected". */
        .acc-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
                  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }

        /* ---- Title bar: dark, with the toolbar. Contrast on the default #1f2330 (WCAG AA — 4.5:1
           text, 3:1 icons and focus rings), and on the 12% white hover (#3a3d49):
             title          #fff     15.7:1
             icons          #c7c8ff   9.8:1 / 6.8:1   (also the focus ring)
             delete icon    #ffa3b1   8.3:1 / 5.7:1
           Unavailable icons are dimmed on purpose; WCAG exempts disabled controls. A host can
           override the --acc-bar-* colors; keep those ratios if it does.
           The title keeps its natural width (no min-width: 0, or the text runs under the icons), so
           when both don't fit the toolbar wraps onto its own line, still pushed right. */
        .acc { --acc-bar-bg: var(--dz-color-heading, #1f2330); --acc-bar-fg: #ffffff; --acc-bar-icon: #c7c8ff;
               --acc-bar-danger: #ffa3b1; --acc-bar-muted: #a9adbb; }
        /* No bottom margin: the path header (or the list) sits flush under the bar. */
        .acc-top { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem .75rem; margin: 0;
                   padding: .35rem .5rem .35rem .75rem; background: var(--acc-bar-bg); color: var(--acc-bar-fg); }
        .acc-title { flex: 1 1 auto; margin: 0; padding: .45rem 0; font-family: var(--dz-font-heading, inherit);
                     font-size: 1.05rem; font-weight: 700; color: var(--acc-bar-fg); }

        /* ---- Toolbar. Icons are masks over currentColor, so they take the button's color. The
           shapes come from the --dz-icon-* custom properties in assets/icons.css. */
        .acc-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .15rem; margin-left: auto; }
        .acc-tool { display: inline-flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem;
                    padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
                    color: var(--acc-bar-icon); }
        .acc-tool:hover { background: rgba(255, 255, 255, .12); }
        .acc-tool.is-delete { color: var(--acc-bar-danger); }
        .acc-tool[aria-disabled="true"] { color: var(--acc-bar-muted); opacity: .5; cursor: not-allowed; background: transparent; }
        .acc-tool:focus-visible, .acc-text-btn:focus-visible { outline: 2px solid var(--acc-bar-icon); outline-offset: 1px; }

        .acc-icon { display: block; width: 1.5rem; height: 1.5rem; background: currentColor;
                    -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-add    { --icon: var(--dz-icon-add); }
        .i-edit   { --icon: var(--dz-icon-edit); }
        .i-move   { --icon: var(--dz-icon-move); }
        .i-delete { --icon: var(--dz-icon-delete); }
        .i-home   { --icon: var(--dz-icon-home); }
        .i-gear   { --icon: var(--dz-icon-settings); }

        /* The dropdown: a light panel under the gear, right-aligned to it. Entries are dark text on
           white (13:1); off entries use the muted grey, which WCAG exempts as disabled. */
        .acc-menu { position: relative; }
        .acc-menu-list { position: absolute; right: 0; top: calc(100% + 4px); z-index: 10; min-width: 11rem;
                         margin: 0; padding: .25rem 0; list-style: none; background: var(--dz-color-surface, #fff);
                         border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 6px;
                         box-shadow: 0 8px 24px rgba(0, 0, 0, .18); }
        .acc-menu-item { display: block; width: 100%; padding: .55rem .9rem; border: 0; background: none; font: inherit;
                         font-size: .9rem; text-align: left; white-space: nowrap; cursor: pointer;
                         color: var(--dz-color-text, #2b2f3a); }
        .acc-menu-item:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, var(--dz-color-surface, #fff)); }
        .acc-menu-item:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -2px; }
        .acc-menu-item[aria-disabled="true"] { color: var(--dz-color-muted, #6b7180); background: none; cursor: not-allowed; }

        .acc-text-btn { padding: .3rem .7rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 6px;
                        background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem; font-weight: 600;
                        color: var(--dz-color-heading, #1f2330); cursor: pointer; }

        .acc-status { margin: .5rem 0; padding: .45rem .75rem; border: 1px dashed var(--dz-color-primary, #5b5ef0);
                      border-radius: 6px; font-size: .875rem; color: var(--dz-color-text, #2b2f3a);
                      background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 6%, var(--dz-color-surface, #fff)); }

        /* ---- The open parent: a band carrying the path. While the parent itself is selected the
           band is tinted with a primary line under it; once a child is selected it goes neutral.
           Links use a darker indigo than primary, which is only 4.2:1 on the tint — #4a4dd6 is
           5.4:1 there and 5.9:1 on the neutral band (WCAG AA text needs 4.5:1). */
        .acc { --acc-head-link: #4a4dd6; }
        .acc-head { padding: .45rem .75rem; background: var(--dz-color-bg, #f7f7fb);
                    border-bottom: 2px solid var(--dz-color-border, #e4e6ee); }
        .acc-head.is-selected { border-bottom-color: var(--dz-color-primary, #5b5ef0);
            background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 12%, var(--dz-color-surface, #fff)); }
        /* One line, segments at their natural width, so an overflow shows up as scrollWidth >
           clientWidth for fitPath to measure. The 4px padding (cancelled by the margin) keeps
           focus rings inside the clipped box. Once fully folded and still too long, it wraps. */
        .acc-path { display: flex; flex-wrap: nowrap; align-items: center; list-style: none; margin: -4px;
                    padding: 4px; overflow: hidden; }
        .acc-crumb { display: inline-flex; align-items: center; flex: none; white-space: nowrap; }
        /* The current parent takes the rest of the line, so all of it selects the parent. It grows
           but never shrinks below its text, which keeps the overflow measurement honest. */
        .acc-crumb:last-child { flex: 1 0 auto; }
        .is-wrapping .acc-path { flex-wrap: wrap; overflow: visible; }
        .is-wrapping .acc-crumb { flex: 0 1 auto; min-width: 0; white-space: normal; }
        .is-wrapping .acc-crumb:last-child { flex: 1 1 auto; }
        /* After a segment rather than before the next, so a wrapped path never starts a line with "/". */
        .acc-crumb:not(:last-child)::after { content: "/"; content: "/" / ""; margin: 0 .45rem;
                                             color: var(--dz-color-muted, #6b7180); }
        /* Home, "..." and ancestors hover like the current parent: the same light tint. The
           padding gives the tint room; the matching negative margin on every side keeps each
           segment where it was, the header's height unchanged (the 24px home icon would otherwise
           grow it), and the tint clear of the "/" separators. */
        .acc-up { display: inline-flex; align-items: center; margin: -.25rem; padding: .25rem; border: 0;
                  background: none; font: inherit; cursor: pointer; color: var(--acc-head-link); text-align: left;
                  overflow-wrap: anywhere; }
        .acc-up:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, transparent); }
        .acc-home-icon { display: none; width: 1.5rem; height: 1.5rem; }
        .acc-up.is-home .acc-home-icon { display: block; }
        /* The padding (with the header's reduced padding) gives it a row-like hit area; the
           negative margin lines its text up where it sat before. Hover matches the rows: a light
           tint and link-colored text (#4a4dd6 over the tinted band is still 4.8:1). */
        .acc-here { flex: 1; margin-left: -.3rem; padding: .25rem .45rem .25rem .3rem; border: 0; background: none;
                    font: inherit; font-weight: 700; color: var(--dz-color-heading, #1f2330); text-align: left;
                    cursor: pointer; overflow-wrap: anywhere; }
        .acc-here:hover { color: var(--acc-head-link);
                          background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, transparent); }
        /* Inside the box, so a ring never crosses a "/" separator. */
        .acc-up:focus-visible, .acc-here:focus-visible { outline: 2px solid var(--acc-head-link); outline-offset: -2px; }
        .acc-here:focus:not(:focus-visible) { outline: none; }

        /* ---- Rows. Under the header its own bottom border already separates the list. */
        .acc-list { list-style: none; margin: 0; padding: 0;
                    border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .acc-head + .acc-list, .acc-top + .acc-list { border-top: 0; }
        .acc-row { position: relative; border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }

        .acc-parent, .acc-leaf { display: flex; align-items: center; gap: .6rem; width: 100%;
                                 padding: .6rem .75rem; border: 0; background: transparent;
                                 font: inherit; color: inherit; text-align: left; cursor: pointer; }
        .acc-parent { font-weight: 600; color: var(--dz-color-heading, #1f2330); }
        .acc-parent:hover, .acc-leaf:hover { background: var(--dz-color-bg, #f7f7fb); }
        .acc-parent:hover .acc-label, .acc-leaf:hover .acc-label { color: var(--dz-color-primary, #5b5ef0); }
        .acc-parent:focus-visible, .acc-leaf:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0);
                                                             outline-offset: -2px; }
        .acc-row.is-selected > button:not(.acc-gap) { box-shadow: inset 3px 0 0 var(--dz-color-primary, #5b5ef0);
            background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 7%, var(--dz-color-surface, #fff)); }
        .acc-row.is-moving > button { opacity: .55; font-style: italic; cursor: not-allowed;
                                      outline: 1px dashed var(--dz-color-primary, #5b5ef0); outline-offset: -3px; }
        .is-placing .acc-leaf { cursor: default; }

        .acc-empty { margin: 0; padding: .9rem .75rem; color: var(--dz-color-muted, #6b7180); font-style: italic;
                     border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }

        .acc-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .acc-chevron { flex: none; font-size: 1.25rem; line-height: 1; color: var(--dz-color-primary, #5b5ef0); }

        /* ---- Drop targets (move mode). Each is a 14px band centred on the divider above its row
           (or under the last row), laid over the rows so the layout doesn't move. A faint line
           shows every spot; hover or focus draws it solid, with a dot at the start. */
        .acc-end { position: relative; }
        .acc-gap { position: absolute; left: 0; right: 0; top: -8px; z-index: 1; height: 14px; padding: 0; border: 0;
                   background: transparent; cursor: pointer; }
        .acc-gap::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px;
                           border-radius: 2px; background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 30%, transparent); }
        .acc-gap::after { content: ""; position: absolute; left: 0; top: 50%; width: 10px; height: 10px; margin-top: -5px;
                          box-sizing: border-box; border: 2px solid var(--dz-color-primary, #5b5ef0); border-radius: 50%;
                          background: var(--dz-color-surface, #fff); opacity: 0; }
        .acc-gap:hover::before, .acc-gap:focus-visible::before { height: 3px; margin-top: -1.5px; background: var(--dz-color-primary, #5b5ef0); }
        .acc-gap:hover::after, .acc-gap:focus-visible::after { opacity: 1; }
        .acc-gap:focus { outline: none; }
        .acc-gap-text { display: none; }

        /* Touch screens have no hover and fingers need ~44px, so the bands become visible
           "Place here" slots that take up space between the rows instead of overlaying them. The
           text is a real (aria-hidden) element so the placeHere label can change it. */
        @media (pointer: coarse) {
            .acc-gap { position: relative; top: auto; display: block; width: 100%; height: 2.75rem; }
            .acc-end .acc-gap { border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
            .acc-gap::before, .acc-gap:hover::before, .acc-gap:focus-visible::before {
                inset: .35rem .5rem; height: auto; margin: 0; border: 1.5px dashed var(--dz-color-primary, #5b5ef0);
                border-radius: 6px; background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 6%, transparent); }
            .acc-gap:active::before { border-style: solid;
                background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 18%, transparent); }
            .acc-gap::after, .acc-gap:hover::after, .acc-gap:focus-visible::after { display: none; }
            .acc-gap-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                            font: inherit; font-size: .8rem; font-weight: 600; color: var(--dz-color-primary, #5b5ef0); }
            .acc-gap:focus-visible::before { border-style: solid; border-width: 2px; }
        }
    `
});
