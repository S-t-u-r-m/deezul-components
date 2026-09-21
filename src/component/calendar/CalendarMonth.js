export default Deezul.Component({
    // CalendarMonth — a full month grid with the events of a shared calendar.
    //
    // DATA lives in calendar-store.js (window.DzCalendarStore), not in this component. `store`
    // names the calendar to show; every view with the same name shares its events, the day
    // being looked at and the selected day, so views move together. A host normally fills the
    // calendar through the store:
    //   DzCalendarStore.use('team').setEvents(list);
    //   <dz-component dz-type="calendar_month" :store="'team'"></dz-component>
    // `events` is a shortcut for pages that only have props: when not empty it replaces the
    // calendar's events on mount and whenever it changes. Seed a calendar from ONE place.
    // Event shape ({ id, title, start, end, color }) is documented in calendar-store.js.
    //
    // OPTIONS:
    //   title        a small label above the month name (blank = none)
    //   initialDate  'YYYY-MM-DD' to open at, instead of the calendar's current day
    //   weekStart    first column: 0 Sunday (default) … 6 Saturday
    //   locale       month, weekday, date and time names, e.g. 'fr-FR' (blank = the browser's)
    //   yearsBack    how many whole years before the current one can be shown (default 1)
    //   yearsAhead   how many whole years after the current one (default 1)
    //   maxPerDay    event lines per day before "+N more" (default 3)
    //   showDayList  list the selected day's events under the grid (default true)
    //   labels       text overrides; see the `ui` computed for the keys
    //
    // MOVING AROUND: previous / next month, Today, and month and year dropdowns, all limited to
    // the range. Clicking a day selects it (again unselects it); a day from the neighbouring
    // month also switches to that month.
    //
    // EVENTS emitted:
    //   select-date   { date, events }   a day was selected; events are that day's, as stored
    //   event-click   { event, date }    an event line (or day-list entry) was clicked
    //   month-change  { year, month, date }   month is 1-12; only for changes made in this view
    //
    // SCREEN READERS AND KEYBOARD (the WAI-ARIA date grid pattern): the month is a grid labelled
    // by its heading, with one tab stop — the day being looked at. Arrows move by day and week,
    // Home / End to the week's ends, Page Up / Page Down by month (with Shift, by year), and
    // Enter or Space selects. Each day's name is its full date, plus "today" and its event
    // count. The event lines in the grid are a mouse shortcut hidden from screen readers; the
    // day list under the grid is the accessible way to the events. Month changes from the
    // buttons and dropdowns, and selecting a day, are announced.
    //
    // NARROW: under ~36rem of its own width (a container query, so it follows the space it's
    // given, not the screen) event lines shrink to colored dots and the day list does the rest.
    //
    // NEEDS: window.DzCalendarStore and window.DzGlobal (imported by main.js), and the
    // --dz-icon-chevron-left / -right custom properties (assets/icons.css).
    schema: {
        inputs: {
            store:       { type: 'string', default: 'default', label: 'Calendar name (shared store)' },
            events:      { type: 'array', default: [], label: 'Events (replace the calendar’s events)' },
            title:       { type: 'string', default: '', label: 'Title' },
            initialDate: { type: 'string', default: '', label: 'Open at date (YYYY-MM-DD)' },
            weekStart:   { type: 'number', default: 0, label: 'First day of the week (0 = Sunday)' },
            locale:      { type: 'string', default: '', label: 'Locale (blank = browser)' },
            yearsBack:   { type: 'number', default: 1, label: 'Years back' },
            yearsAhead:  { type: 'number', default: 1, label: 'Years ahead' },
            maxPerDay:   { type: 'number', default: 3, label: 'Events per day before "more"' },
            showDayList: { type: 'boolean', default: true, label: 'Show the selected day’s events' },
            labels:      { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // :if sits on elements INSIDE the :for rows, never on the :for element (a compile error).
    // `ref` only on the outermost element. The select values are set in $updated (syncSelects):
    // an option's selected attribute stops applying once the user has changed the select.
    template: html`
    <div class="cal" ref="root" @keydown="onKeydown">
        <div class="cal-top">
            <div class="cal-heading">
                <p class="cal-title" :if="title">{{ title }}</p>
                <p class="cal-month" id="cal-month">{{ heading }}</p>
            </div>
            <div class="cal-nav" role="group" :aria-label="ui.navigation">
                <button type="button" class="cal-btn cal-icon-btn" :aria-disabled="canPrev ? 'false' : 'true'"
                        :aria-label="ui.previousMonth" :title="ui.previousMonth" @click="step(-1)">
                    <span class="cal-icon i-prev" aria-hidden="true"></span>
                </button>
                <button type="button" class="cal-btn" @click="goToday">{{ ui.today }}</button>
                <button type="button" class="cal-btn cal-icon-btn" :aria-disabled="canNext ? 'false' : 'true'"
                        :aria-label="ui.nextMonth" :title="ui.nextMonth" @click="step(1)">
                    <span class="cal-icon i-next" aria-hidden="true"></span>
                </button>
                <label class="cal-sr" for="cal-select-month">{{ ui.month }}</label>
                <select class="cal-select cal-select-month" id="cal-select-month" @change="pickMonth($event)">
                    <option :for="opt in monthOptions" :key="opt.key" :value="opt.value" :disabled="opt.disabled">{{ opt.label }}</option>
                </select>
                <label class="cal-sr" for="cal-select-year">{{ ui.year }}</label>
                <select class="cal-select cal-select-year" id="cal-select-year" @change="pickYear($event)">
                    <option :for="opt in yearOptions" :key="opt.key" :value="opt.value">{{ opt.label }}</option>
                </select>
            </div>
        </div>
        <div class="cal-grid" role="grid" aria-labelledby="cal-month">
            <div class="cal-row cal-weekdays" role="row">
                <div class="cal-weekday" role="columnheader" :for="wd in weekdays" :key="wd.key">
                    <span aria-hidden="true">{{ wd.short }}</span><span class="cal-sr">{{ wd.long }}</span>
                </div>
            </div>
            <div class="cal-row cal-week" role="row" :for="week in weeks" :key="week.key">
                <div class="cal-day" role="gridcell" :for="day in week.days" :key="day.key" :class="day.cls"
                     :aria-selected="day.selected ? 'true' : 'false'">
                    <button type="button" class="cal-date" :data-date="day.key" :tabindex="day.focus ? '0' : '-1'"
                            :aria-label="day.name" :aria-current="day.today ? 'date' : 'false'"
                            :aria-disabled="day.disabled ? 'true' : 'false'" @click="pick(day, $event, false)">{{ day.number }}</button>
                    <ul class="cal-events" aria-hidden="true">
                        <li :for="ev in day.shown" :key="ev.key">
                            <button type="button" class="cal-event" :class="ev.continues ? 'is-continued' : ''" tabindex="-1"
                                    :style="ev.style" :title="ev.title" @click="openEvent(ev, $event)">
                                <span class="cal-time" :if="ev.time">{{ ev.time }}</span>
                                <span class="cal-ev-label">{{ ev.label }}</span>
                            </button>
                        </li>
                    </ul>
                    <button type="button" class="cal-more" :if="day.more" tabindex="-1" aria-hidden="true"
                            @click="pick(day, $event, true)">{{ day.moreText }}</button>
                </div>
            </div>
        </div>
        <div class="cal-day-list" :if="dayList.show">
            <p class="cal-day-heading">{{ dayList.heading }}</p>
            <ul class="cal-agenda" :if="dayList.events.length">
                <li :for="ev in dayList.events" :key="ev.key">
                    <button type="button" class="cal-agenda-item" :style="ev.style" @click="openEvent(ev, $event)">
                        <span class="cal-dot" aria-hidden="true"></span>
                        <span class="cal-agenda-time">{{ ev.when }}</span>
                        <span class="cal-agenda-label">{{ ev.label }}</span>
                    </button>
                </li>
            </ul>
            <p class="cal-empty" :if="!dayList.events.length">{{ ui.noEvents }}</p>
        </div>
        <p class="cal-sr" role="status" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
    </div>
    `,

    data: () => ({
        store: 'default', events: [], title: '', initialDate: '', weekStart: 0, locale: '',
        yearsBack: 1, yearsAhead: 1, maxPerDay: 3, showDayList: true, labels: {},
        allEvents: [], cursor: '', selected: '', liveMessage: ''
    }),

    // The calendar, its unsubscribe and the last seeded `events` live on the root element,
    // outside reactive data. The `store` name is read once, here.
    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        root._calStore = DzCalendarStore.use(this.store || 'default');
        this.seed(root);
        if (DzCalendarStore.dates.isKey(this.initialDate)) root._calStore.setDate(this.initialDate);
        root._calUnsubscribe = root._calStore.subscribe(() => this.pull());
        this.pull();
        Deezul.nextTick().then(() => this.syncSelects(root));
    },

    $updated() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root || !root._calStore) return;
        this.seed(root);
        this.syncSelects(root);
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (root && root._calUnsubscribe) root._calUnsubscribe();
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                navigation: 'Change month',
                previousMonth: 'Previous month',
                nextMonth: 'Next month',
                today: 'Today',
                month: 'Month',
                year: 'Year',
                todayMark: 'today',
                oneEvent: '1 event',
                manyEvents: '{count} events',
                more: '+{count} more',
                allDay: 'All day',
                untitled: '(no title)',
                dayEvents: 'Events on {date}',
                noEvents: 'No events',
                selectedDay: '{date} selected, {events}'
            }, this.labels);
        },

        // First and last showable day: whole years around the current one.
        range() {
            return DzCalendarStore.display.range(this.yearsBack, this.yearsAhead);
        },

        // The day being looked at (the calendar's date, kept inside this view's range) and its month.
        view() {
            const dates = DzCalendarStore.dates;
            const { min, max } = this.range;
            const key = dates.clamp(dates.isKey(this.cursor) ? this.cursor : dates.today(), min, max);
            return { key, year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 };
        },

        // Intl formatters for the locale; an invalid locale falls back to the browser's.
        formats() {
            const make = options => DzCalendarStore.display.formatter(this.locale, options);
            return {
                heading: make({ month: 'long', year: 'numeric' }),
                full: make({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
                monthName: make({ month: 'long' }),
                weekdayLong: make({ weekday: 'long' }),
                weekdayShort: make({ weekday: 'short' }),
                time: make({ hour: 'numeric', minute: '2-digit' })
            };
        },

        heading() {
            return this.formats.heading.format(DzCalendarStore.dates.parse(this.view.key));
        },

        weekStartDay() {
            return DzCalendarStore.display.weekStartDay(this.weekStart);
        },

        weekdays() {
            const out = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(2023, 0, 1 + ((this.weekStartDay + i) % 7));   // 1 Jan 2023 was a Sunday
                out.push({ key: 'wd' + i, long: this.formats.weekdayLong.format(date), short: this.formats.weekdayShort.format(date) });
            }
            return out;
        },

        // The month padded out to whole weeks with the neighbouring months' days.
        weeks() {
            const dates = DzCalendarStore.dates;
            const ui = this.ui;
            const view = this.view;
            const { min, max } = this.range;
            const first = dates.monthStart(view.key);
            const last = dates.monthEnd(view.key);
            const from = DzCalendarStore.display.weekFrom(first, this.weekStartDay);
            const to = dates.addDays(last, (this.weekStartDay + 6 - dates.weekday(last) + 7) % 7);
            const buckets = this.eventsByDay(from, to);
            const limit = Math.max(1, Math.round(Number(this.maxPerDay)) || 3);
            const today = dates.today();
            const month = view.key.slice(0, 7);
            const weeks = [];
            let key = from;
            while (key <= to) {
                const days = [];
                for (let i = 0; i < 7; i++) {
                    const events = buckets.get(key) || [];
                    const shown = events.length > limit ? events.slice(0, limit - 1) : events;
                    const isToday = key === today;
                    const selected = key === this.selected;
                    const disabled = key < min || key > max;
                    const name = [this.formats.full.format(dates.parse(key))];
                    if (isToday) name.push(ui.todayMark);
                    if (events.length) name.push(this.countText(events.length));
                    days.push({
                        key, number: Number(key.slice(8, 10)), focus: key === view.key, today: isToday, selected, disabled,
                        name: name.join(', '), shown, more: events.length - shown.length,
                        moreText: DzGlobal.format(ui.more, { count: events.length - shown.length }),
                        cls: (key.slice(0, 7) === month ? '' : ' is-outside') + (isToday ? ' is-today' : '')
                            + (selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '')
                    });
                    key = dates.addDays(key, 1);
                }
                weeks.push({ key: days[0].key, days });
            }
            return weeks;
        },

        // The selected day's events for the list under the grid. Never null, so its bindings
        // survive the list being removed.
        dayList() {
            const dates = DzCalendarStore.dates;
            const key = this.selected;
            const show = !!this.showDayList && dates.isKey(key);
            return {
                show,
                events: show ? (this.eventsByDay(key, key).get(key) || []) : [],
                heading: show ? DzGlobal.format(this.ui.dayEvents, { date: this.formats.full.format(dates.parse(key)) }) : ''
            };
        },

        monthOptions() {
            const dates = DzCalendarStore.dates;
            const { min, max } = this.range;
            const year = this.view.year;
            const out = [];
            for (let m = 0; m < 12; m++) {
                const first = dates.make(year, m, 1);
                out.push({ key: 'm' + m, value: String(m), label: this.formats.monthName.format(dates.parse(first)),
                           disabled: dates.monthEnd(first) < min || first > max });
            }
            return out;
        },

        yearOptions() {
            const out = [];
            for (let y = Number(this.range.min.slice(0, 4)); y <= Number(this.range.max.slice(0, 4)); y++) {
                out.push({ key: 'y' + y, value: String(y), label: String(y) });
            }
            return out;
        },

        canPrev() {
            return DzCalendarStore.dates.monthStart(this.view.key) > this.range.min;
        },

        canNext() {
            return DzCalendarStore.dates.monthEnd(this.view.key) < this.range.max;
        }
    },

    methods: {
        calendar() {
            const root = DzGlobal.raw(this.$refs.root);
            return root && root._calStore ? root._calStore : null;
        },

        // Copy the calendar's state in. Runs on every store change, from any view.
        pull() {
            const calendar = this.calendar();
            if (!calendar) return;
            this.allEvents = calendar.getEvents();
            this.cursor = calendar.getDate();
            this.selected = calendar.getSelected();
        },

        // Push a non-empty `events` prop into the calendar when it differs from the last push.
        seed(root) {
            const list = DzGlobal.raw(this.events);
            const signature = JSON.stringify(Array.isArray(list) ? list : []);
            if (root._calSeeded === signature) return;
            root._calSeeded = signature;
            if (Array.isArray(list) && list.length) root._calStore.setEvents(list);
        },

        syncSelects(root) {
            const month = root.querySelector('.cal-select-month');
            const year = root.querySelector('.cal-select-year');
            if (month && month.value !== String(this.view.month)) month.value = String(this.view.month);
            if (year && year.value !== String(this.view.year)) year.value = String(this.view.year);
        },

        countText(count) {
            return count === 1 ? this.ui.oneEvent : DzGlobal.format(this.ui.manyEvents, { count });
        },

        // Display entries for the events touching [from, to], by day (see DzCalendarStore.display.byDay).
        eventsByDay(from, to) {
            return DzCalendarStore.display.byDay(this.allEvents, from, to,
                { time: this.formats.time, allDay: this.ui.allDay, untitled: this.ui.untitled });
        },

        eventById(id) {
            const found = (Array.isArray(this.allEvents) ? this.allEvents : []).find(event => String(event.id) === id);
            return found ? JSON.parse(JSON.stringify(DzGlobal.raw(found))) : null;
        },

        // Look at a day (clamped to the range) through the calendar, so every view follows.
        // Returns the day actually shown. Works from the target key rather than re-reading
        // `view`: computed values aren't refreshed until the store change has been rendered.
        go(key, announce) {
            const dates = DzCalendarStore.dates;
            const calendar = this.calendar();
            const target = dates.clamp(key, this.range.min, this.range.max);
            if (!calendar) return target;
            const before = this.view.key.slice(0, 7);
            calendar.setDate(target);
            if (target.slice(0, 7) === before) return target;
            this.$emit('month-change', { year: Number(target.slice(0, 4)), month: Number(target.slice(5, 7)), date: target });
            if (announce) DzGlobal.announce(this, this.formats.heading.format(dates.parse(target)));
            return target;
        },

        // aria-disabled buttons still click, so the range is checked here.
        step(count) {
            if (count < 0 ? !this.canPrev : !this.canNext) return;
            this.go(DzCalendarStore.dates.addMonths(this.view.key, count), true);
        },

        goToday() {
            this.go(DzCalendarStore.dates.today(), true);
        },

        pickMonth(event) {
            this.go(DzCalendarStore.dates.make(this.view.year, Number(event.target.value), Number(this.view.key.slice(8, 10))), true);
        },

        pickYear(event) {
            this.go(DzCalendarStore.dates.make(Number(event.target.value), this.view.month, Number(this.view.key.slice(8, 10))), true);
        },

        // Select a day, or unselect it when clicked again (`keep` — the "+N more" link — always
        // selects). Focus follows to the day, which is re-rendered when the month changes.
        pick(day, event, keep) {
            const calendar = this.calendar();
            if (!calendar || day.disabled) return;
            const root = event.target.getRootNode();
            const selecting = keep || this.selected !== day.key;
            this.go(day.key, false);
            calendar.setSelected(selecting ? day.key : '');
            if (selecting) {
                const events = this.eventsByDay(day.key, day.key).get(day.key) || [];
                this.$emit('select-date', { date: day.key, events: events.map(entry => this.eventById(entry.id)) });
                DzGlobal.announce(this, DzGlobal.format(this.ui.selectedDay, {
                    date: this.formats.full.format(DzCalendarStore.dates.parse(day.key)),
                    events: events.length ? this.countText(events.length) : this.ui.noEvents
                }));
            }
            DzGlobal.focusIn(root, '.cal-date[data-date="' + day.key + '"]');
        },

        openEvent(entry, event) {
            event.stopPropagation();
            this.$emit('event-click', { event: this.eventById(entry.id), date: entry.date });
        },

        // Grid keys, on a day button only.
        onKeydown(event) {
            const target = event.target;
            if (!target.classList || !target.classList.contains('cal-date')) return;
            const dates = DzCalendarStore.dates;
            const key = target.getAttribute('data-date');
            const column = (dates.weekday(key) - this.weekStartDay + 7) % 7;
            const moves = {
                ArrowLeft: () => dates.addDays(key, -1),
                ArrowRight: () => dates.addDays(key, 1),
                ArrowUp: () => dates.addDays(key, -7),
                ArrowDown: () => dates.addDays(key, 7),
                Home: () => dates.addDays(key, -column),
                End: () => dates.addDays(key, 6 - column),
                PageUp: () => dates.addMonths(key, event.shiftKey ? -12 : -1),
                PageDown: () => dates.addMonths(key, event.shiftKey ? 12 : 1)
            };
            if (!moves[event.key]) return;
            event.preventDefault();
            const shown = this.go(moves[event.key](), false);
            DzGlobal.focusIn(target.getRootNode(), '.cal-date[data-date="' + shown + '"]');
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .cal { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        .cal-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
                  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }

        /* ---- Header: month name left, navigation right; the navigation wraps under when narrow. */
        .cal-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
                   gap: .5rem .75rem; margin: 0 0 .75rem; }
        .cal-heading { min-width: 0; }
        .cal-title { margin: 0; font-size: .75rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
                     color: var(--dz-color-muted, #6b7180); }
        .cal-month { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.35rem; font-weight: 700;
                     color: var(--dz-color-heading, #1f2330); }
        .cal-nav { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; }
        .cal-btn, .cal-select { box-sizing: border-box; height: 2.25rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                                border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem;
                                color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .cal-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0 .75rem; font-weight: 600; }
        .cal-icon-btn { width: 2.25rem; padding: 0; }
        .cal-btn:hover { background: var(--dz-color-bg, #f7f7fb); }
        .cal-btn[aria-disabled="true"] { opacity: .45; cursor: not-allowed; background: var(--dz-color-surface, #fff); }
        .cal-select { padding: 0 .4rem; }
        .cal-btn:focus-visible, .cal-select:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px; }
        .cal-icon { display: block; width: 1.4rem; height: 1.4rem; background: currentColor;
                    -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-prev { --icon: var(--dz-icon-chevron-left); }
        .i-next { --icon: var(--dz-icon-chevron-right); }

        /* ---- The grid. Seven equal columns that may shrink below their content. */
        .cal-grid { border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 8px; overflow: hidden;
                    background: var(--dz-color-surface, #fff); }
        .cal-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
        .cal-weekday { padding: .45rem .25rem; font-size: .75rem; font-weight: 700; text-align: center;
                       color: var(--dz-color-text, #2b2f3a); background: var(--dz-color-bg, #f7f7fb); }
        .cal-day { display: flex; flex-direction: column; gap: 2px; min-width: 0; min-height: 6.5rem; padding: .25rem;
                   border-top: 1px solid var(--dz-color-border, #e4e6ee); border-left: 1px solid var(--dz-color-border, #e4e6ee); }
        .cal-day:first-child { border-left: 0; }
        /* Neighbouring months: muted number on the light ground (4.6:1). */
        .cal-day.is-outside { background: var(--dz-color-bg, #f7f7fb); }
        .cal-day.is-outside .cal-date { color: var(--dz-color-muted, #6b7180); font-weight: 500; }
        .cal-day.is-selected { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 9%, var(--dz-color-surface, #fff));
                               box-shadow: inset 0 0 0 2px var(--dz-color-primary, #5b5ef0); }
        .cal-day.is-disabled .cal-date { opacity: .45; cursor: not-allowed; }

        .cal-date { flex: none; align-self: flex-start; display: inline-flex; align-items: center; justify-content: center;
                    width: 1.9rem; height: 1.9rem; padding: 0; border: 0; border-radius: 50%; background: none;
                    font: inherit; font-size: .875rem; font-weight: 600; color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .cal-date:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 12%, transparent); }
        .cal-date:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px; }
        /* Today: white on primary, 4.9:1. */
        .cal-day.is-today .cal-date { background: var(--dz-color-primary, #5b5ef0); color: #fff; }

        /* Event lines: dark text on a light tint of the event color, so any color stays readable. */
        .cal-events { display: flex; flex-direction: column; gap: 2px; min-width: 0; margin: 0; padding: 0; list-style: none; }
        .cal-events li { min-width: 0; }
        .cal-event { display: flex; gap: .3rem; width: 100%; min-width: 0; padding: 1px 4px; border: 0;
                     border-left: 3px solid var(--ev, var(--dz-color-primary, #5b5ef0)); border-radius: 3px;
                     background: color-mix(in srgb, var(--ev, var(--dz-color-primary, #5b5ef0)) 14%, var(--dz-color-surface, #fff));
                     font: inherit; font-size: .75rem; line-height: 1.35; text-align: left; white-space: nowrap;
                     color: var(--dz-color-text, #2b2f3a); cursor: pointer; }
        .cal-event:hover { background: color-mix(in srgb, var(--ev, var(--dz-color-primary, #5b5ef0)) 26%, var(--dz-color-surface, #fff)); }
        .cal-event.is-continued { border-left-style: dotted; }
        .cal-time { flex: none; font-weight: 700; }
        .cal-ev-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .cal-more { align-self: flex-start; padding: 0 4px; border: 0; background: none; font: inherit; font-size: .75rem;
                    font-weight: 700; color: #4a4dd6; cursor: pointer; }
        .cal-more:hover { text-decoration: underline; }

        /* ---- The selected day's events. */
        .cal-day-list { margin-top: .75rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 8px;
                        background: var(--dz-color-surface, #fff); }
        .cal-day-heading { margin: 0; padding: .6rem .75rem; font-weight: 700; color: var(--dz-color-heading, #1f2330);
                           border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
        .cal-agenda { margin: 0; padding: .25rem 0; list-style: none; }
        .cal-agenda-item { display: flex; align-items: center; gap: .6rem; width: 100%; padding: .5rem .75rem; border: 0;
                           background: none; font: inherit; text-align: left; color: var(--dz-color-text, #2b2f3a); cursor: pointer; }
        .cal-agenda-item:hover { background: var(--dz-color-bg, #f7f7fb); }
        .cal-agenda-item:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -2px; }
        .cal-dot { flex: none; width: .65rem; height: .65rem; border-radius: 50%; background: var(--ev, var(--dz-color-primary, #5b5ef0)); }
        .cal-agenda-time { flex: none; min-width: 4.5rem; font-size: .8125rem; color: var(--dz-color-muted, #6b7180); }
        .cal-agenda-label { min-width: 0; overflow-wrap: anywhere; }
        .cal-empty { margin: 0; padding: .75rem; font-style: italic; color: var(--dz-color-muted, #6b7180); }

        /* ---- Narrow: event lines become dots (up to three) and the day list carries the detail. */
        @container (max-width: 36rem) {
            .cal-month { font-size: 1.15rem; }
            .cal-day { align-items: center; min-height: 3.4rem; padding: .2rem 0; }
            .cal-date { align-self: center; }
            .cal-events { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 3px; }
            .cal-events li:nth-child(n+4) { display: none; }
            .cal-event { width: 6px; height: 6px; padding: 0; border: 0; border-radius: 50%;
                         background: var(--ev, var(--dz-color-primary, #5b5ef0)); }
            .cal-time, .cal-ev-label, .cal-more { display: none; }
        }
    `
});
