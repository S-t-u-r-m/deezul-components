export default Deezul.Component({
    // Button — the library's worked example; copy its shape when adding your own.
    //
    // It shows the four things every reusable block here should do: declare a `schema` so
    // a host editor can drive it, mirror those defaults in `data`, paint from `--dz-*`
    // tokens with literal fallbacks so it survives in an app that never loaded tokens.css,
    // and emit an event rather than reaching outward.
    //
    // Renders as an <a> when given an href and a <button> otherwise — a thing that
    // navigates should be a link, so middle-click and "open in new tab" keep working.
    schema: {
        inputs: {
            label:    { type: 'string', default: 'Button', label: 'Label' },
            variant:  { type: 'enum', options: ['primary', 'secondary', 'ghost', 'danger'], default: 'primary', label: 'Style' },
            size:     { type: 'enum', options: ['sm', 'md', 'lg'], default: 'md', label: 'Size' },
            href:     { type: 'string', default: '', label: 'URL (blank = button)' },
            disabled: { type: 'boolean', default: false, label: 'Disabled' },
            block:    { type: 'boolean', default: false, label: 'Full width' }
        }
    },

    // Emits: `press` — an enabled button was clicked (the link form navigates instead).

    template: `
        <a class="btn" :class="btnClass" :if="href && !disabled" :href="href">{{ label }}</a>
        <button type="button" class="btn" :class="btnClass" :if="!(href && !disabled)"
                :disabled="disabled" @click="press()">{{ label }}</button>
    `,

    data: () => ({
        label: 'Button', variant: 'primary', size: 'md', href: '', disabled: false, block: false
    }),

    computed: {
        btnClass() {
            return 'btn-' + this.variant + ' btn-' + this.size + (this.block ? ' btn-block' : '');
        }
    },

    methods: {
        // The parent decides what a press means; this block only reports that one happened.
        press() {
            if (!this.disabled) this.$emit('press');
        }
    },

    styles: `
        :host { display: inline-block; }
        :host([hidden]) { display: none; }

        .btn { display: inline-flex; align-items: center; justify-content: center; gap: .5em;
               font-family: var(--dz-font-body, inherit); font-weight: 600; line-height: 1;
               text-decoration: none; white-space: nowrap; cursor: pointer;
               border: 1px solid transparent; border-radius: var(--dz-radius, 8px);
               transition: background-color .16s ease, border-color .16s ease, color .16s ease; }
        .btn:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }

        /* Sizes */
        .btn-sm { padding: .45rem .8rem;  font-size: .82rem; }
        .btn-md { padding: .6rem 1.1rem;  font-size: .92rem; }
        .btn-lg { padding: .8rem 1.5rem;  font-size: 1.02rem; }
        .btn-block { display: flex; width: 100%; }

        /* Variants */
        .btn-primary { background: var(--dz-color-primary, #5b5ef0); color: #fff; }
        .btn-primary:hover:not(:disabled) { filter: brightness(1.08); }

        .btn-secondary { background: var(--dz-color-surface, #fff);
                         border-color: var(--dz-color-border, #e4e6ee);
                         color: var(--dz-color-text, #2b2f3a); }
        .btn-secondary:hover:not(:disabled) { border-color: var(--dz-color-primary, #5b5ef0);
                                              color: var(--dz-color-primary, #5b5ef0); }

        .btn-ghost { background: transparent; color: var(--dz-color-primary, #5b5ef0); }
        .btn-ghost:hover:not(:disabled) { background: rgba(91, 94, 240, .1); }

        .btn-danger { background: var(--dz-color-danger, #c0455b); color: #fff; }
        .btn-danger:hover:not(:disabled) { filter: brightness(1.08); }
    `
});
