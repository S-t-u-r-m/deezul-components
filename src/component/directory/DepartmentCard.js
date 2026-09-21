export default Deezul.Component({
    // DepartmentCard — how to reach a department and when it is open: contact details, office and
    // mailing addresses with a directions link, weekly hours, an "Open now / Closed" status,
    // upcoming holiday closures, and quick links.
    //
    // DATA: `department` is one department from the CMS. Every field is optional except the name:
    //   {
    //     name             'Health Department'
    //     href             the department's page; the name links there on a compact card
    //     description      a sentence or two about what it does (full card only)
    //     head:            { name, title } — the director, commissioner or elected official
    //     phone, fax, email
    //     address          the office: { street, street2, city, state, zip }, lines as an array,
    //                      or one string with a line break between lines
    //     mailingAddress   the same shapes, when mail goes somewhere else (a PO box)
    //     mapHref          a map link (blank = built from the address with `directionsHref`)
    //     locationNote     'Enter from Main Street. Accessible parking in the rear lot.'
    //     hours: [         when the office is open, in the department's time zone
    //       { days: [1, 2, 3, 4, 5], open: '08:00', close: '16:30' }
    //     ]                days are 0 (Sunday) to 6 (Saturday), or 'mon', 'tue' ...; list a day twice
    //                      to close for lunch; close '24:00' is midnight, and 00:00–24:00 every day
    //                      is "Open 24 hours". Hours past midnight are not supported.
    //     hoursNote        'Birth and death certificates until 4:00 PM.'
    //     closures: [      holidays and other days that differ from the weekly hours
    //       { date: '2026-11-26', endDate: '2026-11-27', name: 'Thanksgiving' },           closed
    //       { date: '2026-12-24', name: 'Christmas Eve', open: '08:00', close: '12:00' }  shorter hours
    //     ]
    //     closedMessage    'Closed through Friday for flooring repairs.' — shows Closed with this
    //                      message whatever the hours say; clear it to go back to the hours
    //     links: [         { label, href } — services people come to the department page for
    //   }
    // Anything empty is left out. Links: tel:, mailto:, http(s) or a site path.
    //
    //   <dz-component dz-type="department_card" :department="department" :timeZone="'America/New_York'"></dz-component>
    //
    // STATUS: Open now (Closes at 4:30 PM), Closes soon (30 minutes or less left), or Closed
    // (Opens tomorrow at 8:00 AM), with the holiday's name on a closure day. It follows the clock,
    // checked every 30 seconds, in `timeZone` so visitors elsewhere see the office's own time. It
    // is not announced as it changes. Without hours (and no closedMessage) there is no status.
    //
    // VARIANTS:
    //   full      description, contact, addresses, the week's hours, upcoming closures and links;
    //             two columns when there is room (~40rem), one otherwise
    //   compact   the name (a link with `href`), status, today's hours, phone and address: for a
    //             list of departments or a sidebar
    //
    // OPTIONS:
    //   department      the department (above)
    //   variant         'full' (default) or 'compact'
    //   headingLevel    the name's level (default 2); section headings are one below
    //   showStatus      the open/closed status (default true)
    //   showDescription the description, on both variants (default true)
    //   closureDays     how far ahead closures are listed, in days (default 60; 0 = none listed)
    //   closureLimit    at most this many closures listed (default 3)
    //   directionsHref  map link template, {address} = the encoded address (blank = no link unless
    //                   the department has a mapHref)
    //   timeZone        the office's IANA time zone, e.g. 'America/New_York' (blank = the visitor's)
    //   now             preview the card at a moment, 'YYYY-MM-DDTHH:mm' in the office's time
    //                   (blank = now); for the CMS editor and tests
    //   locale          day and time names, e.g. 'es-US' (blank = the browser's)
    //   labels          text overrides; see the `ui` computed for the keys
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js, and the --dz-icon-call, -mail,
    // -print, -location-on, -groups, -schedule and -chevron-right properties.
    schema: {
        inputs: {
            department:     { type: 'object', default: {}, label: 'Department' },
            variant:        { type: 'enum', options: ['full', 'compact'], default: 'full', label: 'Variant' },
            headingLevel:   { type: 'number', default: 2, label: 'Name heading level' },
            showStatus:     { type: 'boolean', default: true, label: 'Show open or closed' },
            showDescription: { type: 'boolean', default: true, label: 'Show the description' },
            closureDays:    { type: 'number', default: 60, label: 'List closures this many days ahead (0 = none)' },
            closureLimit:   { type: 'number', default: 3, label: 'Most closures listed' },
            directionsHref: { type: 'string', default: 'https://www.google.com/maps/search/?api=1&query={address}', label: 'Directions link ({address})' },
            timeZone:       { type: 'string', default: '', label: 'Office time zone (blank = visitor)' },
            now:            { type: 'string', default: '', label: 'Preview at (YYYY-MM-DDTHH:mm)' },
            locale:         { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:         { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. The status is plain text, not a live region: it
    // changes with the clock, and announcing that would interrupt whatever the visitor is doing.
    template: html`
    <article class="dc" ref="root" :class="rootClass">
        <p class="dc-empty" :if="!info.found">{{ ui.notFound }}</p>

        <header class="dc-head" :if="info.found">
            <p class="dc-name" :if="!compact || !info.href" role="heading" :aria-level="levels.name">{{ info.name }}</p>
            <p class="dc-name" :if="compact && info.href" role="heading" :aria-level="levels.name"><a class="dc-name-link" :href="info.href">{{ info.name }}</a></p>
            <p class="dc-status" :if="status.state" :class="'is-' + status.state">
                <span class="dc-pill"><span class="dc-dot" aria-hidden="true"></span>{{ status.label }}</span>
                <span class="dc-detail" :for="part in status.parts" :key="part.key">{{ part.text }}</span>
            </p>
            <p class="dc-desc" :if="showDescription && info.description">{{ info.description }}</p>
        </header>

        <div class="dc-compact" :if="info.found && compact">
            <ul class="dc-lines">
                <li class="dc-line" :if="todayHours">
                    <span class="dc-glyph i-schedule" aria-hidden="true"></span>{{ todayHours }}
                </li>
                <li class="dc-line" :if="info.phone">
                    <span class="dc-glyph i-call" aria-hidden="true"></span>
                    <a class="dc-link" :href="info.phoneHref">{{ info.phone }}</a>
                </li>
                <li class="dc-line" :if="info.addressText">
                    <span class="dc-glyph i-place" aria-hidden="true"></span>{{ info.addressText }}
                </li>
            </ul>
        </div>

        <div class="dc-body" :if="info.found && !compact" :class="weekRows.length ? '' : 'is-single'">
            <section class="dc-section" :if="hasContact">
                <p class="dc-section-title" role="heading" :aria-level="levels.section">{{ ui.contact }}</p>
                <ul class="dc-lines">
                    <li class="dc-line" :if="info.head.name">
                        <span class="dc-glyph i-person" aria-hidden="true"></span>
                        <span><span class="dc-strong">{{ info.head.name }}</span><span class="dc-muted" :if="info.head.title">, {{ info.head.title }}</span></span>
                    </li>
                    <li class="dc-line" :if="info.phone">
                        <span class="dc-glyph i-call" aria-hidden="true"></span>
                        <a class="dc-link" :href="info.phoneHref">{{ info.phone }}</a>
                    </li>
                    <li class="dc-line" :if="info.fax">
                        <span class="dc-glyph i-fax" aria-hidden="true"></span>{{ info.faxText }}
                    </li>
                    <li class="dc-line" :if="info.email">
                        <span class="dc-glyph i-mail" aria-hidden="true"></span>
                        <a class="dc-link" :href="info.emailHref">{{ info.email }}</a>
                    </li>
                </ul>

                <div class="dc-place" :if="info.addressLines.length">
                    <span class="dc-glyph i-place" aria-hidden="true"></span>
                    <div class="dc-place-body">
                        <p class="dc-label">{{ ui.office }}</p>
                        <p class="dc-address"><span class="dc-address-line" :for="line in info.addressLines" :key="line.key">{{ line.text }}</span></p>
                        <p class="dc-note" :if="info.locationNote">{{ info.locationNote }}</p>
                        <a class="dc-directions" :if="info.mapHref" :href="info.mapHref" target="_blank" rel="noopener noreferrer" data-no-router>
                            <span>{{ ui.directions }}</span><span class="dc-sr">{{ ui.newTab }}</span><span class="dc-glyph i-more" aria-hidden="true"></span>
                        </a>
                    </div>
                </div>

                <div class="dc-place" :if="info.mailingLines.length">
                    <span class="dc-glyph i-mailbox" aria-hidden="true"></span>
                    <div class="dc-place-body">
                        <p class="dc-label">{{ ui.mailing }}</p>
                        <p class="dc-address"><span class="dc-address-line" :for="line in info.mailingLines" :key="line.key">{{ line.text }}</span></p>
                    </div>
                </div>
            </section>

            <section class="dc-section dc-hours-section" :if="weekRows.length">
                <p class="dc-section-title" role="heading" :aria-level="levels.section">{{ ui.hours }}</p>
                <table class="dc-hours">
                    <caption class="dc-sr">{{ ui.weeklyHours }}</caption>
                    <tbody>
                        <tr :for="row in weekRows" :key="row.key" :class="row.today ? 'is-today' : ''">
                            <th scope="row">{{ row.days }}<span class="dc-today" :if="row.today">{{ ui.today }}</span></th>
                            <td>{{ row.hours }}</td>
                        </tr>
                    </tbody>
                </table>
                <p class="dc-note" :if="info.hoursNote">{{ info.hoursNote }}</p>

                <div class="dc-closures" :if="closureRows.length">
                    <p class="dc-subtitle" role="heading" :aria-level="levels.sub">{{ ui.closures }}</p>
                    <ul class="dc-closure-list">
                        <li class="dc-closure" :for="entry in closureRows" :key="entry.key" :class="entry.today ? 'is-today' : ''">
                            <span class="dc-closure-name">{{ entry.name }}<span class="dc-today" :if="entry.today">{{ ui.today }}</span></span>
                            <span class="dc-closure-date">{{ entry.dates }}</span>
                            <span class="dc-closure-hours">{{ entry.hours }}</span>
                        </li>
                    </ul>
                </div>
            </section>
        </div>

        <section class="dc-links-section" :if="info.found && !compact && info.links.length">
            <p class="dc-section-title" role="heading" :aria-level="levels.section">{{ ui.links }}</p>
            <ul class="dc-links">
                <li :for="link in info.links" :key="link.key">
                    <a class="dc-quick" :href="link.href"><span>{{ link.label }}</span><span class="dc-glyph i-more" aria-hidden="true"></span></a>
                </li>
            </ul>
        </section>
    </article>
    `,

    data: () => ({
        department: {}, variant: 'full', headingLevel: 2, showStatus: true, showDescription: true, closureDays: 60, closureLimit: 3,
        directionsHref: 'https://www.google.com/maps/search/?api=1&query={address}', timeZone: '', now: '', locale: '', labels: {},
        tick: 0
    }),

    // The status follows the clock: `tick` changes every 30 seconds, and `clock` reads it.
    $mounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (!root) return;
        root._dc = { timer: setInterval(() => { this.tick = Date.now(); }, 30000) };
    },

    $unmounted() {
        const root = DzGlobal.raw(this.$refs.root);
        if (root && root._dc) clearInterval(root._dc.timer);
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                notFound: 'Department information is not available.',
                openNow: 'Open now',
                closingSoon: 'Closes soon',
                closed: 'Closed',
                closedToday: 'Closed today',
                temporarilyClosed: 'Temporarily closed',
                open24: 'Open 24 hours',
                closesAt: 'Closes at {time}',
                opensAt: 'Opens at {time}',
                opensTomorrow: 'Opens tomorrow at {time}',
                opensDay: 'Opens {day} at {time}',
                opensDate: 'Opens {date} at {time}',
                contact: 'Contact',
                fax: 'Fax {fax}',
                office: 'Office',
                mailing: 'Mailing address',
                directions: 'Get directions',
                newTab: ' (opens in a new tab)',
                hours: 'Hours',
                weeklyHours: 'Weekly office hours',
                today: 'Today',
                closedDay: 'Closed',
                timeRange: '{open} – {close}',
                dayRange: '{first}–{last}',
                dateRange: '{start} – {end}',
                todayHours: 'Today: {hours}',
                withReason: '{hours} ({name})',
                closures: 'Upcoming closures',
                links: 'Quick links'
            }, this.labels);
        },

        compact() {
            return this.variant === 'compact';
        },

        rootClass() {
            return this.compact ? 'is-compact' : 'is-full';
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const name = n >= 1 && n <= 6 ? n : 2;
            return { name, section: Math.min(name + 1, 6), sub: Math.min(name + 2, 6) };
        },

        // The department as drawn.
        info() {
            const source = this.department && typeof this.department === 'object' ? this.department : {};
            const t = value => DzGlobal.text(value).trim();
            const name = t(source.name);
            const contact = DzGlobal.contact({ phone: source.phone, email: source.email, fax: source.fax });
            const addressLines = this.addressLines(source.address);
            const addressText = addressLines.join(', ');
            const ownMap = DzGlobal.safeHref(source.mapHref);
            const template = t(this.directionsHref);
            const builtMap = template && addressText
                ? DzGlobal.safeHref(DzGlobal.format(template, { address: encodeURIComponent(addressText) })) : '';
            const head = source.head && typeof source.head === 'object' ? source.head : {};
            const links = (Array.isArray(source.links) ? source.links : [])
                .map((link, index) => {
                    const entry = link && typeof link === 'object' ? link : {};
                    return { key: 'l' + index, label: t(entry.label), href: DzGlobal.safeHref(entry.href) };
                })
                .filter(link => link.label && link.href);
            const mailing = this.addressLines(source.mailingAddress);
            return {
                found: !!name, name, href: DzGlobal.safeHref(source.href), description: t(source.description),
                head: { name: t(head.name), title: t(head.title) },
                phone: contact.phone, phoneHref: contact.phoneHref, email: contact.email, emailHref: contact.emailHref,
                fax: contact.fax, faxText: DzGlobal.format(this.ui.fax, { fax: contact.fax }),
                addressLines: addressLines.map((text, index) => ({ key: 'a' + index, text })), addressText,
                mailingLines: mailing.map((text, index) => ({ key: 'm' + index, text })),
                mapHref: ownMap || builtMap, locationNote: t(source.locationNote), hoursNote: t(source.hoursNote),
                closedMessage: t(source.closedMessage), links
            };
        },

        hasContact() {
            const info = this.info;
            return !!(info.head.name || info.phone || info.fax || info.email || info.addressLines.length || info.mailingLines.length);
        },

        // The regular week: for each day 0 (Sunday) to 6, its open intervals in minutes, merged.
        week() {
            const source = this.department && typeof this.department === 'object' ? this.department : {};
            const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const dayOf = value => typeof value === 'number'
                ? (Number.isInteger(value) && value >= 0 && value <= 6 ? value : -1)
                : names.indexOf(DzGlobal.text(value).trim().toLowerCase().slice(0, 3));
            const days = [[], [], [], [], [], [], []];
            (Array.isArray(source.hours) ? source.hours : []).forEach(entry => {
                if (!entry || typeof entry !== 'object') return;
                const open = this.minutesOf(entry.open);
                const close = this.minutesOf(entry.close);
                if (open < 0 || close <= open) return;
                (Array.isArray(entry.days) ? entry.days : [entry.days]).map(dayOf).forEach(day => {
                    if (day >= 0) days[day].push([open, close]);
                });
            });
            return days.map(list => this.merge(list));
        },

        hasHours() {
            return this.week.some(list => list.length > 0);
        },

        // Closures, each { date, end, name, intervals } — no intervals means closed all day.
        closures() {
            const source = this.department && typeof this.department === 'object' ? this.department : {};
            const t = value => DzGlobal.text(value).trim();
            return (Array.isArray(source.closures) ? source.closures : [])
                .map((entry, index) => {
                    const item = entry && typeof entry === 'object' ? entry : {};
                    const date = DzGlobal.parseDate(t(item.date)) ? t(item.date).slice(0, 10) : '';
                    const endRaw = DzGlobal.parseDate(t(item.endDate)) ? t(item.endDate).slice(0, 10) : '';
                    const open = this.minutesOf(item.open);
                    const close = this.minutesOf(item.close);
                    return {
                        key: 'c' + index + '~' + date, date, end: endRaw > date ? endRaw : date, name: t(item.name),
                        intervals: open >= 0 && close > open ? [[open, close]] : []
                    };
                })
                .filter(entry => entry.date)
                .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        },

        // The office's date and minute of the day: `now` when previewing, else the clock in timeZone.
        clock() {
            const tick = this.tick;   // read so the status refreshes when it changes
            const preview = DzGlobal.text(this.now).trim();
            if (preview) {
                const key = preview.slice(0, 10);
                const time = DzGlobal.timeOf(preview);
                if (DzGlobal.parseDate(key) && time) return { key, minutes: this.minutesOf(time), tick };
            }
            const date = new Date();
            const zone = DzGlobal.text(this.timeZone).trim();
            if (zone) {
                try {
                    const parts = new Intl.DateTimeFormat('en-US', {
                        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
                    }).formatToParts(date);
                    const get = type => (parts.find(part => part.type === type) || {}).value || '';
                    const key = get('year') + '-' + get('month') + '-' + get('day');
                    if (DzGlobal.parseDate(key)) return { key, minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')), tick };
                } catch (error) { /* unknown time zone: the visitor's clock */ }
            }
            return { key: DzGlobal.todayKey(), minutes: date.getHours() * 60 + date.getMinutes(), tick };
        },

        // { state: 'open' | 'closing' | 'closed' | '', label, parts } — parts are shown after the label.
        status() {
            const ui = this.ui;
            const none = { state: '', label: '', parts: [] };
            const info = this.info;
            if (!info.found || !this.showStatus) return none;
            const wrap = (state, label, texts) => ({ state, label, parts: texts.map((text, index) => ({ key: 'p' + index, text })) });
            if (info.closedMessage) return wrap('closed', ui.temporarilyClosed, [info.closedMessage]);
            if (!this.hasHours) return none;

            const { key, minutes } = this.clock;
            const today = this.plan(key);
            const texts = today.closure && today.closure.name ? [today.closure.name] : [];
            const current = today.intervals.find(range => range[0] <= minutes && minutes < range[1]);
            if (current) {
                if (current[0] === 0 && current[1] === 1440) return wrap('open', ui.openNow, [...texts, ui.open24]);
                texts.push(DzGlobal.format(ui.closesAt, { time: this.timeText(current[1]) }));
                return current[1] - minutes <= 30 ? wrap('closing', ui.closingSoon, texts) : wrap('open', ui.openNow, texts);
            }
            const next = this.nextOpening(key, minutes);
            if (next) texts.push(next);
            return wrap('closed', today.closure && !today.intervals.length ? ui.closedToday : ui.closed, texts);
        },

        // The week from Monday, consecutive days with the same hours on one row.
        weekRows() {
            if (!this.hasHours) return [];
            const ui = this.ui;
            const order = [1, 2, 3, 4, 5, 6, 0];
            const today = DzGlobal.parseDate(this.clock.key).getDay();
            const rows = [];
            order.forEach(day => {
                const hours = this.hoursText(this.week[day]);
                const last = rows[rows.length - 1];
                if (last && last.hours === hours) last.days.push(day);
                else rows.push({ hours, days: [day] });
            });
            return rows.map(row => {
                const first = this.dayName(row.days[0]);
                const days = row.days.length > 1
                    ? DzGlobal.format(ui.dayRange, { first, last: this.dayName(row.days[row.days.length - 1]) }) : first;
                return { key: row.days.join('-'), days, hours: row.hours, today: row.days.includes(today) };
            });
        },

        // "Today: 8:00 AM – 4:30 PM" on a compact card, with a closure's name.
        todayHours() {
            if (!this.hasHours || this.info.closedMessage) return '';
            const today = this.plan(this.clock.key);
            const hours = this.hoursText(today.intervals);
            const text = today.closure && today.closure.name
                ? DzGlobal.format(this.ui.withReason, { hours, name: today.closure.name }) : hours;
            return DzGlobal.format(this.ui.todayHours, { hours: text });
        },

        // Closures from today through closureDays ahead, soonest first.
        closureRows() {
            const days = Math.floor(Number(this.closureDays));
            const limit = Math.floor(Number(this.closureLimit));
            if (!(days > 0) || !(limit > 0)) return [];
            const ui = this.ui;
            const today = this.clock.key;
            const last = this.addDays(today, days);
            return this.closures
                .filter(entry => entry.end >= today && entry.date <= last)
                .slice(0, limit)
                .map(entry => ({
                    key: entry.key, name: entry.name || ui.closed,
                    dates: entry.end > entry.date
                        ? DzGlobal.format(ui.dateRange, { start: this.dateText(entry.date), end: this.dateText(entry.end) })
                        : this.dateText(entry.date),
                    hours: this.hoursText(entry.intervals),
                    today: entry.date <= today && today <= entry.end
                }));
        }
    },

    methods: {
        // 'HH:mm' (or 'H:mm') as minutes of the day, 0 to 1440; -1 when it is not a time.
        minutesOf(value) {
            let text = DzGlobal.text(value).trim();
            if (text.length === 4 && text.charAt(1) === ':') text = '0' + text;
            if (text.length !== 5 || text.charAt(2) !== ':') return -1;
            const hours = Number(text.slice(0, 2));
            const minutes = Number(text.slice(3, 5));
            if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) return -1;
            if (hours > 24 || (hours === 24 && minutes > 0)) return -1;
            return hours * 60 + minutes;
        },

        // Sort intervals and join the ones that touch or overlap.
        merge(list) {
            const sorted = list.map(range => [range[0], range[1]]).sort((a, b) => a[0] - b[0]);
            const out = [];
            sorted.forEach(range => {
                const last = out[out.length - 1];
                if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
                else out.push(range);
            });
            return out;
        },

        addDays(key, count) {
            const date = DzGlobal.parseDate(key);
            date.setDate(date.getDate() + count);
            return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        },

        // A day's hours: a closure's when one covers it, else the regular week's.
        plan(key) {
            const closure = this.closures.find(entry => entry.date <= key && key <= entry.end) || null;
            return closure
                ? { intervals: closure.intervals, closure }
                : { intervals: this.week[DzGlobal.parseDate(key).getDay()], closure: null };
        },

        // "Opens at 1:00 PM", "Opens tomorrow at 8:00 AM", "Opens Monday at 8:00 AM", or with the
        // date when it is a week or more away; '' when nothing opens in the next three weeks.
        nextOpening(key, minutes) {
            const ui = this.ui;
            for (let offset = 0; offset <= 21; offset++) {
                const day = this.addDays(key, offset);
                const starts = this.plan(day).intervals.map(range => range[0]).filter(start => offset > 0 || start > minutes);
                if (!starts.length) continue;
                const time = this.timeText(Math.min(...starts));
                if (offset === 0) return DzGlobal.format(ui.opensAt, { time });
                if (offset === 1) return DzGlobal.format(ui.opensTomorrow, { time });
                if (offset < 7) return DzGlobal.format(ui.opensDay, { day: this.dayName(DzGlobal.parseDate(day).getDay()), time });
                return DzGlobal.format(ui.opensDate, { date: this.dateText(day), time });
            }
            return '';
        },

        hoursText(intervals) {
            const ui = this.ui;
            if (!intervals.length) return ui.closedDay;
            if (intervals.length === 1 && intervals[0][0] === 0 && intervals[0][1] === 1440) return ui.open24;
            return intervals
                .map(range => DzGlobal.format(ui.timeRange, { open: this.timeText(range[0]), close: this.timeText(range[1]) }))
                .join(', ');
        },

        timeText(minutes) {
            const date = new Date(2000, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60);
            return DzGlobal.dateFormatter(this.locale, { hour: 'numeric', minute: '2-digit' }).format(date);
        },

        // Day 0 (Sunday) to 6 by name. 7 January 2024 was a Sunday.
        dayName(day) {
            return DzGlobal.dateFormatter(this.locale, { weekday: 'long' }).format(new Date(2024, 0, 7 + day));
        },

        // "Thursday, November 26", with the year when it is not this year.
        dateText(key) {
            const date = DzGlobal.parseDate(key);
            const options = { weekday: 'long', month: 'long', day: 'numeric' };
            if (key.slice(0, 4) !== this.clock.key.slice(0, 4)) options.year = 'numeric';
            return DzGlobal.dateFormatter(this.locale, options).format(date);
        },

        // Address lines from { street, street2, city, state, zip }, an array, or a string with line breaks.
        addressLines(value) {
            const t = item => DzGlobal.text(item).trim();
            if (Array.isArray(value)) return value.map(t).filter(Boolean);
            if (value && typeof value === 'object') {
                const place = [t(value.city), [t(value.state), t(value.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
                return [t(value.street), t(value.street2), place].filter(Boolean);
            }
            return t(value).split(String.fromCharCode(10)).map(t).filter(Boolean);
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        /* height: 100% so that in a grid of cards (department_list) every card fills its row. */
        .dc { container-type: inline-size; box-sizing: border-box; height: 100%; padding: 1.5rem; border: 1px solid var(--dz-color-border, #e4e6ee);
              border-radius: 14px; background: var(--dz-color-surface, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
              font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); --dc-link: #4a4dd6; }
        .dc.is-compact { padding: 1.1rem 1.2rem; border-radius: 12px; }
        .dc-glyph { display: block; flex: none; width: 1.1rem; height: 1.1rem; background: currentColor;
                    -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-call     { --icon: var(--dz-icon-call); }
        .i-mail     { --icon: var(--dz-icon-mail); }
        .i-mailbox  { --icon: var(--dz-icon-mail); }
        .i-fax      { --icon: var(--dz-icon-print); }
        .i-place    { --icon: var(--dz-icon-location-on); }
        .i-person   { --icon: var(--dz-icon-groups); }
        .i-schedule { --icon: var(--dz-icon-schedule); }
        .i-more     { --icon: var(--dz-icon-chevron-right); }
        .dc-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
                 clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
        p { margin: 0; }
        .dc-empty { font-style: italic; color: var(--dz-color-muted, #6b7180); }

        /* ---- Name and status. */
        .dc-head { display: flex; flex-direction: column; gap: .45rem; }
        .dc-name { font-family: var(--dz-font-heading, inherit); font-size: 1.5rem; font-weight: 700; line-height: 1.25;
                   color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .is-compact .dc-name { font-size: 1.125rem; }
        .dc-name-link { color: inherit; text-decoration: none; }
        .dc-name-link:hover { color: var(--dc-link); text-decoration: underline; text-underline-offset: 3px; }
        .dc-desc { max-width: 48rem; font-size: .9375rem; line-height: 1.55; color: #454a57; }
        .is-compact .dc-desc { font-size: .875rem; line-height: 1.5; }

        /* Status: a colored pill with a dot, so it never rests on color alone; the words say it.
           The detail parts are separated by a dot that starts no wrapped line (clipped away). */
        .dc-status { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem 1.1rem; overflow: hidden; font-size: .875rem; }
        .dc-pill { display: inline-flex; align-items: center; gap: .4rem; margin-right: -.45rem; padding: .2rem .65rem .2rem .55rem;
                   border-radius: 999px; font-weight: 700; }
        .dc-dot { width: .55rem; height: .55rem; border-radius: 50%; background: currentColor; }
        .is-open .dc-pill { background: #e6f4ec; color: #146c3a; }
        .is-closing .dc-pill { background: #fff1db; color: #8a4600; }
        .is-closed .dc-pill { background: #fdecea; color: #b42318; }
        .dc-detail { position: relative; margin-left: -1.1rem; padding-left: 1.1rem; font-weight: 600; color: #454a57; }
        .dc-detail::before { content: "·" / ""; position: absolute; left: .4rem; color: #6b7180; }
        .dc-pill + .dc-detail { margin-left: 0; padding-left: 0; }
        .dc-pill + .dc-detail::before { content: none; }

        /* ---- Body: contact beside hours when there is room. */
        .dc-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; margin-top: 1.25rem; padding-top: 1.25rem;
                   border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        @container (min-width: 40rem) {
            .dc-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 2.5rem; }
            .dc-body.is-single { grid-template-columns: minmax(0, 1fr); }
        }
        .dc-section { min-width: 0; }
        .dc-section-title { margin: 0 0 .7rem; font-size: .75rem; font-weight: 700; letter-spacing: .06em;
                            text-transform: uppercase; color: #555b69; }
        .dc-subtitle { margin: 1.25rem 0 .55rem; font-size: .9375rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }

        .dc-lines { display: flex; flex-direction: column; gap: .45rem; margin: 0; padding: 0; list-style: none; font-size: .9375rem; }
        .is-compact .dc-lines { gap: .35rem; margin-top: .75rem; font-size: .875rem; }
        .dc-line { display: flex; align-items: flex-start; gap: .55rem; min-width: 0; overflow-wrap: anywhere; }
        .dc-line > .dc-glyph, .dc-place > .dc-glyph { width: 1.05rem; height: 1.05rem; margin-top: .15rem; color: var(--dz-color-muted, #6b7180); }
        .dc-strong { font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .dc-muted { color: #555b69; }
        .dc-link { color: var(--dc-link); text-underline-offset: 2px; overflow-wrap: anywhere; }

        .dc-place { display: flex; align-items: flex-start; gap: .55rem; margin-top: 1rem; font-size: .9375rem; }
        .dc-place-body { min-width: 0; }
        .dc-label { font-size: .75rem; font-weight: 700; color: #555b69; }
        .dc-address { margin-top: .1rem; line-height: 1.45; }
        .dc-address-line { display: block; }
        .dc-note { margin-top: .4rem; font-size: .8125rem; line-height: 1.45; color: #555b69; }
        .dc-directions { display: inline-flex; align-items: center; gap: .15rem; min-height: 2.25rem; margin-top: .35rem;
                         font-size: .875rem; font-weight: 700; color: var(--dc-link); text-underline-offset: 2px; }
        .dc-directions .dc-glyph { width: 1rem; height: 1rem; }

        /* ---- Hours. Today's row is marked in words as well as by its tint. */
        .dc-hours { width: 100%; border-collapse: collapse; font-size: .9375rem; }
        .dc-hours th, .dc-hours td { padding: .5rem .6rem; text-align: left; vertical-align: top; }
        .dc-hours th { font-weight: 600; white-space: nowrap; color: var(--dz-color-heading, #1f2330); }
        .dc-hours tr + tr > * { border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .dc-hours tr.is-today > * { background: var(--dz-color-bg, #f4f5fb); font-weight: 700; }
        .dc-hours tr.is-today > th { box-shadow: inset 3px 0 0 var(--dc-link); }
        .dc-today { display: inline-block; margin-left: .45rem; padding: .05rem .4rem; border-radius: 4px; vertical-align: .1em;
                    background: var(--dc-link); color: #fff; font-size: .6875rem; font-weight: 700; letter-spacing: .03em; }
        @container (max-width: 24rem) {
            .dc-hours th, .dc-hours td { display: block; padding: .1rem .6rem; }
            .dc-hours th { padding-top: .5rem; }
            .dc-hours td { padding-bottom: .5rem; }
            .dc-hours tr + tr > td { border-top: 0; }
        }

        .dc-closure-list { display: flex; flex-direction: column; gap: .5rem; margin: 0; padding: 0; list-style: none; }
        .dc-closure { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .1rem 1rem; padding: .6rem .75rem;
                      border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 8px; font-size: .875rem; }
        .dc-closure.is-today { border-color: var(--dc-link); }
        .dc-closure-name { font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .dc-closure-date { grid-column: 1; color: #555b69; }
        .dc-closure-hours { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-weight: 600; text-align: right; }
        @container (max-width: 24rem) {
            .dc-closure { grid-template-columns: minmax(0, 1fr); }
            .dc-closure-hours { grid-column: 1; grid-row: auto; text-align: left; }
        }

        /* ---- Quick links. */
        .dc-links-section { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .dc-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: .5rem; margin: 0; padding: 0; list-style: none; }
        .dc-quick { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-height: 2.75rem; box-sizing: border-box;
                    padding: .5rem .6rem .5rem .9rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 8px;
                    font-size: .9375rem; font-weight: 600; color: var(--dc-link); text-decoration: none; }
        .dc-quick:hover { border-color: var(--dc-link); background: var(--dz-color-bg, #f7f7fb); }
        .dc-quick .dc-glyph { width: 1.1rem; height: 1.1rem; }

        .dc-link:focus-visible, .dc-name-link:focus-visible, .dc-directions:focus-visible, .dc-quick:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
    `
});
