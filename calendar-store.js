/*
 * calendar-store.js — shared calendar data, published as window.DzCalendarStore.
 *
 * Calendar views (the month view now; week, day and agenda views later) don't own their
 * events. Each reads a NAMED calendar from this store and writes changes back to it, so every
 * view bound to the same name shows the same events — and moving through dates in one view
 * moves the others with it.
 *
 *   const team = DzCalendarStore.use('team');          // created on first use
 *   team.setEvents([{ id: 'standup', title: 'Standup', start: '2026-09-15T09:00' }]);
 *   const stop = team.subscribe(change => { ... });   // change.type: 'events' | 'date' | 'selected'
 *
 *   <dz-component dz-type="calendar_month" :store="'team'"></dz-component>
 *
 * EVENTS: { id, title, start, end, color, location, ...anything else }
 *   start   'YYYY-MM-DD' (all day) or 'YYYY-MM-DDTHH:mm' (timed), local time. Required.
 *   end     the same forms, optional. An end DAY is inclusive: a three-day event ends on its
 *           third day. A missing or earlier end means the event is one day.
 *   end     a timed end on the start day ('YYYY-MM-DDTHH:mm') shows as a time range
 *   color   any CSS color, optional
 *   location  text, optional
 * Events without a valid start are dropped; a missing or duplicate id is replaced with a
 * generated one. Other fields are kept, so a host's own data rides along.
 *
 * SHARED VIEW STATE, per calendar:
 *   date      'YYYY-MM-DD' — the day the views are looking at (starts as today)
 *   selected  'YYYY-MM-DD' — the chosen day, or '' for none
 *
 * Everything handed out is a copy, and everything taken in is copied: change a calendar only
 * through its methods. Listeners run synchronously, after the change.
 *
 * Kept in memory. Persisting is the host's job for now: subscribe, save on 'events', and call
 * setEvents after loading.
 *
 * DATES are local 'YYYY-MM-DD' keys, which compare correctly as plain strings. Never
 * new Date('YYYY-MM-DD'): that parses as UTC and lands on the previous day west of Greenwich.
 * DzCalendarStore.dates has the date helpers; DzCalendarStore.display has what the views share
 * for drawing events (sorting per day, upcoming lists, colors, formatters, ranges).
 *
 * Kept free of regex and backslash escapes on purpose (see global.js).
 */

const pad = n => String(n).padStart(2, '0');

const dates = {
    // The key for a Date, in local time.
    key(date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    },

    today() {
        return dates.key(new Date());
    },

    // A local-midnight Date for a key (anything after the first 10 characters is ignored), or
    // null when it isn't a real calendar date.
    parse(value) {
        if (typeof value !== 'string' || value.length < 10) return null;
        const parts = value.slice(0, 10).split('-');
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) return null;
        const [year, month, day] = parts.map(Number);
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 1000) return null;
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
    },

    isKey(value) {
        return dates.parse(value) !== null;
    },

    // The key for a year, a month index (0-11, may overflow) and a day clamped to that month.
    make(year, monthIndex, day) {
        const first = new Date(year, monthIndex, 1);
        const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        first.setDate(Math.min(Math.max(1, day), length));
        return dates.key(first);
    },

    addDays(key, count) {
        const date = dates.parse(key);
        date.setDate(date.getDate() + count);
        return dates.key(date);
    },

    // Same day in another month, clamped: 31 Jan + 1 month is 28 (or 29) Feb.
    addMonths(key, count) {
        const date = dates.parse(key);
        return dates.make(date.getFullYear(), date.getMonth() + count, date.getDate());
    },

    monthStart(key) {
        return key.slice(0, 8) + '01';
    },

    monthEnd(key) {
        const date = dates.parse(key);
        return dates.make(date.getFullYear(), date.getMonth(), 31);
    },

    // 0 (Sunday) to 6 (Saturday).
    weekday(key) {
        return dates.parse(key).getDay();
    },

    clamp(key, min, max) {
        return key < min ? min : key > max ? max : key;
    },

    // The 'HH:mm' of a timed value ('YYYY-MM-DDTHH:mm'), or '' for an all-day one.
    time(value) {
        if (typeof value !== 'string' || value.length < 16 || value.charAt(10) !== 'T' || value.charAt(13) !== ':') return '';
        const hours = Number(value.slice(11, 13));
        const minutes = Number(value.slice(14, 16));
        const valid = Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
        return valid ? value.slice(11, 16) : '';
    },

    // The inclusive last day of an event.
    endDay(event) {
        const start = event.start.slice(0, 10);
        const end = dates.isKey(event.end) ? event.end.slice(0, 10) : start;
        return end < start ? start : end;
    }
};

// Plain-data copy; also strips reactive proxies a component may pass in.
const copy = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

let counter = 0;
const newId = () => 'ev-' + Date.now().toString(36) + '-' + (++counter);

