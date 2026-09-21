/*
 * bid-helpers.js — logic shared by the bid, RFQ and RFP components, published as window.DzBids.
 *
 * Layout only: the Deezul CMS owns the listings and their uploaded documents and hands them in
 * as props. DzBids.normalize turns one listing, as the CMS sends it, into what the components
 * draw. Anything empty is left out of the display. Dates, contacts and safe links come from
 * window.DzGlobal (global.js).
 *
 * LISTING SHAPE (every field optional except a title, in practice):
 *   {
 *     id, title,
 *     description  plain text; line breaks kept, markup shown as text
 *     type         'Bid', 'RFQ', 'RFP' — any text
 *     status       any text: 'Open', 'Closed', 'Awarded', 'Cancelled', ... (colored by keyword)
 *     posted       'YYYY-MM-DD'
 *     due          'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'
 *     closes       'YYYY-MM-DD' — never shown; once it has passed the listing counts as closed,
 *                  and the listing component leaves it out (hideClosed)
 *     location
 *     contact:     { name, phone, email }
 *     meetings:    [{ title, start ('YYYY-MM-DDTHH:mm' or a date), end ('HH:mm' or a date-time
 *                     on the same day), location }]
 *     documents:   [{ name, href, type ('PDF'; blank = from the file extension),
 *                     size (bytes, shown as KB / MB, or display text) }]
 *   }
 * Document links must be http(s), or a site or relative path; anything else is dropped.
 *
 * Kept free of regex and backslash escapes on purpose (see global.js).
 */

const DzBids = {
    text(value) {
        return DzGlobal.text(value).trim();
    },

    // A status's color group, by keyword: open, awarded, closed, cancelled, other ('' = none).
    statusKind(status) {
        const s = DzBids.text(status).toLowerCase();
        if (!s) return '';
        if (s.includes('cancel')) return 'cancelled';
        if (s.includes('award')) return 'awarded';
        if (s.includes('close') || s.includes('expire')) return 'closed';
        if (s.includes('open') || s.includes('active') || s.includes('accepting')) return 'open';
        return 'other';
    },

    // 'PDF' from an explicit type (or MIME type), else from the name's or the link's extension.
    fileType(doc) {
        return DzGlobal.fileType(doc.type, doc.name, doc.href);
    },

    // Bytes as '512 B', '180 KB' or '2.3 MB'; text passes through.
    sizeText(size) {
        return DzGlobal.fileSize(size);
    },

    // "Tue, Sep 22, 2026 at 10:00 – 11:00 AM" for a date or date-time and an optional end time.
    // formats: { date, time }; ui.dateTime: '{date} at {time}'.
    whenText(value, formats, ui, endValue) {
        const date = DzGlobal.parseDate(value);
        if (!date) return '';
        const dateText = formats.date.format(date);
        const time = DzGlobal.timeOf(value);
        if (!time) return dateText;
        const start = DzGlobal.dateTime(value);
        const endTime = DzGlobal.timeOf(endValue);
        let timeText = formats.time.format(start);
        if (endTime && endTime > time) {
            const end = DzGlobal.dateTime(value.slice(0, 10) + 'T' + endTime);
            timeText = typeof formats.time.formatRange === 'function'
                ? formats.time.formatRange(start, end) : timeText + ' – ' + formats.time.format(end);
        }
        return DzGlobal.format(ui.dateTime, { date: dateText, time: timeText });
    },

    // One listing as the components draw it.
    //   options.ui        labels: untitled, dateTime, dueToday, dueTomorrow, dueInDays ('{count}')
    //   options.formats   { date, time } Intl formatters
    //   options.href      link template with {id} (URL-encoded), or '' for none
    //   options.soonDays  due within this many days counts as due soon (while still open)
    normalize(raw, index, options) {
        const bid = raw && typeof raw === 'object' ? raw : {};
        const t = DzBids.text;
        const ui = options.ui;
        const f = options.formats;
        const today = DzGlobal.todayKey();
        const dateValue = value => (DzGlobal.parseDate(t(value)) ? t(value) : '');

        const id = t(bid.id) || String(index);
        const posted = dateValue(bid.posted).slice(0, 10);
        const due = dateValue(bid.due);
        const closes = dateValue(bid.closes).slice(0, 10);
        const daysToDue = due ? DzGlobal.daysBetween(today, due.slice(0, 10)) : null;
        const status = t(bid.status);
        const statusKind = DzBids.statusKind(status);
        const stillOpen = statusKind === 'open' || statusKind === 'other' || statusKind === '';
        const dueSoon = stillOpen && daysToDue !== null && daysToDue >= 0 && daysToDue <= options.soonDays;
        let dueSoonText = '';
        if (dueSoon) {
            dueSoonText = daysToDue === 0 ? ui.dueToday
                : daysToDue === 1 ? ui.dueTomorrow : DzGlobal.format(ui.dueInDays, { count: daysToDue });
        }

        const meetings = (Array.isArray(bid.meetings) ? bid.meetings : [])
            .filter(meeting => meeting && typeof meeting === 'object')
            .map((meeting, i) => ({
                key: 'm' + i, title: t(meeting.title), start: dateValue(meeting.start),
                when: DzBids.whenText(t(meeting.start), f, ui, t(meeting.end)), location: t(meeting.location)
            }))
            .filter(meeting => meeting.title || meeting.when || meeting.location)
            .sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));

        const documents = (Array.isArray(bid.documents) ? bid.documents : [])
            .filter(doc => doc && typeof doc === 'object')
            .map((doc, i) => {
                const href = DzGlobal.safeHref(doc.href);
                const name = t(doc.name) || (href ? href.split('?')[0].split('#')[0].split('/').pop() : '');
                const type = DzBids.fileType(doc);
                const size = DzBids.sizeText(doc.size);
                const details = [type, size].filter(Boolean);
                return {
                    key: 'd' + i, name, href, type, size, meta: details.join(' · '),
                    label: details.length ? name + ' (' + details.join(', ') + ')' : name
                };
            })
            .filter(doc => doc.href && doc.name);

        return {
            key: id, id, index,
            title: t(bid.title) || ui.untitled, description: t(bid.description), type: t(bid.type), status, statusKind,
            posted, postedText: posted ? f.date.format(DzGlobal.parseDate(posted)) : '',
            due, dueText: due ? DzBids.whenText(due, f, ui) : '', daysToDue, dueSoon, dueSoonText,
            closes, closed: !!closes && closes < today,
            location: t(bid.location), contact: DzGlobal.contact(bid.contact),
            meetings, nextMeeting: meetings.find(meeting => meeting.start && meeting.start.slice(0, 10) >= today) || null,
            documents,
            href: options.href ? String(options.href).split('{id}').join(encodeURIComponent(id)) : ''
        };
    }
};

window.DzBids = DzBids;
export default DzBids;
