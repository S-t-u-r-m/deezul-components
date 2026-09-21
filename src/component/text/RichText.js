export default Deezul.Component({
    // RichText — shows HTML written with rich_text_editor, read-only, styled with the same dz-*
    // classes (alignment, fonts, sizes, colors, tables, indents, list markers).
    //
    //   <dz-component dz-type="rich_text" :html="article.body"></dz-component>
    //
    // SAFE BY ALLOWLIST: the HTML comes from the CMS, so it is parsed in an inert document and
    // rebuilt from what the editor can produce. Anything else never reaches the page.
    //   elements     p, h1–h6, lists, links, b/strong, i/em, u, s, sup, sub, span, br, hr,
    //                blockquote, pre, code, div, tables, img. Scripts, styles, frames, forms,
    //                SVG and the like are dropped with their content; unknown wrappers are
    //                unwrapped (their text kept).
    //   classes      only dz-* names
    //   styles       only color and background-color, and the table sizing the editor writes
    //                (table width and layout, column widths, row heights); no url()
    //   links        href through DzGlobal.safeHref (http(s), mailto, tel, site or relative);
    //                target="_blank" gets rel="noopener noreferrer"
    //   images       src must be http(s) or a site or relative path; alt kept
    //   no event handlers, ids, data or aria attributes
    //
    // HEADINGS: minHeadingLevel shifts the content's headings down so the highest is at least
    // that level, keeping their order: an article with an h1 title passes 2, and the body's
    // h1 and h2 become h2 and h3. 0 = leave them as written.
    //
    // TABLES scroll sideways inside their own box when they are wider than the text.
    //
    // OPTIONS:
    //   html             the saved HTML
    //   minHeadingLevel  see HEADINGS (default 0 = off)
    //   size             'small', 'normal' (default) or 'large' base text size
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js.
    schema: {
        inputs: {
            html:            { type: 'text', default: '', label: 'Content (HTML)' },
            minHeadingLevel: { type: 'number', default: 0, label: 'Highest heading level (0 = as written)' },
            size:            { type: 'enum', options: ['small', 'normal', 'large'], default: 'normal', label: 'Text size' }
        }
    },

    // `ref` only on the outermost element; the content is built into it imperatively.
    template: html`<div class="rt" ref="root" :class="'is-' + sizeName"></div>`,

    data: () => ({ html: '', minHeadingLevel: 0, size: 'normal' }),

    $mounted() {
        this.render();
    },

    $updated() {
        this.render();
    },

    computed: {
        sizeName() {
            return this.size === 'small' || this.size === 'large' ? this.size : 'normal';
        }
    },

    methods: {
        // Rebuild the content when the HTML or the heading level changed.
        render() {
            const root = DzGlobal.raw(this.$refs.root);
            if (!root) return;
            const html = DzGlobal.text(this.html);
            const level = Math.round(Number(this.minHeadingLevel));
            const signature = level + '|' + html;
            if (root._rtSignature === signature) return;
            root._rtSignature = signature;
            const fragment = this.clean(html, level >= 1 && level <= 6 ? level : 0);
            root.replaceChildren(fragment);
            if (html.includes('dz-font-')) this.loadFonts();
        },

        // The allowlist rebuild described above. Returns a DocumentFragment in this document.
        clean(html, minLevel) {
            const parsed = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
            const out = document.createDocumentFragment();
            const keep = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'b', 'strong', 'i', 'em', 'u', 's',
                'sup', 'sub', 'span', 'br', 'hr', 'blockquote', 'pre', 'code', 'div',
                'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'img'];
            const drop = ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'template', 'noscript',
                'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta', 'base',
                'head', 'title', 'audio', 'video', 'source', 'track', 'canvas', 'dialog', 'slot'];

            // Heading shift: how far the highest heading in the content is above minLevel.
            let shift = 0;
            if (minLevel) {
                const levels = [...parsed.body.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(h => Number(h.tagName.slice(1)));
                const highest = levels.length ? Math.min(...levels) : minLevel;
                shift = Math.max(0, minLevel - highest);
            }

            // A scratch element's CSSOM rejects invalid values for us.
            const probe = document.createElement('span');
            const styleFor = (source, tag) => {
                const allowed = ['color', 'background-color'];
                if (tag === 'table') allowed.push('width', 'table-layout');
                if (tag === 'col') allowed.push('width');
                if (tag === 'tr') allowed.push('height');
                probe.removeAttribute('style');
                // Keywords like `initial` are what a shorthand leaves behind (background: url(...)).
                const keywords = ['initial', 'inherit', 'unset', 'revert', 'revert-layer'];
                allowed.forEach(name => {
                    const value = source.style.getPropertyValue(name).trim();
                    const lower = value.toLowerCase();
                    if (value && !lower.includes('url(') && !keywords.includes(lower)) probe.style.setProperty(name, value);
                });
                return probe.getAttribute('style') || '';
            };
            const wholeNumber = value => {
                const n = Number(value);
                return Number.isInteger(n) && n > 0 && n < 1000 ? String(n) : '';
            };

            const copy = (source, parent) => {
                source.childNodes.forEach(node => {
                    if (node.nodeType === 3) {
                        parent.appendChild(document.createTextNode(node.textContent));
                        return;
                    }
                    if (node.nodeType !== 1) return;
                    const tag = node.tagName.toLowerCase();
                    if (drop.includes(tag)) return;
                    if (!keep.includes(tag)) {
                        copy(node, parent);   // unknown wrapper: keep its content
                        return;
                    }

                    let name = tag;
                    if (shift && tag.length === 2 && tag.charAt(0) === 'h') name = 'h' + Math.min(6, Number(tag.charAt(1)) + shift);
                    const el = document.createElement(name);

                    const classes = (node.getAttribute('class') || '').split(' ').filter(c => c.startsWith('dz-'));
                    if (classes.length) el.setAttribute('class', classes.join(' '));
                    const style = styleFor(node, tag);
                    if (style) el.setAttribute('style', style);

                    if (tag === 'a') {
                        const href = DzGlobal.safeHref(node.getAttribute('href'));
                        if (href) el.setAttribute('href', href);
                        if (href && node.getAttribute('target') === '_blank') {
                            el.setAttribute('target', '_blank');
                            el.setAttribute('rel', 'noopener noreferrer');
                        }
                    }
                    if (tag === 'img') {
                        const src = DzGlobal.safeHref(node.getAttribute('src'));
                        const lower = src.toLowerCase();
                        if (!src || lower.startsWith('mailto:') || lower.startsWith('tel:')) return;
                        el.setAttribute('src', src);
                        el.setAttribute('alt', node.getAttribute('alt') || '');
                        ['width', 'height'].forEach(attr => {
                            const n = wholeNumber(node.getAttribute(attr));
                            if (n) el.setAttribute(attr, n);
                        });
                    }
                    if (tag === 'td' || tag === 'th') {
                        ['colspan', 'rowspan'].forEach(attr => {
                            const n = wholeNumber(node.getAttribute(attr));
                            if (n) el.setAttribute(attr, n);
                        });
                    }
                    if (tag === 'ol') {
                        const n = wholeNumber(node.getAttribute('start'));
                        if (n) el.setAttribute('start', n);
                    }

                    copy(node, el);
                    if (tag === 'table') {
                        // Wide tables scroll in their own box, which keyboard users can reach.
                        const box = document.createElement('div');
                        box.setAttribute('class', 'rt-table');
                        box.setAttribute('tabindex', '0');
                        box.appendChild(el);
                        parent.appendChild(box);
                    } else {
                        parent.appendChild(el);
                    }
                });
            };
            copy(parsed.body, out);
            return out;
        },

        // The dz-font-* faces, once per document (@font-face does nothing inside a shadow root).
        // Same faces and element id as rich_text_editor, so whichever mounts first adds them.
        loadFonts() {
            if (document.getElementById('dz-rte-fonts')) return;
            const face = (family, file, weight, style) => "@font-face { font-family: '" + family + "'; src: url('/assets/fonts/"
                + file + "') format('woff2'); font-weight: " + weight + '; font-style: ' + style + '; font-display: swap; }';
            const fonts = document.createElement('style');
            fonts.id = 'dz-rte-fonts';
            fonts.textContent = [
                face('Public Sans', 'PublicSans-Variable.woff2', '100 900', 'normal'),
                face('Public Sans', 'PublicSans-Italic-Variable.woff2', '100 900', 'italic'),
                face('Merriweather', 'Merriweather-Variable.woff2', '300 900', 'normal'),
                face('Merriweather', 'Merriweather-Italic-Variable.woff2', '300 900', 'italic'),
                face('Source Code Pro', 'SourceCodePro-Variable.woff2', '200 900', 'normal')
            ].join(String.fromCharCode(10));
            document.head.appendChild(fonts);
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .rt { font-family: var(--dz-font-body, inherit); font-size: 1.0625rem; line-height: 1.75; color: var(--dz-color-text, #2b2f3a);
              overflow-wrap: anywhere; }
        .rt.is-small { font-size: .9375rem; line-height: 1.65; }
        .rt.is-large { font-size: 1.1875rem; }
        .rt > :first-child { margin-top: 0; }
        .rt > :last-child { margin-bottom: 0; }

        .rt p, .rt ul, .rt ol, .rt blockquote, .rt pre { margin-block: 0 1em; }
        .rt h1, .rt h2, .rt h3, .rt h4, .rt h5, .rt h6 { margin-block: 1.4em .5em; font-family: var(--dz-font-heading, inherit);
            line-height: 1.25; color: var(--dz-color-heading, #1f2330); }
        .rt h1 { font-size: 1.75em; }
        .rt h2 { font-size: 1.4em; }
        .rt h3 { font-size: 1.2em; }
        .rt h4 { font-size: 1.05em; }
        .rt h5 { font-size: 1em; }
        .rt h6 { font-size: .9em; text-transform: uppercase; letter-spacing: .04em; }
        .rt ul, .rt ol { padding-left: 1.5em; }
        .rt li + li { margin-top: .25em; }
        .rt li > ul, .rt li > ol { margin-block: .25em 0; }
        .rt a { color: #4a4dd6; text-decoration: underline; text-underline-offset: 2px; }
        .rt a:focus-visible, .rt-table:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .rt blockquote { padding: .25em 0 .25em 1em; border-left: 4px solid var(--dz-color-border, #e4e6ee); color: #4b5060; }
        .rt pre { overflow-x: auto; padding: .75em 1em; border-radius: 8px; background: var(--dz-color-bg, #f7f7fb); }
        .rt code { font-family: var(--dz-font-mono, ui-monospace, monospace); font-size: .9em; }
        .rt hr { margin: 1.5em 0; border: 0; border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .rt img { max-width: 100%; height: auto; }
        .rt-table { max-width: 100%; margin: 0 0 1em; overflow-x: auto; }
        .rt-table > table { margin: 0; }

        /* ---- The editor's formatting classes: the same rules as rich_text_editor and the CMS's
           assets/deezul-ui.css. Keep all three in sync when a class changes. */
        .dz-align-center { text-align: center; }
        .dz-align-right { text-align: right; }
        .dz-align-justify { text-align: justify; }

        .dz-font-sans { font-family: 'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
        .dz-font-serif { font-family: 'Merriweather', Georgia, 'Times New Roman', serif; }
        .dz-font-mono { font-family: 'Source Code Pro', ui-monospace, 'Courier New', monospace; }

        .dz-size-sm { font-size: 0.85em; }
        .dz-size-lg { font-size: 1.25em; }
        .dz-size-xl { font-size: 1.6em; }

        .dz-fg-black { color: #1f2330; }
        .dz-fg-gray { color: #8a90a2; }
        .dz-fg-red { color: #c0455b; }
        .dz-fg-orange { color: #c2691c; }
        .dz-fg-green { color: #2f9e44; }
        .dz-fg-blue { color: #1c7ed6; }
        .dz-fg-purple { color: #7048e8; }
        .dz-fg-pink { color: #c2255c; }

        .dz-bg-yellow { background-color: #fff3a3; }
        .dz-bg-green { background-color: #c3f0ca; }
        .dz-bg-blue { background-color: #c5e3ff; }
        .dz-bg-pink { background-color: #ffd6e7; }
        .dz-bg-orange { background-color: #ffe2c2; }
        .dz-bg-gray { background-color: #e4e6ee; }

        .dz-table { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
        .dz-table td, .dz-table th { border: 1px solid var(--dz-color-border, #d4d7e2); padding: 6px 8px; min-width: 28px; }
        .dz-table th { background: var(--dz-color-subtle, #f4f5fb); font-weight: 600; text-align: left; }
        .dz-table-plain td, .dz-table-plain th { border: none; }
        .dz-valign-top { vertical-align: top; }
        .dz-valign-middle { vertical-align: middle; }
        .dz-valign-bottom { vertical-align: bottom; }

        .dz-indent-1 { margin-left: 2em; }
        .dz-indent-2 { margin-left: 4em; }
        .dz-indent-3 { margin-left: 6em; }
        .dz-indent-4 { margin-left: 8em; }
        .dz-indent-5 { margin-left: 10em; }
        .dz-indent-6 { margin-left: 12em; }

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
