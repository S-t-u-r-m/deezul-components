export default Deezul.Component({
    // AlertBanner — the strip across the top of a site that says something is wrong or closed:
    // "Level 3 snow emergency", "All county offices are closed Monday", "Boil advisory lifted".
    //
    // DATA: `items` is the alerts the CMS has running. Every field is optional except a message:
    //   {
    //     id         used to remember a dismissal ('snow-2027-01'); without one, its position
    //     level      'emergency' (red, active danger), 'warning' (amber, a closing or disruption)
    //                or 'info' (blue, a planned notice); blank = 'warning'
    //     title      the short lead, shown bold: 'Holiday closing.'
    //     message    the rest of it, one or two sentences
    //     href       a page with the detail; linkLabel names it
    //     linkLabel  the link's text (blank = 'Read more')
    //     dismissible  false to keep an alert that cannot be dismissed (an emergency)
    //   }
    //
    //   <dz-component dz-type="alert_banner" :items="alerts"></dz-component>
    //
    // SEVERAL ALERTS: `layout` 'stack' (default) shows the first `maxShown` and, when there are
    // more, a button that shows the rest. 'single' shows one at a time with Previous, Next and
    // "1 of 3" — the visitor moves it; nothing scrolls or advances on its own. A scrolling ticker
    // is deliberately not offered: moving text can't be read back, breaks under magnification,
    // and needs a pause control to meet WCAG 2.2.2.
    //
    // ACCESSIBILITY:
    //   · an emergency is a role="alert", so a screen reader says it as soon as it appears; the
    //     other levels are regions, found by landmark but not interrupting;
    //   · the severity is spoken ("Emergency: ", "Warning: ") as well as shown, and each level
    //     has its own icon SHAPE — octagon, triangle, circle — so it never rests on color;
    //   · dismiss buttons are named with the alert ("Dismiss: Holiday closing"), 44px, and the
    //     next alert (or the page) takes focus afterwards;
    //   · text is 4.5:1 or better on each background.
    //
    // DISMISSING: an alert with an id stays dismissed for that visitor (localStorage, one entry
    // per site; `remember` false asks again on every page). The CMS decides what is running; this
    // only hides what the visitor has already read.
    //
    // OPTIONS:
    //   items        the alerts (above)
    //   label        the band's name for screen readers (default 'Alerts'); give each banner on a
    //                page a different one
    //   layout       'stack' (default) or 'single'; see SEVERAL ALERTS
    //   maxShown     stack: how many show before the "Show all" button (default 2; 0 = all)
    //   dismissible  visitors can dismiss alerts (default true); an alert can still opt out
    //   remember     remember dismissals in this browser (default true)
    //   storageKey   name for the remembered list, for a second banner on the same site
    //   labels       text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   dismiss        { id, level }          an alert was dismissed
    //   alert-change   { index, id, count }   'single': the visitor moved to another alert
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js, and the --dz-icon-emergency,
    // -warning, -info, -close, -chevron-left and -chevron-right properties (assets/icons.css).
    schema: {
        inputs: {
            items:       { type: 'array', default: [], label: 'Alerts' },
            label:       { type: 'string', default: '', label: 'Name for screen readers (blank = Alerts)' },
            layout:      { type: 'enum', options: ['stack', 'single'], default: 'stack', label: 'Layout' },
            maxShown:    { type: 'number', default: 2, label: 'Alerts shown before "Show all" (0 = all)' },
            dismissible: { type: 'boolean', default: true, label: 'Visitors can dismiss alerts' },
            remember:    { type: 'boolean', default: true, label: 'Remember dismissals in this browser' },
            storageKey:  { type: 'string', default: '', label: 'Name for the remembered list' },
            labels:      { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Nothing renders when there is no live alert, so the
    // banner takes no space on a normal day.
    template: html`
    <div class="ab" ref="root" :class="rootClass">
        <div class="ab-band" :if="count" role="region" :aria-label="regionName">
            <div class="ab-alert" :for="alert in shown" :key="alert.key" :class="'is-' + alert.level" :role="alert.role">
                <span class="ab-icon" aria-hidden="true"></span>
                <p class="ab-text">
                    <span class="ab-sr">{{ alert.prefix }}</span>
                    <b class="ab-title" :if="alert.title">{{ alert.title }}</b>
                    <span class="ab-message" :if="alert.message">{{ alert.messageText }}</span>
                    <span class="ab-sr" :if="alert.href">{{ space }}</span>
                    <a class="ab-link" :if="alert.href" :href="alert.href">{{ alert.linkLabel }}</a>
                </p>
                <button type="button" class="ab-dismiss" :if="alert.canDismiss" :aria-label="alert.dismissName"
                        :title="ui.dismiss" :data-alert="alert.id" @click="dismiss(alert.id, $event)">
                    <span class="ab-glyph i-close" aria-hidden="true"></span>
                </button>
            </div>

            <div class="ab-nav" :if="single && count > 1" :aria-label="ui.navName" role="group">
                <button type="button" class="ab-step" @click="step(-1)">
                    <span class="ab-glyph i-prev" aria-hidden="true"></span><span>{{ ui.previous }}</span>
                </button>
                <p class="ab-of" role="status">{{ ofText }}</p>
                <button type="button" class="ab-step" @click="step(1)">
                    <span>{{ ui.next }}</span><span class="ab-glyph i-next" aria-hidden="true"></span>
                </button>
            </div>

            <button type="button" class="ab-more" :if="moreCount" @click="showAll()">{{ moreText }}</button>
        </div>
    </div>
    `,

    data: () => ({
        items: [], label: '', layout: 'stack', maxShown: 2, dismissible: true, remember: true, storageKey: '', labels: {},
        index: 0, expanded: false, gone: []
    }),

    $mounted() {
        this.gone = this.loadDismissed();
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                emergency: 'Emergency: ',
                warning: 'Warning: ',
                info: 'Notice: ',
                regionName: 'Alerts',
                more: 'Read more',
                dismiss: 'Dismiss',
                dismissNamed: 'Dismiss: {text}',
                navName: 'Alerts',
                previous: 'Previous',
                next: 'Next',
                position: 'Alert {index} of {count}',
                showAll: 'Show {count} more alerts',
                showAllOne: 'Show 1 more alert'
            }, this.labels);
        },

        rootClass() {
            return this.single ? 'is-single' : 'is-stack';
        },

        single() {
            return this.layout === 'single';
        },

        // A space before the link, so a screen reader doesn't read "unaffected.See the schedule".
        // The gap on screen is the link's own margin; a space in the template would be trimmed.
        space() {
            return ' ';
        },

        // The band is one landmark. Two banners on a page need different names, so a host with
        // more than one sets `label`.
        regionName() {
            return DzGlobal.text(this.label).trim() || this.ui.regionName;
        },

        // Every alert as the strip draws it. An alert with neither title nor message is left out.
        alerts() {
            const ui = this.ui;
            const list = Array.isArray(this.items) ? this.items : [];
            const levels = ['emergency', 'warning', 'info'];
            return list
                .map((raw, index) => {
                    const item = DzGlobal.raw(raw);
                    if (!item || typeof item !== 'object') return null;
                    const title = DzGlobal.text(item.title).trim();
                    const message = DzGlobal.text(item.message).trim();
                    if (!title && !message) return null;
                    const level = levels.includes(item.level) ? item.level : 'warning';
                    const id = DzGlobal.text(item.id).trim() || 'alert-' + index;
                    return {
                        key: id, id, level, title, message,
                        // A space, not a CSS margin: a screen reader reads the two straight
                        // together otherwise ("Holiday closing.All county offices").
                        messageText: (title ? ' ' : '') + message,
                        href: DzGlobal.safeHref(item.href),
                        linkLabel: DzGlobal.text(item.linkLabel).trim() || ui.more,
                        // Only an emergency interrupts. The others are read in place, inside the
                        // band's one landmark — a landmark each would give a page several with
                        // the same name.
                        role: level === 'emergency' ? 'alert' : 'none',
                        prefix: ui[level],
                        canDismiss: !!this.dismissible && item.dismissible !== false,
                        dismissName: DzGlobal.format(ui.dismissNamed, { text: title || message })
                    };
                })
                .filter(Boolean);
        },

        // The alerts still to be seen: the dismissed ones are gone for this visitor.
        live() {
            const gone = Array.isArray(this.gone) ? this.gone : [];
            return this.alerts.filter(alert => !gone.includes(alert.id));
        },

        count() {
            return this.live.length;
        },

        at() {
            return this.count ? Math.min(Math.max(0, Math.floor(Number(this.index)) || 0), this.count - 1) : 0;
        },

        shown() {
            if (!this.count) return [];
            if (this.single) return [this.live[this.at]];
            const max = Math.floor(Number(this.maxShown));
            return this.expanded || !(max > 0) ? this.live : this.live.slice(0, max);
        },

        moreCount() {
            return this.single ? 0 : this.count - this.shown.length;
        },

        moreText() {
            return this.moreCount === 1 ? this.ui.showAllOne : DzGlobal.format(this.ui.showAll, { count: this.moreCount });
        },

        ofText() {
            return DzGlobal.format(this.ui.position, { index: this.at + 1, count: this.count });
        }
    },

    methods: {
        // The remembered dismissals for this site, or [] when storage is off or unavailable
        // (private browsing, a blocked cookie jar).
        storageName() {
            const own = DzGlobal.text(this.storageKey).trim();
            return 'dz-alerts-dismissed' + (own ? '-' + own : '');
        },

        loadDismissed() {
            if (!this.remember) return [];
            try {
                const saved = JSON.parse(window.localStorage.getItem(this.storageName()) || '[]');
                return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
            } catch (error) {
                return [];
            }
        },

        saveDismissed(ids) {
            if (!this.remember) return;
            try {
                // Only ids still in the data are kept, so the list can't grow forever.
                const known = this.alerts.map(alert => alert.id);
                window.localStorage.setItem(this.storageName(), JSON.stringify(ids.filter(id => known.includes(id))));
            } catch (error) { /* storage unavailable: it just asks again next time */ }
        },

        // Dismissed: hide it, remember it, and move focus on — the button has gone.
        async dismiss(id, event) {
            const gone = [...(Array.isArray(this.gone) ? this.gone : []), id];
            const alert = this.alerts.find(entry => entry.id === id);
            const wasLast = this.single && this.at >= this.count - 1;
            this.gone = gone;
            this.saveDismissed(gone);
            if (wasLast) this.index = Math.max(0, this.at - 1);
            this.$emit('dismiss', { id, level: alert ? alert.level : '' });

            const root = event ? event.target.getRootNode() : null;
            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            if (!root) return;
            // The next alert's dismiss button, else whatever the page has to offer.
            const next = root.querySelector('.ab-dismiss') || root.querySelector('.ab-step');
            if (next) next.focus();
        },

        // 'single': Previous (-1) and Next (1), wrapping, so two buttons reach every alert.
        step(by) {
            if (this.count < 2) return;
            const next = ((this.at + by) % this.count + this.count) % this.count;
            this.index = next;
            const alert = this.live[next];
            this.$emit('alert-change', { index: next, id: alert ? alert.id : '', count: this.count });
        },

        showAll() {
            this.expanded = true;
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .ab { font-family: var(--dz-font-body, inherit); }
        .ab-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
                 clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
        .ab-glyph { display: block; width: 1.15rem; height: 1.15rem; background: currentColor;
                    -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-close { --icon: var(--dz-icon-close); }
        .i-prev  { --icon: var(--dz-icon-chevron-left); }
        .i-next  { --icon: var(--dz-icon-chevron-right); }

        /* ---- One alert: a full-width strip. Each level has its own icon shape as well as its
           own color, and every text color is 4.9:1 or better on its background. */
        .ab-alert { display: flex; align-items: flex-start; gap: .85rem; padding: .85rem 1rem;
                    border-bottom: 1px solid; font-size: .9375rem; line-height: 1.5; }
        .ab-icon { flex: none; width: 1.35rem; height: 1.35rem; margin-top: .1rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }

        .is-info { background: #e7f2f7; border-bottom-color: rgba(18, 92, 119, .28); color: #10556d; }
        .is-info .ab-icon { --icon: var(--dz-icon-info); }
        .is-warning { background: #fdf1dd; border-bottom-color: rgba(138, 91, 0, .28); color: #7a4a00; }
        .is-warning .ab-icon { --icon: var(--dz-icon-warning); }
        .is-emergency { background: #fbe8e8; border-bottom-color: rgba(155, 27, 27, .32); color: #9b1b1b; }
        .is-emergency .ab-icon { --icon: var(--dz-icon-emergency); }
        .is-emergency .ab-title { text-transform: uppercase; letter-spacing: .04em; }

        .ab-text { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; }
        .ab-title { font-weight: 700; }
        .ab-link { margin-left: .35rem; color: inherit; font-weight: 600; text-underline-offset: 2px; }

        /* ---- Buttons. 44px targets; the ring is the alert's own color, which has contrast on
           every background here. */
        .ab-dismiss { display: inline-flex; flex: none; align-items: center; justify-content: center;
                      width: 2.75rem; height: 2.75rem; margin: -.55rem -.4rem -.55rem 0; padding: 0;
                      border: 0; border-radius: 999px; background: none; color: inherit; cursor: pointer; }
        .ab-dismiss:hover { background: rgba(0, 0, 0, .07); }
        .ab-step { display: inline-flex; align-items: center; gap: .3rem; min-height: 2.75rem; padding: 0 .85rem;
                   border: 1px solid #8a8f9c; border-radius: 999px; background: var(--dz-color-surface, #fff);
                   font: inherit; font-size: .875rem; font-weight: 650; color: var(--dz-color-heading, #1f2330);
                   cursor: pointer; }
        .ab-step:hover { background: var(--dz-color-bg, #f3f4f8); }
        .ab-more { display: block; width: 100%; min-height: 2.75rem; padding: .5rem 1rem; border: 0;
                   border-bottom: 1px solid var(--dz-color-border, #e4e6ee); background: var(--dz-color-bg, #f3f4f8);
                   font: inherit; font-size: .875rem; font-weight: 650; color: #3b3ec2; cursor: pointer; }
        .ab-more:hover { background: #e9ebf5; }
        .ab-dismiss:focus-visible, .ab-step:focus-visible, .ab-more:focus-visible, .ab-link:focus-visible {
            outline: 2px solid currentColor; outline-offset: 2px; }
        .ab-more:focus-visible { outline-color: var(--dz-color-primary, #5b5ef0); }

        /* ---- 'single': the controls sit under the strip. */
        .ab-nav { display: flex; align-items: center; justify-content: center; gap: .75rem; padding: .6rem 1rem;
                  border-bottom: 1px solid var(--dz-color-border, #e4e6ee); background: var(--dz-color-bg, #f3f4f8); }
        .ab-of { margin: 0; font-size: .875rem; font-weight: 650; color: var(--dz-color-text, #2b2f3a); }

        @media (max-width: 480px) {
            .ab-alert { gap: .6rem; padding: .75rem .85rem; }
            .ab-nav { justify-content: space-between; }
        }
    `
});
