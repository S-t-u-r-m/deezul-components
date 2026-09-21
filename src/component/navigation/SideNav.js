export default Deezul.Component({
    // SideNav — a sidebar of grouped links that collapses to a top bar with a menu button on
    // narrow screens.
    //
    // DATA: `items` is an array of objects of ANY shape. These props say which fields to read:
    //   labelKey  (default 'label')  the link text
    //   hrefKey   (default 'href')   where it goes
    //   groupKey  (default 'group')  the heading it sits under. Groups appear in the order they're
    //                                first seen; items without one sit at the top, unheaded.
    //
    //   <dz-component dz-type="side_nav" :title="'Admin'" :subtitle="'v2.4'" :items="links"></dz-component>
    //
    // OPTIONS:
    //   title, titleHref  the brand link at the top (titleHref defaults to '/')
    //   subtitle          a muted line under it (blank = none)
    //   navLabel          the nav landmark's name for screen readers. Blank (the default) uses the
    //                     title, else 'Main'. Give each nav on a page a different name.
    //   width             the sidebar's width on wide screens (default '230px')
    //   collapseBelow     viewport width in px under which it becomes a top bar (default 768).
    //                     A host layout that stacks for phones should use the same breakpoint.
    //   activeHref        the link to mark as the current page. Blank (the default) follows the
    //                     URL: a link is current when its href equals location.pathname.
    //   matchPrefix       also mark a link current for pages BELOW its href (default false):
    //                     '/orders' stays current on '/orders/1042'. An exact match wins, then
    //                     the longest matching href; '/' only ever matches exactly.
    //   labels            text overrides: { openMenu, closeMenu } (defaults 'Open menu', 'Close menu')
    //
    // NEEDS: window.DzGlobal (global.js) for labels, and the --dz-icon-menu / --dz-icon-close
    // custom properties (assets/icons.css) for the menu button.
    //
    // Links are plain <a href>, so the Deezul router handles them like any other link.
    //
    // NARROW SCREENS: the menu button drops the links down over the page, with a backdrop.
    // Choosing a link, tapping the backdrop or pressing Esc closes it (Esc returns focus to the
    // button); so does widening past the breakpoint.
    schema: {
        inputs: {
            title:         { type: 'string', default: '', label: 'Title' },
            titleHref:     { type: 'string', default: '/', label: 'Title link' },
            subtitle:      { type: 'string', default: '', label: 'Subtitle' },
            items:         { type: 'array', default: [], label: 'Links' },
            labelKey:      { type: 'string', default: 'label', label: 'Label field' },
            hrefKey:       { type: 'string', default: 'href', label: 'Link field' },
            groupKey:      { type: 'string', default: 'group', label: 'Group field' },
            navLabel:      { type: 'string', default: '', label: 'Navigation name (screen readers; blank = title)' },
            width:         { type: 'string', default: '230px', label: 'Width' },
            collapseBelow: { type: 'number', default: 768, label: 'Collapse below (px)' },
            activeHref:    { type: 'string', default: '', label: 'Current link (blank = follow the URL)' },
            matchPrefix:   { type: 'boolean', default: false, label: 'Current for pages below a link too' },
            labels:        { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` sits on the outermost element only: an :if before a ref shifts its compile-time path.
    // The whole component is the <nav> landmark — title link and menu button included — so no
    // content sits outside a landmark.
    template: html`
    <nav class="sn" ref="root" :aria-label="navName" :class="(mobile ? 'is-mobile' : '') + (open ? ' is-open' : '')"
         :style="'--sn-width:' + (width || '230px')" @keydown="onKeydown">
        <div class="sn-bar">
            <a class="sn-brand" :if="title" :href="titleHref || '/'">{{ title }}</a>
            <button type="button" class="sn-toggle" :if="mobile" :aria-expanded="open ? 'true' : 'false'"
                    :aria-label="open ? ui.closeMenu : ui.openMenu" :title="open ? ui.closeMenu : ui.openMenu" @click="toggle">
                <span class="sn-icon" :class="open ? 'i-close' : 'i-menu'" aria-hidden="true"></span>
            </button>
        </div>
        <div class="sn-panel" @click="onPanelClick">
            <p class="sn-sub" :if="subtitle">{{ subtitle }}</p>
            <div class="sn-group" :for="group in groups" :key="group.key">
                <p class="sn-glabel" :if="group.name">{{ group.name }}</p>
                <ul class="sn-links">
                    <li :for="link in group.links" :key="link.key">
                        <a class="sn-link" :class="link.active ? 'is-active' : ''" :href="link.href"
                           :aria-current="link.active ? 'page' : 'false'">{{ link.label }}</a>
                    </li>
                </ul>
            </div>
        </div>
        <div class="sn-backdrop" :if="mobile && open" @click="close"></div>
    </nav>
    `,

    data: () => ({
        title: '', titleHref: '/', subtitle: '', items: [], labelKey: 'label', hrefKey: 'href', groupKey: 'group',
        navLabel: '', width: '230px', collapseBelow: 768, activeHref: '', matchPrefix: false, labels: {},
        current: typeof location !== 'undefined' ? location.pathname : '', mobile: false, open: false
    }),

    // Route changes (router subscription + back/forward) update `current`; a media query decides
    // `mobile`. Handles live on the root element, outside reactive data, for cleanup.
    $mounted() {
        const root = Deezul.toRaw(this.$refs.root);
        if (!root) return;
        const syncPath = () => { this.current = location.pathname; };
        const router = typeof Deezul.getRouter === 'function' ? Deezul.getRouter() : null;
        // The router notifies around its history update, so read the URL a microtask later.
        root._snUnsubscribe = router ? router.subscribe(() => queueMicrotask(syncPath)) : null;
        root._snPopstate = () => queueMicrotask(syncPath);
        window.addEventListener('popstate', root._snPopstate);

        const below = Number(this.collapseBelow) > 0 ? Number(this.collapseBelow) : 768;
        root._snQuery = window.matchMedia('(max-width: ' + (below - 0.02) + 'px)');
        root._snQueryChange = () => {
            this.mobile = root._snQuery.matches;
            if (!this.mobile) this.open = false;
        };
        root._snQuery.addEventListener('change', root._snQueryChange);
        root._snQueryChange();
    },

    $unmounted() {
        const root = Deezul.toRaw(this.$refs.root);
        if (!root) return;
        if (root._snUnsubscribe) root._snUnsubscribe();
        if (root._snPopstate) window.removeEventListener('popstate', root._snPopstate);
        if (root._snQuery) root._snQuery.removeEventListener('change', root._snQueryChange);
    },

    computed: {
        // Strings the component shows, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({ openMenu: 'Open menu', closeMenu: 'Close menu' }, this.labels);
        },

        // The landmark's accessible name: navLabel, else the title, else 'Main'.
        navName() {
            return this.navLabel || this.title || 'Main';
        },

        // [{ key, name, links }] in first-seen order; each link knows whether it's current.
        groups() {
            const list = Array.isArray(this.items) ? this.items : [];
            const labelKey = this.labelKey || 'label';
            const hrefKey = this.hrefKey || 'href';
            const groupKey = this.groupKey || 'group';
            const trim = path => (path.length > 1 ? path.replace(/\/+$/, '') : path);
            const current = trim(this.activeHref || this.current || '');
            const out = [];
            list.forEach((item, index) => {
                if (item === null || typeof item !== 'object') return;
                const rawGroup = item[groupKey];
                const name = rawGroup === undefined || rawGroup === null ? '' : String(rawGroup);
                let group = out.find(g => g.name === name);
                if (!group) out.push(group = { key: 'g:' + name, name, links: [] });
                const href = item[hrefKey] === undefined || item[hrefKey] === null ? '' : String(item[hrefKey]);
                const label = item[labelKey];
                group.links.push({
                    key: href + '#' + index, href, match: trim(href),
                    label: label === undefined || label === null ? '' : String(label),
                    active: false
                });
            });
            // One current link: the first exact match, else (matchPrefix) the longest href the
            // path sits under.
            const links = out.flatMap(g => g.links).filter(link => link.href !== '');
            let best = links.find(link => link.match === current) || null;
            if (!best && this.matchPrefix) {
                links.forEach(link => {
                    if (link.match === '/' || !current.startsWith(link.match + '/')) return;
                    if (!best || link.match.length > best.match.length) best = link;
                });
            }
            if (best) best.active = true;
            // Unheaded links lead, wherever they were first seen.
            return out.sort((a, b) => (a.name === '' ? -1 : b.name === '' ? 1 : 0));
        }
    },

    methods: {
        toggle() {
            this.open = !this.open;
        },

        close() {
            this.open = false;
        },

        // Choosing a link closes the drop-down; the router does the navigating.
        onPanelClick(event) {
            if (this.open && event.composedPath().some(el => el.tagName === 'A')) this.open = false;
        },

        async onKeydown(event) {
            if (event.key !== 'Escape' || !this.open) return;
            const root = event.target.getRootNode();
            this.open = false;
            await Deezul.nextTick();
            const toggle = root.querySelector('.sn-toggle');
            if (toggle) toggle.focus();
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        /* ---- Wide screens: a full-height column. */
        .sn { box-sizing: border-box; display: flex; flex-direction: column; width: var(--sn-width, 230px); height: 100%;
              padding: 22px 0; overflow-y: auto; font-family: var(--dz-font-body, inherit);
              background: var(--dz-color-surface, #fff); border-right: 1px solid var(--dz-color-border, #e4e6ee); }
        .sn-bar { display: flex; align-items: center; gap: .5rem; padding: 0 20px; }
        .sn-brand { flex: 1; min-width: 0; font-weight: 700; font-size: 15px; text-decoration: none;
                    color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .sn-brand:focus-visible, .sn-link:focus-visible, .sn-toggle:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -2px; }

        .sn-sub { margin: 0; padding: 2px 20px 18px; font-size: 12px; color: var(--dz-color-muted, #6b7180); }
        .sn-glabel { margin: 0; padding: 14px 20px 6px; font-size: 11px; font-weight: 700; letter-spacing: .07em;
                     text-transform: uppercase; color: var(--dz-color-muted, #6b7180); }
        .sn-links { list-style: none; margin: 0; padding: 0; }
        .sn-link { display: block; padding: 7px 20px; font-size: 14px; text-decoration: none;
                   color: var(--dz-color-text, #2b2f3a); border-left: 3px solid transparent; }
        .sn-link:hover { background: var(--dz-color-bg, #f7f7fb); border-left-color: var(--dz-color-primary, #5b5ef0); }
        /* Current page: a primary bar and heading-weight text, not color alone. */
        .sn-link.is-active { font-weight: 600; color: var(--dz-color-heading, #1f2330);
                             border-left-color: var(--dz-color-primary, #5b5ef0);
                             background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 8%, var(--dz-color-surface, #fff)); }

        /* ---- Narrow screens: a top bar; the links drop down over the page. */
        .sn.is-mobile { position: relative; width: auto; height: auto; padding: 0; overflow: visible;
                        border-right: 0; border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
        .is-mobile .sn-bar { position: relative; z-index: 51; min-height: 3.25rem; padding: 0 .5rem 0 16px;
                             background: var(--dz-color-surface, #fff); }
        .sn-toggle { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem;
                     margin-left: auto; padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
                     color: var(--dz-color-heading, #1f2330); }
        .sn-toggle:hover { background: var(--dz-color-bg, #f7f7fb); }
        .sn-icon { display: block; width: 1.5rem; height: 1.5rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-menu  { --icon: var(--dz-icon-menu); }
        .i-close { --icon: var(--dz-icon-close); }

        .is-mobile .sn-panel { display: none; position: absolute; left: 0; right: 0; top: 100%; z-index: 50;
                               max-height: 70vh; overflow-y: auto; padding: 6px 0 14px;
                               background: var(--dz-color-surface, #fff); border-bottom: 1px solid var(--dz-color-border, #e4e6ee);
                               box-shadow: 0 12px 24px rgba(0, 0, 0, .12); }
        .is-mobile.is-open .sn-panel { display: block; }
        .is-mobile .sn-link { padding: 11px 16px; }
        .is-mobile .sn-glabel, .is-mobile .sn-sub { padding-left: 16px; }
        .sn-backdrop { position: fixed; inset: 0; z-index: 40; background: rgba(15, 18, 28, .35); }
    `
});