// A stored event from input, or null when it has no valid start.
function clean(raw) {
    if (!raw || typeof raw !== 'object' || !dates.isKey(raw.start)) return null;
    const event = { ...raw };
    event.id = raw.id === undefined || raw.id === null || raw.id === '' ? newId() : String(raw.id);
    event.title = raw.title === undefined || raw.title === null ? '' : String(raw.title);
    if (event.end !== undefined && dates.endDay(event) === event.start.slice(0, 10) && !dates.isKey(event.end)) delete event.end;
    return event;
}

function createCalendar(name) {
    let events = [];
    let date = dates.today();
    let selected = '';
    const listeners = new Set();

    const notify = type => {
        listeners.forEach(listener => {
            try {
                listener({ type, calendar: name });
            } catch (error) {
                console.error('DzCalendarStore: a listener on "' + name + '" failed', error);
            }
        });
    };

    return {
        name,

        getEvents() {
            return copy(events);
        },

        getEvent(id) {
            const found = events.find(event => event.id === String(id));
            return found ? copy(found) : null;
        },

        // Events touching any day from `from` to `to` (keys, inclusive).
        getEventsBetween(from, to) {
            return copy(events.filter(event => event.start.slice(0, 10) <= to && dates.endDay(event) >= from));
        },

        setEvents(list) {
            const seen = new Set();
            events = [];
            (Array.isArray(list) ? copy(list) : []).forEach(raw => {
                const event = clean(raw);
                if (!event) return;
                if (seen.has(event.id)) event.id = newId();
                seen.add(event.id);
                events.push(event);
            });
            notify('events');
        },

        // Returns the stored copy (with its id), or null when the event was invalid.
        addEvent(raw) {
            const event = clean(copy(raw));
            if (!event) return null;
            if (events.some(existing => existing.id === event.id)) event.id = newId();
            events = [...events, event];
            notify('events');
            return copy(event);
        },

        // Merge changes into an event (its id can't change). Returns the result, or null.
        updateEvent(id, changes) {
            let result = null;
            events = events.map(event => {
                if (event.id !== String(id)) return event;
                const next = clean({ ...event, ...copy(changes || {}), id: event.id });
                if (!next) return event;
                result = next;
                return next;
            });
            if (result) notify('events');
            return result ? copy(result) : null;
        },

        removeEvent(id) {
            const before = events.length;
            events = events.filter(event => event.id !== String(id));
            if (events.length === before) return false;
            notify('events');
            return true;
        },

        getDate() {
            return date;
        },

        setDate(key) {
            if (!dates.isKey(key) || key.slice(0, 10) === date) return;
            date = key.slice(0, 10);
            notify('date');
        },

        getSelected() {
            return selected;
        },

        // A key, or '' to clear.
        setSelected(key) {
            const next = key === '' || key === null || key === undefined ? '' : (dates.isKey(key) ? key.slice(0, 10) : selected);
            if (next === selected) return;
            selected = next;
            notify('selected');
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}

// ---- Display helpers shared by the calendar views: turning stored events into what a view draws.
const display = {
    // Intl formatter for a locale; an invalid locale falls back to the browser's.
    formatter(locale, options) {
        try {
            return new Intl.DateTimeFormat(locale || undefined, options);
        } catch (error) {
            return new Intl.DateTimeFormat(undefined, options);
        }
    },

    // "Sep 13 – 19, 2026" style text for two keys, with a fallback where formatRange is missing.
    rangeText(formatter, from, to) {
        const a = dates.parse(from);
        const b = dates.parse(to);
        return typeof formatter.formatRange === 'function' ? formatter.formatRange(a, b) : formatter.format(a) + ' – ' + formatter.format(b);
    },

    // First and last showable day: whole years around the current one.
    range(yearsBack, yearsAhead) {
        const year = new Date().getFullYear();
        const span = (value, fallback) => {
            const n = Math.round(Number(value));
            return Number.isFinite(n) && n >= 0 ? n : fallback;
        };
        return { min: (year - span(yearsBack, 1)) + '-01-01', max: (year + span(yearsAhead, 1)) + '-12-31' };
    },

    // A weekStart option as 0 (Sunday) to 6.
    weekStartDay(value) {
        const n = Math.round(Number(value));
        return n >= 0 && n <= 6 ? n : 0;
    },

    // The first day of the week holding `key`.
    weekFrom(key, weekStartDay) {
        return dates.addDays(key, -((dates.weekday(key) - weekStartDay + 7) % 7));
    },

    // Colors go into a style attribute, so only characters a CSS color needs are let through.
    safeColor(value) {
        const allowed = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#(),.% -';
        const text = typeof value === 'string' ? value.trim() : '';
        return text && text.split('').every(ch => allowed.includes(ch)) ? text : '';
    },

    // A timed value's time through `formatter`, or '' for an all-day value.
    timeText(value, formatter) {
        const time = dates.time(value);
        if (!time) return '';
        const at = dates.parse(value);
        at.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)));
        return formatter.format(at);
    },

    // All-day and continuing entries first, then by start time, then by title.
    compare(a, b) {
        return a.rank - b.rank || a.sortTime.localeCompare(b.sortTime) || a.label.localeCompare(b.label);
    },

    // Entries for the events touching [from, to], as a Map of day key → sorted entries. A
    // multi-day event appears on each of its days. `text`: { time: formatter, allDay, untitled }.
    byDay(events, from, to, text) {
        const out = new Map();
        (Array.isArray(events) ? events : []).forEach(event => {
            if (!event || !dates.isKey(event.start)) return;
            const startDay = event.start.slice(0, 10);
            const endDay = dates.endDay(event);
            if (startDay > to || endDay < from) return;
            const time = dates.time(event.start);
            const timeText = display.timeText(event.start, text.time);
            const label = event.title ? String(event.title) : text.untitled;
            const color = display.safeColor(event.color);
            const stop = endDay > to ? to : endDay;
            for (let day = startDay < from ? from : startDay; day <= stop; day = dates.addDays(day, 1)) {
                const first = day === startDay;
                const timed = first && !!time;
                const when = timed ? timeText : text.allDay;
                if (!out.has(day)) out.set(day, []);
                out.get(day).push({
                    key: event.id + '@' + day, id: String(event.id), date: day, label, when,
                    time: timed ? timeText : '', title: (timed ? timeText + ' ' : '') + label, name: when + ', ' + label,
                    style: color ? '--ev:' + color : '', continues: !first,
                    rank: timed ? 1 : 0, sortTime: timed ? time : ''
                });
            }
        });
        out.forEach(list => list.sort(display.compare));
        return out;
    },

    // "9:00 – 10:30 AM" for a timed start and end on the same day.
    timeRangeText(start, end, formatter) {
        const at = value => {
            const date = dates.parse(value);
            const time = dates.time(value);
            date.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)));
            return date;
        };
        const a = at(start);
        const b = at(end);
        return typeof formatter.formatRange === 'function' ? formatter.formatRange(a, b) : formatter.format(a) + ' – ' + formatter.format(b);
    },

    // Card entries for a list of events, soonest first (the week view's columns).
    //   options.startsOnly  only events STARTING in [from, to]; otherwise any event touching it
    //   options.limit       at most this many (0 or missing = all)
    //   options.href        a link template with {id} (the id is URL-encoded), or '' for none
    //   options.time / date / month / weekday   Intl formatters
    //   options.allDay / untitled               label text
    // Each entry: { key, id, date, dateText, when, label, location, month, day, weekday, href,
    // name (for screen readers), style (the --ev color), rank, sortTime }.
    agenda(events, from, to, options) {
        const list = [];
        (Array.isArray(events) ? events : []).forEach(event => {
            if (!event || !dates.isKey(event.start)) return;
            const startDay = event.start.slice(0, 10);
            const endDay = dates.endDay(event);
            if (startDay > to || (options.startsOnly ? startDay < from : endDay < from)) return;
            const start = dates.parse(startDay);
            const time = dates.time(event.start);
            const endTime = dates.time(event.end);
            let when = options.allDay;
            if (time) {
                when = endTime && endDay === startDay && endTime > time
                    ? display.timeRangeText(event.start, event.end, options.time)
                    : display.timeText(event.start, options.time);
            }
            const dateText = endDay > startDay ? display.rangeText(options.date, startDay, endDay) : options.date.format(start);
            const label = event.title ? String(event.title) : options.untitled;
            const location = event.location === undefined || event.location === null ? '' : String(event.location);
            const color = display.safeColor(event.color);
            const id = String(event.id);
            list.push({
                key: id, id, date: startDay, dateText, when, label, location,
                month: options.month.format(start), day: String(start.getDate()), weekday: options.weekday.format(start),
                href: options.href ? String(options.href).split('{id}').join(encodeURIComponent(id)) : '',
                name: [label, dateText, when, location].filter(Boolean).join(', '),
                style: color ? '--ev:' + color : '', rank: time ? 1 : 0, sortTime: time
            });
        });
        list.sort((a, b) => a.date.localeCompare(b.date) || display.compare(a, b));
        const limit = Math.round(Number(options.limit));
        return limit > 0 ? list.slice(0, limit) : list;
    }
};

const calendars = new Map();

const DzCalendarStore = {
    dates,
    display,

    // The calendar with this name, created on first use.
    use(name) {
        const key = name === undefined || name === null || name === '' ? 'default' : String(name);
        if (!calendars.has(key)) calendars.set(key, createCalendar(key));
        return calendars.get(key);
    },

    names() {
        return [...calendars.keys()];
    }
};

window.DzCalendarStore = DzCalendarStore;
export default DzCalendarStore;
