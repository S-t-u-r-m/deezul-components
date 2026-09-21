export default Deezul.Component({
    // CalendarWeek — two columns of event cards: this week, and what's coming up after it.
    //
    // DATA lives in calendar-store.js (window.DzCalendarStore), as for CalendarMonth: `store`
    // names the calendar, and every view with that name shows the same events. `events` (when
    // not empty) replaces the calendar's events, for pages with only props.
    //
    //   <dz-component dz-type="calendar_week" :store="'team'" :detailsHref="'/events/{id}'"></dz-component>
    //
    // THIS WEEK: every event touching the current week (the one holding today), soonest first.
    // UPCOMING: events STARTING in the `upcomingDays` days after this week, soonest first, at
    // most `upcomingLimit`. Under ~40rem of its own width (a container query) the columns stack.
    //
    // CARDS: a date badge in the event's color, then the title, the date and time (a same-day
    // timed end shows as a range; a multi-day event shows its date range) and the location
    // (the event's `location` field). A card opens the event:
    //   detailsHref  a link template such as '/events/{id}' — cards become links, so the router
    //                loads the details page (and they open in a new tab like any link)
    //   blank        cards are buttons; the host handles event-click
    // Both emit event-click.
    //
    // OPTIONS:
    //   title          a heading above the columns (blank = none)
    //   weekStart      first day of the week: 0 Sunday (default) … 6 Saturday
    //   locale         date and time names, e.g. 'fr-FR' (blank = the browser's)
    //   upcomingDays   how many days after this week Upcoming covers (default 30)
    //   upcomingLimit  how many upcoming events it shows at most (default 5)
    //   detailsHref    see CARDS
    //   headingLevel   level of the column headings (default 2; the title is one above, or the
    //                  same with no room above). Set it to fit the page's own heading outline.
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   event-click   { event, date, href }   a card was clicked; event is the stored event
    //
    // SCREEN READERS: the column names are headings; each card is a link (or button) named
    // "title, date, time, location", with the badge hidden since the name already says it.
    //
    // NEEDS: window.DzCalendarStore and window.DzGlobal (imported by main.js), and the
    // --dz-icon-location-on custom property (assets/icons.css).
    schema: {
        inputs: {
            store:         { type: 'string', default: 'default', label: 'Calendar name (shared store)' },
            events:        { type: 'array', default: [], label: 'Events (replace the calendar’s events)' },
            title:         { type: 'string', default: '', label: 'Title' },
            weekStart:     { type: 'number', default: 0, label: 'First day of the week (0 = Sunday)' },
            locale:        { type: 'string', default: '', label: 'Locale (blank = browser)' },
            upcomingDays:  { type: 'number', default: 30, label: 'Upcoming: days after this week' },
            upcomingLimit: { type: 'number', default: 5, label: 'Upcoming: most events shown' },
            detailsHref:   { type: 'string', default: '', label: 'Details page link ({id} = event id; blank = no link)' },
            headingLevel:  { type: 'number', default: 2, label: 'Column heading level' },
            labels:        { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // :if sits on elements INSIDE the :for rows, never on the :for element (a compile error).
    // `ref` only on the outermost element. A card is either a link or a button, so its inside
    // is written twice.
    template: html`
    <div class="wk" ref="root">
        <p class="wk-title" :if="title" role="heading" :aria-level="levels.title">{{ title }}</p>
        <div class="wk-columns">
            <div class="wk-col" :for="col in columns" :key="col.key">
                <div class="wk-col-head">
                    <p class="wk-heading" role="heading" :aria-level="levels.column">{{ col.heading }}</p>
                    <p class="wk-range">{{ col.range }}</p>
                </div>
                <ul class="wk-cards" :if="col.cards.length">
                    <li :for="card in col.cards" :key="card.key">
                        <a class="wk-card" :if="card.href" :href="card.href" :data-date="card.date" :style="card.style"
                           :aria-label="card.name" @click="openEvent(card)">
                            <span class="wk-badge" aria-hidden="true">
                                <span class="wk-badge-month">{{ card.month }}</span>
                                <span class="wk-badge-day">{{ card.day }}</span>
                                <span class="wk-badge-dow">{{ card.weekday }}</span>
                            </span>
                            <span class="wk-body">
                                <span class="wk-card-title">{{ card.label }}</span>
                                <span class="wk-meta">{{ card.dateText }}<span class="wk-sep" aria-hidden="true">·</span>{{ card.when }}</span>
                                <span class="wk-loc" :if="card.location">{{ card.location }}</span>
                            </span>
                        </a>
                        <button type="button" class="wk-card" :if="!card.href" :data-date="card.date" :style="card.style"
                                :aria-label="card.name" @click="openEvent(card)">
                            <span class="wk-badge" aria-hidden="true">
                                <span class="wk-badge-month">{{ card.month }}</span>
                                <span class="wk-badge-day">{{ card.day }}</span>
                                <span class="wk-badge-dow">{{ card.weekday }}</span>
                            </span>
                            <span class="wk-body">
                                <span class="wk-card-title">{{ card.label }}</span>
                                <span class="wk-meta">{{ card.dateText }}<span class="wk-sep" aria-hidden="true">·</span>{{ card.when }}</span>
                                <span class="wk-loc" :if="card.location">{{ card.location }}</span>
                            </span>
                        </button>
                    </li>
                </ul>
                <p class="wk-empty" :if="!col.cards.length">{{ col.empty }}</p>
            </div>
        </div>
    </div>
    `,

    data: () => ({
        store: 'default', events: [], title: '', weekStart: 0, locale: '',
        upcomingDays: 30, upcomingLimit: 5, detailsHref: '', headingLevel: 2, labels: {},
        allEvents: []
    }),

    // The calendar, its unsubscribe and the last seeded `events` live on the root element,
    // outside reactive data. The `store` name is read once, here.
    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        root._calStore = DzCalendarStore.use(this.store || 'default');
        this.seed(root);
        root._calUnsubscribe = root._calStore.subscribe(change => {
            if (change.type === 'events') this.pull();
        });
        this.pull();
    },

    $updated() {
        const root = DzGlobal.raw(this.$refs.root);
        if (root && root._calStore) this.seed(root);
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (root && root._calUnsubscribe) root._calUnsubscribe();
    },

    computed: {
        // Every string the component shows, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                thisWeek: 'This week',
                upcoming: 'Upcoming',
                nextDays: 'Next {days} days',
                allDay: 'All day',
                untitled: '(no title)',
                nothingThisWeek: 'Nothing this week',
                nothingUpcoming: 'Nothing in the next {days} days'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const column = n >= 1 && n <= 6 ? n : 2;
            return { title: Math.max(column - 1, 1), column };
        },

        formats() {
            const make = options => DzCalendarStore.display.formatter(this.locale, options);
            return {
                range: make({ month: 'short', day: 'numeric' }),
                date: make({ weekday: 'short', month: 'short', day: 'numeric' }),
                month: make({ month: 'short' }),
                weekday: make({ weekday: 'short' }),
                time: make({ hour: 'numeric', minute: '2-digit' })
            };
        },

        // The current week: the one holding today.
        week() {
            const dates = DzCalendarStore.dates;
            const from = DzCalendarStore.display.weekFrom(dates.today(), DzCalendarStore.display.weekStartDay(this.weekStart));
            return { from, to: dates.addDays(from, 6) };
        },

        upcomingSpan() {
            const n = Math.round(Number(this.upcomingDays));
            return n >= 1 ? n : 30;
        },

        // The two columns. Keys are fixed, so both are reused as events change.
        columns() {
            const dates = DzCalendarStore.dates;
            const display = DzCalendarStore.display;
            const { from, to } = this.week;
            const ui = this.ui;
            const days = this.upcomingSpan;
            const limit = Math.round(Number(this.upcomingLimit));
            const options = {
                href: this.detailsHref, time: this.formats.time, date: this.formats.date, month: this.formats.month,
                weekday: this.formats.weekday, allDay: ui.allDay, untitled: ui.untitled
            };
            return [
                { key: 'week', heading: ui.thisWeek, range: display.rangeText(this.formats.range, from, to),
                  cards: display.agenda(this.allEvents, from, to, options), empty: ui.nothingThisWeek },
                { key: 'upcoming', heading: ui.upcoming, range: DzGlobal.format(ui.nextDays, { days }),
                  cards: display.agenda(this.allEvents, dates.addDays(to, 1), dates.addDays(to, days),
                                        { ...options, startsOnly: true, limit: limit >= 1 ? limit : 5 }),
                  empty: DzGlobal.format(ui.nothingUpcoming, { days }) }
            ];
        }
    },

    methods: {
        pull() {
            const root = DzGlobal.raw(this.$refs.root);
            if (root && root._calStore) this.allEvents = root._calStore.getEvents();
        },

        // Push a non-empty `events` prop into the calendar when it differs from the last push.
        seed(root) {
            const list = DzGlobal.raw(this.events);
            const signature = JSON.stringify(Array.isArray(list) ? list : []);
            if (root._calSeeded === signature) return;
            root._calSeeded = signature;
            if (Array.isArray(list) && list.length) root._calStore.setEvents(list);
        },

        // A link card still navigates (the router takes the click); this only reports it.
        openEvent(card) {
            const found = (Array.isArray(this.allEvents) ? this.allEvents : []).find(event => String(event.id) === card.id);
            this.$emit('event-click', {
                event: found ? JSON.parse(JSON.stringify(DzGlobal.raw(found))) : null, date: card.date, href: card.href
            });
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .wk { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        .wk-title { margin: 0 0 .75rem; font-family: var(--dz-font-heading, inherit); font-size: 1.35rem; font-weight: 700;
                    color: var(--dz-color-heading, #1f2330); }

        /* ---- Two equal columns; one under ~40rem of the component's own width. */
        .wk-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; align-items: start; }
        @container (max-width: 40rem) {
            .wk-columns { grid-template-columns: minmax(0, 1fr); }
        }
        .wk-col-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem .75rem;
                       margin: 0 0 .6rem; padding-bottom: .4rem; border-bottom: 2px solid var(--dz-color-border, #e4e6ee); }
        .wk-heading { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.05rem; font-weight: 700;
                      color: var(--dz-color-heading, #1f2330); }
        .wk-range { margin: 0; font-size: .8125rem; color: var(--dz-color-muted, #6b7180); }

        /* ---- Cards. Text stays dark on white or on a light tint of the event color, so any
           color stays readable; the color itself is the badge stripe and the hover border. */
        .wk-cards { display: flex; flex-direction: column; gap: .5rem; margin: 0; padding: 0; list-style: none; }
        .wk-card { box-sizing: border-box; display: flex; align-items: stretch; gap: .75rem; width: 100%; padding: .5rem;
                   border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 8px; background: var(--dz-color-surface, #fff);
                   box-shadow: 0 1px 2px rgba(0, 0, 0, .04); font: inherit; text-align: left; text-decoration: none;
                   color: var(--dz-color-text, #2b2f3a); cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
        .wk-card:hover { border-color: var(--ev, var(--dz-color-primary, #5b5ef0)); box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .3); }
        .wk-card:hover .wk-card-title { color: #4a4dd6; }
        .wk-card:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        .wk-badge { flex: none; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;
                    width: 3.6rem; padding: .3rem 0; border-top: 4px solid var(--ev, var(--dz-color-primary, #5b5ef0)); border-radius: 6px;
                    background: color-mix(in srgb, var(--ev, var(--dz-color-primary, #5b5ef0)) 14%, var(--dz-color-surface, #fff));
                    line-height: 1.1; color: var(--dz-color-heading, #1f2330); }
        .wk-badge-month { font-size: .6875rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .wk-badge-day { font-size: 1.4rem; font-weight: 800; }
        .wk-badge-dow { font-size: .6875rem; font-weight: 600; }

        .wk-body { display: flex; flex-direction: column; justify-content: center; gap: .15rem; min-width: 0; padding: .1rem 0; }
        .wk-card-title { font-weight: 700; color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .wk-meta { font-size: .8125rem; color: var(--dz-color-text, #2b2f3a); }
        .wk-sep { margin: 0 .35rem; color: var(--dz-color-muted, #6b7180); }
        /* The pin is a mask over currentColor from assets/icons.css. */
        .wk-loc { display: flex; align-items: center; gap: .25rem; font-size: .8125rem; color: var(--dz-color-muted, #6b7180);
                  overflow-wrap: anywhere; }
        .wk-loc::before { content: ""; flex: none; width: .95rem; height: .95rem; background: currentColor;
                          -webkit-mask: var(--dz-icon-location-on) center / contain no-repeat;
                          mask: var(--dz-icon-location-on) center / contain no-repeat; }

        .wk-empty { margin: 0; padding: .9rem .75rem; font-style: italic; color: var(--dz-color-muted, #6b7180);
                    border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 8px; }
    `
});
