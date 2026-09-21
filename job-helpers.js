/*
 * job-helpers.js — logic shared by the job components, published as window.DzJobs.
 *
 * The components here are layout only: the Deezul CMS owns the job data and hands it in as
 * props. DzJobs.normalize turns one job, as the CMS sends it, into what the components draw.
 * Dates, contacts and formatters come from window.DzGlobal (global.js).
 *
 * JOB SHAPE (every field optional except a title, in practice):
 *   {
 *     id, title, division, jobType ('Full Time'), payType ('Hourly'),
 *     pay       display text: '$22.00 – $26.50 an hour'
 *     posted    'YYYY-MM-DD'
 *     closes    'YYYY-MM-DD', or blank for "open until filled"
 *     location, summary (a short description for cards and the details page),
 *     contact:  { name, email, phone, fax },
 *     sections: [{ title, text, items: ['bullet', ...],
 *                  subsections: [{ title, text, items }] }]
 *   }
 * Text is plain: line breaks are kept, markup is shown as text.
 *
 * STATUS: no closing date → 'open' ("Open until filled"); closing within `soonDays` →
 * 'closing'; later → 'open' ("Closes Oct 1, 2026"); past → 'closed'.
 *
 * Kept free of regex and backslash escapes on purpose (see global.js).
 */

const DzJobs = {
    text(value) {
        return DzGlobal.text(value).trim();
    },

    // Bullet items as { key, text }, blanks dropped.
    items(list, prefix) {
        return (Array.isArray(list) ? list : [])
            .map(item => DzJobs.text(item))
            .filter(Boolean)
            .map((text, i) => ({ key: prefix + '-' + i, text }));
    },

    sections(list) {
        const part = (raw, key) => ({
            key, title: DzJobs.text(raw.title), text: DzJobs.text(raw.text), items: DzJobs.items(raw.items, key)
        });
        return (Array.isArray(list) ? list : [])
            .filter(section => section && typeof section === 'object')
            .map((section, i) => ({
                ...part(section, 's' + i),
                subsections: (Array.isArray(section.subsections) ? section.subsections : [])
                    .filter(sub => sub && typeof sub === 'object')
                    .map((sub, j) => part(sub, 's' + i + '-' + j))
            }));
    },

    // One job as the components draw it.
    //   options.ui        { openUntilFilled, closesOn ('Closes {date}'), closed, untitled }
    //   options.date      Intl formatter for dates
    //   options.href      link template with {id} (URL-encoded), or '' for none
    //   options.soonDays  closing within this many days counts as closing soon
    normalize(raw, index, options) {
        const job = raw && typeof raw === 'object' ? raw : {};
        const t = DzJobs.text;
        const ui = options.ui;
        const today = DzGlobal.todayKey();
        const id = t(job.id) || String(index);
        const posted = DzGlobal.parseDate(t(job.posted)) ? t(job.posted).slice(0, 10) : '';
        const closes = DzGlobal.parseDate(t(job.closes)) ? t(job.closes).slice(0, 10) : '';

        let statusKind = 'open';
        let statusText = ui.openUntilFilled;
        if (closes) {
            const left = DzGlobal.daysBetween(today, closes);
            if (left < 0) {
                statusKind = 'closed';
                statusText = ui.closed;
            } else {
                statusKind = left <= options.soonDays ? 'closing' : 'open';
                statusText = DzGlobal.format(ui.closesOn, { date: options.date.format(DzGlobal.parseDate(closes)) });
            }
        }
        const contact = DzGlobal.contact(job.contact);

        return {
            key: id, id, index,
            title: t(job.title) || ui.untitled,
            division: t(job.division), jobType: t(job.jobType), payType: t(job.payType), pay: t(job.pay),
            location: t(job.location), summary: t(job.summary),
            posted, postedText: posted ? options.date.format(DzGlobal.parseDate(posted)) : '',
            closes, statusKind, statusText,
            href: options.href ? String(options.href).split('{id}').join(encodeURIComponent(id)) : '',
            contact, hasContact: contact.any,
            sections: DzJobs.sections(job.sections)
        };
    }
};

window.DzJobs = DzJobs;
export default DzJobs;
