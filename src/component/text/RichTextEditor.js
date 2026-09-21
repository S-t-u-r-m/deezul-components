export default Deezul.Component({
    // RichTextEditor — imported from the Deezul CMS (app/src/component/RichTextEditor.js).
    // Changes from the CMS copy, kept small so the two stay easy to compare:
    //   - the link and table dialogs use this library's modal_dialog instead of the CMS modal
    //   - `html` is an input, so a page can hand in saved content to edit
    //   - the editing surface and the hidden color input have names for screen readers
    //
    //   <dz-component dz-type="rich_text_editor" :html="article.body" @change="save"></dz-component>
    //
    // CONTENT is uncontrolled: `html` seeds the surface once, on mount. Every edit emits
    // `change` with the new HTML ('' when empty). The HTML uses the dz-* classes (alignment,
    // fonts, sizes, colors, tables, indents, list markers); show it with rich_text, which has
    // the same rules.
    schema: {
        inputs: {
            html:        { type: 'text', default: '', label: 'Content (HTML)' },
            placeholder: { type: 'string', default: 'Start writing…', label: 'Placeholder' }
        },
        slots: {}
    },

    // The editable surface (.rte-surface) carries NO reactive binding on purpose:
    // Deezul writes {{ }} via textContent, which would wipe the caret on every
    // keystroke. We seed it once in $mounted and read *out* of it via @input.
    // The toolbar IS reactive — it lives outside the editable subtree, so
    // re-rendering its active states never disturbs the selection. The block and
    // list <select>s are reflected imperatively via refs (a native <select>'s
    // shown value is a property, not a reactive attribute).
    template: `
        <div class="rte">
            <div class="rte-toolbar" role="toolbar" aria-label="Text formatting">
                <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="undo()" title="Undo">
                    <svg width="16" height="16"><path d="M6 5 L3 8 L6 11 M3 8 H10 a3.2 3.2 0 0 1 0 6 H7.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="redo()" title="Redo">
                    <svg width="16" height="16"><path d="M10 5 L13 8 L10 11 M13 8 H6 a3.2 3.2 0 0 0 0 6 H8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <span class="rte-sep"></span>
                <button type="button" class="rte-btn" :class="active.bold ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="cmd('bold')" title="Bold"><b>B</b></button>
                <button type="button" class="rte-btn" :class="active.italic ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="cmd('italic')" title="Italic"><i>I</i></button>
                <button type="button" class="rte-btn" :class="active.underline ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="cmd('underline')" title="Underline"><u>U</u></button>
                <button type="button" class="rte-btn" :class="active.sup ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="cmd('superscript')" title="Superscript">x<sup>2</sup></button>
                <button type="button" class="rte-btn" :class="active.sub ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="cmd('subscript')" title="Subscript">x<sub>2</sub></button>
                <button type="button" class="rte-btn rte-icon" :class="active.link ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="openLink()" title="Link">
                    <svg width="16" height="16"><path d="M6.5 9.5l3-3M7 5.5l.8-.8a2.4 2.4 0 0 1 3.4 3.4l-.8.8M9 10.5l-.8.8a2.4 2.4 0 0 1-3.4-3.4l.8-.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                </button>
                <button type="button" class="rte-btn rte-color-btn" @mousedown="hold($event)" @click="openColor('fg')" title="Text color">
                    A<span class="rte-color-bar" style="background:#c0455b"></span>
                </button>
                <button type="button" class="rte-btn rte-color-btn" @mousedown="hold($event)" @click="openColor('bg')" title="Highlight">
                    <span class="rte-hl">H</span><span class="rte-color-bar" style="background:#fff3a3"></span>
                </button>
                <span class="rte-sep"></span>
                <select class="rte-select" ref="blockSelect" @change="onBlockChange($event)" title="Text style" aria-label="Text style">
                    <option value="p">Paragraph</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                    <option value="h4">Heading 4</option>
                    <option value="h5">Heading 5</option>
                    <option value="h6">Heading 6</option>
                </select>
                <select class="rte-select" ref="listSelect" @change="onListChange($event)" title="List style" aria-label="List style">
                    <option value="">No list</option>
                    <option value="ul:disc">Bulleted •</option>
                    <option value="ul:circle">Circle ◦</option>
                    <option value="ul:square">Square ▪</option>
                    <option value="ol:decimal">Numbered 1.</option>
                    <option value="ol:lower-alpha">Letters a.</option>
                    <option value="ol:upper-alpha">Letters A.</option>
                    <option value="ol:lower-roman">Roman i.</option>
                    <option value="ol:upper-roman">Roman I.</option>
                </select>
                <select class="rte-select" ref="fontSelect" @mousedown="saveInlineSel()" @change="onFontChange($event)" title="Font" aria-label="Font">
                    <option value="">Default font</option>
                    <option value="sans">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="mono">Mono</option>
                </select>
                <select class="rte-select" ref="sizeSelect" @mousedown="saveInlineSel()" @change="onSizeChange($event)" title="Font size" aria-label="Font size">
                    <option value="">Normal</option>
                    <option value="sm">Small</option>
                    <option value="lg">Large</option>
                    <option value="xl">Huge</option>
                </select>
                <span class="rte-sep"></span>
                <button type="button" class="rte-btn rte-icon" :class="active.align === 'left' ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="align('left')" title="Align left">
                    <svg width="16" height="16"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="12" y2="12"/></svg>
                </button>
                <button type="button" class="rte-btn rte-icon" :class="active.align === 'center' ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="align('center')" title="Align center">
                    <svg width="16" height="16"><line x1="2" y1="4" x2="14" y2="4"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/></svg>
                </button>
                <button type="button" class="rte-btn rte-icon" :class="active.align === 'right' ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="align('right')" title="Align right">
                    <svg width="16" height="16"><line x1="2" y1="4" x2="14" y2="4"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="4" y1="12" x2="14" y2="12"/></svg>
                </button>
                <button type="button" class="rte-btn rte-icon" :class="active.align === 'justify' ? 'is-active' : ''"
                        @mousedown="hold($event)" @click="align('justify')" title="Justify">
                    <svg width="16" height="16"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>
                </button>
                <span class="rte-sep"></span>
                <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="indent(-1)" title="Outdent">
                    <svg width="16" height="16"><line x1="6" y1="3" x2="14" y2="3"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="6" y1="13" x2="14" y2="13"/><path d="M5 5 L2 8 L5 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="indent(1)" title="Indent">
                    <svg width="16" height="16"><line x1="2" y1="3" x2="10" y2="3"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="13" x2="10" y2="13"/><path d="M11 5 L14 8 L11 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <span class="rte-sep"></span>
                <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="openTable()" title="Insert table">
                    <svg width="16" height="16"><rect x="2" y="3" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="6.5" y1="3" x2="6.5" y2="13"/><line x1="10.5" y1="3" x2="10.5" y2="13"/></svg>
                </button>
                <span class="rte-tabletools" :class="inTable ? 'open' : ''">
                    <span class="rte-tabletools-label">Table</span>
                    <button type="button" class="rte-btn rte-tbtn" @mousedown="hold($event)" @click="insertRowBelow()" title="Insert row below">+Row</button>
                    <button type="button" class="rte-btn rte-tbtn" @mousedown="hold($event)" @click="insertColRight()" title="Insert column right">+Col</button>
                    <button type="button" class="rte-btn rte-tbtn" @mousedown="hold($event)" @click="deleteRow()" title="Delete row">−Row</button>
                    <button type="button" class="rte-btn rte-tbtn" @mousedown="hold($event)" @click="deleteCol()" title="Delete column">−Col</button>
                    <button type="button" class="rte-btn rte-tbtn" @mousedown="hold($event)" @click="deleteTable()" title="Delete table">Del&nbsp;tbl</button>
                    <span class="rte-sep"></span>
                    <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="valign('top')" title="Align top">
                        <svg width="16" height="16"><rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="4" width="6" height="2.4" fill="currentColor"/></svg>
                    </button>
                    <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="valign('middle')" title="Align middle">
                        <svg width="16" height="16"><rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="6.8" width="6" height="2.4" fill="currentColor"/></svg>
                    </button>
                    <button type="button" class="rte-btn rte-icon" @mousedown="hold($event)" @click="valign('bottom')" title="Align bottom">
                        <svg width="16" height="16"><rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="9.6" width="6" height="2.4" fill="currentColor"/></svg>
                    </button>
                    <span class="rte-sep"></span>
                    <button type="button" class="rte-btn rte-icon" :class="tableFluid ? 'is-active' : ''"
                            @mousedown="hold($event)" @click="toggleTableFluid()"
                            :title="tableFluid ? 'Responsive width — columns fill a ratio of the space (click to lock fixed widths)' : 'Fixed pixel widths (click to make responsive)'">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="14" y2="8"/><path d="M5 5 L2 8 L5 11"/><path d="M11 5 L14 8 L11 11"/></svg>
                    </button>
                </span>

                <div class="rte-color-pop" :class="colorOpen ? 'open' : ''">
                    <div class="rte-color-head">
                        <span>{{ colorOpen === 'bg' ? 'Highlight' : 'Text color' }}</span>
                        <button type="button" class="rte-color-x" @click="closeColor()" title="Cancel">&times;</button>
                    </div>
                    <div class="rte-swatches">
                        <button type="button" class="rte-swatch" :for="c in swatches"
                                @mousedown="hold($event)" @click="pickSwatch(c.name)"
                                :style="'background:' + c.hex" :title="c.name"></button>
                    </div>
                    <div class="rte-color-tools">
                        <button type="button" class="rte-swatch" @mousedown="hold($event)" @click="applyCustomColor()" :style="'background:' + customColor" title="Apply custom color"></button>
                        <span class="rte-tools-sep"></span>
                        <button type="button" class="rte-swatch rte-wheel" @mousedown="hold($event)" @click="openCustom()" title="Pick custom color"></button>
                        <button type="button" class="rte-swatch rte-none" @mousedown="hold($event)" @click="clearColor()" title="Remove color"></button>
                        <input type="color" class="rte-hidden-color" ref="customInput" tabindex="-1" aria-label="Custom color" @change="onCustomPicked($event)" />
                    </div>
                </div>
            </div>

            <div class="rte-surface" ref="editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Rich text"
                 @input="onInput" @focus="onFocus" @blur="onBlur" @keydown="onKeydown($event)"
                 @mousemove="onEditorMove($event)" @mousedown="onEditorDown($event)"></div>

            <dz-component dz-type="modal_dialog" :size="'small'" :open="linkOpen"
                          :title="linkEditing ? 'Edit link' : 'Insert link'" @close="closeLink">
                <div class="rte-link-form">
                    <label class="rte-field-label">Text</label>
                    <input type="text" class="rte-field" :bind="linkText" placeholder="Visible text" />
                    <label class="rte-field-label">URL</label>
                    <input type="text" class="rte-field" :bind="linkUrl" placeholder="https://example.com" />
                    <button type="button" class="rte-toggle" :class="linkNewTab ? 'is-on' : ''" @click="linkNewTab = !linkNewTab">
                        <span class="dot"></span> Open in new tab
                    </button>
                    <div class="rte-dialog-actions">
                        <button type="button" :if="linkEditing" class="rte-danger" @click="removeLink()">Remove</button>
                        <span class="rte-spacer"></span>
                        <button type="button" @click="closeLink()">Cancel</button>
                        <button type="button" class="rte-primary" @click="applyLink()">{{ linkEditing ? 'Save' : 'Insert' }}</button>
                    </div>
                </div>
            </dz-component>

            <dz-component dz-type="modal_dialog" :size="'small'" :open="tableOpen" :title="'Insert table'" @close="closeTable">
                <div class="rte-tablepick">
                    <div :class="tableAdvanced ? 'rte-hide' : ''">
                        <div class="rte-pick-row">
                            <div class="rte-grid" @mousemove="gridHover($event)" @click="gridClick($event)"
                                 :style="'grid-template-columns: repeat(' + gridCols + ', 18px)'">
                                <button type="button" class="rte-gcell" :for="cell in gridCells"
                                        :class="(cell.r <= hovR && cell.c <= hovC) ? 'on' : ''"></button>
                            </div>
                            <div class="rte-grid-label">{{ hovR }} × {{ hovC }}</div>
                        </div>
                        <button type="button" class="rte-adv-link" @click="tableAdvanced = true">Advanced options ▾</button>
                    </div>
                    <div :class="tableAdvanced ? '' : 'rte-hide'">
                        <div class="rte-pick-row rte-adv-row">
                            <label class="rte-dim-l">Rows <input type="number" min="1" class="rte-dim" :bind="tblRows" /></label>
                            <label class="rte-dim-l">Cols <input type="number" min="1" class="rte-dim" :bind="tblCols" /></label>
                        </div>
                        <div class="rte-pick-row rte-adv-toggles">
                            <button type="button" class="rte-toggle" :class="tblHeader ? 'is-on' : ''" @click="tblHeader = !tblHeader"><span class="dot"></span> Header row</button>
                            <button type="button" class="rte-toggle" :class="tblBorders ? 'is-on' : ''" @click="tblBorders = !tblBorders"><span class="dot"></span> Borders</button>
                            <button type="button" class="rte-toggle" :class="tblDynamic ? 'is-on' : ''" @click="tblDynamic = !tblDynamic" title="Columns fill a ratio of the space and reflow to any screen"><span class="dot"></span> Responsive width</button>
                        </div>
                        <div class="rte-adv-actions">
                            <button type="button" class="rte-adv-link" @click="tableAdvanced = false">← Grid</button>
                            <button type="button" class="rte-primary rte-dim-go" @click="insertAdvanced()">Insert</button>
                        </div>
                    </div>
                </div>
            </dz-component>
        </div>
    `,

    data: () => ({
        placeholder: 'Start writing…',
        html: '',
        focused: false,
        // Reactive state for the toggle buttons (the selects are driven via refs).
        active: { bold: false, italic: false, underline: false, sub: false, sup: false, link: false, align: 'left' },
        // Link modal state
        linkOpen: false,
        linkEditing: false,
        linkText: '',
        linkUrl: '',
        linkNewTab: false,
        // Color popover state ('fg' | 'bg' | null) and palettes (class name + swatch hex)
        colorOpen: null,
        customColor: '#5b5ef0',
        fgSwatches: [
            { name: 'black', hex: '#1f2330' }, { name: 'gray', hex: '#8a90a2' },
            { name: 'red', hex: '#c0455b' }, { name: 'orange', hex: '#c2691c' },
            { name: 'green', hex: '#2f9e44' }, { name: 'blue', hex: '#1c7ed6' },
            { name: 'purple', hex: '#7048e8' }, { name: 'pink', hex: '#c2255c' }
        ],
        bgSwatches: [
            { name: 'yellow', hex: '#fff3a3' }, { name: 'green', hex: '#c3f0ca' },
            { name: 'blue', hex: '#c5e3ff' }, { name: 'pink', hex: '#ffd6e7' },
            { name: 'orange', hex: '#ffe2c2' }, { name: 'gray', hex: '#e4e6ee' }
        ],
        // Table insert modal + grid-picker state; inTable shows the row/col tools.
        tableOpen: false,
        inTable: false,
        tableFluid: false,    // current cell's table sizing mode (fluid % vs fixed px)
        gridRows: 8,
        gridCols: 8,
        hovR: 2,
        hovC: 2,
        // Advanced table options (separate from the grid; not synced)
        tableAdvanced: false,
        tblRows: 3,
        tblCols: 3,
        tblHeader: false,
        tblBorders: true,
        tblDynamic: false     // Advanced: insert a responsive (fluid %) table
    }),

    computed: {
        // Which palette the popover shows, based on which color button is open.
        swatches() {
            return this.colorOpen === 'bg' ? this.bgSwatches : this.fgSwatches;
        },
        // Row-major cells for the grid picker (re-renders when the grid grows).
        gridCells() {
            const cells = [];
            for (let r = 1; r <= this.gridRows; r++)
                for (let c = 1; c <= this.gridCols; c++) cells.push({ r, c });
            return cells;
        }
    },

    $mounted() {
        // Self-contained fonts: @font-face must live at document level (it has no
        // effect inside a shadow root), so inject the faces once per document.
        // Fonts are self-hosted app assets (no third-party CDN); font-display:swap
        // falls back gracefully when the .woff2 files are absent.
        if (!document.getElementById('dz-rte-fonts')) {
            const fonts = document.createElement('style');
            fonts.id = 'dz-rte-fonts';
            fonts.textContent = `
                @font-face { font-family: 'Public Sans'; src: url('/assets/fonts/PublicSans-Variable.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
                @font-face { font-family: 'Public Sans'; src: url('/assets/fonts/PublicSans-Italic-Variable.woff2') format('woff2'); font-weight: 100 900; font-style: italic; font-display: swap; }
                @font-face { font-family: 'Merriweather'; src: url('/assets/fonts/Merriweather-Variable.woff2') format('woff2'); font-weight: 300 900; font-style: normal; font-display: swap; }
                @font-face { font-family: 'Merriweather'; src: url('/assets/fonts/Merriweather-Italic-Variable.woff2') format('woff2'); font-weight: 300 900; font-style: italic; font-display: swap; }
                @font-face { font-family: 'Source Code Pro'; src: url('/assets/fonts/SourceCodePro-Variable.woff2') format('woff2'); font-weight: 200 900; font-style: normal; font-display: swap; }
            `;
            document.head.appendChild(fonts);
        }
        const el = this.$refs.editor;
        el.setAttribute('data-placeholder', this.placeholder);
        // Enter should start a new <p>, not a <div> (the Chrome default).
        try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* older browsers */ }
        // Seed initial content imperatively (uncontrolled — never via a binding).
        // Always keep a paragraph to type into, so the first text is wrapped in <p>.
        el.innerHTML = this.html || '<p><br></p>';
        this.refreshEmpty();
        // Seed the undo history with the initial content.
        el._hist = [{ html: el.innerHTML, sel: 0 }];
        el._hi = 0;
        // selectionchange is document-level: it is the only reliable signal for
        // caret moves via keyboard/mouse. Gate it on focus and clean up on unmount.
        this._onSel = () => { if (this.focused) this.syncToolbar(); };
        document.addEventListener('selectionchange', this._onSel);
    },

    $unmounted() {
        document.removeEventListener('selectionchange', this._onSel);
    },

    methods: {
        // Stop the toolbar button from stealing the selection/focus from the editor.
        hold(e) { e.preventDefault(); },

        cmd(command) {
            this.$refs.editor.focus();
            document.execCommand(command, false, null);
            this.afterChange();
        },

        // Nearest <a> ancestor of the caret, within the editor (or null).
        closestLink() {
            const sel = this.selection();
            let n = sel && sel.anchorNode;
            const editor = this.$refs.editor;
            while (n && n !== editor) {
                if (n.nodeType === 1 && n.tagName === 'A') return n;
                n = n.parentNode;
            }
            return null;
        },

        // Open the link modal. Save the current selection (lost once the inputs
        // take focus) and prefill from an existing link if the caret is in one.
        // Transient DOM state (range/link) is stashed on the raw editor element,
        // never on `this` — the reactive proxy would wrap a Range/Node and break it.
        openLink() {
            const el = this.$refs.editor;
            const sel = this.selection();
            const range = (sel && sel.rangeCount && el.contains(sel.anchorNode))
                ? sel.getRangeAt(0).cloneRange() : null;
            el._dzRange = range;
            const a = this.closestLink();
            el._dzLink = a;
            this.linkEditing = !!a;
            if (a) {
                this.linkText = a.textContent;
                this.linkUrl = a.getAttribute('href') || '';
                this.linkNewTab = a.getAttribute('target') === '_blank';
            } else {
                this.linkText = range ? range.toString() : '';
                this.linkUrl = '';
                this.linkNewTab = false;
            }
            this.linkOpen = true;
        },

        closeLink() { this.linkOpen = false; },

        setLinkTarget(a, newTab) {
            if (newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
            else { a.removeAttribute('target'); a.removeAttribute('rel'); }
        },

        applyLink() {
            const el = this.$refs.editor;
            const url = this.linkUrl.trim();
            const text = this.linkText.trim();
            if (!url) { this.closeLink(); return; }
            el.focus();

            if (this.linkEditing && el._dzLink) {
                const a = el._dzLink;
                a.setAttribute('href', url);
                a.textContent = text || url;
                this.setLinkTarget(a, this.linkNewTab);
            } else {
                const sel = this.selection();
                // Restore the saved selection, or fall back to the end of the editor.
                if (el._dzRange) { sel.removeAllRanges(); sel.addRange(el._dzRange); }
                if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
                    const r = document.createRange();
                    r.selectNodeContents(el); r.collapse(false);
                    sel.removeAllRanges(); sel.addRange(r);
                }
                const a = document.createElement('a');
                a.setAttribute('href', url);
                a.textContent = text || url;
                this.setLinkTarget(a, this.linkNewTab);
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(a);
                range.setStartAfter(a); range.collapse(true);
                sel.removeAllRanges(); sel.addRange(range);
            }
            this.closeLink();
            this.afterChange();
        },

        // Unwrap the current/saved link, keeping its text.
        removeLink() {
            const el = this.$refs.editor;
            el.focus();
            const a = el._dzLink || this.closestLink();
            if (a && a.parentNode) {
                const parent = a.parentNode;
                while (a.firstChild) parent.insertBefore(a.firstChild, a);
                parent.removeChild(a);
            }
            this.closeLink();
            this.afterChange();
        },

        // ── Color (text + highlight) ──
        // Toggle the popover for a kind ('fg' | 'bg'); save the selection first.
        openColor(kind) {
            const el = this.$refs.editor;
            const sel = this.selection();
            el._dzColorRange = (sel && sel.rangeCount && el.contains(sel.anchorNode))
                ? sel.getRangeAt(0).cloneRange() : null;
            this.colorOpen = this.colorOpen === kind ? null : kind;
        },

        closeColor() { this.colorOpen = null; },

        // Restore the saved selection before applying (the popover stole focus).
        restoreColorRange() {
            const el = this.$refs.editor;
            el.focus();
            const sel = this.selection();
            if (el._dzColorRange) { sel.removeAllRanges(); sel.addRange(el._dzColorRange); }
            return sel;
        },

        // Palette swatch → wrap the selection in a span with the dz-fg-/dz-bg- class.
        pickSwatch(name) {
            const prefix = this.colorOpen === 'bg' ? 'dz-bg-' : 'dz-fg-';
            this.restoreColorRange();
            this.wrapColor(prefix + name, null, null);
            this.closeColor();
        },

        // Open the OS color picker (the color-wheel tab triggers the hidden input),
        // seeded with the last custom color.
        openCustom() {
            this.$refs.customInput.value = this.customColor;
            this.$refs.customInput.click();
        },

        // OS picker committed: remember the color (the custom-color tab reflects it)
        // and apply it.
        onCustomPicked(e) {
            this.customColor = e.target.value;
            this.applyCustomColor();
        },

        // Apply the remembered custom color (the tab next to the wheel) inline.
        applyCustomColor() {
            const prop = this.colorOpen === 'bg' ? 'backgroundColor' : 'color';
            this.restoreColorRange();
            this.wrapColor(null, prop, this.customColor);
            this.closeColor();
        },

        wrapColor(className, styleProp, styleVal) {
            const sel = this.selection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            if (range.collapsed) { this.afterChange(); return; }
            const span = document.createElement('span');
            if (className) span.className = className;
            if (styleProp) span.style[styleProp] = styleVal;
            try { range.surroundContents(span); }
            catch { span.appendChild(range.extractContents()); range.insertNode(span); }
            const r = document.createRange();
            r.selectNodeContents(span); r.collapse(false);
            sel.removeAllRanges(); sel.addRange(r);
            this.afterChange();
        },

        // Strip color from spans intersecting the selection (best-effort), unwrapping
        // any span left with no class or style.
        clearColor() {
            const kind = this.colorOpen;
            const sel = this.restoreColorRange();
            if (!sel.rangeCount) { this.closeColor(); return; }
            const range = sel.getRangeAt(0);
            const prefix = kind === 'bg' ? 'dz-bg-' : 'dz-fg-';
            const styleProp = kind === 'bg' ? 'backgroundColor' : 'color';
            this.$refs.editor.querySelectorAll('span').forEach(span => {
                if (!range.intersectsNode(span)) return;
                [...span.classList].forEach(c => { if (c.startsWith(prefix)) span.classList.remove(c); });
                span.style[styleProp] = '';
                if (!span.className && !span.getAttribute('style')) {
                    const p = span.parentNode;
                    while (span.firstChild) p.insertBefore(span.firstChild, span);
                    p.removeChild(span);
                }
            });
            this.closeColor();
            this.afterChange();
        },

        // Font family / size — curated classes (dz-font-* / dz-size-*) wrapped on a
        // span. Empty value = default → strip the class. (Restricted to the dropdown
        // options, so the site stays font-consistent.)
        onFontChange(e) {
            const v = e.target.value;
            this.restoreInlineSel();   // the native dropdown drops the selection; restore it
            if (v) this.wrapColor('dz-font-' + v, null, null);
            else { this.removeInline('dz-font-'); this.afterChange(); }
        },

        onSizeChange(e) {
            const v = e.target.value;
            this.restoreInlineSel();
            if (v) this.wrapColor('dz-size-' + v, null, null);
            else { this.removeInline('dz-size-'); this.afterChange(); }
        },

        // Save/restore the text selection across the native <select> interaction,
        // which otherwise collapses it before @change fires (stored on the raw el).
        saveInlineSel() {
            const el = this.$refs.editor;
            const sel = this.selection();
            el._dzInlineRange = (sel && sel.rangeCount && el.contains(sel.anchorNode)) ? sel.getRangeAt(0).cloneRange() : null;
        },

        restoreInlineSel() {
            const el = this.$refs.editor;
            el.focus();
            const sel = this.selection();
            if (el._dzInlineRange) { sel.removeAllRanges(); sel.addRange(el._dzInlineRange); }
        },

        // Remove a dz-<prefix>* class from spans intersecting the selection,
        // unwrapping any span left with no class/style.
        removeInline(prefix) {
            const sel = this.selection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            this.$refs.editor.querySelectorAll('span').forEach(span => {
                if (!range.intersectsNode(span)) return;
                [...span.classList].forEach(c => { if (c.startsWith(prefix)) span.classList.remove(c); });
                if (!span.className && !span.getAttribute('style')) {
                    const p = span.parentNode;
                    while (span.firstChild) p.insertBefore(span.firstChild, span);
                    p.removeChild(span);
                }
            });
        },

        // First ancestor class with the given prefix at the caret (or null).
        closestClass(prefix) {
            const sel = this.selection();
            let n = sel && sel.anchorNode;
            const editor = this.$refs.editor;
            while (n && n !== editor) {
                if (n.nodeType === 1) { for (const c of n.classList) if (c.startsWith(prefix)) return c; }
                n = n.parentNode;
            }
            return null;
        },

        // Text alignment via a dz-align-* class on each block in the selection
        // (not inline style). 'left' is the default, so it just clears the classes.
        align(which) {
            this.$refs.editor.focus();
            for (const b of this.selectedBlocks()) {
                b.classList.remove('dz-align-center', 'dz-align-right', 'dz-align-justify');
                if (which !== 'left') b.classList.add('dz-align-' + which);
            }
            this.afterChange();
        },

        // Indent / outdent. delta is +1 (indent) or -1 (outdent).
        // In a list this nests/un-nests into sub-lists (structural). Elsewhere it
        // adds a dz-indent-N margin class to each selected block (no list wrapper).
        indent(delta) {
            this.$refs.editor.focus();
            if (this.closestList()) {
                document.execCommand(delta > 0 ? 'indent' : 'outdent', false, null);
            } else {
                for (const b of this.selectedBlocks()) {
                    const cls = [...b.classList].find(c => /^dz-indent-\d+$/.test(c));
                    const level = cls ? parseInt(cls.slice(10), 10) : 0;
                    const next = Math.max(0, Math.min(6, level + delta));
                    if (cls) b.classList.remove(cls);
                    if (next > 0) b.classList.add('dz-indent-' + next);
                    if (!b.classList.length) b.removeAttribute('class');
                }
            }
            this.afterChange();
        },

        // Block-level elements intersecting the current selection (for alignment).
        selectedBlocks() {
            const editor = this.$refs.editor;
            const ALIGNABLE = /^(P|H[1-6]|LI|BLOCKQUOTE|DIV|PRE|TD|TH)$/;
            const sel = this.selection();
            if (!sel || !sel.rangeCount) return [];
            const range = sel.getRangeAt(0);
            const blockOf = (node) => {
                let n = node && node.nodeType === 1 ? node : (node && node.parentNode);
                while (n && n !== editor) {
                    if (n.nodeType === 1 && ALIGNABLE.test(n.tagName)) return n;
                    n = n.parentNode;
                }
                return null;
            };
            const blocks = new Set();
            const s = blockOf(range.startContainer); if (s) blocks.add(s);
            const e = blockOf(range.endContainer); if (e) blocks.add(e);
            if (!range.collapsed) {
                const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, {
                    acceptNode: (n) => ALIGNABLE.test(n.tagName) && range.intersectsNode(n)
                        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
                });
                while (walker.nextNode()) blocks.add(walker.currentNode);
            }
            return [...blocks];
        },

        // Block (paragraph / heading) selector.
        onBlockChange(e) {
            const tag = e.target.value;
            this.$refs.editor.focus();
            document.execCommand('formatBlock', false, tag);
            this.afterChange();
        },

        // List selector. Value is "tag:style" (e.g. "ol:lower-alpha") or "" for none.
        // execCommand only makes a plain <ul>/<ol>; the variant comes from a
        // dz-list-<style> class added to the resulting list element.
        onListChange(e) {
            const val = e.target.value;
            this.$refs.editor.focus();
            const current = this.closestList();

            if (!val) {
                // "No list" — toggle off the current list, if any.
                if (current) {
                    document.execCommand(current.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
                }
                this.afterChange();
                return;
            }

            const [tag, style] = val.split(':');
            // Create the list, or convert ul<->ol, only when the tag differs.
            // Chrome converts between list types when the command is re-issued.
            if (!current || current.tagName.toLowerCase() !== tag) {
                document.execCommand(tag === 'ol' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
            }
            const list = this.closestList();
            if (list) {
                [...list.classList].forEach(c => { if (c.startsWith('dz-list-')) list.classList.remove(c); });
                list.classList.add('dz-list-' + style);
            }
            this.afterChange();
        },

        // Skip normalization while an IME composition is in progress (mutating the
        // DOM mid-composition breaks it); the trailing non-composing input fixes up.
        onInput(e) { this.afterChange(!!(e && e.isComposing), true); },

        // Keyboard shortcuts. Undo/redo use our snapshot stack (preventDefault stops
        // the native contenteditable undo, which our manual DOM edits would corrupt).
        onKeydown(e) {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (e.shiftKey) this.redo(); else this.undo();
                return;
            }
            if (mod && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault(); this.redo(); return;
            }
            if (e.key === 'Backspace' && this.backspaceEmptyBlock()) { e.preventDefault(); return; }
            if (e.key === 'ArrowUp' && this.tableEdgeEscape(-1)) { e.preventDefault(); return; }
            if (e.key === 'ArrowDown' && this.tableEdgeEscape(1)) { e.preventDefault(); return; }
            if (e.key === 'Tab') {
                e.preventDefault();
                const cell = this.currentCell();
                if (cell) { this.moveCell(cell, e.shiftKey ? -1 : 1); return; }
                this.indent(e.shiftKey ? -1 : 1);
            }
        },

        // The top-level block (direct child of the editor) containing a node.
        topBlock(node) {
            const el = this.$refs.editor;
            let n = node;
            while (n && n.parentNode !== el) n = n.parentNode;
            return (n && n.parentNode === el) ? n : null;
        },

        // Collapse the caret to the start (or end) of a node's contents.
        caretAt(node, atEnd) {
            const r = document.createRange();
            r.selectNodeContents(node);
            r.collapse(!atEnd);
            const s = this.selection(); s.removeAllRanges(); s.addRange(r);
        },

        // Backspace in an EMPTY paragraph that neighbours a table: the browser can't
        // merge a paragraph into a table, so it would be stuck. Delete it and move
        // the caret into the table (last cell if the table is above, first cell if
        // below). Returns true when handled. Empty blocks not touching a table fall
        // through to the browser's normal merge.
        backspaceEmptyBlock() {
            const sel = this.selection();
            if (!sel || !sel.isCollapsed) return false;
            const block = this.topBlock(sel.anchorNode);
            if (!block) return false;
            const skip = /^(TABLE|UL|OL|PRE)$/;
            if (skip.test(block.tagName) || block.textContent.trim() !== '') return false;
            const prev = block.previousElementSibling;
            const next = block.nextElementSibling;
            if (prev && prev.tagName === 'TABLE') {
                const cells = prev.querySelectorAll('td, th');
                block.remove();
                this.caretAt(cells[cells.length - 1], true);
                this.afterChange();
                return true;
            }
            if (!prev && next && next.tagName === 'TABLE') {
                block.remove();
                this.caretAt(next.querySelector('td, th'), false);
                this.afterChange();
                return true;
            }
            return false;
        },

        // ArrowUp/Down out of a table row that has no block on that side: create a
        // paragraph there and move into it (dir -1 = above, +1 = below). Only fires
        // at the caret extreme of an edge row so multi-line cell navigation is intact.
        tableEdgeEscape(dir) {
            const sel = this.selection();
            if (!sel || !sel.isCollapsed) return false;
            const cell = this.currentCell();
            if (!cell) return false;
            const table = cell.closest('table');
            const block = this.topBlock(cell);
            if (!block || block.tagName !== 'TABLE') return false;   // ignore nested tables
            const rows = [...table.querySelectorAll('tr')];
            const rowIndex = rows.indexOf(cell.parentNode);
            // Is the caret at the very start / end of the cell's content?
            const edge = sel.getRangeAt(0).cloneRange();
            edge.selectNodeContents(cell);
            if (dir < 0) {
                if (rowIndex !== 0 || block.previousElementSibling) return false;
                edge.setEnd(sel.anchorNode, sel.anchorOffset);
                if (edge.toString().length) return false;            // not at cell start
                const p = document.createElement('p'); p.appendChild(document.createElement('br'));
                block.before(p); this.caretAt(p, false); this.afterChange();
                return true;
            }
            if (rowIndex !== rows.length - 1 || block.nextElementSibling) return false;
            edge.setStart(sel.anchorNode, sel.anchorOffset);
            if (edge.toString().length) return false;                // not at cell end
            const p = document.createElement('p'); p.appendChild(document.createElement('br'));
            block.after(p); this.caretAt(p, false); this.afterChange();
            return true;
        },

        onFocus() { this.focused = true; this.syncToolbar(); },
        onBlur() { this.focused = false; this.$refs.editor.classList.remove('dz-tables-on'); },

        // True when there is no real content — text is blank and there is no
        // standalone media. The DOM keeps a <p> to type into, but a blank editor
        // serializes to "" rather than the placeholder <p><br></p> markup.
        empty() {
            const el = this.$refs.editor;
            return el.textContent.trim() === '' && !el.querySelector('img, hr, table');
        },

        // Pull the latest HTML out of the uncontrolled surface and notify the host.
        // Normalize structure first (unless mid-IME), so the emitted HTML is clean.
        afterChange(skipNormalize, coalesce) {
            if (!skipNormalize) { this.normalizeBlocks(); this.normalizeLists(); this.normalizeListNesting(); this.normalizeSpans(); }
            this.html = this.empty() ? '' : this.$refs.editor.innerHTML;
            this.refreshEmpty();
            this.syncToolbar();
            if (this.$emit) this.$emit('change', this.html);
            // Record an undo step: immediately for discrete commands, coalesced
            // (debounced) for typing runs so they collapse into one entry.
            this.recordHistory(!coalesce);
        },

        // ── Undo / redo: full-HTML snapshots (the native undo stack can't track our
        //    manual DOM edits). State lives on the raw editor element, not on `this`
        //    (a reactive array would be needlessly proxied). Cap: 100 entries. ──
        recordHistory(immediate) {
            const el = this.$refs.editor;
            if (!el._hist) { el._hist = [{ html: el.innerHTML, sel: 0 }]; el._hi = 0; }
            if (immediate) { this.flushHistory(); return; }
            // Typing: snapshot after ~1.5s idle, but force one every ~12s of
            // continuous typing so a long run is not a single giant undo entry.
            clearTimeout(el._histIdle);
            el._histIdle = setTimeout(() => this.flushHistory(), 1500);
            if (!el._histMax) el._histMax = setTimeout(() => this.flushHistory(), 12000);
        },

        // Commit any pending typing snapshot now and clear both timers.
        flushHistory() {
            const el = this.$refs.editor;
            clearTimeout(el._histIdle); el._histIdle = null;
            clearTimeout(el._histMax); el._histMax = null;
            this.commitHistory();
        },

        commitHistory() {
            const el = this.$refs.editor;
            if (!el._hist) { el._hist = [{ html: el.innerHTML, sel: 0 }]; el._hi = 0; return; }
            const html = el.innerHTML;
            if (el._hist[el._hi] && el._hist[el._hi].html === html) return;  // no content change
            if (el._hi < el._hist.length - 1) el._hist.length = el._hi + 1;   // drop redo future
            el._hist.push({ html, sel: this.caretOffset() });
            if (el._hist.length > 100) el._hist.shift();
            el._hi = el._hist.length - 1;
        },

        undo() {
            const el = this.$refs.editor;
            if (!el._hist) return;
            this.flushHistory();                   // commit a pending typing run first
            if (el._hi <= 0) return;
            el._hi--;
            this.restoreHistory(el._hist[el._hi]);
        },

        redo() {
            const el = this.$refs.editor;
            if (!el._hist || el._hi >= el._hist.length - 1) return;
            el._hi++;
            this.restoreHistory(el._hist[el._hi]);
        },

        restoreHistory(state) {
            const el = this.$refs.editor;
            el.focus();
            el.innerHTML = state.html;
            this.setCaret(state.sel);
            this.html = this.empty() ? '' : el.innerHTML;
            this.refreshEmpty();
            this.syncToolbar();
            if (this.$emit) this.$emit('change', this.html);
        },

        // Caret position as a text-character offset from the editor start (survives
        // the innerHTML replacement that undo/redo performs).
        caretOffset() {
            const sel = this.selection();
            if (!sel.rangeCount) return 0;
            const range = sel.getRangeAt(0);
            const pre = range.cloneRange();
            pre.selectNodeContents(this.$refs.editor);
            pre.setEnd(range.endContainer, range.endOffset);
            return pre.toString().length;
        },

        setCaret(offset) {
            const el = this.$refs.editor;
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
            let remaining = offset, node;
            while ((node = walker.nextNode())) {
                const len = node.textContent.length;
                if (remaining <= len) {
                    const r = document.createRange(); r.setStart(node, remaining); r.collapse(true);
                    const sel = this.selection(); sel.removeAllRanges(); sel.addRange(r);
                    return;
                }
                remaining -= len;
            }
            const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
            const sel = this.selection(); sel.removeAllRanges(); sel.addRange(r);
        },

        // Guarantee every top-level node is a block element: wrap loose text/inline
        // content (which the browser leaves behind after select-all-delete, etc.)
        // into a <p>, preserving the caret via a temporary marker. Runs only when
        // something is actually loose, so normal typing is a cheap no-op.
        normalizeBlocks() {
            const editor = this.$refs.editor;
            const BLOCK = /^(P|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|HR|FIGURE|DIV)$/;
            const blank = n => n.nodeType === 3 && n.textContent.trim() === '';

            if (!editor.firstChild) { editor.innerHTML = '<p><br></p>'; return; }
            const loose = Array.from(editor.childNodes).some(n =>
                !blank(n) && !(n.nodeType === 1 && BLOCK.test(n.tagName)));
            if (!loose) return;

            // Mark the caret so it can be restored after the nodes move.
            const sel = this.selection();
            let marker = null;
            if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
                marker = document.createElement('span');
                sel.getRangeAt(0).insertNode(marker);
            }

            let buffer = [];
            const flush = () => {
                if (!buffer.length) return;
                const p = document.createElement('p');
                editor.insertBefore(p, buffer[0]);
                buffer.forEach(n => p.appendChild(n));
                buffer = [];
            };
            for (const node of Array.from(editor.childNodes)) {
                if (blank(node)) { flush(); continue; }
                if (node.nodeType === 1 && BLOCK.test(node.tagName)) flush();
                else buffer.push(node);
            }
            flush();

            if (marker) {
                const range = document.createRange();
                range.setStartBefore(marker);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                marker.remove();
            }
        },

        // Toggle the empty class so the CSS placeholder shows when no text remains.
        refreshEmpty() {
            this.$refs.editor.classList.toggle('is-empty', this.empty());
        },

        // execCommand can leave a list wrapped in a <p> (e.g. when an existing
        // paragraph is listed). Lift any <ul>/<ol> out so it is a sibling — not a
        // child — of the <p>, then drop the now-empty wrapper.
        normalizeLists() {
            const editor = this.$refs.editor;
            editor.querySelectorAll('p > ul, p > ol').forEach(list => {
                const p = list.parentElement;
                p.parentNode.insertBefore(list, p.nextSibling);
                if (!p.textContent.trim() && !p.querySelector('img, hr')) p.remove();
            });
        },

        // Clean up the inline style spans we emit (color, highlight, font, size):
        // collapse redundant nesting (re-applying wraps a new span — inner wins per
        // property, so the dead outer is dropped; also prevents em sizes compounding),
        // combine different properties into one span, and merge adjacent identical
        // spans. Strictly scoped to our spans (only dz-fg/bg/font/size classes or
        // color/background-color styles), so <b>/<a>/etc. are never touched.
        normalizeSpans() {
            const editor = this.$refs.editor;
            const isStyleSpan = (el) => {
                if (!el || el.tagName !== 'SPAN') return false;
                for (const a of el.attributes) if (a.name !== 'class' && a.name !== 'style') return false;
                for (const c of el.classList) if (!/^dz-(fg|bg|font|size)-/.test(c)) return false;
                for (let i = 0; i < el.style.length; i++) {
                    const p = el.style[i];
                    if (p !== 'color' && p !== 'background-color') return false;
                }
                return true;
            };
            const stylesOf = (el) => {
                let fg = null, bg = null, font = null, size = null;
                for (const c of el.classList) {
                    if (c.startsWith('dz-fg-')) fg = { kind: 'class', v: c };
                    else if (c.startsWith('dz-bg-')) bg = { kind: 'class', v: c };
                    else if (c.startsWith('dz-font-')) font = c;
                    else if (c.startsWith('dz-size-')) size = c;
                }
                if (el.style.color) fg = { kind: 'style', v: el.style.color };
                if (el.style.backgroundColor) bg = { kind: 'style', v: el.style.backgroundColor };
                return { fg, bg, font, size };
            };
            const setStyles = (el, s) => {
                el.removeAttribute('class'); el.removeAttribute('style');
                if (s.fg) { if (s.fg.kind === 'class') el.classList.add(s.fg.v); else el.style.color = s.fg.v; }
                if (s.bg) { if (s.bg.kind === 'class') el.classList.add(s.bg.v); else el.style.backgroundColor = s.bg.v; }
                if (s.font) el.classList.add(s.font);
                if (s.size) el.classList.add(s.size);
            };
            const isEmpty = (s) => !s.fg && !s.bg && !s.font && !s.size;
            const sig = (el) => { const s = stylesOf(el); return [s.fg && s.fg.kind + s.fg.v, s.bg && s.bg.kind + s.bg.v, s.font, s.size].join('|'); };
            const merge = (outer, inner) => ({ fg: inner.fg || outer.fg, bg: inner.bg || outer.bg, font: inner.font || outer.font, size: inner.size || outer.size });
            const unwrap = (el) => { const p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); };

            let changed = true, guard = 0;
            while (changed && guard++ < 30) {
                changed = false;
                for (const span of [...editor.querySelectorAll('span')]) {
                    if (!span.isConnected || !isStyleSpan(span)) continue;
                    const s = stylesOf(span);

                    // (a) no formatting left → unwrap
                    if (isEmpty(s)) { unwrap(span); changed = true; continue; }

                    // (b) wraps a single style span as its only content → merge, inner wins
                    const elKids = [...span.childNodes].filter(n => n.nodeType === 1);
                    const textKids = [...span.childNodes].filter(n => n.nodeType === 3 && n.textContent !== '');
                    if (elKids.length === 1 && textKids.length === 0 && isStyleSpan(elKids[0])) {
                        const inner = elKids[0];
                        setStyles(inner, merge(s, stylesOf(inner)));
                        unwrap(span);
                        changed = true;
                        continue;
                    }

                    // (c) adjacent identical style span → merge
                    let next = span.nextSibling;
                    while (next && next.nodeType === 3 && next.textContent === '') next = next.nextSibling;
                    if (next && next.nodeType === 1 && isStyleSpan(next) && sig(next) === sig(span)) {
                        while (next.firstChild) span.appendChild(next.firstChild);
                        next.remove();
                        changed = true;
                    }
                }
            }
        },

        // execCommand('indent') can nest a list directly inside another list
        // (<ol><ol>…), which is invalid. Move such a sub-list into the preceding
        // <li> so it nests correctly (<li>…<ol>…</ol></li>).
        normalizeListNesting() {
            const editor = this.$refs.editor;
            editor.querySelectorAll('ol > ol, ol > ul, ul > ol, ul > ul').forEach(sub => {
                const prev = sub.previousElementSibling;
                if (prev && prev.tagName === 'LI') prev.appendChild(sub);
            });
        },

        // The selection (read from the shadow root so it sees nodes inside it).
        selection() {
            const root = this.$refs.editor.getRootNode();
            return root.getSelection ? root.getSelection() : document.getSelection();
        },

        // Nearest <ul>/<ol> ancestor of the caret, within the editor (or null).
        closestList() {
            const sel = this.selection();
            let node = sel && sel.anchorNode;
            const editor = this.$refs.editor;
            while (node && node !== editor) {
                if (node.nodeType === 1 && (node.tagName === 'UL' || node.tagName === 'OL')) return node;
                node = node.parentNode;
            }
            return null;
        },

        // ── Tables ──
        openTable() {
            const el = this.$refs.editor;
            const sel = this.selection();
            el._dzTableRange = (sel && sel.rangeCount && el.contains(sel.anchorNode)) ? sel.getRangeAt(0).cloneRange() : null;
            this.hovR = 2; this.hovC = 2;
            this.tableAdvanced = false;
            this.tblRows = 3; this.tblCols = 3; this.tblHeader = false; this.tblBorders = true;
            this.tableOpen = true;
        },

        closeTable() { this.tableOpen = false; },

        // ONE delegated handler on the grid (not per-cell) finds the cell under the
        // pointer; a single overlay element shows the R×C highlight (no per-cell
        // reactivity, no re-render churn — much smoother than per-cell @mouseover).
        gridCellRC(e) {
            const cell = e.target.closest && e.target.closest('.rte-gcell');
            if (!cell || !cell.parentElement) return null;
            const cells = [...cell.parentElement.querySelectorAll('.rte-gcell')];
            const i = cells.indexOf(cell);
            if (i < 0) return null;
            return { r: Math.floor(i / this.gridCols) + 1, c: (i % this.gridCols) + 1 };
        },
        // Single delegated handler sets hovR/hovC; the per-cell :class reacts (the
        // deezul :for outer-dep reactivity fix makes this work without re-rendering).
        gridHover(e) { const rc = this.gridCellRC(e); if (rc) { this.hovR = rc.r; this.hovC = rc.c; } },
        gridClick(e) { const rc = this.gridCellRC(e); if (rc) this.insertTable(rc.r, rc.c); },

        newCell() { const td = document.createElement('td'); td.appendChild(document.createElement('br')); return td; },

        insertTable(rows, cols, opts) {
            opts = opts || {};
            const el = this.$refs.editor;
            el.focus();
            const sel = this.selection();
            if (el._dzTableRange) { sel.removeAllRanges(); sel.addRange(el._dzTableRange); }
            // The table is placed AFTER the caret's top-level block (it cannot nest in <p>).
            let block = null;
            if (sel.rangeCount) {
                let n = sel.getRangeAt(0).startContainer;
                n = n.nodeType === 1 ? n : n.parentNode;
                while (n && n.parentNode !== el) n = n.parentNode;
                if (n && n.parentNode === el) block = n;
            }
            const table = document.createElement('table');
            table.className = 'dz-table'
                + (opts.borders === false ? ' dz-table-plain' : '')
                + (opts.fluid ? ' dz-table-fluid' : '');
            let firstBodyRow = 0;
            if (opts.header) {
                const thead = document.createElement('thead');
                const tr = document.createElement('tr');
                for (let c = 0; c < cols; c++) { const th = document.createElement('th'); th.appendChild(document.createElement('br')); tr.appendChild(th); }
                thead.appendChild(tr);
                table.appendChild(thead);
                firstBodyRow = 1;
            }
            const tbody = document.createElement('tbody');
            for (let r = firstBodyRow; r < rows; r++) {
                const tr = document.createElement('tr');
                for (let c = 0; c < cols; c++) tr.appendChild(this.newCell());
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            if (block) block.after(table); else el.appendChild(table);
            this.caretInCell(table.querySelector('th, td'));
            this.closeTable();
            this.afterChange();
        },

        // Insert using the Advanced panel's options.
        insertAdvanced() {
            const r = Math.max(1, parseInt(this.tblRows, 10) || 1);
            const c = Math.max(1, parseInt(this.tblCols, 10) || 1);
            this.insertTable(r, c, { header: this.tblHeader, borders: this.tblBorders, fluid: this.tblDynamic });
        },

        // Nearest table cell of the caret (or null). Also drives the inTable tools.
        currentCell() {
            const sel = this.selection();
            let n = sel && sel.anchorNode;
            const el = this.$refs.editor;
            while (n && n !== el) {
                if (n.nodeType === 1 && (n.tagName === 'TD' || n.tagName === 'TH')) return n;
                n = n.parentNode;
            }
            return null;
        },

        caretInCell(cell) {
            if (!cell) return;
            const r = document.createRange(); r.selectNodeContents(cell); r.collapse(true);
            const sel = this.selection(); sel.removeAllRanges(); sel.addRange(r);
        },

        insertRowBelow() {
            const cell = this.currentCell(); if (!cell) return;
            this.$refs.editor.focus();
            const tr = cell.parentNode;
            const newTr = document.createElement('tr');
            for (let i = 0; i < tr.children.length; i++) newTr.appendChild(this.newCell());
            tr.after(newTr);
            this.afterChange();
        },

        insertColRight() {
            const cell = this.currentCell(); if (!cell) return;
            this.$refs.editor.focus();
            const idx = [...cell.parentNode.children].indexOf(cell);
            const table = cell.closest('table');
            for (const tr of table.querySelectorAll('tr')) {
                const ref = tr.children[idx];
                if (ref) ref.after(this.newCell()); else tr.appendChild(this.newCell());
            }
            // Mirror the new column in the colgroup so fixed widths stay aligned.
            const cg = table.querySelector(':scope > colgroup');
            if (cg && cg.children[idx]) {
                const col = document.createElement('col');
                col.style.width = cg.children[idx].style.width;
                cg.children[idx].after(col);
            }
            this.afterChange();
        },

        deleteRow() {
            const cell = this.currentCell(); if (!cell) return;
            const tr = cell.parentNode;
            const table = cell.closest('table');
            if (table.querySelectorAll('tr').length <= 1) { this.deleteTable(); return; }
            const nextRow = tr.nextElementSibling || tr.previousElementSibling;
            tr.remove();
            this.caretInCell(nextRow && nextRow.children[0]);
            this.afterChange();
        },

        deleteCol() {
            const cell = this.currentCell(); if (!cell) return;
            const idx = [...cell.parentNode.children].indexOf(cell);
            const table = cell.closest('table');
            if (table.querySelector('tr').children.length <= 1) { this.deleteTable(); return; }
            for (const tr of table.querySelectorAll('tr')) { const c = tr.children[idx]; if (c) c.remove(); }
            const cg = table.querySelector(':scope > colgroup');
            if (cg && cg.children[idx]) cg.children[idx].remove();
            this.caretInCell(table.querySelector('td, th'));
            this.afterChange();
        },

        deleteTable() {
            const cell = this.currentCell();
            const table = cell ? cell.closest('table') : null;
            if (table) table.remove();
            this.afterChange();
        },

        // Vertical content alignment of the current cell (top | middle | bottom).
        valign(pos) {
            const cell = this.currentCell(); if (!cell) return;
            this.$refs.editor.focus();
            cell.classList.remove('dz-valign-top', 'dz-valign-middle', 'dz-valign-bottom');
            cell.classList.add('dz-valign-' + pos);
            this.afterChange();
        },


        // Tab/Shift+Tab inside a table moves between cells; Tab past the last cell
        // adds a row.
        moveCell(cell, dir) {
            const table = cell.closest('table');
            const cells = [...table.querySelectorAll('td, th')];
            let target = cells[cells.indexOf(cell) + dir];
            if (dir > 0 && !target) {
                this.insertRowBelow();
                const rows = table.querySelectorAll('tr');
                target = rows[rows.length - 1].children[0];
            }
            this.caretInCell(target);
        },

        // ── Column / row drag-resize ──────────────────────────────────────────
        //  Columns are sized via a <colgroup>: a lazily-built <col> per column and
        //  table-layout:fixed make widths authoritative. A table is either FIXED
        //  (default — exact px widths) or FLUID (dz-table-fluid — table width 100%,
        //  cols as % so they fill a ratio of the space and reflow to any viewport).
        //  Rows are sized by an explicit <tr> height in both modes. Transient drag
        //  state lives on the raw editor element (never on `this`, which would proxy
        //  the DOM nodes).

        tableIsFluid(table) { return !!table && table.classList.contains('dz-table-fluid'); },

        // Freeze a table to fixed layout with an explicit <col> per column, sized to
        // its current rendered widths — as % (fluid) or px (fixed). Idempotent once
        // a colgroup exists.
        ensureColgroup(table) {
            let cg = table.querySelector(':scope > colgroup');
            if (cg) return cg;
            const firstRow = table.querySelector('tr');
            const widths = [...firstRow.children].map(c => c.getBoundingClientRect().width);
            const total = table.getBoundingClientRect().width || 1;
            const fluid = this.tableIsFluid(table);
            cg = document.createElement('colgroup');
            widths.forEach(w => {
                const col = document.createElement('col');
                col.style.width = fluid ? (w / total * 100).toFixed(3) + '%' : w + 'px';
                cg.appendChild(col);
            });
            table.insertBefore(cg, table.firstChild);
            table.style.tableLayout = 'fixed';
            table.style.width = fluid ? '100%' : total + 'px';
            return cg;
        },

        // Toggle the current cell's table between fluid (%) and fixed (px), preserving
        // the columns' visible widths at the moment of the switch.
        toggleTableFluid() {
            const cell = this.currentCell(); if (!cell) return;
            this.$refs.editor.focus();
            const table = cell.closest('table');
            const fluid = !this.tableIsFluid(table);          // target mode
            const cg = this.ensureColgroup(table);
            const widths = [...table.querySelector('tr').children].map(c => c.getBoundingClientRect().width);
            const total = table.getBoundingClientRect().width || 1;
            table.classList.toggle('dz-table-fluid', fluid);
            widths.forEach((w, i) => {
                if (cg.children[i]) cg.children[i].style.width = fluid ? (w / total * 100).toFixed(3) + '%' : w + 'px';
            });
            table.style.tableLayout = 'fixed';
            table.style.width = fluid ? '100%' : total + 'px';
            this.afterChange();
        },

        // Which resize handle (if any) sits under the pointer. Returns a descriptor
        // for a column boundary (right edge of column `col`) or a row boundary
        // (bottom edge of row `tr`), or null.
        resizeHandleAt(e) {
            const EDGE = 5;
            const cell = e.target && e.target.closest && e.target.closest('td, th');
            if (!cell || !this.$refs.editor.contains(cell)) return null;
            const r = cell.getBoundingClientRect();
            const table = cell.closest('table');
            const idx = cell.cellIndex;
            const lastCol = cell.parentNode.children.length - 1;
            // Column boundary first (right edge of this cell, or left edge → previous column).
            // In fluid mode the table's outer right edge is the container edge — not draggable.
            if (Math.abs(e.clientX - r.right) <= EDGE) {
                if (idx === lastCol && this.tableIsFluid(table)) return null;
                return { axis: 'col', table, col: idx };
            }
            if (idx > 0 && Math.abs(e.clientX - r.left) <= EDGE) return { axis: 'col', table, col: idx - 1 };
            // Row boundary (bottom edge of this row, or top edge → previous row).
            const tr = cell.parentNode;
            if (Math.abs(e.clientY - r.bottom) <= EDGE) return { axis: 'row', table, tr };
            if (Math.abs(e.clientY - r.top) <= EDGE) {
                const prev = tr.previousElementSibling || (tr.parentNode.previousElementSibling && tr.parentNode.previousElementSibling.lastElementChild);
                if (prev) return { axis: 'row', table, tr: prev };
            }
            return null;
        },

        // Hover: show the resize cursor when the pointer is over a boundary.
        onEditorMove(e) {
            const el = this.$refs.editor;
            if (el._dzResize) return;                 // a drag owns the cursor
            const h = this.resizeHandleAt(e);
            el.style.cursor = h ? (h.axis === 'col' ? 'col-resize' : 'row-resize') : '';
        },

        // Press on a boundary starts a drag (and suppresses caret placement).
        onEditorDown(e) {
            if (e.button !== 0) return;
            const h = this.resizeHandleAt(e);
            if (!h) return;
            e.preventDefault();
            const el = this.$refs.editor;
            const state = { axis: h.axis, table: h.table, startX: e.clientX, startY: e.clientY };
            if (h.axis === 'col') {
                const cg = this.ensureColgroup(h.table);
                const cols = [...cg.children];
                const rects = [...h.table.querySelector('tr').children].map(c => c.getBoundingClientRect().width);
                state.cols = cols;
                state.i = h.col;
                state.w0 = rects[h.col];
                state.hasNext = h.col + 1 < cols.length;
                state.w1 = state.hasNext ? rects[h.col + 1] : 0;
                state.tableW = h.table.getBoundingClientRect().width;
                state.fluid = this.tableIsFluid(h.table);
                // Content width available inside the editor — the table may not grow past it.
                const cs = getComputedStyle(el);
                state.maxTableW = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
            } else {
                state.tr = h.tr;
                state.h0 = h.tr.getBoundingClientRect().height;
            }
            el._dzResize = state;
            el._dzResizeMove = ev => this.onResizeDrag(ev);
            el._dzResizeUp = () => this.endResize();
            document.addEventListener('mousemove', el._dzResizeMove);
            document.addEventListener('mouseup', el._dzResizeUp);
            document.body.style.cursor = h.axis === 'col' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
        },

        onResizeDrag(e) {
            const MINCOL = 30, MINROW = 24;
            const el = this.$refs.editor;
            const s = el._dzResize; if (!s) return;
            if (s.axis === 'col') {
                let nw = s.w0 + (e.clientX - s.startX);
                if (s.hasNext) {
                    // Trade width with the neighbour so the table width stays constant.
                    // Fluid tables store the two changed columns as % of the table so
                    // they keep filling their ratio of the (100%-wide) container.
                    nw = Math.max(MINCOL, Math.min(nw, s.w0 + s.w1 - MINCOL));
                    const nw1 = s.w0 + s.w1 - nw;
                    if (s.fluid) {
                        s.cols[s.i].style.width = (nw / s.tableW * 100).toFixed(3) + '%';
                        s.cols[s.i + 1].style.width = (nw1 / s.tableW * 100).toFixed(3) + '%';
                    } else {
                        s.cols[s.i].style.width = nw + 'px';
                        s.cols[s.i + 1].style.width = nw1 + 'px';
                    }
                } else {
                    // Last column: grow the column and the table together, but never
                    // past the editor's content width (keeps the table on-screen).
                    const maxNw = s.maxTableW - s.tableW + s.w0;
                    nw = Math.min(Math.max(MINCOL, nw), Math.max(MINCOL, maxNw));
                    s.cols[s.i].style.width = nw + 'px';
                    s.table.style.width = (s.tableW + nw - s.w0) + 'px';
                }
            } else {
                const nh = Math.max(MINROW, s.h0 + (e.clientY - s.startY));
                s.tr.style.height = nh + 'px';
            }
        },

        endResize() {
            const el = this.$refs.editor;
            document.removeEventListener('mousemove', el._dzResizeMove);
            document.removeEventListener('mouseup', el._dzResizeUp);
            el._dzResize = null; el._dzResizeMove = null; el._dzResizeUp = null;
            el.style.cursor = '';
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Record one undo step for the whole drag; skip normalization (nothing
            // block-level moved) so the caret is left undisturbed.
            this.afterChange(true);
        },

        // Reflect the selection formatting into the toolbar. Buttons use reactive
        // state (mutated in place — reassigning this.active would orphan bindings);
        // the selects are set directly since their shown value is a DOM property.
        syncToolbar() {
            const a = this.active;
            a.bold = document.queryCommandState('bold');
            a.italic = document.queryCommandState('italic');
            a.underline = document.queryCommandState('underline');
            a.sup = document.queryCommandState('superscript');
            a.sub = document.queryCommandState('subscript');
            a.link = !!this.closestLink();
            const cell = this.currentCell();
            this.inTable = !!cell;
            this.tableFluid = cell ? this.tableIsFluid(cell.closest('table')) : false;
            // Editor-only affordance: dashed cell borders while a table is active
            // (the class lives on .rte-surface, which is not part of the saved HTML).
            this.$refs.editor.classList.toggle('dz-tables-on', !!cell);

            // Alignment is read from the dz-align-* class on the caret's block.
            const ab = this.selectedBlocks()[0];
            a.align = ab && ab.classList.contains('dz-align-center') ? 'center'
                : ab && ab.classList.contains('dz-align-right') ? 'right'
                : ab && ab.classList.contains('dz-align-justify') ? 'justify'
                : 'left';

            let block = (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '');
            if (!/^h[1-6]$/.test(block)) block = 'p';
            this.$refs.blockSelect.value = block;

            // List type is read from the dz-list-* class on the caret's list.
            const list = this.closestList();
            if (list) {
                const cls = [...list.classList].find(c => c.startsWith('dz-list-'));
                const style = cls ? cls.slice('dz-list-'.length) : (list.tagName === 'OL' ? 'decimal' : 'disc');
                this.$refs.listSelect.value = `${list.tagName.toLowerCase()}:${style}`;
            } else {
                this.$refs.listSelect.value = '';
            }

            // Font family / size from the caret's enclosing span classes.
            const fontCls = this.closestClass('dz-font-');
            this.$refs.fontSelect.value = fontCls ? fontCls.slice('dz-font-'.length) : '';
            const sizeCls = this.closestClass('dz-size-');
            this.$refs.sizeSelect.value = sizeCls ? sizeCls.slice('dz-size-'.length) : '';
        },

        // ── Public API for host code ──
        getHTML() { return this.empty() ? '' : this.$refs.editor.innerHTML; },
        setHTML(html) { this.$refs.editor.innerHTML = html || '<p><br></p>'; this.afterChange(); }
    },

    styles: `
        .rte {
            position: relative;
            border: 1px solid #d4d7e2;
            border-radius: 10px;
            overflow: hidden;
            background: #fff;
            font-family: 'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
        .rte-toolbar {
            position: relative;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px;
            padding: 8px;
            border-bottom: 1px solid #eceef5;
            background: #fafbff;
        }
        .rte-btn {
            min-width: 32px;
            height: 30px;
            padding: 0 8px;
            border: 1px solid transparent;
            border-radius: 6px;
            background: transparent;
            color: #2b2f3a;
            font-size: 13px;
            line-height: 1;
            cursor: pointer;
        }
        .rte-btn:hover { background: #eef0fb; }
        .rte-btn.is-active {
            background: #e6e7fb;
            border-color: #c3c5f5;
            color: #4244c7;
        }
        .rte-icon { display: inline-flex; align-items: center; justify-content: center; }
        .rte-icon svg { display: block; }
        .rte-icon svg line {
            stroke: currentColor;
            stroke-width: 1.6;
            stroke-linecap: round;
        }
        .rte-surface a { color: var(--dz-color-link, #4244c7); text-decoration: underline; }

        /* Color buttons + popover */
        .rte-color-btn {
            display: inline-flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 1px; font-weight: 600; line-height: 1;
        }
        .rte-hl { background: #fff3a3; padding: 0 2px; border-radius: 2px; }
        .rte-color-bar { width: 16px; height: 3px; border-radius: 2px; }
        .rte-color-pop {
            position: absolute; top: 100%; left: 8px; z-index: 20; margin-top: 4px;
            display: none; padding: 10px; width: 160px;
            background: #fff; border: 1px solid #d4d7e2; border-radius: 10px;
            box-shadow: 0 8px 24px rgba(20, 22, 32, 0.18);
        }
        .rte-color-pop.open { display: block; }
        .rte-color-head {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eceef5;
            font-size: 12px; color: #6b7180;
        }
        .rte-color-x {
            border: none; background: transparent; font-size: 16px; line-height: 1;
            color: #8a90a2; cursor: pointer; padding: 0 2px;
        }
        .rte-color-x:hover { color: #1f2330; }
        .rte-color-apply {
            flex: 1; padding: 6px; border: 1px solid #c3c5f5; border-radius: 6px;
            background: #eef0fb; color: #4244c7; font-size: 12px; font-weight: 600; cursor: pointer;
        }
        .rte-color-apply:hover { background: #e6e7fb; }
        .rte-swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .rte-swatch {
            width: 24px; height: 24px; border-radius: 6px;
            border: 1px solid rgba(20, 22, 32, 0.15); cursor: pointer; padding: 0;
        }
        .rte-swatch:hover { outline: 2px solid #c3c5f5; }
        /* Divider between preset swatches (top) and custom/none tools (bottom). */
        .rte-color-tools {
            display: flex; align-items: center; justify-content: flex-end; gap: 6px;
            margin-top: 10px; padding-top: 10px;
            border-top: 1px solid #eceef5;
        }
        .rte-tools-sep { width: 1px; align-self: stretch; background: #e2e5ef; margin: 0 2px; }
        .rte-wheel {
            background: conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
        }
        .rte-none {
            background-color: #fff;
            background-image: linear-gradient(45deg, transparent calc(50% - 1px), #e03131 calc(50% - 1px), #e03131 calc(50% + 1px), transparent calc(50% + 1px));
        }
        .rte-hidden-color {
            position: absolute; width: 1px; height: 1px;
            padding: 0; margin: 0; border: 0; opacity: 0;
        }

        /* Table row/col tools (shown only when the caret is in a cell) */
        .rte-tabletools { display: none; align-items: center; gap: 4px; }
        /* Table options get their own full-width row, divided from the main toolbar */
        .rte-tabletools.open {
            display: flex; flex-basis: 100%; flex-wrap: wrap; align-items: center; gap: 4px;
            margin-top: 4px; padding-top: 6px; border-top: 1px solid #e2e5ef;
        }
        .rte-tabletools-label {
            font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
            color: #9498a8; margin-right: 4px;
        }
        .rte-tbtn { min-width: 0; font-size: 11px; padding: 0 7px; }

        /* Table insert grid picker */
        .rte-tablepick { display: flex; flex-direction: column; }
        /* Divider between each row/section of options */
        .rte-pick-row { padding: 10px 0; border-bottom: 1px solid #eceef5; }
        .rte-grid { display: grid; gap: 2px; cursor: pointer; justify-content: center; margin-bottom: 8px; }
        .rte-gcell {
            width: 18px; height: 18px; padding: 0;
            border: 1px solid #d4d7e2; border-radius: 3px; background: #fff;
        }
        .rte-gcell.on { background: #c3c5f5; border-color: #5b5ef0; }
        .rte-grid-label { font-size: 12px; color: #6b7180; text-align: center; }
        .rte-hide { display: none; }
        .rte-adv-link {
            display: block; margin-top: 10px; width: 100%;
            border: none; background: transparent; color: #5b5ef0;
            font-size: 12px; cursor: pointer; text-align: center;
        }
        .rte-adv-link:hover { text-decoration: underline; }
        .rte-adv-row { display: flex; gap: 10px; }
        .rte-adv-toggles { display: flex; gap: 6px; flex-wrap: wrap; }
        .rte-dim-l { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7180; }
        .rte-dim {
            width: 52px; padding: 4px 6px; font-size: 13px;
            border: 1px solid #d4d7e2; border-radius: 6px;
        }
        .rte-adv-actions { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; }
        .rte-dim-go {
            padding: 6px 14px; border: 1px solid #5b5ef0;
            border-radius: 6px; background: #5b5ef0; color: #fff; font-weight: 600; cursor: pointer;
        }

        /* Link form (slotted into the reusable <modal> component) */
        .rte-link-form { width: min(340px, 80vw); }
        .rte-field-label {
            display: block;
            font-size: 12px;
            color: #6b7180;
            margin-bottom: 4px;
        }
        .rte-field {
            width: 100%;
            padding: 8px 10px;
            margin-bottom: 12px;
            border: 1px solid #d4d7e2;
            border-radius: 6px;
            font-size: 14px;
        }
        .rte-field:focus { outline: none; border-color: #5b5ef0; }
        .rte-toggle {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border: 1px solid #d4d7e2;
            border-radius: 6px;
            background: #fff;
            font-size: 13px;
            color: #2b2f3a;
            cursor: pointer;
        }
        .rte-toggle .dot {
            width: 14px; height: 14px;
            border-radius: 4px;
            border: 1px solid #c3c5d2;
            background: #fff;
        }
        .rte-toggle.is-on { border-color: #c3c5f5; background: #eef0fb; color: #4244c7; }
        .rte-toggle.is-on .dot { background: #5b5ef0; border-color: #5b5ef0; }
        .rte-dialog-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 16px;
        }
        .rte-spacer { flex: 1; }
        .rte-dialog-actions button {
            padding: 7px 14px;
            border: 1px solid #d4d7e2;
            border-radius: 6px;
            background: #fff;
            font-size: 13px;
            cursor: pointer;
        }
        .rte-dialog-actions .rte-primary {
            background: #5b5ef0;
            border-color: #5b5ef0;
            color: #fff;
            font-weight: 600;
        }
        .rte-dialog-actions .rte-danger { color: #c0455b; border-color: #e7c2ca; }
        .rte-select {
            height: 30px;
            padding: 0 6px;
            border: 1px solid #d4d7e2;
            border-radius: 6px;
            background: #fff;
            color: #2b2f3a;
            font-size: 13px;
            cursor: pointer;
        }
        .rte-select:hover { border-color: #c3c5f5; }
        .rte-sep {
            width: 1px;
            align-self: stretch;
            margin: 2px 4px;
            background: #e2e5ef;
        }
        .rte-surface {
            position: relative;
            min-height: 200px;
            /* Bounded height + internal scroll so the toolbar (and the contextual
               Table row) stays pinned above the content, usable even when the table
               is far down. Override with --rte-max-height on the host if needed. */
            max-height: var(--rte-max-height, 460px);
            overflow-y: auto;
            overscroll-behavior: contain;
            padding: 16px 18px;
            outline: none;
            font-size: 15px;
            line-height: 1.6;
            color: var(--dz-color-text, #1f2330);
        }
        .rte-surface.is-empty::before {
            content: attr(data-placeholder);
            position: absolute;
            color: #aab0c0;
            pointer-events: none;
        }
        /* margin-block (top/bottom only) so the global dz-indent-* (margin-left)
           classes are not clobbered by a margin shorthand resetting the left. */
        .rte-surface h1 { font-size: 26px; margin-block: 0 10px; }
        .rte-surface h2 { font-size: 21px; margin-block: 0 8px; }
        .rte-surface h3 { font-size: 18px; margin-block: 0 8px; }
        .rte-surface h4 { font-size: 16px; margin-block: 0 6px; }
        .rte-surface h5 { font-size: 14px; margin-block: 0 6px; }
        .rte-surface h6 { font-size: 13px; margin-block: 0 6px; text-transform: uppercase; letter-spacing: .4px; }
        .rte-surface p { margin-block: 0 10px; }
        .rte-surface ul, .rte-surface ol { margin-block: 0 10px; padding-left: 24px; }
        /* Dashed guide borders on hover or while a table is active (editor-only) */
        .rte-surface table:hover td,
        .rte-surface table:hover th,
        .rte-surface.dz-tables-on table td,
        .rte-surface.dz-tables-on table th { border: 1px dashed #9a9ef0; }

        /* ── Embedded content design system ─────────────────────────────────────
           A copy of the dz-* formatting rules the editor's output uses, so the
           component is fully self-contained (WYSIWYG works with no app wiring).
           assets/deezul-ui.css remains the CANONICAL library — published pages
           render saved HTML with it. Keep the two in sync when a class changes.
           (@font-face lives at document level; the component injects it on mount.) */

        /* Text alignment (left is the default — no class) */
        .dz-align-center { text-align: center; }
        .dz-align-right { text-align: right; }
        .dz-align-justify { text-align: justify; }

        /* Font families (curated/restricted set so the site stays consistent) */
        .dz-font-sans { font-family: 'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
        .dz-font-serif { font-family: 'Merriweather', Georgia, 'Times New Roman', serif; }
        .dz-font-mono { font-family: 'Source Code Pro', ui-monospace, 'Courier New', monospace; }

        /* Font sizes (medium/normal is the default — no class) */
        .dz-size-sm { font-size: 0.85em; }
        .dz-size-lg { font-size: 1.25em; }
        .dz-size-xl { font-size: 1.6em; }

        /* Text colors (palette; arbitrary colors use inline style instead) */
        .dz-fg-black { color: #1f2330; }
        .dz-fg-gray { color: #8a90a2; }
        .dz-fg-red { color: #c0455b; }
        .dz-fg-orange { color: #c2691c; }
        .dz-fg-green { color: #2f9e44; }
        .dz-fg-blue { color: #1c7ed6; }
        .dz-fg-purple { color: #7048e8; }
        .dz-fg-pink { color: #c2255c; }

        /* Highlight colors */
        .dz-bg-yellow { background-color: #fff3a3; }
        .dz-bg-green { background-color: #c3f0ca; }
        .dz-bg-blue { background-color: #c5e3ff; }
        .dz-bg-pink { background-color: #ffd6e7; }
        .dz-bg-orange { background-color: #ffe2c2; }
        .dz-bg-gray { background-color: #e4e6ee; }

        /* Tables */
        .dz-table { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
        .dz-table td, .dz-table th { border: 1px solid var(--dz-color-border, #d4d7e2); padding: 6px 8px; min-width: 28px; }
        .dz-table th { background: var(--dz-color-subtle, #f4f5fb); font-weight: 600; text-align: left; }
        .dz-table-plain td, .dz-table-plain th { border: none; }
        .dz-valign-top { vertical-align: top; }
        .dz-valign-middle { vertical-align: middle; }
        .dz-valign-bottom { vertical-align: bottom; }

        /* Block indentation (paragraphs/headings; lists indent via nesting instead) */
        .dz-indent-1 { margin-left: 2em; }
        .dz-indent-2 { margin-left: 4em; }
        .dz-indent-3 { margin-left: 6em; }
        .dz-indent-4 { margin-left: 8em; }
        .dz-indent-5 { margin-left: 10em; }
        .dz-indent-6 { margin-left: 12em; }

        /* List markers */
        .dz-list-disc { list-style-type: disc; }
        .dz-list-circle { list-style-type: circle; }
        .dz-list-square { list-style-type: square; }
        .dz-list-decimal { list-style-type: decimal; }
        .dz-list-lower-alpha { list-style-type: lower-alpha; }
        .dz-list-upper-alpha { list-style-type: upper-alpha; }
        .dz-list-lower-roman { list-style-type: lower-roman; }
        .dz-list-upper-roman { list-style-type: upper-roman; }
    `
});
