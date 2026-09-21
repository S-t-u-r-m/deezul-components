export default Deezul.Component({
    // EventDetails — one event of a shared calendar, as a page: title, date and time, location,
    // organizer and description.
    //
    // DATA lives in calendar-store.js (window.DzCalendarStore): `store` names the calendar and
    // `eventId` the event. With no eventId, a component created by the router reads the route's
    // `id` parameter, so it can be a route's page directly:
    //   { path: '/events/:id', component: 'event_details' }        (the 'default' calendar)
    // or sit in a page that passes both:
    //   <dz-component dz-type="event_details" :store="'team'" :eventId="id"></dz-component>
    // It follows the calendar: an edited event updates in place, a removed one shows "not found".
    // `events` (when not empty) replaces the calendar's events, for pages with only props.
    //
    // FIELDS READ from the event: title, start, end, color, location, organizer, description
    // (plain text; line breaks kept, markup shown as text). A past event is marked as ended.
    // Attachments (documents, images) aren't shown yet: they arrive with the event entry form.
    //
    // OPTIONS:
    //   backHref       a "Back to calendar" link at the top (blank = none)
    //   locale         date and time names, e.g. 'fr-FR' (blank = the browser's)
    //   headingLevel   level of the event title (default 1, as a page's main heading); the
    //                  description heading is one below
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // NEEDS: window.DzCalendarStore and window.DzGlobal (imported by main.js), and the
    // --dz-icon-chevron-left custom property (assets/icons.css).
    schema: {
        inputs: {
            store:        { type: 'string', default: 'default', label: 'Calendar name (shared store)' },
            eventId:      { type: 'string', default: '', label: 'Event id (blank = the route’s id)' },
            events:       { type: 'array', default: [], label: 'Events (replace the calendar’s events)' },
            backHref:     { type: 'string', default: '', label: 'Back link (blank = none)' },
            locale:       { type: 'string', default: '', label: 'Locale (blank = browser)' },
            headingLevel: { type: 'number', default: 1, label: 'Title heading level' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Bindings inside the :if blocks read `info`, which is
    // never null (every field is a string when the event isn't found).
    template: html`
    <article class="ed" ref="root" :style="info.style">
        <a class="ed-back" :if="backHref" :href="backHref">
            <span class="ed-icon" aria-hidden="true"></span>{{ ui.back }}
        </a>
        <div class="ed-card" :if="info.found">
            <div class="ed-head">
                <span class="ed-badge" aria-hidden="true">
                    <span class="ed-badge-month">{{ info.month }}</span>
                    <span class="ed-badge-day">{{ info.day }}</span>
                    <span class="ed-badge-dow">{{ info.weekday }}</span>
                </span>
                <div class="ed-head-text">
                    <p class="ed-title" role="heading" :aria-level="levels.title">{{ info.title }}</p>
                    <p class="ed-when">{{ info.dateText }}<span class="ed-sep" aria-hidden="true">·</span>{{ info.timeText }}</p>
                    <p class="ed-ended" :if="info.ended">{{ ui.ended }}</p>
                </div>
            </div>
            <div class="ed-body">
                <dl class="ed-facts" :if="info.hasFacts">
                    <div class="ed-fact" :if="info.location">
                        <dt>{{ ui.where }}</dt>
                        <dd>{{ info.location }}</dd>
                    </div>
                    <div class="ed-fact" :if="info.organizer">
                        <dt>{{ ui.organizer }}</dt>
                        <dd>{{ info.organizer }}</dd>
                    </div>
                </dl>
                <div class="ed-about" :if="info.description">
                    <p class="ed-about-title" role="heading" :aria-level="levels.section">{{ ui.about }}</p>
                    <p class="ed-description">{{ info.description }}</p>
                </div>
                <p class="ed-nothing" :if="!info.hasFacts && !info.description">{{ ui.noDetails }}</p>            </div>
        </div>
        <div class="ed-missing" :if="!info.found">
            <p class="ed-title" role="heading" :aria-level="levels.title">{{ ui.notFound }}</p>
            <p class="ed-missing-text">{{ ui.notFoundText }}</p>
        </div>
    </article>
    `,

    data: () => ({
        store: 'default', eventId: '', events: [], backHref: '', locale: '', headingLevel: 1, labels: {},
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
                back: 'Back to calendar',
                where: 'Where',
                organizer: 'Organizer',
                about: 'About this event',
                allDay: 'All day',
                untitled: '(no title)',
                ended: 'This event has ended',
                noDetails: 'No other details.',
                notFound: 'Event not found',
                notFoundText: 'It may have been removed, or the link is out of date.'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const title = n >= 1 && n <= 6 ? n : 1;
            return { title, section: Math.min(title + 1, 6) };
        },

        // eventId, else the route's id parameter.
        id() {
            const own = DzGlobal.text(this.eventId);
            if (own) return own;
            const route = this.$route;
            return route && route.params && route.params.id ? String(route.params.id) : '';
        },

        formats() {
            const make = options => DzCalendarStore.display.formatter(this.locale, options);
            return {
                full: make({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
                month: make({ month: 'short' }),
                weekday: make({ weekday: 'short' }),
                time: make({ hour: 'numeric', minute: '2-digit' })
            };
        },

        // Everything the template shows about the event. Never null.
        info() {
            const empty = {
                found: false, title: '', dateText: '', timeText: '', location: '', organizer: '', description: '',
                month: '', day: '', weekday: '', style: '', ended: false, hasFacts: false
            };
            const dates = DzCalendarStore.dates;
            const display = DzCalendarStore.display;
            const id = this.id;
            const event = id ? (Array.isArray(this.allEvents) ? this.allEvents : []).find(e => String(e.id) === id) : null;
            if (!event || !dates.isKey(event.start)) return empty;

            const ui = this.ui;
            const f = this.formats;
            const text = value => DzGlobal.text(value).trim();
            const startDay = event.start.slice(0, 10);
            const endDay = dates.endDay(event);
            const start = dates.parse(startDay);
            const time = dates.time(event.start);
            const endTime = dates.time(event.end);
            let timeText = ui.allDay;
            if (time) {
                timeText = endTime && endDay === startDay && endTime > time
                    ? display.timeRangeText(event.start, event.end, f.time)
                    : display.timeText(event.start, f.time);
            }
            const color = display.safeColor(event.color);
            const location = text(event.location);
            const organizer = text(event.organizer);
            return {
                ...empty, found: true,
                title: text(event.title) || ui.untitled,
                dateText: endDay > startDay ? display.rangeText(f.full, startDay, endDay) : f.full.format(start),
                timeText, location, organizer, description: text(event.description),
                month: f.month.format(start), day: String(start.getDate()), weekday: f.weekday.format(start),
                style: color ? '--ev:' + color : '', ended: endDay < dates.today(), hasFacts: !!(location || organizer)
            };
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
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .ed { --ed-color: var(--ev, var(--dz-color-primary, #5b5ef0)); max-width: 46rem;
              font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }

        .ed-back { display: inline-flex; align-items: center; gap: .15rem; margin: 0 0 .75rem -.35rem; padding: .3rem .6rem .3rem .2rem;
                   border-radius: 6px; font-size: .875rem; font-weight: 600; text-decoration: none; color: #4a4dd6; }
        .ed-back:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, transparent); }
        .ed-back:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .ed-icon { display: block; width: 1.25rem; height: 1.25rem; background: currentColor;
                   -webkit-mask: var(--dz-icon-chevron-left) center / contain no-repeat;
                   mask: var(--dz-icon-chevron-left) center / contain no-repeat; }

        /* ---- The card: a band in a light tint of the event color. Text stays dark on the tint,
           so any color stays readable; the color itself is the top stripe and badge border. */
        .ed-card { overflow: hidden; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px;
                   background: var(--dz-color-surface, #fff); }
        .ed-head { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 1.1rem 1.25rem;
                   border-top: 6px solid var(--ed-color);
                   background: color-mix(in srgb, var(--ed-color) 10%, var(--dz-color-surface, #fff)); }
        .ed-badge { flex: none; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; width: 4.5rem;
                    padding: .45rem 0; border: 1px solid color-mix(in srgb, var(--ed-color) 40%, var(--dz-color-surface, #fff));
                    border-radius: 8px; background: var(--dz-color-surface, #fff); line-height: 1.1; color: var(--dz-color-heading, #1f2330); }
        .ed-badge-month { font-size: .75rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .ed-badge-day { font-size: 1.9rem; font-weight: 800; }
        .ed-badge-dow { font-size: .75rem; font-weight: 600; }
        .ed-head-text { flex: 1 1 14rem; min-width: 0; }
        .ed-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.5rem; font-weight: 700; line-height: 1.25;
                    color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .ed-when { margin: .3rem 0 0; font-size: .9375rem; }
        .ed-sep { margin: 0 .4rem; color: var(--dz-color-muted, #6b7180); }
        .ed-ended { display: inline-block; margin: .5rem 0 0; padding: .1rem .55rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                    border-radius: 999px; font-size: .75rem; font-weight: 600; background: var(--dz-color-surface, #fff); }

        .ed-body { display: flex; flex-direction: column; gap: 1.1rem; padding: 1.1rem 1.25rem 1.35rem; }
        .ed-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem 1.5rem; margin: 0; }
        .ed-fact dt { margin: 0 0 .15rem; font-size: .75rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .ed-fact dd { margin: 0; overflow-wrap: anywhere; color: var(--dz-color-heading, #1f2330); }
        .ed-about-title { margin: 0 0 .35rem; font-size: 1rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .ed-description { margin: 0; line-height: 1.65; white-space: pre-line; overflow-wrap: anywhere; }
        .ed-nothing { margin: 0; font-style: italic; color: var(--dz-color-muted, #6b7180); }

        .ed-missing { padding: 1.5rem 1.25rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px;
                      background: var(--dz-color-surface, #fff); }
        .ed-missing-text { margin: .4rem 0 0; color: var(--dz-color-muted, #6b7180); }
    `
});
