export default Deezul.Component({
    // The index: one card per component in the catalog. It is the empty-state screen too —
    // a fresh clone with nothing registered says so rather than showing a blank page.
    template: `
        <div class="page">
            <h1>Component library</h1>
            <p class="lede">Reusable Deezul blocks. Open one to see every state it supports
               and the props that produce them.</p>

            <div class="empty" :if="!items.length">
                <p>Nothing registered yet. Add a component to
                   <code>src/component/</code>, then list it in <code>modules.config.js</code>
                   and <code>catalog.config.js</code>.</p>
            </div>

            <div class="grid">
                <a class="card" :for="c in cards" :href="'/c/' + c.ref">
                    <p class="cgroup">{{ c.group || 'Components' }}</p>
                    <h2>{{ c.name }}</h2>
                    <p class="sum">{{ c.summary }}</p>
                    <code class="ref">{{ c.snippet }}</code>
                </a>
            </div>
        </div>
    `,

    data: () => ({ items: (typeof window !== 'undefined' && window.DzCatalog) || [] }),

    computed: {
        // The mount snippet is built here, as a STRING, and reaches the page through an
        // interpolation. Writing it in the template as &lt;dz-component&gt; does not work:
        // the compiler decodes entities and then parses the result as markup, so the escaped
        // tag becomes a real <dz-component> whose dz-type is an unresolvable ref — which the
        // runtime answers with its “Loading…” spinner. Interpolated text is inserted as text.
        cards() {
            return this.items.map(c => ({ ...c, snippet: '<dz-component dz-type="' + c.ref + '"></dz-component>' }));
        }
    },

    styles: `
        .page { max-width: 960px; padding: 40px 44px 64px; }
        h1 { font-family: var(--dz-font-heading, inherit); font-size: 26px;
             color: var(--dz-color-heading, #1f2330); }
        .lede { margin: 8px 0 30px; max-width: 60ch; line-height: 1.6;
                color: var(--dz-color-muted, #6b7180); }

        .empty { padding: 26px; border: 1px dashed var(--dz-color-border, #e4e6ee);
                 border-radius: var(--dz-radius, 8px); line-height: 1.7;
                 color: var(--dz-color-muted, #6b7180); }

        .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
        .card { display: block; padding: 18px 20px; text-decoration: none;
                background: var(--dz-color-surface, #fff);
                border: 1px solid var(--dz-color-border, #e4e6ee);
                border-radius: var(--dz-radius, 8px);
                transition: border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
        .card:hover { border-color: var(--dz-color-primary, #5b5ef0); transform: translateY(-2px);
                      box-shadow: var(--dz-shadow, 0 18px 40px -24px rgba(0,0,0,.35)); }
        .cgroup { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
                  color: var(--dz-color-muted, #6b7180); }
        .card h2 { margin: 6px 0; font-size: 17px; color: var(--dz-color-heading, #1f2330); }
        .sum { font-size: 13px; line-height: 1.55; color: var(--dz-color-muted, #6b7180); }
        .ref { display: block; margin-top: 12px; font-family: var(--dz-font-mono, monospace);
               font-size: 11px; color: var(--dz-color-text, #2b2f3a); word-break: break-all; }   /* secondary on the code tint failed WCAG AA */

        code { font-family: var(--dz-font-mono, monospace); font-size: .92em;
               padding: 1px 5px; border-radius: 4px; background: rgba(0,0,0,.05); }
    `
});
