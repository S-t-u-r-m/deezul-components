export default Deezul.Component({
    // BidDetails — one bid, RFQ or RFP as a page: type, status and due date in the header; the
    // description, meetings and document links; and "At a glance" and "Contact" boxes beside them.
    //
    // DATA: `bid` is one listing from the CMS, in the shape documented in bid-helpers.js. The CMS
    // stores the uploaded documents; this component only links to them. Every empty field, and
    // every section or box left with nothing in it, is left out. The closing date is never shown.
    //
    //   <dz-component dz-type="bid_details" :bid="bid" :backHref="'/bids'"></dz-component>
    //
    // OPTIONS:
    //   backHref       a "Back to bids and proposals" link (blank = none)
    //   showPrint      a Print button (default true); the buttons are left off the printout
    //   dueSoonDays    an open listing due within this many days is highlighted (default 7)
    //   headingLevel   level of the listing title (default 1, as a page's main heading);
    //                  sections and boxes are one below
    //   locale         date and time names, e.g. 'fr-FR' (blank = the browser's)
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // An empty `bid` (or one without a title) shows "Listing not found".
    //
    // SCREEN READERS: each document link is named with its file type and size, e.g.
    // "Specifications (PDF, 2.3 MB)".
    //
    // NARROW: under ~46rem of its own width (a container query) the boxes move above the sections.
    //
    // NEEDS: window.DzBids (bid-helpers.js) and window.DzGlobal, both imported by main.js, and the
    // --dz-icon-chevron-left / -print / -schedule / -description / -location-on properties.
    schema: {
        inputs: {
            bid:          { type: 'object', default: {}, label: 'Bid, RFQ or RFP' },
            backHref:     { type: 'string', default: '', label: 'Back link (blank = none)' },
            showPrint:    { type: 'boolean', default: true, label: 'Show print button' },
            dueSoonDays:  { type: 'number', default: 7, label: '"Due soon" within (days)' },
            headingLevel: { type: 'number', default: 1, label: 'Title heading level' },
            locale:       { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Bindings inside the :if blocks read `info`, which is
    // never null (every field has a value when the listing is missing).
    template: html`
    <article class="bd" ref="root">
        <div class="bd-actions" :if="backHref || (showPrint && info.found)">
            <a class="bd-back" :if="backHref" :href="backHref">
                <span class="bd-icon i-back" aria-hidden="true"></span>{{ ui.back }}
            </a>
            <button type="button" class="bd-print" :if="showPrint && info.found" @click="print">
                <span class="bd-icon i-print" aria-hidden="true"></span>{{ ui.print }}
            </button>
        </div>

        <div class="bd-card" :if="info.found">
            <div class="bd-head">
                <ul class="bd-chips" :if="info.type || info.status || info.dueSoon">
                    <li class="bd-chip is-type" :if="info.type">{{ info.type }}</li>
                    <li class="bd-chip" :if="info.status" :class="'is-' + info.statusKind">{{ info.status }}</li>
                    <li class="bd-chip is-soon" :if="info.dueSoon">{{ info.dueSoonText }}</li>
                </ul>
                <p class="bd-title" role="heading" :aria-level="levels.title">{{ info.title }}</p>
                <p class="bd-due" :if="info.dueText"><span class="bd-icon i-due" aria-hidden="true"></span>{{ dueLine }}</p>
            </div>

            <div class="bd-layout" :class="info.hasAside ? '' : 'is-single'">
                <div class="bd-main">
                    <div class="bd-section" :if="info.description">
                        <p class="bd-section-title" role="heading" :aria-level="levels.section">{{ ui.description }}</p>
                        <p class="bd-text">{{ info.description }}</p>
                    </div>
                    <div class="bd-section" :if="info.meetings.length">
                        <p class="bd-section-title" role="heading" :aria-level="levels.section">{{ ui.meetings }}</p>
                        <ul class="bd-meetings">
                            <li class="bd-meeting" :for="meeting in info.meetings" :key="meeting.key">
                                <p class="bd-meeting-title" :if="meeting.title">{{ meeting.title }}</p>
                                <p class="bd-meeting-line" :if="meeting.when">
                                    <span class="bd-icon i-due" aria-hidden="true"></span>{{ meeting.when }}
                                </p>
                                <p class="bd-meeting-line" :if="meeting.location">
                                    <span class="bd-icon i-place" aria-hidden="true"></span>{{ meeting.location }}
                                </p>
                            </li>
                        </ul>
                    </div>
                    <div class="bd-section" :if="info.documents.length">
                        <p class="bd-section-title" role="heading" :aria-level="levels.section">{{ ui.documents }}</p>
                        <ul class="bd-docs">
                            <li :for="doc in info.documents" :key="doc.key">
                                <a class="bd-doc" :href="doc.href" :aria-label="doc.label" data-no-router>
                                    <span class="bd-icon i-doc" aria-hidden="true"></span>
                                    <span class="bd-doc-name">{{ doc.name }}</span>
                                    <span class="bd-doc-meta" :if="doc.meta">{{ doc.meta }}</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                    <p class="bd-nothing" :if="!info.hasBody">{{ ui.noDetails }}</p>
                </div>

                <div class="bd-aside" :if="info.hasAside">
                    <div class="bd-box" :if="info.hasFacts">
                        <p class="bd-box-title" role="heading" :aria-level="levels.section">{{ ui.atAGlance }}</p>
                        <dl class="bd-facts">
                            <div class="bd-fact" :if="info.type"><dt>{{ ui.type }}</dt><dd>{{ info.type }}</dd></div>
                            <div class="bd-fact" :if="info.status"><dt>{{ ui.status }}</dt><dd>{{ info.status }}</dd></div>
                            <div class="bd-fact" :if="info.postedText"><dt>{{ ui.posted }}</dt><dd>{{ info.postedText }}</dd></div>
                            <div class="bd-fact" :if="info.dueText"><dt>{{ ui.due }}</dt><dd>{{ info.dueText }}</dd></div>
                            <div class="bd-fact" :if="info.location"><dt>{{ ui.location }}</dt><dd>{{ info.location }}</dd></div>
                        </dl>
                    </div>
                    <div class="bd-box" :if="info.contact.any">
                        <p class="bd-box-title" role="heading" :aria-level="levels.section">{{ ui.contact }}</p>
                        <p class="bd-contact-name" :if="info.contact.name">{{ info.contact.name }}</p>
                        <dl class="bd-facts" :if="info.contact.email || info.contact.phone">
                            <div class="bd-fact" :if="info.contact.email">
                                <dt>{{ ui.email }}</dt>
                                <dd><a class="bd-link" :href="info.contact.emailHref">{{ info.contact.email }}</a></dd>
                            </div>
                            <div class="bd-fact" :if="info.contact.phone">
                                <dt>{{ ui.phone }}</dt>
                                <dd><a class="bd-link" :href="info.contact.phoneHref">{{ info.contact.phone }}</a></dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <div class="bd-missing" :if="!info.found">
            <p class="bd-title" role="heading" :aria-level="levels.title">{{ ui.notFound }}</p>
            <p class="bd-missing-text">{{ ui.notFoundText }}</p>
        </div>
    </article>
    `,

    data: () => ({
        bid: {}, backHref: '', showPrint: true, dueSoonDays: 7, headingLevel: 1, locale: '', labels: {}
    }),

    computed: {
        // Every string the component shows, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                back: 'Back to bids and proposals',
                print: 'Print',
                description: 'Description',
                meetings: 'Meetings',
                documents: 'Documents',
                atAGlance: 'At a glance',
                contact: 'Contact',
                type: 'Type',
                status: 'Status',
                posted: 'Posted',
                due: 'Due',
                dueOn: 'Due {when}',
                location: 'Location',
                email: 'Email',
                phone: 'Phone',
                dateTime: '{date} at {time}',
                dueToday: 'Due today',
                dueTomorrow: 'Due tomorrow',
                dueInDays: 'Due in {count} days',
                noDetails: 'No other details.',
                untitled: '(untitled listing)',
                notFound: 'Listing not found',
                notFoundText: 'It may have been closed or removed, or the link is out of date.'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const title = n >= 1 && n <= 6 ? n : 1;
            return { title, section: Math.min(title + 1, 6) };
        },

        // The listing as drawn. Never null: `found` says whether there is one.
        info() {
            const raw = DzGlobal.raw(this.bid);
            const found = !!(raw && typeof raw === 'object' && DzBids.text(raw.title));
            const soon = Math.round(Number(this.dueSoonDays));
            const bid = DzBids.normalize(found ? raw : {}, 0, {
                ui: this.ui, href: '', soonDays: Number.isFinite(soon) && soon >= 0 ? soon : 7,
                formats: {
                    date: DzGlobal.dateFormatter(this.locale, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
                    time: DzGlobal.dateFormatter(this.locale, { hour: 'numeric', minute: '2-digit' })
                }
            });
            const hasFacts = !!(bid.type || bid.status || bid.postedText || bid.dueText || bid.location);
            return {
                ...bid, found, hasFacts, hasAside: hasFacts || bid.contact.any,
                hasBody: !!(bid.description || bid.meetings.length || bid.documents.length)
            };
        },

        dueLine() {
            return DzGlobal.format(this.ui.dueOn, { when: this.info.dueText });
        }
    },

    methods: {
        print() {
            window.print();
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .bd { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        .bd-icon { display: block; flex: none; width: 1.2rem; height: 1.2rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-back  { --icon: var(--dz-icon-chevron-left); }
        .i-print { --icon: var(--dz-icon-print); }
        .i-due   { --icon: var(--dz-icon-schedule); }
        .i-doc   { --icon: var(--dz-icon-description); }
        .i-place { --icon: var(--dz-icon-location-on); }

        .bd-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0 0 .75rem; }
        .bd-back { display: inline-flex; align-items: center; gap: .15rem; margin-left: -.35rem; padding: .3rem .6rem .3rem .2rem;
                   border-radius: 6px; font-size: .875rem; font-weight: 600; text-decoration: none; color: #4a4dd6; }
        .bd-back:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, transparent); }
        .bd-print { display: inline-flex; align-items: center; gap: .35rem; height: 2.25rem; margin-left: auto; padding: 0 .8rem;
                    border: 1px solid #8a8f9c; border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit;
                    font-size: .875rem; font-weight: 600; color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .bd-print:hover { background: var(--dz-color-bg, #f7f7fb); }
        .bd-back:focus-visible, .bd-print:focus-visible, .bd-doc:focus-visible, .bd-link:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        .bd-card { overflow: hidden; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px;
                   background: var(--dz-color-surface, #fff); }

        /* ---- Header. */
        .bd-head { display: flex; flex-direction: column; align-items: flex-start; gap: .5rem; padding: 1.35rem 1.5rem;
                   border-top: 6px solid var(--dz-color-primary, #5b5ef0); border-bottom: 1px solid var(--dz-color-border, #e4e6ee);
                   background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 6%, var(--dz-color-surface, #fff)); }
        .bd-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.75rem; font-weight: 700; line-height: 1.2;
                    color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .bd-due { display: flex; align-items: center; gap: .4rem; margin: 0; font-size: 1rem; font-weight: 700;
                  color: var(--dz-color-heading, #1f2330); }
        /* Chips: dark text on light tints, all above 6:1. */
        .bd-chips { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0; padding: 0; list-style: none; }
        .bd-chip { padding: .15rem .6rem; border: 1px solid #d5d8e0; border-radius: 999px; font-size: .8125rem; font-weight: 600;
                   background: var(--dz-color-surface, #fff); }
        .bd-chip.is-type { border-color: #c9caf7; background: #eeeefd; color: #3b3ec2; font-weight: 700; }
        .bd-chip.is-open { border-color: #b5dcc9; background: #e6f4ee; color: #17613f; }
        .bd-chip.is-soon { border-color: #f1cf9c; background: #fdf1e0; color: #8a4b00; }
        .bd-chip.is-awarded { border-color: #bcd0f2; background: #e8effb; color: #1f4fa3; }
        .bd-chip.is-closed { border-color: #d5d8e0; background: #eef0f4; color: #4b5060; }
        .bd-chip.is-cancelled { border-color: #efc2c8; background: #fbe9eb; color: #9b1c2c; }

        /* ---- Body: sections beside the boxes; stacked (boxes first) when narrow. */
        .bd-layout { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; align-items: start; gap: 1.5rem;
                     padding: 1.35rem 1.5rem 1.6rem; }
        .bd-layout.is-single { grid-template-columns: minmax(0, 1fr); }
        @container (max-width: 46rem) {
            .bd-layout { grid-template-columns: minmax(0, 1fr); padding: 1.1rem; }
            .bd-aside { order: -1; }
            .bd-head { padding: 1.1rem; }
            .bd-title { font-size: 1.45rem; }
        }
        .bd-main { display: flex; flex-direction: column; gap: 1.4rem; min-width: 0; }
        .bd-section-title { margin: 0 0 .6rem; padding-bottom: .3rem; border-bottom: 2px solid var(--dz-color-border, #e4e6ee);
                            font-size: 1.125rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .bd-text { margin: 0; line-height: 1.65; white-space: pre-line; overflow-wrap: anywhere; }
        .bd-nothing { margin: 0; font-style: italic; color: var(--dz-color-muted, #6b7180); }

        .bd-meetings { display: flex; flex-direction: column; gap: .6rem; margin: 0; padding: 0; list-style: none; }
        .bd-meeting { padding: .7rem .9rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                      border-left: 3px solid var(--dz-color-primary, #5b5ef0); border-radius: 6px; }
        .bd-meeting-title { margin: 0 0 .2rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .bd-meeting-line { display: flex; align-items: flex-start; gap: .4rem; margin: .15rem 0 0; font-size: .9375rem;
                           overflow-wrap: anywhere; }
        .bd-meeting-line .bd-icon { margin-top: .1rem; color: var(--dz-color-muted, #6b7180); }

        .bd-docs { display: flex; flex-direction: column; gap: .4rem; margin: 0; padding: 0; list-style: none; }
        .bd-doc { display: flex; align-items: center; gap: .6rem; padding: .6rem .8rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                  border-radius: 6px; text-decoration: none; color: var(--dz-color-heading, #1f2330); }
        .bd-doc .bd-icon { color: #4a4dd6; }
        .bd-doc:hover { border-color: var(--dz-color-primary, #5b5ef0); background: var(--dz-color-bg, #f7f7fb); }
        .bd-doc-name { flex: 1; min-width: 0; font-weight: 600; color: #4a4dd6; text-decoration: underline; overflow-wrap: anywhere; }
        .bd-doc-meta { flex: none; font-size: .8125rem; color: var(--dz-color-text, #2b2f3a); }

        .bd-aside { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
        .bd-box { padding: 1rem 1.1rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 8px;
                  background: var(--dz-color-bg, #f7f7fb); }
        .bd-box-title { margin: 0 0 .65rem; font-size: .8125rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .bd-facts { display: flex; flex-direction: column; gap: .6rem; margin: 0; }
        .bd-fact dt { margin: 0; font-size: .75rem; font-weight: 600; }
        .bd-fact dd { margin: .1rem 0 0; font-weight: 600; color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .bd-contact-name { margin: 0 0 .6rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .bd-contact-name:last-child { margin-bottom: 0; }
        .bd-link { color: #4a4dd6; }

        .bd-missing { padding: 1.5rem 1.25rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px;
                      background: var(--dz-color-surface, #fff); }
        .bd-missing-text { margin: .4rem 0 0; color: var(--dz-color-muted, #6b7180); }

        @media print {
            .bd-actions { display: none; }
            .bd-card { border: 0; }
        }
    `
});
