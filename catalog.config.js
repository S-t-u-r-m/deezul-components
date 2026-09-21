/*
 * catalog.config.js — the gallery's index of this library.
 *
 * Adding a component is three edits: the file in src/component/, a line in
 * modules.config.js (which gives it its dz-type), and an entry here (which gives it a
 * page in the gallery). `demos` are the states worth looking at side by side — the
 * variants, the empty case, the overflowing case — each one a plain props object,
 * exactly what a host app would pass.
 *
 * `actions` (optional) makes a component's demos respond to their events the way a host app
 * would — see demo-actions.js. Every demo that emits events gets an event log either way.
 * `events` (optional) lists extra event names to log that have no handler.
 */
import { editableActions, toastActions } from './demo-actions.js';
import { demoJobs } from './demo-jobs.js';
import { demoBids } from './demo-bids.js';
import { demoDocuments, demoMinutes } from './demo-documents.js';
import { demoNews } from './demo-news.js';
import { demoStaff } from './demo-staff.js';
import { demoDepartments, demoDepartmentList } from './demo-departments.js';
import { demoServices } from './demo-services.js';

// Calendar demo events sit relative to today, so the month on screen always has some.
const pad = n => String(n).padStart(2, '0');
const day = (offset, time) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + (time ? 'T' + time : '');
};
const NL = String.fromCharCode(10);
// One set of events for the calendar demos, so every calendar view shows the same data. main.js
// also loads it into the 'demo' calendar at boot, so an /events/:id link works when opened directly.
export const demoEvents = [
    { id: 'standup', title: 'Standup', start: day(0, '09:00'), end: day(0, '09:15'), location: 'Room 2B',
      organizer: 'Priya Shah', description: 'Fifteen minutes: what you did, what is next, and anything in your way.' },
    { id: 'lunch', title: 'Team lunch', start: day(0, '12:00'), end: day(0, '13:00'), color: '#1f9d74', location: 'Rosie’s Diner' },
    { id: 'review', title: 'Design review', start: day(0, '14:00'), end: day(0, '15:30'), location: 'Zoom' },
    { id: 'notes', title: 'Release notes due', start: day(0), color: '#d98b1a' },
    { id: 'interview', title: 'Interview', start: day(-1, '16:00'), color: '#8a5cd6', location: 'Room 4A' },
    { id: 'budget', title: 'Budget sync', start: day(1, '11:00'), location: 'Finance office' },
    { id: 'planning', title: 'Sprint planning', start: day(-3, '10:00'), location: 'Room 2B' },
    { id: 'dentist', title: 'Dentist', start: day(2, '10:30'), color: '#e0556a', location: '120 Main St' },
    { id: 'conference', title: 'Conference', start: day(5), end: day(7), color: '#1f9d74', location: 'Convention Center, Hall C',
      organizer: 'Events team',
      description: ['Three days of talks and workshops on civic technology.', '',
                    'Badges are at the north entrance from 8am each day. Lunch is provided.'].join(NL) },
    { id: 'training', title: 'Safety training', start: day(9, '13:00'), end: day(9, '16:00'), location: 'Warehouse 3' },
    { id: 'offsite', title: 'Leadership offsite', start: day(-10), end: day(-9), color: '#8a5cd6', location: 'Lakeside Lodge' },
    { id: 'report', title: 'Quarterly report due', start: day(12), color: '#d98b1a' },
    { id: 'party', title: 'Launch party', start: day(16, '17:30'), color: '#1f9d74', location: 'Rooftop terrace' },
    { id: 'holiday', title: 'Company holiday', start: day(35), color: '#e0556a' }
];

