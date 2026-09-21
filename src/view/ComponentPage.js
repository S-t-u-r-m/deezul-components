export default Deezul.Component({
    // The workbench for one component: every demo in its catalog entry, each mounted for
    // real next to the exact props that produced it.
    //
    // TWO TEMPLATE RULES ARE LOAD-BEARING HERE:
    //
    // 1. No `:if` in this template. `ref` is resolved by a compile-time positional path into
    //    the rendered tree, so an `:if` earlier at the same level shifts the indices and the
    //    ref silently lands on the wrong node. The header handles its empty states with text
    //    and `:empty` CSS instead, which keeps the path stable.
    //
    // 2. The mount snippet goes through an interpolation as a STRING. Writing it as escaped
    //    markup (&lt;dz-component&gt;) does not work: the compiler decodes entities and parses
    //    the result, so it becomes a real element with a bogus dz-type and the runtime renders
    //    its "Loading…" spinner forever.
    //
    // The demos themselves are built imperatively because a demo's props are an arbitrary
    // object — the same way a page model instantiates a block: create <dz-component>, set
    // dz-type, hand it `_props`.
    //
    // EVENT LOG: a demo that emits events (the entry's `actions` and `events`, plus the demo's
    // own menu entries) gets a log under it. Components emit on their host element without
    // bubbling, so the listeners go on the demo element itself. When the entry has a handler
    // for the event (demo-actions.js), it runs first and can push new items into the demo.
    //
    // TRY DEMOS: a demo with `try` ([{ label, code, run }]) mounts nothing; it shows a button per
    // entry that calls run(), its code, and a log of what run() returned (toasts from DzToast).
    template: `
        <div class="page">
            <p class="crumb">{{ crumb }}</p>
            <h1>{{ heading }}</h1>
            <p class="lede">{{ lede }}</p>
            <code class="ref">{{ snippet }}</code>
            <div class="demos" ref="host"></div>
        </div>
    `,

    data: () => ({ crumb: '', heading: '', lede: '', snippet: '' }),

    $mounted() {
        const ref = (this.$route && this.$route.params && this.$route.params.ref) || '';
        const catalog = (typeof window !== 'undefined' && window.DzCatalog) || [];
        const entry = catalog.find(c => c.ref === ref) || null;

        if (!entry) {
            this.heading = 'Not in the catalog';
            this.lede = 'No entry for "' + ref + '" in catalog.config.js.';
            return;
        }

        this.crumb = entry.group || 'Components';
        this.heading = entry.name;
        this.lede = entry.summary || '';
        this.snippet = '<dz-component dz-type="' + entry.ref + '"></dz-component>';

        const host = this.$refs.host;
        const demos = entry.demos && entry.demos.length
            ? entry.demos
            : [{ label: 'Default', props: {} }];   // a component with no demos still gets mounted once

        for (const demo of demos) {
            const card = document.createElement('section');
            card.className = 'demo';

            const label = document.createElement('p');
            label.className = 'dlabel';
            label.textContent = demo.label || 'Demo';
            card.appendChild(label);

            const stage = document.createElement('div');
            stage.className = 'stage';

            if (Array.isArray(demo.try)) {
                host.appendChild(this.tryDemo(card, stage, demo));
                continue;
            }

            const el = document.createElement('dz-component');
            el.setAttribute('dz-type', entry.ref);
            el._props = { ...(demo.props || {}) };
            // Slot content for container components: `children` entries are either components
            // ({ type, props }) or plain elements ({ tag, text }), each optionally in a named
            // `slot` and with extra `attrs`. Text goes in as textContent — never markup.
            (Array.isArray(demo.children) ? demo.children : []).forEach(child => {
                const kid = document.createElement(child.type ? 'dz-component' : (child.tag || 'p'));
                if (child.type) {
                    kid.setAttribute('dz-type', child.type);
                    kid._props = { ...(child.props || {}) };
                } else {
                    kid.textContent = child.text || '';
                }
                if (child.slot) kid.setAttribute('slot', child.slot);
                Object.keys(child.attrs || {}).forEach(name => kid.setAttribute(name, child.attrs[name]));
                el.appendChild(kid);
            });
            stage.appendChild(el);
            card.appendChild(stage);

            // textContent, never innerHTML — demo props are data, and a prop containing
            // markup must show as text here rather than render into the page.
            const code = document.createElement('pre');
            code.className = 'props';
            code.textContent = JSON.stringify(Array.isArray(demo.children)
                ? { props: demo.props || {}, children: demo.children } : demo.props || {}, null, 2);
            // Long values scroll sideways, and a scrolling area must be reachable by keyboard.
            code.tabIndex = 0;
            code.setAttribute('role', 'region');
            code.setAttribute('aria-label', 'Props for ' + (demo.label || 'demo'));

            const log = this.eventLog(entry, demo, el, code);
            if (log) card.appendChild(log);
            card.appendChild(code);

            host.appendChild(card);
        }
    },

    methods: {
        // A demo that is code to run rather than a component to mount: `try` is a list of
        // { label, code, run }. Each becomes a button that calls run(); the code is shown in place
        // of props, and what run() returns (a promise too) is written to the log.
        tryDemo(card, stage, demo) {
            const row = document.createElement('div');
            row.className = 'try';
            const { box, write } = this.makeLog(demo);
            demo.try.forEach(entry => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'try-button';
                button.textContent = entry.label;
                button.addEventListener('click', async () => {
                    try {
                        const result = typeof entry.run === 'function' ? entry.run() : undefined;
                        write(entry.label, 'shown');
                        const settled = await result;
                        if (settled && typeof settled === 'object') write(entry.label, this.summarize(settled, {}));
                    } catch (error) {
                        write(entry.label, 'failed: ' + error.message);
                    }
                });
                row.appendChild(button);
            });
            stage.appendChild(row);
            card.appendChild(stage);
            card.appendChild(box);

            const code = document.createElement('pre');
            code.className = 'props';
            code.textContent = demo.try.map(entry => entry.code || '').filter(Boolean).join(String.fromCharCode(10));
            code.tabIndex = 0;
            code.setAttribute('role', 'region');
            code.setAttribute('aria-label', 'Code for ' + (demo.label || 'demo'));
            card.appendChild(code);
            return card;
        },

        // An empty event log: { box, write(name, text) }, newest line first, six at most.
        makeLog(demo) {
            const box = document.createElement('div');
            box.className = 'log';
            const title = document.createElement('p');
            title.className = 'log-title';
            title.textContent = 'Events';
            // role="log" is not allowed on a list element, so the log is plain divs, newest first.
            const list = document.createElement('div');
            list.className = 'log-list';
            list.setAttribute('role', 'log');
            list.setAttribute('aria-label', 'Events from ' + (demo.label || 'demo'));
            const empty = document.createElement('div');
            empty.className = 'log-empty';
            empty.textContent = 'Use the demo; its events show here.';
            list.appendChild(empty);
            box.append(title, list);

            const write = (name, text) => {
                empty.remove();
                const line = document.createElement('div');
                const tag = document.createElement('span');
                tag.className = 'log-name';
                tag.textContent = name;
                line.append(tag, document.createTextNode(text ? ' ' + text : ''));
                list.prepend(line);
                while (list.children.length > 6) list.lastElementChild.remove();
            };
            return { box, write };
        },

        // Build a demo's event log, or return null when the demo emits nothing worth logging.
        eventLog(entry, demo, el, code) {
            const props = demo.props || {};
            const actions = entry.actions || {};
            const menuEvents = (Array.isArray(props.menu) ? props.menu : []).map(m => m && m.event).filter(Boolean);
            const names = [...new Set([...(entry.events || []), ...Object.keys(actions), ...menuEvents])];
            if (!names.length) return null;

            const copy = value => JSON.parse(JSON.stringify(value === undefined ? null : value));
            const state = { items: copy(props.items || []) };
            const context = {
                props,
                get items() { return state.items; },
                setItems(next) {
                    state.items = copy(next);
                    if (el.component && el.component.proxy) el.component.proxy.items = copy(next);
                    code.textContent = JSON.stringify({ ...props, items: state.items }, null, 2);
                }
            };
            const { box, write } = this.makeLog(demo);

            names.forEach(name => {
                el.addEventListener(name, async event => {
                    let note = '';
                    try {
                        // A handler that asks first (DzPrompt) returns a promise; log once it is answered.
                        const result = typeof actions[name] === 'function' ? await actions[name](event.detail, context) : '';
                        note = typeof result === 'string' ? result : '';
                    } catch (error) {
                        note = 'handler failed: ' + error.message;
                    }
                    const summary = this.summarize(event.detail, props);
                    write(name, [summary, note && '(' + note + ')'].filter(Boolean).join(' '));
                });
            });
            return box;
        },

        // One line for an event's detail: items by their label (or title, or name), paths as
        // [0, 2], other arrays by their length.
        summarize(detail, props) {
            const nameKeys = [props.labelKey || 'label', 'title', 'name'];
            const named = value => value && typeof value === 'object' && nameKeys.some(key => key in value);
            const nameOf = value => JSON.stringify(String(value[nameKeys.find(key => key in value)]));
            const show = (key, value) => {
                if (value === null || value === undefined) return 'none';
                if (Array.isArray(value)) {
                    return /path$/i.test(key) ? '[' + value.join(', ') + ']' : value.length + (value.length === 1 ? ' entry' : ' entries');
                }
                if (typeof value === 'object') return named(value) ? nameOf(value) : '{...}';
                return String(value);
            };
            if (detail === null || detail === undefined) return '';
            if (typeof detail !== 'object') return String(detail);
            if (named(detail) && !('event' in detail)) return show('', detail);   // select hands over the item itself
            return Object.keys(detail).map(key => key + ': ' + show(key, detail[key])).join(', ');
        }
    },

    styles: `
        .page { max-width: 960px; padding: 40px 44px 64px; }
        @media (max-width: 767.98px) { .page { padding: 24px 16px 40px; } .stage { padding: 18px 14px; } }

        /* Standing in for :if — an unused header line collapses instead of leaving a gap. */
        .crumb:empty, .lede:empty, .ref:empty { display: none; }

        .crumb { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
                 color: var(--dz-color-muted, #6b7180); }
        h1 { margin: 6px 0; font-family: var(--dz-font-heading, inherit); font-size: 26px;
             color: var(--dz-color-heading, #1f2330); }
        .lede { max-width: 60ch; line-height: 1.6; color: var(--dz-color-muted, #6b7180); }
        .ref { display: inline-block; margin-top: 12px; padding: 5px 9px; border-radius: 6px;
               background: rgba(0,0,0,.05); font-family: var(--dz-font-mono, monospace); font-size: 12px;
               color: var(--dz-color-text, #2b2f3a); }   /* muted grey on the tint was ~4.2:1 */

        .demos { margin-top: 30px; display: flex; flex-direction: column; gap: 18px; }
        .demo { background: var(--dz-color-surface, #fff);
                border: 1px solid var(--dz-color-border, #e4e6ee);
                border-radius: var(--dz-radius, 8px); }
        /* No overflow: hidden on .demo — it would clip a component's dropdowns. The props block
           rounds its own bottom corners instead. */
        .props { border-radius: 0 0 var(--dz-radius, 8px) var(--dz-radius, 8px); }
        .dlabel { padding: 10px 16px; font-size: 12px; font-weight: 700;
                  color: var(--dz-color-muted, #6b7180);
                  border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
        .stage { padding: 26px 22px; }
        .try { display: flex; flex-wrap: wrap; gap: 10px; }
        /* White on #4a4dd6, 6.1:1. */
        .try-button { min-height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: #4a4dd6;
                      font: inherit; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; }
        .try-button:hover { background: #3b3ec2; }
        .try-button:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 3px; }
        .log { padding: 10px 16px 12px; border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .log-title { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
                     color: var(--dz-color-muted, #6b7180); }
        .log-list { font-family: var(--dz-font-mono, monospace); font-size: 12px;
                    line-height: 1.6; color: var(--dz-color-text, #2b2f3a); overflow-wrap: anywhere; }
        .log-list > div:first-child { font-weight: 600; }
        .log-name { display: inline-block; min-width: 4.5rem; color: var(--dz-color-heading, #1f2330); font-weight: 700; }
        .log-empty { font-family: var(--dz-font-body, inherit); font-style: italic; color: var(--dz-color-muted, #6b7180); }
        .props { margin: 0; padding: 12px 16px; overflow-x: auto;
                 background: #1f2330; color: #d8dbe8;
                 font-family: var(--dz-font-mono, monospace); font-size: 12px; line-height: 1.5; }
    `
});
