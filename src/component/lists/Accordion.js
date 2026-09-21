export default Deezul.Component({
    // Accordion — a read-only, multi-level text accordion for static content (FAQs, outlines,
    // policies). Each section expands and collapses in place, indented under its parent, and
    // sections open independently: any number can be open at once. No selection, no editing —
    // for browsing and editing a tree, use AccordionList.
    //
    // DATA: `items` is an array of objects of ANY shape. These props say which fields to read:
    //   labelKey    (default 'label')     the section heading
    //   contentKey  (default 'content')   plain-text body shown when the section is open. Line
    //                                     breaks are kept; markup is shown as text, never rendered.
    //   childrenKey (default 'children')  nested sections, shown (indented) under the body
    //   idKey       (default 'id')        a stable identity; falls back to the item's position
    // An item with a body or children is a section with a +/− button; one with neither is a
    // plain line of text.
    //
    //   <dz-component dz-type="accordion" :title="'FAQ'" :items="faq" :headingLevel="2"></dz-component>
    //
    // OPTIONS:
    //   title          a heading above the list (blank = none)
    //   headingLevel   the title's heading level (default 2). Sections start one level below it —
    //                  or at it, with no title — and each nesting depth adds one. Set it to fit the
    //                  page's own heading outline. Levels stop at 6 (the deepest level screen
    //                  readers reliably announce): sections nested deeper all report level 6.
    //   openAll        start with every section open (default false)
    //   showExpandAll  show "Expand all" / "Collapse all" buttons by the title (default false)
    //   emptyText      shown when there are no items (default 'Nothing here yet')
    //   labels         text overrides: { expandAll, collapseAll, allExpanded, allCollapsed }
    //                  (the last two are announced to screen readers). Needs window.DzGlobal.
    //
    // SCREEN READERS (the WAI-ARIA accordion pattern): each section heading is a heading
    // (role="heading" + aria-level) containing a button with aria-expanded and aria-controls
    // pointing at its body. Nesting is carried by the heading levels — "heading level 3,
    // Permits, button, collapsed", then "heading level 4, Sign permit" — so it is announced
    // and navigable by heading, not only shown by indentation. There is deliberately no list
    // markup: a flat list of rows would announce bodies as list items and hide the nesting.
    // Bodies stay in the DOM while closed (display: none keeps them out of the accessibility
    // tree), so every aria-controls points at a real element. Body panels have no region role:
    // one landmark per section would swamp landmark navigation.
    //
    // HOW: the tree is flattened into the rows currently in the DOM (`rows`) — section headings,
    // their body panels and plain lines, each tagged with its depth — and one keyed :for draws
    // them. Open state is `baseOpen` (all open or all closed) plus the keys toggled away from it,
    // so "Expand all" and "Collapse all" are one assignment each. A toggled section keeps its
    // key, so its button is reused in place and keeps focus.
    //
    // RUNTIME: rows are rebuilt on every toggle, so the :if blocks inside keyed rows need
    // deezul d494224 or later.
    schema: {
        inputs: {
            title:         { type: 'string', default: '', label: 'Title' },
            items:         { type: 'array', default: [], label: 'Items' },
            labelKey:      { type: 'string', default: 'label', label: 'Heading field' },
            contentKey:    { type: 'string', default: 'content', label: 'Body field' },
            childrenKey:   { type: 'string', default: 'children', label: 'Children field' },
            idKey:         { type: 'string', default: 'id', label: 'Id field' },
            headingLevel:  { type: 'number', default: 2, label: 'Title heading level' },
            openAll:       { type: 'boolean', default: false, label: 'Start fully open' },
            showExpandAll: { type: 'boolean', default: false, label: 'Show expand / collapse all' },
            emptyText:     { type: 'string', default: 'Nothing here yet', label: 'Empty message' },
            labels:        { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // :if sits on elements INSIDE the :for rows, never on the :for element (a compile error).
    // Attributes that must not be empty (aria-expanded, aria-controls, id) are only bound on the
    // elements that always have a value — a null would render as the text "null".
    template: html`
    <div class="ac">
        <div class="ac-top" :if="title || showExpandAll">
            <p class="ac-title" :if="title" role="heading" :aria-level="titleLevel">{{ title }}</p>
            <div class="ac-controls" :if="showExpandAll">
                <button type="button" class="ac-ctl" @click="expandAll">{{ ui.expandAll }}</button>
                <button type="button" class="ac-ctl" @click="collapseAll">{{ ui.collapseAll }}</button>
            </div>
        </div>
        <div class="ac-list">
            <div class="ac-row" :for="row in rows" :key="row.key" :style="'--depth:' + row.depth"
                 :class="'is-' + row.type + (row.open ? ' is-open' : '') + (row.hidden ? ' is-hidden' : '')">
                <div class="ac-heading" :if="row.type === 'section'" role="heading" :aria-level="row.level">
                    <button type="button" class="ac-toggle" :id="row.buttonId" :aria-controls="row.panelId"
                            :aria-expanded="row.open ? 'true' : 'false'" @click="toggle(row)">
                        <span class="ac-sign" aria-hidden="true">{{ row.open ? '−' : '+' }}</span>
                        <span class="ac-label">{{ row.label }}</span>
                    </button>
                </div>
                <p class="ac-text" :if="row.type === 'text'">{{ row.label }}</p>
                <div class="ac-body" :if="row.type === 'body'" :id="row.panelId">{{ row.text }}</div>
            </div>
        </div>
        <p class="ac-empty" :if="isEmpty">{{ emptyText }}</p>
        <p class="ac-sr" role="status" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
    </div>
    `,

    data: () => ({
        title: '', items: [], labelKey: 'label', contentKey: 'content', childrenKey: 'children', idKey: 'id',
        headingLevel: 2, openAll: false, showExpandAll: false, emptyText: 'Nothing here yet',
        labels: {}, baseOpen: null, toggled: [], liveMessage: ''
    }),

    computed: {
        // Strings the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                expandAll: 'Expand all',
                collapseAll: 'Collapse all',
                allExpanded: 'All sections expanded',
                allCollapsed: 'All sections collapsed'
            }, this.labels);
        },

        titleLevel() {
            const level = Math.round(Number(this.headingLevel));
            return level >= 1 ? Math.min(level, 6) : 2;
        },

        // The rows in the DOM, top to bottom. Every section is followed by its body panel (hidden
        // while closed or when it has no text), so aria-controls always has a target; an open
        // section's children follow the panel. A key is the parent's key plus this item's id (or
        // '#index' without one) — unique across levels and stable for :key. Element ids are the
        // key with anything outside [A-Za-z0-9_-] encoded, so data ids with spaces stay valid.
        rows() {
            const labelKey = this.labelKey || 'label';
            const contentKey = this.contentKey || 'content';
            const childrenKey = this.childrenKey || 'children';
            const idKey = this.idKey || 'id';
            const base = this.baseOpen === null ? !!this.openAll : this.baseOpen;
            const toggled = new Set(this.toggled);
            const firstLevel = this.title ? this.titleLevel + 1 : this.titleLevel;
            const out = [];

            const walk = (list, depth, parentKey) => {
                if (!Array.isArray(list)) return;
                list.forEach((item, index) => {
                    if (item === null || typeof item !== 'object') return;
                    const id = item[idKey];
                    const key = parentKey + '/' + (id === undefined || id === null || id === '' ? '#' + index : id);
                    const uid = 'ac' + key.replace(/[^A-Za-z0-9_-]/g, ch => '_' + ch.charCodeAt(0));
                    const label = item[labelKey];
                    const rawContent = item[contentKey];
                    const content = rawContent === undefined || rawContent === null ? '' : String(rawContent);
                    const children = item[childrenKey];
                    const hasChildren = Array.isArray(children) && children.length > 0;
                    const expandable = content !== '' || hasChildren;
                    const open = expandable && base !== toggled.has(key);
                    const common = { depth, buttonId: uid + '-h', panelId: uid + '-p', level: Math.min(firstLevel + depth, 6) };
                    out.push({ ...common, key, type: expandable ? 'section' : 'text', open, hidden: false, text: '',
                               label: label === undefined || label === null ? '' : String(label) });
                    if (!expandable) return;
                    out.push({ ...common, key: key + '::panel', depth: depth + 1, type: 'body', open: false, label: '',
                               text: content, hidden: !open || content === '' });
                    if (open && hasChildren) walk(children, depth + 1, key);
                });
            };

            walk(this.items, 0, '');
            return out;
        },

        isEmpty() {
            return !Array.isArray(this.items) || !this.items.some(item => item !== null && typeof item === 'object');
        }
    },

    methods: {
        // Reassigned, never mutated, so `rows` is invalidated.
        toggle(row) {
            this.toggled = this.toggled.includes(row.key)
                ? this.toggled.filter(key => key !== row.key)
                : [...this.toggled, row.key];
        },

        // Both keep focus on their own button (it isn't re-rendered) and say what happened.
        expandAll() {
            this.baseOpen = true;
            this.toggled = [];
            DzGlobal.announce(this, this.ui.allExpanded);
        },

        collapseAll() {
            this.baseOpen = false;
            this.toggled = [];
            DzGlobal.announce(this, this.ui.allCollapsed);
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .ac { font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        /* Screen-reader-only text: the live region. */
        .ac-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
                 overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
        .ac-top { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem .75rem; margin: 0 0 .5rem; }
        .ac-title { flex: 1 1 auto; margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.05rem;
                    font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .ac-controls { display: flex; gap: .25rem; margin-left: auto; }
        .ac-ctl { padding: .3rem .6rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 6px;
                  background: var(--dz-color-surface, #fff); font: inherit; font-size: .8125rem; font-weight: 600;
                  color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .ac-ctl:hover { background: var(--dz-color-bg, #f7f7fb); }

        .ac-list { border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .ac-row { padding-left: calc(var(--depth, 0) * 1.25rem); border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
        /* display: none also removes a closed body from the accessibility tree. */
        .ac-row.is-hidden { display: none; }
        /* A visible body belongs to the heading above it: no divider between them. */
        .ac-row.is-open:has(+ .is-body:not(.is-hidden)) { border-bottom-color: transparent; }

        .ac-heading { margin: 0; }
        .ac-toggle { display: flex; align-items: center; gap: .6rem; width: 100%; padding: .6rem .5rem; border: 0;
                     background: transparent; font: inherit; font-weight: 600; text-align: left; cursor: pointer;
                     color: var(--dz-color-heading, #1f2330); }
        .ac-toggle:hover { background: var(--dz-color-bg, #f7f7fb); }
        .ac-toggle:hover .ac-label { color: var(--dz-color-primary, #5b5ef0); }
        .ac-toggle:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -2px; }
        .ac-ctl:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px; }

        /* border-box: the 1.35rem the text and body padding reserves must include the borders. */
        .ac-sign { flex: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
                   width: 1.35rem; height: 1.35rem; line-height: 1; font-weight: 700;
                   border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 4px;
                   background: var(--dz-color-surface, #fff); color: var(--dz-color-primary, #5b5ef0); }
        .is-open > .ac-heading .ac-sign { background: var(--dz-color-primary, #5b5ef0);
                                          border-color: var(--dz-color-primary, #5b5ef0); color: #fff; }
        .ac-label { min-width: 0; overflow-wrap: anywhere; }

        /* Plain lines and bodies line up with the section labels, past the sign. */
        .ac-text { display: block; margin: 0; padding: .6rem .5rem .6rem calc(.5rem + 1.35rem + .6rem); overflow-wrap: anywhere; }
        .ac-body { margin: 0; padding: .1rem .75rem .8rem calc(.5rem + 1.35rem + .6rem - 1.25rem);
                   line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; color: var(--dz-color-text, #2b2f3a); }

        .ac-empty { margin: 0; padding: .9rem .5rem; color: var(--dz-color-muted, #6b7180); font-style: italic;
                    border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
    `
});