export default [
    {
        ref: 'dz-button',
        name: 'Button',
        group: 'Controls',
        summary: 'The library\u2019s worked example: an action button with variants, sizes and a disabled state.',
        demos: [
            { label: 'Variants', props: { label: 'Primary', variant: 'primary' } },
            { label: 'Secondary', props: { label: 'Secondary', variant: 'secondary' } },
            { label: 'Ghost', props: { label: 'Ghost', variant: 'ghost' } },
            { label: 'Danger', props: { label: 'Delete', variant: 'danger' } },
            { label: 'Small', props: { label: 'Small', variant: 'primary', size: 'sm' } },
            { label: 'Large, full width', props: { label: 'Large', variant: 'primary', size: 'lg', block: true } },
            { label: 'Disabled', props: { label: 'Disabled', variant: 'primary', disabled: true } },
            { label: 'As a link', props: { label: 'Open docs', variant: 'secondary', href: 'https://github.com/S-t-u-r-m/deezul' } }
        ]
    },
    {
        ref: 'accordion',
        name: 'Accordion',
        group: 'Lists',
        summary: 'A read-only, multi-level text accordion for static content. Sections expand in place, indented under their parent, and open independently.',
        demos: [
            { label: 'FAQ: text bodies and a nested section', props: {
                title: 'Frequently asked questions',
                items: [
                    { id: 'hours', label: 'What are your opening hours?',
                      content: 'Monday to Friday, 8am to 6pm.\nSaturday, 9am to 1pm. Closed Sundays and public holidays.' },
                    { id: 'parking', label: 'Is there parking?',
                      content: 'Yes. Free two-hour parking is available behind the building.' },
                    { id: 'permits', label: 'Permits',
                      content: 'Most projects need a permit before work starts.',
                      children: [
                          { id: 'building', label: 'Building permit', content: 'Required for new structures, additions and major repairs.' },
                          { id: 'sign', label: 'Sign permit', content: 'Required for any exterior sign larger than 2 square feet.' }
                      ] },
                    { id: 'contact', label: 'Call 555-0100 for anything else.' }
                ] } },
            { label: 'Outline, four levels, starting fully open (openAll)', props: {
                title: 'Employee handbook', openAll: true,
                items: [
                    { id: 'intro', label: '1. Introduction', children: [
                        { id: 'welcome', label: '1.1 Welcome' },
                        { id: 'values', label: '1.2 Our values', children: [
                            { id: 'integrity', label: '1.2.1 Integrity', children: [
                                { id: 'honesty', label: '1.2.1.1 Honesty in reporting' }
                            ] }
                        ] }
                    ] },
                    { id: 'leave', label: '2. Leave', children: [
                        { id: 'vacation', label: '2.1 Vacation' },
                        { id: 'sick', label: '2.2 Sick leave' }
                    ] }
                ] } },
            { label: 'Own field names (name / text / sub) with expand and collapse all', props: {
                title: 'Policies', showExpandAll: true, labelKey: 'name', contentKey: 'text', childrenKey: 'sub',
                items: [
                    { name: 'Privacy', text: 'We collect only what we need to provide the service.', sub: [
                        { name: 'Cookies', text: 'Essential cookies only; no tracking.' }
                    ] },
                    { name: 'Returns', text: 'Unused items can be returned within 30 days.' }
                ] } }
        ]
    },
    {
        ref: 'accordion_list',
        name: 'Accordion list',
        group: 'Lists',
        actions: editableActions,
        summary: 'A drill-down tree that shows one level at a time under a clickable path, with add, edit, move and delete in a dark title bar. Sorts by an order field, or A–Z without one.',
        demos: [
            { label: 'Default fields (id / label / children), top level ordered', props: {
                title: 'City services', showAdd: true, showEdit: true, showMove: true, showDelete: true,
                showMenu: true, menu: [
                    { event: 'duplicate', label: 'Duplicate', needsSelection: true },
                    { event: 'export', label: 'Export tree' }
                ],
                items: [
                    { id: 'residents', label: 'Residents', order: 1, children: [
                        { id: 'trash', label: 'Trash & recycling', children: [
                            { id: 'pickup', label: 'Pickup schedule' },
                            { id: 'bulk', label: 'Bulk item collection' },
                            { id: 'compost', label: 'Yard waste & compost' }
                        ] },
                        { id: 'taxes', label: 'Property taxes', children: [
                            { id: 'pay', label: 'Pay online' },
                            { id: 'appeal', label: 'Appeal an assessment' }
                        ] },
                        { id: 'vote', label: 'Voter registration' }
                    ] },
                    { id: 'business', label: 'Business', order: 2, children: [
                        { id: 'permits', label: 'Permits', children: [
                            { id: 'building', label: 'Building permit' },
                            { id: 'sign', label: 'Sign permit' }
                        ] },
                        { id: 'licenses', label: 'Licenses', children: [
                            { id: 'food', label: 'Food service' },
                            { id: 'liquor', label: 'Liquor' }
                        ] }
                    ] },
                    { id: 'parks', label: 'Parks & recreation', order: 3, children: [
                        { id: 'shelters', label: 'Reserve a shelter' },
                        { id: 'programs', label: 'Programs & classes' }
                    ] },
                    { id: 'contact', label: 'Contact us', order: 4 }
                ] } },
            { label: 'Own field names (code / name / subs), A–Z', props: {
                title: 'Catalog', showAdd: true, showEdit: true, showMove: true, showDelete: true,
                labelKey: 'name', childrenKey: 'subs', idKey: 'code',
                items: [
                    { code: 'EL', name: 'Electronics', subs: [
                        { code: 'EL-AUD', name: 'Audio', subs: [
                            { code: 'EL-AUD-01', name: 'Headphones' },
                            { code: 'EL-AUD-02', name: 'Speakers' }
                        ] },
                        { code: 'EL-CMP', name: 'Computers', subs: [
                            { code: 'EL-CMP-01', name: 'Laptops' },
                            { code: 'EL-CMP-02', name: 'Monitors' },
                            { code: 'EL-CMP-03', name: 'Keyboards' }
                        ] }
                    ] },
                    { code: 'HM', name: 'Home & garden', subs: [
                        { code: 'HM-KIT', name: 'Kitchen' },
                        { code: 'HM-OUT', name: 'Outdoor', subs: [
                            { code: 'HM-OUT-01', name: 'Grills' },
                            { code: 'HM-OUT-02', name: 'Patio furniture' }
                        ] }
                    ] },
                    { code: 'GC', name: 'Gift cards' }
                ] } },
            { label: 'Five levels deep, read-only', props: {
                title: 'Organization',
                items: [
                    { id: 'ceo', label: 'Executive office', children: [
                        { id: 'ops', label: 'Operations', children: [
                            { id: 'it', label: 'Information technology', children: [
                                { id: 'infra', label: 'Infrastructure', children: [
                                    { id: 'net', label: 'Network team' },
                                    { id: 'help', label: 'Help desk' }
                                ] },
                                { id: 'apps', label: 'Applications' }
                            ] },
                            { id: 'facilities', label: 'Facilities' }
                        ] },
                        { id: 'finance', label: 'Finance', children: [
                            { id: 'payroll', label: 'Payroll' },
                            { id: 'budget', label: 'Budget office' }
                        ] }
                    ] },
                    { id: 'board', label: 'Board of directors' }
                ] } }
        ]
    },
    {
        ref: 'dynamic_list',
        name: 'Dynamic list',
        group: 'Lists',
        actions: editableActions,
        summary: 'A single selectable list with add, edit, move and delete in a dark title bar. Sorts by an order field, or A–Z without one.',
        demos: [
            { label: 'Default fields, A–Z (no order field)', props: {
                title: 'Tags', showAdd: true, showEdit: true, showMove: true, showDelete: true,
                showMenu: true, menu: [
                    { event: 'duplicate', label: 'Duplicate', needsSelection: true },
                    { event: 'export', label: 'Export list' }
                ],
                items: [
                    { id: 'urgent', label: 'Urgent' },
                    { id: 'billing', label: 'Billing' },
                    { id: 'feature', label: 'Feature request' },
                    { id: 'bug', label: 'Bug' },
                    { id: 'docs', label: 'Documentation' }
                ] } },
            { label: 'Own field names, ordered by rank', props: {
                title: 'Priorities', showAdd: true, showEdit: true, showMove: true, showDelete: true,
                labelKey: 'name', idKey: 'code', orderKey: 'rank',
                items: [
                    { code: 'P3', name: 'Medium', rank: 3 },
                    { code: 'P1', name: 'Critical', rank: 1 },
                    { code: 'P4', name: 'Low', rank: 4 },
                    { code: 'P2', name: 'High', rank: 2 }
                ] } },
            { label: 'Read-only (no actions)', props: {
                title: 'Recent',
                items: [
                    { id: 'a', label: 'Quarterly report' },
                    { id: 'b', label: 'Budget draft' },
                    { id: 'c', label: 'Meeting notes' }
                ] } },
            { label: 'Empty', props: {
                title: 'Favorites', showAdd: true, items: [], emptyText: 'No favorites yet. Use + to add one.' } }
        ]
    },
    {
        ref: 'calendar_month',
        name: 'Calendar: month',
        group: 'Calendar',
        events: ['select-date', 'event-click', 'month-change'],
        summary: 'A full month grid over a shared calendar store. Views bound to the same calendar share its events, the day on screen and the selection, so they move together.',
        demos: [
            { label: 'Events from props (calendar "demo")', props: {
                title: 'Team calendar', store: 'demo', events: demoEvents } },
            { label: 'The same calendar: Monday first, French (moves with the one above)', props: {
                store: 'demo', weekStart: 1, locale: 'fr-FR', maxPerDay: 2,
                labels: { previousMonth: 'Mois précédent', nextMonth: 'Mois suivant', today: 'Aujourd’hui', month: 'Mois',
                          year: 'Année', navigation: 'Changer de mois', todayMark: 'aujourd’hui', oneEvent: '1 événement',
                          manyEvents: '{count} événements', more: '+{count} de plus', allDay: 'Toute la journée',
                          dayEvents: 'Événements du {date}', noEvents: 'Aucun événement', selectedDay: '{date} sélectionné, {events}' } } },
            { label: 'Its own calendar, three years each way, no day list', props: {
                store: 'wide', yearsBack: 3, yearsAhead: 3, showDayList: false,
                events: [
                    { id: 'launch', title: 'Launch', start: day(1, '08:00'), color: '#5b5ef0' },
                    { id: 'retro', title: 'Retrospective', start: day(8, '15:30') }
                ] } }
        ]
    },
    {
        ref: 'calendar_week',
        name: 'Calendar: week',
        group: 'Calendar',
        events: ['event-click'],
        summary: 'Two columns of event cards: this week, and what is coming up after it. Each card shows the date, time, title and location, and opens the event. Shares the calendar store with the month view.',
        demos: [
            { label: 'This week and upcoming (calendar "demo"; cards report event-click)', props: {
                title: 'Team calendar', store: 'demo', events: demoEvents } },
            { label: 'Cards as links to the event details page (detailsHref "/events/{id}"), Monday first, at most 3 upcoming', props: {
                store: 'demo', weekStart: 1, upcomingLimit: 3, detailsHref: '/events/{id}' } },
            { label: 'An empty calendar', props: {
                title: 'On call', store: 'empty' } }
        ]
    },
    {
        ref: 'event_details',
        name: 'Event details',
        group: 'Calendar',
        summary: 'One event of a shared calendar as a page: title, date and time, location, organizer and description. The week view’s card links open it at /events/:id.',
        demos: [
            { label: 'With a description and organizer (multi-day)', props: {
                store: 'demo', eventId: 'conference', backHref: '/c/calendar_week', headingLevel: 2 } },
            { label: 'A short timed event', props: {
                store: 'demo', eventId: 'standup', headingLevel: 2 } },
            { label: 'A past event, marked as ended (location only)', props: {
                store: 'demo', eventId: 'offsite', headingLevel: 2 } },
            { label: 'An id that is not in the calendar', props: {
                store: 'demo', eventId: 'missing', backHref: '/c/calendar_week', headingLevel: 2 } }
        ]
    },
    {
        ref: 'job_listings',
        name: 'Job listings',
        group: 'Jobs',
        events: ['job-click', 'page-change'],
        summary: 'Job openings as cards with search, division and job type filters, sorting, numbered pages and a live result count. Each card shows division, pay, location, posting date and status, and opens the job.',
        demos: [
            { label: 'Open positions with search and filters (cards link to /jobs/{id})', props: {
                title: 'Job openings', items: demoJobs, detailsHref: '/jobs/{id}' } },
            { label: 'Sorted by closing date, closed jobs included, no filters (cards report job-click)', props: {
                items: demoJobs, sort: 'closing', hideClosed: false, showFilters: false } },
            { label: 'Three per page (pageSize 3): Previous, Next and numbered pages', props: {
                title: 'All job openings', items: demoJobs, detailsHref: '/jobs/{id}', pageSize: 3 } },
            { label: 'No openings', props: {
                title: 'Internships', items: [] } }
        ]
    },
    {
        ref: 'job_details',
        name: 'Job details',
        group: 'Jobs',
        summary: 'One job opening as a page: key facts in the header, the description sections beside "At a glance" and "Contact" boxes, with back, print and an optional apply button.',
        demos: [
            { label: 'A full posting with sections, subsections and an apply link', props: {
                job: demoJobs[0], backHref: '/c/job_listings', applyHref: '/apply/{id}', headingLevel: 2 } },
            { label: 'A short posting, closing soon', props: {
                job: demoJobs[2], headingLevel: 2 } },
            { label: 'No job', props: {
                job: {}, backHref: '/c/job_listings', headingLevel: 2 } }
        ]
    },
    {
        ref: 'bid_listings',
        name: 'Bid listings',
        group: 'Bids',
        events: ['bid-click', 'page-change'],
        summary: 'Bids, RFQs and RFPs as cards with search, type and status filters, sorting, numbered pages and a live result count. Each card shows the due date, posted date, document count and next meeting; empty fields are left out.',
        demos: [
            { label: 'Open listings with search and filters, due soonest first (cards link to /bids/{id})', props: {
                title: 'Bids and proposals', items: demoBids, detailsHref: '/bids/{id}' } },
            { label: 'Newest first, closed listings included, no filters (cards report bid-click)', props: {
                items: demoBids, sort: 'newest', hideClosed: false, showFilters: false } },
            { label: 'Two per page (pageSize 2): Previous, Next and numbered pages', props: {
                title: 'All bids and proposals', items: demoBids, detailsHref: '/bids/{id}', pageSize: 2 } },
            { label: 'Nothing posted', props: {
                title: 'Current solicitations', items: [] } }
        ]
    },
    {
        ref: 'bid_details',
        name: 'Bid details',
        group: 'Bids',
        summary: 'One bid, RFQ or RFP as a page: type, status and due date, the description, meetings and document links, with "At a glance" and "Contact" boxes. Empty fields and sections are left out; the closing date is never shown.',
        demos: [
            { label: 'Everything filled in: meetings, documents and contact', props: {
                bid: demoBids[0], backHref: '/c/bid_listings', headingLevel: 2 } },
            { label: 'Due soon, with an online meeting and an email-only contact', props: {
                bid: demoBids[1], headingLevel: 2 } },
            { label: 'Only a title, type and dates: everything empty is left out', props: {
                bid: demoBids[3], headingLevel: 2 } },
            { label: 'No listing', props: {
                bid: {}, backHref: '/c/bid_listings', headingLevel: 2 } }
        ]
    },
    {
        ref: 'document_list',
        name: 'Document list',
        group: 'Documents',
        events: ['document-click', 'page-change'],
        summary: 'A searchable, paged list of documents. Each row has a file icon showing the type, the display name linking to the file (from the CMS by id), and its size, date and category. Search, category filter, year filter and sort are optional; the year filter appears on its own when the dates cover more than one year, and dateLabel changes how the date reads. Focus moves to the list when the page changes.',
        demos: [
            { label: 'Search, category and sort, 10 per page (links to /api/documents/{id}, opening in a new tab)', props: {
                title: 'Documents and forms', items: demoDocuments, documentHref: '/api/documents/{id}', newTab: true } },
            { label: 'Recently updated first, 3 per page, no filters: page numbers with gaps', props: {
                items: demoDocuments, documentHref: '/api/documents/{id}', newTab: true, showFilters: false, sort: 'newest', pageSize: 3 } },
            { label: 'Forms in the order given, all on one page', props: {
                title: 'Forms', items: demoDocuments.filter(doc => doc.category === 'Forms'), documentHref: '/api/documents/{id}',
                newTab: true, sort: 'order', pageSize: 0 } },
            { label: 'An archive: the year filter, newest first, and the date read as "Meeting …"', props: {
                title: 'Agendas and minutes', items: demoMinutes, documentHref: '/api/documents/{id}',
                sort: 'newest', pageSize: 8, dateLabel: 'Meeting {date}',
                labels: { newest: 'Most recent meeting', searchPlaceholder: 'Board, month or year' } } },
            { label: 'Nothing posted', props: {
                title: 'Meeting packets', items: [] } }
        ]
    },
    {
        ref: 'staff_directory',
        name: 'Staff directory',
        group: 'Directory',
        events: ['page-change'],
        summary: 'People and how to reach them, broken out by department and division (sub-department), as contact cards, profiles with biographies, or tables: search, department and division filters, and pages. Phone numbers (with extensions) and emails are links; photos or initials. Set a department to show one department on its own page.',
        demos: [
            { label: 'Cards broken out by department and division, with search and filters, 12 per page', props: {
                title: 'Staff directory', items: demoStaff, pageSize: 12, headingLevel: 3 } },
            { label: 'Tables by department only (divisions shown on each row), everyone on one page', props: {
                title: 'County staff', items: demoStaff, layout: 'table', groupBy: 'department', pageSize: 0, headingLevel: 3 } },
            { label: 'A department page: Health Department broken out by division, table, no photos', props: {
                title: 'Health Department staff', items: demoStaff, department: 'Health Department', layout: 'table',
                showPhotos: false, headingLevel: 3 } },
            { label: 'Profiles with biographies: the Board of Commissioners page', props: {
                title: 'Board of Commissioners', items: demoStaff, department: 'Board of Commissioners', layout: 'profiles',
                showFilters: false, headingLevel: 3 } },
            { label: 'One A–Z list, not grouped (groupBy none), 12 per page', props: {
                title: 'Everyone', items: demoStaff, groupBy: 'none', pageSize: 12, headingLevel: 3 } },
            { label: 'Nobody listed', props: {
                title: 'Board members', items: [] } }
        ]
    },
    {
        ref: 'department_card',
        name: 'Department card',
        group: 'Directory',
        summary: 'How to reach a department and when it is open: contact details, office and mailing addresses with directions, the week’s hours, an Open now / Closed status in the office’s time zone, upcoming holiday closures, and quick links. A compact variant fits a list of departments or a sidebar. The demos with a fixed time use the now option to preview a moment.',
        demos: [
            { label: 'Full card, live status (America/New_York)', props: {
                department: demoDepartments.health, timeZone: 'America/New_York', headingLevel: 2 } },
            { label: 'Closed for a holiday: previewed on Thanksgiving morning 2026', props: {
                department: demoDepartments.health, now: '2026-11-26T10:00', headingLevel: 2 } },
            { label: 'Compact, closing soon on a short day: Christmas Eve 2026 at 11:40 AM', props: {
                department: demoDepartments.health, variant: 'compact', now: '2026-12-24T11:40', headingLevel: 3 } },
            { label: 'Compact, closed for lunch: a Tuesday at 12:15 PM', props: {
                department: demoDepartments.recorder, variant: 'compact', now: '2026-11-17T12:15', headingLevel: 3 } },
            { label: 'Compact, open 24 hours', props: {
                department: demoDepartments.sheriff, variant: 'compact', now: '2026-11-17T03:00', headingLevel: 3 } },
            { label: 'Temporarily closed, with a message', props: {
                department: demoDepartments.shelter, now: '2026-11-17T12:00', headingLevel: 2 } },
            { label: 'Only a name and phone number: no hours, no status', props: {
                department: demoDepartments.soil, headingLevel: 2 } },
            { label: 'No department', props: { department: {} } }
        ]
    },
    {
        ref: 'department_list',
        name: 'Department list',
        group: 'Directory',
        summary: 'Every department on one page, in sections by service area (or by letter), each one a compact department card: the name, whether it is open now, today’s hours, the phone number and the address. Search covers names, what a department does and extra keywords ("dog licence" finds the Animal Shelter), and the count under the box is announced. Areas read alphabetically unless `groups` sets their order. The demos with a fixed time use the now option to preview a moment.',
        demos: [
            { label: 'By service area, live status (America/New_York)', props: {
                items: demoDepartmentList, title: 'County departments', timeZone: 'America/New_York' } },
            { label: 'The areas in a set order (groups); Parks is not listed, so it follows the rest. A Tuesday at 10:00 AM', props: {
                items: demoDepartmentList, title: 'Departments by service area', now: '2026-11-17T10:00',
                groups: ['Public safety', 'Health and family', 'Records and elections', 'Land and property', 'Roads and utilities', 'Finance'] } },
            { label: 'A–Z instead (groupBy letter), with the area filter, previewed at 10:00 AM', props: {
                items: demoDepartmentList, title: 'Departments A–Z', groupBy: 'letter', now: '2026-11-17T10:00' } },
            { label: 'One column, no sections, after hours (7:30 PM)', props: {
                items: demoDepartmentList, layout: 'rows', groupBy: 'none', now: '2026-11-17T19:30' } },
            { label: 'A short list in a hand-made order, no search or status', props: {
                title: 'Most asked for', sort: 'order', groupBy: 'none', showSearch: false, showStatus: false,
                items: [
                    { ...demoDepartments.sheriff, order: 1 },
                    { ...demoDepartments.health, order: 2 },
                    { ...demoDepartments.recorder, order: 3 },
                    { ...demoDepartments.shelter, order: 4 }
                ] } },
            { label: 'Nothing yet', props: { title: 'Departments' } }
        ]
    },
    {
        ref: 'service_list',
        name: 'Service list',
        group: 'Directory',
        events: ['service-click'],
        summary: 'The "what do you want to do?" page: every service a resident can start, in sections by topic or by letter, with a "Most requested" shelf on top. Each row links to the service and says how it can be done (Online, Form, Pay, In person, Phone) and which department runs it. Search covers names, descriptions, topics, departments and extra keywords ("foia" finds public records), and the count is announced.',
        demos: [
            { label: 'By topic, in a set order, with "Most requested"', props: {
                items: demoServices, title: 'Services', departmentHref: '/departments?name={department}',
                groups: ['Taxes and payments', 'Permits and licences', 'Records and certificates', 'Roads and property'] } },
            { label: 'A–Z instead (groupBy letter), with the topic filter and no shelf', props: {
                items: demoServices, title: 'Services A–Z', groupBy: 'letter', showPopular: false } },
            { label: 'One topic, no sections, no chips: for a department page', props: {
                items: demoServices.filter(service => service.category === 'Permits and licences'),
                title: 'Permits and licences', groupBy: 'none', showPopular: false, showSearch: false, showTags: false } },
            { label: 'Nothing yet', props: { title: 'Services' } }
        ]
    },
    {
        ref: 'rich_text_editor',
        name: 'Rich text editor',
        group: 'Text',
        events: ['change'],
        summary: 'The Deezul CMS rich text editor: bold, italic, links, colors, headings, lists, fonts and sizes, alignment, indents and tables with resizable columns, with undo and redo. Emits change with the HTML, which rich_text shows.',
        demos: [
            { label: 'Empty, with a placeholder', props: { placeholder: 'Write the article…' } },
            { label: 'Editing saved content (the news demo article)', props: { html: demoNews[0].body } }
        ]
    },
    {
        ref: 'rich_text',
        name: 'Rich text',
        group: 'Text',
        summary: 'Shows HTML written with the rich text editor, read-only, with the same formatting classes. The HTML is rebuilt from an allowlist, so scripts, event handlers, unsafe links and styles never reach the page. Headings can be shifted to fit the page, and wide tables scroll.',
        demos: [
            { label: 'An article body: headings shifted to start at level 2, a list, a table, a highlight and a link', props: {
                html: demoNews[0].body, minHeadingLevel: 2 } },
            { label: 'Unsafe HTML is dropped: a script, an image onerror, a javascript: link, an iframe and a url() style', props: {
                html: '<p>Before.</p><script>alert(1)</script><img src="x" onerror="alert(2)" alt="Broken on purpose">'
                    + '<p><a href="javascript:alert(3)" onclick="alert(4)">A link with no safe address</a> and '
                    + '<a href="https://example.gov/" target="_blank">a safe one</a>.</p>'
                    + '<iframe src="https://example.com"></iframe><p style="background:url(https://example.com/x.png);color:#c0455b" class="dz-align-center evil">Centered red text.</p>'
                    + '<section><p>Text from an unknown wrapper is kept.</p></section><p>After.</p>' } },
            { label: 'Large text', props: {
                html: '<p>Council meetings are open to the public. <b>Public comment</b> is heard at the start of every meeting.</p>', size: 'large' } }
        ]
    },
    {
        ref: 'news_list',
        name: 'News list',
        group: 'News',
        events: ['news-click', 'page-change'],
        summary: 'News, press releases, announcements, and public and legal notices, newest first: a grid of cards (optionally with the newest featured), a list with thumbnails, or compact headlines. Search, category and department filters and pages, or just the newest few with a "View all news" link.',
        demos: [
            { label: 'Grid with the newest featured, search and filters, 7 per page (cards link to /news/{id})', props: {
                title: 'News and press releases', items: demoNews, detailsHref: '/news/{id}', featureFirst: true, pageSize: 7, headingLevel: 2 } },
            { label: 'List with thumbnails, no filters, 4 per page', props: {
                items: demoNews, detailsHref: '/news/{id}', layout: 'list', showFilters: false, pageSize: 4, headingLevel: 2 } },
            { label: 'Compact headlines: the newest 5 with a "View all news" link (headlines report news-click)', props: {
                title: 'Latest news', items: demoNews, layout: 'compact', limit: 5, moreHref: '/c/news_list', headingLevel: 3 } },
            { label: 'Public and legal notices only (the categories option), as a list', props: {
                title: 'Public and legal notices', items: demoNews, categories: ['Public notice', 'Legal notice'], detailsHref: '/news/{id}',
                layout: 'list', pageSize: 10, headingLevel: 2, labels: { noNews: 'There are no notices posted right now.', countOne: '1 notice', countMany: '{count} notices' } } },
            { label: 'Nothing posted', props: {
                title: 'Press releases', items: [], headingLevel: 3 } }
        ]
    },
    {
        ref: 'news_details',
        name: 'News details',
        group: 'News',
        events: ['share'],
        summary: 'One article or press release as a page: category and department, headline, published and updated dates, a figure with caption, the summary as a lede, the body, attachments and related links, and a media contact box. Share and print buttons; empty fields are left out.',
        demos: [
            { label: 'Everything filled in: image, attachments, links and media contact', props: {
                article: demoNews[0], backHref: '/c/news_list', headingLevel: 2 } },
            { label: 'A legal notice: hearing details, documents and the clerk as contact', props: {
                article: demoNews.find(article => article.id === 'zoning-hearing'), backHref: '/c/news_list', headingLevel: 2,
                labels: { back: 'Back to notices', mediaContact: 'Contact' } } },
            { label: 'Only a title and a date: everything empty is left out', props: {
                article: demoNews[demoNews.length - 1], headingLevel: 2, showShare: false } },
            { label: 'No article', props: {
                article: {}, backHref: '/c/news_list', headingLevel: 2 } }
        ]
    },
    {
        ref: 'tabs',
        name: 'Tabs',
        group: 'Layout',
        events: ['tab-change'],
        summary: 'A container that shows one of the components inside it at a time, chosen from a row of tabs: Overview / Staff / Documents on a department page. Arrow keys move between tabs; tabs that don’t fit scroll sideways. Optionally keeps the open tab in the address (#staff), so a link can open it.',
        demos: [
            { label: 'A department page: components by dz-type (items), the open tab kept in the address', props: {
                label: 'Health Department', linkHash: true,
                items: [
                    { label: 'Overview', id: 'overview', type: 'department_card', props: { department: demoDepartments.health, timeZone: 'America/New_York', headingLevel: 2 } },
                    { label: 'Staff', id: 'staff', type: 'staff_directory', props: { title: 'Health Department staff', items: demoStaff, department: 'Health Department', layout: 'table', showPhotos: false, headingLevel: 3 } },
                    { label: 'Forms and documents', id: 'documents', type: 'document_list', props: { title: 'Forms and documents', items: demoDocuments, documentHref: '/api/documents/{id}', pageSize: 5, headingLevel: 3 } }
                ] } },
            { label: 'Boxed, with plain elements inside (each names its tab with data-tab-label)', props: {
                label: 'Parking', variant: 'boxed' },
              children: [
                  { tag: 'p', text: 'Free two-hour parking is behind the Administration Building. The lot fills by 9 a.m. on court days.', attrs: { 'data-tab-label': 'Where to park' } },
                  { tag: 'p', text: 'Accessible spaces are next to the north entrance, which has a ramp and an automatic door.', attrs: { 'data-tab-label': 'Accessible parking' } },
                  { tag: 'p', text: 'Bike racks are at both entrances. Bus routes 2 and 7 stop on Second Street.', attrs: { 'data-tab-label': 'Bikes and buses' } }
              ] },
            { label: 'Nine tabs named by titles, opened at "Fees" (selected by id); the row scrolls when narrow', props: {
                label: 'Building permits', selected: 'fees',
                titles: ['Overview', 'Who needs a permit', 'How to apply', 'Fees', 'Inspections', 'Timelines', 'Appeals', 'Contact', 'Questions'] },
              children: ['Overview', 'Who needs a permit', 'How to apply', 'Fees', 'Inspections', 'Timelines', 'Appeals', 'Contact', 'Questions']
                  .map(name => ({ tag: 'p', text: name + ': details for this step of the building permit process.' })) },
            { label: 'Nothing inside', props: { label: 'Empty tabs' } }
        ]
    },
    {
        ref: 'content_carousel',
        name: 'Content carousel',
        group: 'Layout',
        summary: 'A container that cycles through the components placed inside it, one at a time, with pause, previous, next and item buttons. Pauses on hover and focus, and never moves for visitors who prefer reduced motion.',
        demos: [
            { label: 'Three event details by dz-type, fading every 7 seconds', props: {
                label: 'Featured events',
                items: [
                    { type: 'event_details', props: { store: 'demo', eventId: 'conference', headingLevel: 2 } },
                    { type: 'event_details', props: { store: 'demo', eventId: 'standup', headingLevel: 2 } },
                    { type: 'event_details', props: { store: 'demo', eventId: 'party', headingLevel: 2 } }
                ] } },
            { label: 'Sliding, not rotating on its own, no item buttons', props: {
                label: 'FAQ topics', autoplay: false, transition: 'slide', showDots: false,
                items: [
                    { type: 'accordion', props: { title: 'Parking', headingLevel: 2, items: [
                        { id: 'where', label: 'Where can I park?', content: 'Free two-hour parking is behind the building.' },
                        { id: 'permit', label: 'Do I need a permit?', content: 'Only for spaces marked Reserved.' }] } },
                    { type: 'accordion', props: { title: 'Hours', headingLevel: 2, items: [
                        { id: 'week', label: 'Weekdays', content: '8am to 4:30pm.' },
                        { id: 'holidays', label: 'Holidays', content: 'Closed on county holidays.' }] } },
                    { type: 'accordion', props: { title: 'Payments', headingLevel: 2, items: [
                        { id: 'cards', label: 'Do you take cards?', content: 'Yes, all major cards, with a small processing fee.' }] } }
                ] } },
            { label: 'Twelve items: arrows appear, dots in groups of five (the last group padded)', props: {
                label: 'Upcoming events', autoplay: false,
                items: demoEvents.slice(0, 12).map(event => ({
                    type: 'event_details', props: { store: 'demo', eventId: event.id, headingLevel: 2 }
                })) } },
            { label: 'One item: no controls', props: {
                label: 'Single item',
                items: [{ type: 'dz-button', props: { label: 'The only item', variant: 'secondary' } }] } }
        ]
    },
    {
        ref: 'modal_dialog',
        name: 'Modal dialog',
        group: 'Layout',
        events: ['open', 'close'],
        summary: 'A generic modal dialog on the native <dialog> element: a title, then whatever goes in its body and footer slots. Opened from its own button or by the page; traps focus, closes on Esc, locks page scrolling, returns focus, and animates in and out over a blurred backdrop.',
        demos: [
            { label: 'Slots: text in the body, two buttons in the footer (data-modal-close)', props: {
                triggerLabel: 'Delete listing', title: 'Delete this listing?', size: 'small' },
              children: [
                  { tag: 'p', text: 'The listing and its documents will no longer be shown on the site. This cannot be undone.' },
                  { type: 'dz-button', slot: 'footer', attrs: { 'data-modal-close': 'cancel' }, props: { label: 'Cancel', variant: 'secondary' } },
                  { type: 'dz-button', slot: 'footer', attrs: { 'data-modal-close': 'delete' }, props: { label: 'Delete', variant: 'danger' } }
              ] },
            { label: 'A component by dz-type (items), large, no footer', props: {
                triggerLabel: 'View event', title: 'Event details', size: 'large',
                items: [{ type: 'event_details', props: { store: 'demo', eventId: 'conference', headingLevel: 3 } }] } },
            { label: 'Long content scrolls inside; clicking outside does not close it', props: {
                triggerLabel: 'Read the policy', title: 'Website privacy policy', closeOnBackdrop: false },
              children: [
                  ...Array.from({ length: 12 }, (_, i) => ({ tag: 'p', text: 'Section ' + (i + 1) + '. We collect only the information needed to provide county services, keep it secure, and never sell it. Questions can be sent to the records office.' })),
                  { type: 'dz-button', slot: 'footer', attrs: { 'data-modal-close': 'accept' }, props: { label: 'I understand', variant: 'primary' } }
              ] }
        ]
    },
    {
        ref: 'prompt_dialog',
        name: 'Prompt dialog',
        group: 'Layout',
        events: ['result'],
        summary: 'The common questions as a modal: alert, confirm (with a danger tone and an optional "type DELETE to confirm"), and prompt (a labelled field with hint and errors). Opened by its own button, by the page, or from code with DzPrompt.alert(), DzPrompt.confirm() and DzPrompt.prompt(), which return promises. The add, rename and delete buttons in the list demos use DzPrompt.',
        demos: [
            { label: 'Confirm, danger: focus starts on Cancel', props: {
                triggerLabel: 'Delete listing', kind: 'confirm', tone: 'danger', title: 'Delete this listing?',
                message: 'The listing and its documents will no longer be shown on the site. This cannot be undone.', confirmLabel: 'Delete listing' } },
            { label: 'Alert: one button', props: {
                triggerLabel: 'Publish page', kind: 'alert', title: 'Page published', message: 'Your changes are live on the site.' } },
            { label: 'Prompt: required, at most 60 characters, starts with the current name selected', props: {
                triggerLabel: 'Rename page', kind: 'prompt', title: 'Rename page', inputLabel: 'Page name', value: 'Trash & recycling',
                hint: 'Shown in menus and the browser tab.', maxLength: 60, confirmLabel: 'Rename' } },
            { label: 'Prompt for an email address: checked before it goes through', props: {
                triggerLabel: 'Share draft', kind: 'prompt', inputType: 'email', title: 'Share this draft',
                message: 'We will email a link to a preview of this page.', inputLabel: 'Email address', placeholder: 'name@example.gov', confirmLabel: 'Send link' } },
            { label: 'Confirm by typing a phrase', props: {
                triggerLabel: 'Delete department', kind: 'confirm', tone: 'danger', title: 'Delete the Health Department?',
                message: 'Its pages, staff listings and documents will be removed for everyone.', confirmPhrase: 'DELETE', confirmLabel: 'Delete department' } },
            { label: 'Prompt with a textarea, optional', props: {
                triggerLabel: 'Return for changes', kind: 'prompt', inputType: 'textarea', title: 'Return this page for changes',
                inputLabel: 'Note to the author', hint: 'Optional. Say what needs to change.', required: false, confirmLabel: 'Return page' } }
        ]
    },
    {
        ref: 'toast_region',
        name: 'Toasts',
        group: 'Layout',
        actions: toastActions,
        events: ['action'],
        summary: 'Short messages that don’t interrupt: “Page saved”, “Couldn’t save the page”, “Deleted · Undo”. Sent from code with DzToast.success(), .error(), .warning(), .info() or .show(), which return a promise of how the toast closed. Read out by screen readers as they appear; Alt+T reaches them from the keyboard; timers pause under the pointer and while focused, and errors and toasts with an action stay until closed. The add, rename and delete buttons in the list demos send toasts too.',
        demos: [
            { label: 'From code: DzToast, in the corner of the page (the log shows how each closed)', try: [
                { label: 'Page saved', code: "DzToast.success('Page saved');",
                  run: () => window.DzToast.success('Page saved') },
                { label: 'Couldn’t save', code: "DzToast.error({ title: 'Couldn’t save the page', message: 'Check your connection and try again.' });",
                  run: () => window.DzToast.error({ title: 'Couldn’t save the page', message: 'Check your connection and try again.' }) },
                { label: 'Deleted, with Undo', code: `const closed = await DzToast.show({ message: 'Deleted "Road closures"', action: 'Undo' });` + NL + "if (closed.reason === 'action') restore();",
                  run: () => window.DzToast.show({ message: 'Deleted "Road closures"', action: 'Undo' }) },
                { label: 'Saving, then saved', code: "DzToast.info({ id: 'save', message: 'Saving…', duration: 0 });" + NL + "// Later, the same id replaces it:" + NL + "DzToast.success({ id: 'save', message: 'All changes saved' });",
                  run: () => {
                      const saving = window.DzToast.info({ id: 'save', message: 'Saving…', duration: 0 });
                      setTimeout(() => window.DzToast.success({ id: 'save', message: 'All changes saved' }), 1500);
                      return saving;
                  } },
                { label: 'Warning', code: "DzToast.warning({ title: 'Your session ends in 5 minutes', message: 'Save your work to keep it.' });",
                  run: () => window.DzToast.warning({ title: 'Your session ends in 5 minutes', message: 'Save your work to keep it.' }) }
            ] },
            { label: 'The four tones, in the page (position inline, items, not timed)', props: {
                source: 'items', position: 'inline', hotkey: '', label: 'Notifications (tones)', max: 4,
                items: [
                    { id: 'saved', tone: 'success', message: 'Page saved', duration: 0 },
                    { id: 'scheduled', tone: 'info', title: 'Publishing scheduled', message: 'The page goes live Monday at 8:00 AM.', duration: 0 },
                    { id: 'session', tone: 'warning', title: 'Your session ends in 5 minutes', message: 'Save your work to keep it.', duration: 0 },
                    { id: 'failed', tone: 'error', title: 'Couldn’t save the page', message: 'Check your connection and try again.' }
                ] } },
            { label: 'An action button, and a long message (closing removes it through the close event)', props: {
                source: 'items', position: 'inline', hotkey: '', label: 'Notifications (actions)',
                items: [
                    { id: 'deleted', message: 'Deleted "Road closures and detours for the Main Street resurfacing project"', action: 'Undo' },
                    { id: 'draft', tone: 'info', message: 'A newer draft of this page exists.', action: { label: 'Open draft' } }
                ] } }
        ]
    },
    {
        ref: 'alert_banner',
        name: 'Alert banner',
        group: 'Controls',
        events: ['dismiss', 'alert-change'],
        summary: 'The strip across the top of a site for a closing, a disruption or an emergency. Three levels, each with its own icon shape and its own spoken severity, so it never rests on color; an emergency is announced at once (role alert), and the whole band is one landmark named by `label`. Several alerts either stack (with a "Show all" button) or step through one at a time with Previous and Next — nothing scrolls or advances on its own, which is why there is no ticker. Dismissals are remembered in the visitor’s browser.',
        demos: [
            { label: 'A warning: holiday closing', props: {
                label: 'County alert', items: [
                    { id: 'labor-day', level: 'warning', title: 'Holiday closing.',
                      message: 'All county offices are closed Monday, September 1 for Labor Day. Emergency services are unaffected.',
                      href: '/departments/holidays', linkLabel: 'See the full holiday schedule' }
                ] } },
            { label: 'An emergency (role alert, cannot be dismissed) above a notice', props: {
                label: 'Emergency alert', items: [
                    { id: 'snow-level-3', level: 'emergency', title: 'Level 3 snow emergency.',
                      message: 'All roadways are closed to non-emergency travel.',
                      href: '/news/road-conditions', linkLabel: 'Current road conditions', dismissible: false },
                    { id: 'dog-licences', level: 'info', title: 'Dog licences.',
                      message: 'The 2027 renewal period opens December 1.', href: '/services/dog-licence', linkLabel: 'Renew online' }
                ] } },
            { label: 'Four alerts, two shown, the rest behind "Show all"', props: {
                label: 'Current alerts', remember: false,
                items: [
                    { id: 'boil', level: 'emergency', title: 'Boil advisory.', message: 'Northside customers should boil water before drinking it.', href: '/news/boil-advisory' },
                    { id: 'closing', level: 'warning', title: 'Courthouse closing early.', message: 'The courthouse closes at noon on Friday for maintenance.' },
                    { id: 'hydrants', level: 'info', title: 'Hydrant flushing.', message: 'Crews are flushing hydrants weeknights in the Northside service area.' },
                    { id: 'meeting', level: 'info', title: 'Special meeting.', message: 'The Board meets Thursday at 6 p.m. on the Route 16 rezoning.', href: '/news/zoning-hearing' }
                ] } },
            { label: 'One at a time (layout single): Previous, Next and "Alert 1 of 3"', props: {
                label: 'Alerts, one at a time', layout: 'single', remember: false,
                items: [
                    { id: 'one', level: 'warning', title: 'Trash collection delayed.', message: 'Pickup runs one day late this week after the holiday.' },
                    { id: 'two', level: 'info', title: 'Passport office closed.', message: 'Passport services are unavailable Wednesday for staff training.' },
                    { id: 'three', level: 'info', title: 'Park road closed.', message: 'The north entrance to Lakeside Park is closed for paving until Friday.', href: '/parks/lakeside' }
                ] } },
            { label: 'Nothing running (the banner takes no space)', props: { label: 'No alerts', items: [] } }
        ]
    },
    {
        ref: 'page_feedback',
        name: 'Page feedback',
        group: 'Controls',
        events: ['feedback', 'comment'],
        summary: 'The "Was this page helpful?" strip for the foot of a page: Yes, No, then a thank-you that is announced and takes focus. Saying No opens the prompt dialog for a note, so there is no second form sitting on the page. The vote is emitted the moment a button is pressed, and the note separately, so closing the dialog still counts as a vote. The CMS stores them.',
        demos: [
            { label: 'Default: a note is asked for after No', props: { page: '/departments/health' } },
            { label: 'A note after either answer, with its own wording', props: {
                page: '/services/pay-taxes', askComment: 'always',
                commentTitle: 'Tell us more', commentLabel: 'What were you trying to do?',
                commentHint: 'Optional. Please do not include personal details.' } },
            { label: 'Just the vote (askComment never), plain, and the question as a heading', props: {
                page: '/news', askComment: 'never', variant: 'plain', headingLevel: 2,
                question: 'Did you find what you were looking for?' } },
            { label: 'Already answered (the CMS editor preview)', props: { answered: 'yes' } }
        ]
    },
    {
        ref: 'side_nav',
        name: 'Side nav',
        group: 'Navigation',
        summary: 'A sidebar of grouped links that highlights the current page and collapses to a top bar with a menu button on narrow screens. The gallery’s own sidebar is one.',
        demos: [
            { label: 'Grouped links, current page set with activeHref', props: {
                title: 'Acme Admin', subtitle: 'v2.4', activeHref: '/orders',
                items: [
                    { label: 'Dashboard', href: '/' },
                    { label: 'Orders', href: '/orders', group: 'Sales' },
                    { label: 'Customers', href: '/customers', group: 'Sales' },
                    { label: 'Products', href: '/products', group: 'Catalog' },
                    { label: 'Categories', href: '/categories', group: 'Catalog' },
                    { label: 'Settings', href: '/settings', group: 'Account' }
                ] } },
            { label: 'Own field names (name / url / section), wider', props: {
                title: 'Docs', width: '280px', labelKey: 'name', hrefKey: 'url', groupKey: 'section',
                items: [
                    { name: 'Getting started', url: '/docs/start', section: 'Guide' },
                    { name: 'Components', url: '/docs/components', section: 'Guide' },
                    { name: 'API reference', url: '/docs/api', section: 'Reference' }
                ] } },
            { label: 'Narrow-screen top bar (collapseBelow forced high)', props: {
                title: 'Acme Admin', navLabel: 'Acme Admin (top bar)', collapseBelow: 100000, activeHref: '/customers',
                items: [
                    { label: 'Orders', href: '/orders', group: 'Sales' },
                    { label: 'Customers', href: '/customers', group: 'Sales' },
                    { label: 'Settings', href: '/settings', group: 'Account' }
                ] } },
            { label: 'Pages below a link keep it current (matchPrefix, at /orders/1042)', props: {
                title: 'Shop', navLabel: 'Shop (matchPrefix)', matchPrefix: true, activeHref: '/orders/1042',
                items: [
                    { label: 'Home', href: '/' },
                    { label: 'Orders', href: '/orders', group: 'Sales' },
                    { label: 'Order returns', href: '/orders-returns', group: 'Sales' }
                ] } }
        ]
    }
];
