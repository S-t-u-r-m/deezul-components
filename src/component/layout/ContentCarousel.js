export default Deezul.Component({
    // ContentCarousel — a container that cycles through the components placed inside it, one at a
    // time: any blocks, not just images (the CMS CarouselBlock is the image slider).
    //
    // CHILDREN are this component's own light-DOM children, shown through a native <slot> — the
    // same way the CMS container blocks take their content:
    //   <dz-component dz-type="content_carousel" :label="'Featured events'">
    //       <dz-component dz-type="event_details" ...></dz-component>
    //       <dz-component dz-type="job_details" ...></dz-component>
    //   </dz-component>
    // Or list them as data and let the carousel create them — each by its dz-type, loaded by the
    // module handler like any other component:
    //   <dz-component dz-type="content_carousel"
    //       :items="[{ type: 'event_details', props: { store: 'team', eventId: 'picnic' } }, ...]">
    // Items from `items` are added after any children placed inside, and replaced when it changes.
    // Every child shares one grid cell, so the carousel is as tall as its tallest child and the
    // page never jumps as items change. Children added or removed later are picked up.
    //
    // OPTIONS:
    //   label        the carousel's name for screen readers (default 'Featured content'); give
    //                each carousel on a page a different one
    //   autoplay     cycle on its own (default true)
    //   interval     seconds per item, at least 3 (default 7)
    //   transition   'fade' (default), 'slide' or 'none'
    //   arrows       previous / next buttons: 'auto' (default: only with more items than one group
    //                of dots holds, or when dots are off), 'always' or 'never'
    //   showDots     one button per item (default true)
    //   dotsPerGroup dots shown at a time (default 5). With more items the dots show the group
    //                holding the current item — items 6–10 while on item 7 — and the last group
    //                is padded with empty placeholders so the bar keeps its width. A visible
    //                counter ("7 / 12") then shows how many items there are and where you are
    //                (screen readers get the same from the dot names, so it is hidden from them).
    //   labels       text overrides; see the `ui` computed for the keys
    //
    // ACCESSIBILITY (the WAI-ARIA carousel pattern):
    //   · auto-rotation always comes with a visible pause button (WCAG 2.2.2), and it pauses
    //     while the pointer is over the carousel or keyboard focus is inside it;
    //   · prefers-reduced-motion: no auto-rotation (so no pause button) and no transitions;
    //   · the carousel is a region named by `label` (roledescription "carousel"); each child
    //     becomes a group named "2 of 5" (roledescription "slide");
    //   · hidden items are visibility: hidden — out of the tab order and the accessibility tree;
    //   · changes the visitor makes are announced ("Item 2 of 5"); automatic ones are not, so a
    //     screen reader isn't interrupted every few seconds.
    // Swipe left or right on touch screens.
    //
    // EDITOR: with window.DZ_EDITING set, every child shows, stacked, and nothing rotates, so an
    // author can see and arrange all of them.
    //
    // NEEDS: window.DzGlobal (global.js, imported by main.js) and the --dz-icon-chevron-left /
    // -chevron-right / -pause / -play-arrow custom properties (assets/icons.css).
    schema: {
        inputs: {
            label:      { type: 'string', default: 'Featured content', label: 'Name (screen readers)' },
            items:      { type: 'array', default: [], label: 'Items ({ type: dz-type, props })' },
            autoplay:   { type: 'boolean', default: true, label: 'Rotate automatically' },
            interval:   { type: 'number', default: 7, label: 'Seconds per item (3 or more)' },
            transition: { type: 'enum', options: ['fade', 'slide', 'none'], default: 'fade', label: 'Change by' },
            arrows:       { type: 'enum', options: ['auto', 'always', 'never'], default: 'auto', label: 'Previous / next buttons' },
            showDots:     { type: 'boolean', default: true, label: 'Show item buttons' },
            dotsPerGroup: { type: 'number', default: 5, label: 'Item buttons shown at a time' },
            labels:     { type: 'object', default: {}, label: 'Text overrides' }
        },
        slots: {
            default: { label: 'Items', allow: ['*'] }
        }
    },

    // `ref` only on the outermost element. The slot listener, timer and swipe handlers are
    // attached in $mounted and live on the root element, outside reactive data.
    template: html`
    <div class="cc" ref="root" role="region" aria-roledescription="carousel" :aria-label="label || ui.defaultLabel"
         :class="rootClass" @mouseenter="setHover(true)" @mouseleave="setHover(false)"
         @focusin="setFocus(true)" @focusout="onFocusOut($event)">
        <div class="cc-viewport">
            <slot></slot>
        </div>
        <div class="cc-controls" :if="count > 1 && !editing">
            <button type="button" class="cc-btn" :if="canPlay" :aria-label="playing ? ui.pause : ui.play"
                    :title="playing ? ui.pause : ui.play" @click="togglePlay">
                <span class="cc-icon" :class="playing ? 'i-pause' : 'i-play'" aria-hidden="true"></span>
            </button>
            <button type="button" class="cc-btn" :if="arrowButtons" :aria-label="ui.previous" :title="ui.previous" @click="step(-1)">
                <span class="cc-icon i-prev" aria-hidden="true"></span>
            </button>
            <div class="cc-dots" :if="showDots" role="group" :aria-label="dotGroup.label">
                <button type="button" class="cc-dot" :for="dot in dots" :key="dot.key" :aria-label="dot.name"
                        :aria-current="dot.current ? 'true' : 'false'" @click="goTo(dot.index, true)"></button>
                <span class="cc-dot is-placeholder" :for="spot in dotGroup.placeholders" :key="spot.key" aria-hidden="true"></span>
            </div>
            <span class="cc-counter" :if="counterText" aria-hidden="true">{{ counterText }}</span>
            <button type="button" class="cc-btn" :if="arrowButtons" :aria-label="ui.next" :title="ui.next" @click="step(1)">
                <span class="cc-icon i-next" aria-hidden="true"></span>
            </button>
        </div>
        <p class="cc-empty" :if="!count">{{ ui.empty }}</p>
        <p class="cc-sr" role="status" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
    </div>
    `,

    data: () => ({
        label: 'Featured content', items: [], autoplay: true, interval: 7, transition: 'fade', arrows: 'auto', showDots: true, dotsPerGroup: 5, labels: {},
        count: 0, active: 0, playing: false, calm: false, hovering: false, focused: false, editing: false, liveMessage: ''
    }),

    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        const state = root._cc = { timer: null, running: false, settings: '' };
        try {
            this.calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (error) { /* older engine */ }
        this.editing = !!window.DZ_EDITING;
        this.playing = !!this.autoplay && !this.calm && !this.editing;
        state.settings = this.settingsKey();

        // Children added or removed later (the editor, a collection loading) are picked up.
        const slot = root.querySelector('slot');
        if (slot) {
            state.onSlotChange = () => this.apply(this.active);
            slot.addEventListener('slotchange', state.onSlotChange);
            state.slot = slot;
        }

        // Swipe. A gesture counts only if it is decidedly horizontal; otherwise the page was
        // being scrolled and the carousel must not take it.
        state.onTouchStart = event => {
            const touch = event.changedTouches[0];
            state.x = touch.clientX;
            state.y = touch.clientY;
        };
        state.onTouchEnd = event => {
            if (state.x === undefined || state.x === null) return;
            const touch = event.changedTouches[0];
            const dx = touch.clientX - state.x;
            const dy = touch.clientY - state.y;
            state.x = null;
            if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
            this.step(dx < 0 ? 1 : -1);
        };
        root.addEventListener('touchstart', state.onTouchStart, { passive: true });
        root.addEventListener('touchend', state.onTouchEnd, { passive: true });

        this.syncItems(root);
        this.apply(0);
    },

    // New `items` are recreated; a host changing autoplay or interval restarts the rotation.
    $updated() {
        const root = DzGlobal.raw(this.$refs.root);
        const state = root && root._cc;
        if (!state) return;
        this.syncItems(root);
        if (state.settings === this.settingsKey()) return;
        state.settings = this.settingsKey();
        this.playing = !!this.autoplay && !this.calm && !this.editing;
        this.syncTimer(true);
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        const state = root && root._cc;
        if (!state) return;
        if (state.timer) clearInterval(state.timer);
        if (state.slot) state.slot.removeEventListener('slotchange', state.onSlotChange);
        root.removeEventListener('touchstart', state.onTouchStart);
        root.removeEventListener('touchend', state.onTouchEnd);
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                defaultLabel: 'Featured content',
                previous: 'Previous item',
                next: 'Next item',
                pause: 'Pause rotation',
                play: 'Start rotation',
                chooseItem: 'Choose an item',
                chooseInGroup: 'Choose an item, {from} to {to} of {count}',
                counter: '{n} / {count}',
                goTo: 'Item {n} of {count}',
                slide: 'slide',
                slideName: '{n} of {count}',
                announce: 'Item {n} of {count}',
                empty: 'Add components to rotate'
            }, this.labels);
        },

        rootClass() {
            const transition = this.transition === 'slide' || this.transition === 'none' ? this.transition : 'fade';
            return 'cc-' + transition + (this.editing ? ' is-editing' : '');
        },

        // A pause button exists exactly when something can move.
        canPlay() {
            return !!this.autoplay && !this.calm && !this.editing && this.count > 1;
        },

        groupSize() {
            const n = Math.round(Number(this.dotsPerGroup));
            return n >= 2 ? n : 5;
        },

        // 'auto': arrows only when the dots can't reach every item at once, or there are no dots.
        arrowButtons() {
            if (this.arrows === 'always') return true;
            if (this.arrows === 'never') return false;
            return this.count > this.groupSize || !this.showDots;
        },

        // The group of dots holding the current item: its range, its name, and the empty
        // placeholders that pad a short last group (only when there is more than one group).
        dotGroup() {
            const size = this.groupSize;
            const count = this.count;
            const from = Math.floor(this.active / size) * size;
            const to = Math.min(from + size, count);
            const grouped = count > size;
            const placeholders = [];
            for (let i = to - from; grouped && i < size; i++) placeholders.push({ key: 'p' + i });
            return {
                from, to, placeholders,
                label: grouped ? DzGlobal.format(this.ui.chooseInGroup, { from: from + 1, to, count }) : this.ui.chooseItem
            };
        },

        // "7 / 12" — only when the dots can't show every item at once (or there are no dots).
        counterText() {
            if (this.count <= 1 || (this.showDots && this.count <= this.groupSize)) return '';
            return DzGlobal.format(this.ui.counter, { n: this.active + 1, count: this.count });
        },

        dots() {
            const out = [];
            for (let i = this.dotGroup.from; i < this.dotGroup.to; i++) {
                out.push({
                    key: 'd' + i, index: i, current: i === this.active,
                    name: DzGlobal.format(this.ui.goTo, { n: i + 1, count: this.count })
                });
            }
            return out;
        }
    },

    methods: {
        settingsKey() {
            return String(!!this.autoplay) + '/' + this.seconds();
        },

        seconds() {
            const n = Number(this.interval);
            return Number.isFinite(n) ? Math.max(3, n) : 7;
        },

        // Create the `items` entries as this component's own children, by dz-type, replacing the
        // ones made last time; only when `items` actually changed. The slotchange listener then
        // brings them into the rotation.
        syncItems(root) {
            const state = root._cc;
            const list = DzGlobal.raw(this.items);
            const entries = Array.isArray(list) ? list : [];
            const signature = JSON.stringify(entries);
            if (state.itemsSignature === signature) return;
            state.itemsSignature = signature;
            DzGlobal.renderItems(root.getRootNode().host, entries, 'data-cc-item');
        },

        // The slides: element children in the default slot.
        slides() {
            const root = DzGlobal.raw(this.$refs.root);
            const host = root && root.getRootNode().host;
            if (!host) return [];
            return Array.prototype.filter.call(host.children, el => el.nodeType === 1 && !el.hasAttribute('slot'));
        },

        // Show item `index` and mark every child: data-cc="on" | "before" | "after" drives the
        // transition CSS; role and names make each child a labelled slide. Works from locals
        // rather than re-reading data, which the proxy doesn't refresh mid-method.
        apply(index) {
            const kids = this.slides();
            const count = kids.length;
            const active = count ? ((index % count) + count) % count : 0;
            const ui = this.ui;
            kids.forEach((kid, i) => {
                kid.setAttribute('data-cc', this.editing || i === active ? 'on' : (i < active ? 'before' : 'after'));
                kid.setAttribute('role', 'group');
                kid.setAttribute('aria-roledescription', ui.slide);
                kid.setAttribute('aria-label', DzGlobal.format(ui.slideName, { n: i + 1, count }));
            });
            this.count = count;
            this.active = active;
            this.syncTimer(false, count);
            return active;
        },

        // Visitor-initiated changes are announced and restart the timer.
        goTo(index, byVisitor) {
            const active = this.apply(index);
            if (!byVisitor || !this.count) return;
            DzGlobal.announce(this, DzGlobal.format(this.ui.announce, { n: active + 1, count: this.count }));
            this.syncTimer(true);
        },

        step(direction) {
            this.goTo(this.active + direction, true);
        },

        togglePlay() {
            this.playing = !this.playing;
            this.syncTimer(true);
        },

        setHover(on) {
            this.hovering = on;
            this.syncTimer(false);
        },

        setFocus(on) {
            this.focused = on;
            this.syncTimer(false);
        },

        // Focus moving between the carousel's own controls and its children keeps it paused.
        onFocusOut(event) {
            const root = DzGlobal.raw(this.$refs.root);
            const host = root && root.getRootNode().host;
            const next = event.relatedTarget;
            if (next && ((root && root.contains(next)) || (host && host.contains(next)))) return;
            this.setFocus(false);
        },

        // Run the timer exactly while rotation should happen. `restart` resets the countdown
        // (after a visitor's change or new settings). Reads data directly, never computed values.
        syncTimer(restart, knownCount) {
            const root = DzGlobal.raw(this.$refs.root);
            const state = root && root._cc;
            if (!state) return;
            const count = knownCount === undefined ? this.count : knownCount;
            const run = !!this.autoplay && !this.calm && !this.editing && count > 1
                && this.playing && !this.hovering && !this.focused;
            if (run === state.running && !restart) return;
            if (state.timer) clearInterval(state.timer);
            state.timer = run ? setInterval(() => this.goTo(this.active + 1, false), this.seconds() * 1000) : null;
            state.running = run;
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .cc { position: relative; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        .cc-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
                 overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }

        /* ---- Items share one grid cell: the tallest sets the height, nothing jumps. Hidden items
           are visibility: hidden, which also keeps them out of the tab order and the
           accessibility tree; the visibility switch waits for the fade or slide to finish. */
        .cc-viewport { display: grid; overflow: hidden; }
        .cc-viewport > slot { display: contents; }
        .cc-viewport > slot::slotted(*) { grid-area: 1 / 1; min-width: 0; }

        .cc-fade .cc-viewport > slot::slotted(*) { opacity: 0; visibility: hidden;
            transition: opacity .6s ease, visibility 0s linear .6s; }
        .cc-fade .cc-viewport > slot::slotted([data-cc="on"]) { opacity: 1; visibility: visible;
            transition: opacity .6s ease, visibility 0s linear 0s; }

        .cc-slide .cc-viewport > slot::slotted(*) { visibility: hidden; transform: translateX(100%);
            transition: transform .45s ease, visibility 0s linear .45s; }
        .cc-slide .cc-viewport > slot::slotted([data-cc="before"]) { transform: translateX(-100%); }
        .cc-slide .cc-viewport > slot::slotted([data-cc="on"]) { visibility: visible; transform: none;
            transition: transform .45s ease, visibility 0s linear 0s; }

        .cc-none .cc-viewport > slot::slotted(*) { visibility: hidden; }
        .cc-none .cc-viewport > slot::slotted([data-cc="on"]) { visibility: visible; }

        /* Editor: everything visible, stacked. */
        .cc.is-editing .cc-viewport { display: flex; flex-direction: column; gap: 1rem; overflow: visible; }

        @media (prefers-reduced-motion: reduce) {
            .cc-viewport > slot::slotted(*) { transition: none !important; }
        }

        /* ---- Controls under the content, so they never cover a child. Button borders and dots
           are 3.4:1 against white (WCAG 1.4.11); each dot is a 24px target around a small mark. */
        .cc-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: .4rem; margin-top: .75rem; }
        .cc-btn { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; padding: 0;
                  border: 1px solid #8a8f9c; border-radius: 999px; background: var(--dz-color-surface, #fff);
                  color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .cc-btn:hover { background: var(--dz-color-bg, #f7f7fb); }
        .cc-icon { display: block; width: 1.25rem; height: 1.25rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-prev  { --icon: var(--dz-icon-chevron-left); }
        .i-next  { --icon: var(--dz-icon-chevron-right); }
        .i-pause { --icon: var(--dz-icon-pause); }
        .i-play  { --icon: var(--dz-icon-play-arrow); }

        .cc-dots { display: flex; align-items: center; gap: .1rem; }
        .cc-dot { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; padding: 0; border: 0; border-radius: 999px;
                  background: none; cursor: pointer; }
        .cc-dot::before { content: ""; width: .6rem; height: .6rem; border-radius: 999px; background: #8a8f9c;
                          transition: width .2s ease, background-color .2s ease; }
        .cc-dot:hover::before { background: var(--dz-color-heading, #1f2330); }
        /* Empty spots in a short last group: a faint ring, not a control. */
        .cc-dot.is-placeholder { cursor: default; }
        .cc-dot.is-placeholder::before, .cc-dot.is-placeholder:hover::before {
            box-sizing: border-box; background: transparent; border: 1.5px solid #c9ccd6; }
        .cc-dot[aria-current="true"] { width: 2rem; }
        .cc-dot[aria-current="true"]::before { width: 1.35rem; background: var(--dz-color-primary, #5b5ef0); }
        .cc-btn:focus-visible, .cc-dot:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        .cc-counter { min-width: 3.5rem; padding: 0 .25rem; font-size: .875rem; font-weight: 700; text-align: center;
                      font-variant-numeric: tabular-nums; color: var(--dz-color-heading, #1f2330); }

        .cc-empty { display: flex; align-items: center; justify-content: center; min-height: 8rem; margin: 0;
                    border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px; font-style: italic;
                    color: var(--dz-color-muted, #6b7180); }
    `
});
