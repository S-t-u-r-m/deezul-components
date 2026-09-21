export default Deezul.Component({
    // JobDetails — one job opening as a page: a header with its key facts, the description
    // sections from the CMS, and "At a glance" and "Contact" boxes beside them.
    //
    // DATA: `job` is one job from the CMS, in the shape documented in job-helpers.js. The
    // sections are whatever the CMS sends — typically position description, prerequisites
    // (with minimum and additional qualifications as subsections), compensation, application
    // procedure and an about section — each a title with text and/or bullet items. This
    // component only lays them out.
    //
    //   <dz-component dz-type="job_details" :job="job" :backHref="'/jobs'"></dz-component>
    //
    // OPTIONS:
    //   backHref         a "Back to job openings" link (blank = none)
    //   applyHref        an Apply button link, with {id} for the job id (blank = none)
    //   showPrint        a Print button (default true); the buttons are left off the printout
    //   closingSoonDays  closing within this many days is highlighted (default 7)
    //   headingLevel     level of the job title (default 1, as a page's main heading);
    //                    sections and boxes are one below, subsections two below
    //   locale           date names, e.g. 'fr-FR' (blank = the browser's)
    //   labels           text overrides; see the `ui` computed for the keys
    //
    // An empty `job` (or one without a title) shows "Job not found".
    //
    // NARROW: under ~46rem of its own width (a container query) the boxes move above the sections.
    //
    // NEEDS: window.DzJobs (job-helpers.js) and window.DzGlobal, both imported by main.js, and
    // the --dz-icon-chevron-left / -print custom properties (assets/icons.css).
    schema: {
        inputs: {
            job:             { type: 'object', default: {}, label: 'Job' },
            backHref:        { type: 'string', default: '', label: 'Back link (blank = none)' },
            applyHref:       { type: 'string', default: '', label: 'Apply link ({id} = job id; blank = none)' },
            showPrint:       { type: 'boolean', default: true, label: 'Show print button' },
            closingSoonDays: { type: 'number', default: 7, label: '"Closing soon" within (days)' },
            headingLevel:    { type: 'number', default: 1, label: 'Title heading level' },
            locale:          { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:          { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Bindings inside the :if blocks read `info`, which is
    // never null (every field has a value when the job is missing).
    template: html`
    <article class="jd" ref="root">
        <div class="jd-actions" :if="backHref || (showPrint && info.found)">
            <a class="jd-back" :if="backHref" :href="backHref">
                <span class="jd-icon i-back" aria-hidden="true"></span>{{ ui.back }}
            </a>
            <button type="button" class="jd-print" :if="showPrint && info.found" @click="print">
                <span class="jd-icon i-print" aria-hidden="true"></span>{{ ui.print }}
            </button>
        </div>

        <div class="jd-card" :if="info.found">
            <div class="jd-head">
                <p class="jd-division" :if="info.division">{{ info.division }}</p>
                <p class="jd-title" role="heading" :aria-level="levels.title">{{ info.title }}</p>
                <ul class="jd-chips">
                    <li class="jd-chip" :if="info.jobType">{{ info.jobType }}</li>
                    <li class="jd-chip" :if="info.payType">{{ info.payType }}</li>
                    <li class="jd-chip" :class="'is-' + info.statusKind">{{ info.statusText }}</li>
                </ul>
                <a class="jd-apply" :if="applyLink" :href="applyLink">{{ ui.apply }}</a>
            </div>

            <div class="jd-layout">
                <div class="jd-main">
                    <div class="jd-section" :if="info.summary">
                        <p class="jd-section-title" role="heading" :aria-level="levels.section">{{ ui.summary }}</p>
                        <p class="jd-text">{{ info.summary }}</p>
                    </div>
                    <div class="jd-section" :for="section in info.sections" :key="section.key">
                        <p class="jd-section-title" :if="section.title" role="heading" :aria-level="levels.section">{{ section.title }}</p>
                        <p class="jd-text" :if="section.text">{{ section.text }}</p>
                        <ul class="jd-bullets" :if="section.items.length">
                            <li :for="item in section.items" :key="item.key">{{ item.text }}</li>
                        </ul>
                        <div class="jd-sub" :for="sub in section.subsections" :key="sub.key">
                            <p class="jd-sub-title" :if="sub.title" role="heading" :aria-level="levels.sub">{{ sub.title }}</p>
                            <p class="jd-text" :if="sub.text">{{ sub.text }}</p>
                            <ul class="jd-bullets" :if="sub.items.length">
                                <li :for="item in sub.items" :key="item.key">{{ item.text }}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="jd-aside">
                    <div class="jd-box">
                        <p class="jd-box-title" role="heading" :aria-level="levels.section">{{ ui.atAGlance }}</p>
                        <dl class="jd-facts">
                            <div class="jd-fact" :if="info.pay"><dt>{{ ui.pay }}</dt><dd>{{ info.pay }}</dd></div>
                            <div class="jd-fact"><dt>{{ ui.status }}</dt><dd>{{ info.statusText }}</dd></div>
                            <div class="jd-fact" :if="info.postedText"><dt>{{ ui.posted }}</dt><dd>{{ info.postedText }}</dd></div>
                            <div class="jd-fact" :if="info.location"><dt>{{ ui.location }}</dt><dd>{{ info.location }}</dd></div>
                            <div class="jd-fact" :if="info.jobType"><dt>{{ ui.jobType }}</dt><dd>{{ info.jobType }}</dd></div>
                            <div class="jd-fact" :if="info.payType"><dt>{{ ui.payType }}</dt><dd>{{ info.payType }}</dd></div>
                        </dl>
                    </div>
                    <div class="jd-box" :if="info.hasContact">
                        <p class="jd-box-title" role="heading" :aria-level="levels.section">{{ ui.contact }}</p>
                        <p class="jd-contact-name" :if="info.contact.name">{{ info.contact.name }}</p>
                        <dl class="jd-facts">
                            <div class="jd-fact" :if="info.contact.email">
                                <dt>{{ ui.email }}</dt>
                                <dd><a class="jd-link" :href="info.contact.emailHref">{{ info.contact.email }}</a></dd>
                            </div>
                            <div class="jd-fact" :if="info.contact.phone">
                                <dt>{{ ui.phone }}</dt>
                                <dd><a class="jd-link" :href="info.contact.phoneHref">{{ info.contact.phone }}</a></dd>
                            </div>
                            <div class="jd-fact" :if="info.contact.fax"><dt>{{ ui.fax }}</dt><dd>{{ info.contact.fax }}</dd></div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <div class="jd-missing" :if="!info.found">
            <p class="jd-title" role="heading" :aria-level="levels.title">{{ ui.notFound }}</p>
            <p class="jd-missing-text">{{ ui.notFoundText }}</p>
        </div>
    </article>
    `,

    data: () => ({
        job: {}, backHref: '', applyHref: '', showPrint: true, closingSoonDays: 7, headingLevel: 1, locale: '', labels: {}
    }),

    computed: {
        // Every string the component shows, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                back: 'Back to job openings',
                print: 'Print',
                apply: 'Apply for this job',
                summary: 'Brief description',
                atAGlance: 'At a glance',
                contact: 'Contact',
                pay: 'Pay',
                status: 'Status',
                posted: 'Posted',
                location: 'Location',
                jobType: 'Job type',
                payType: 'Pay type',
                email: 'Email',
                phone: 'Phone',
                fax: 'Fax',
                openUntilFilled: 'Open until filled',
                closesOn: 'Closes {date}',
                closed: 'Closed',
                untitled: '(untitled position)',
                notFound: 'Job not found',
                notFoundText: 'This position may have been filled or removed.'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const title = n >= 1 && n <= 6 ? n : 1;
            return { title, section: Math.min(title + 1, 6), sub: Math.min(title + 2, 6) };
        },

        // The job as drawn. Never null: `found` says whether there is one.
        info() {
            const raw = DzGlobal.raw(this.job);
            const found = !!(raw && typeof raw === 'object' && DzJobs.text(raw.title));
            const soon = Math.round(Number(this.closingSoonDays));
            return {
                found,
                ...DzJobs.normalize(found ? raw : {}, 0, {
                    ui: this.ui, href: '', soonDays: Number.isFinite(soon) && soon >= 0 ? soon : 7,
                    date: DzGlobal.dateFormatter(this.locale, { month: 'long', day: 'numeric', year: 'numeric' })
                })
            };
        },

        applyLink() {
            return this.info.found && this.applyHref
                ? String(this.applyHref).split('{id}').join(encodeURIComponent(this.info.id)) : '';
        }
    },

    methods: {
        print() {
            window.print();
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .jd { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        .jd-icon { display: block; flex: none; width: 1.2rem; height: 1.2rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-back  { --icon: var(--dz-icon-chevron-left); }
        .i-print { --icon: var(--dz-icon-print); }

        .jd-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0 0 .75rem; }
        .jd-back { display: inline-flex; align-items: center; gap: .15rem; margin-left: -.35rem; padding: .3rem .6rem .3rem .2rem;
                   border-radius: 6px; font-size: .875rem; font-weight: 600; text-decoration: none; color: #4a4dd6; }
        .jd-back:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, transparent); }
        .jd-print { display: inline-flex; align-items: center; gap: .35rem; height: 2.25rem; margin-left: auto; padding: 0 .8rem;
                    border: 1px solid #8a8f9c; border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit;
                    font-size: .875rem; font-weight: 600; color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .jd-print:hover { background: var(--dz-color-bg, #f7f7fb); }
        .jd-back:focus-visible, .jd-print:focus-visible, .jd-apply:focus-visible, .jd-link:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        .jd-card { overflow: hidden; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px;
                   background: var(--dz-color-surface, #fff); }

        /* ---- Header. */
        .jd-head { display: flex; flex-direction: column; align-items: flex-start; gap: .45rem; padding: 1.35rem 1.5rem;
                   border-top: 6px solid var(--dz-color-primary, #5b5ef0); border-bottom: 1px solid var(--dz-color-border, #e4e6ee);
                   background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 6%, var(--dz-color-surface, #fff)); }
        .jd-division { margin: 0; font-size: .8125rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .jd-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.75rem; font-weight: 700; line-height: 1.2;
                    color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        /* Chips: dark text on light tints, all above 6:1. */
        .jd-chips { display: flex; flex-wrap: wrap; gap: .35rem; margin: .1rem 0 0; padding: 0; list-style: none; }
        .jd-chip { padding: .15rem .6rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 999px;
                   font-size: .8125rem; font-weight: 600; background: var(--dz-color-surface, #fff); }
        .jd-chip.is-open { border-color: #b5dcc9; background: #e6f4ee; color: #17613f; }
        .jd-chip.is-closing { border-color: #f1cf9c; background: #fdf1e0; color: #8a4b00; }
        .jd-chip.is-closed { border-color: #d5d8e0; background: #eef0f4; color: #4b5060; }
        /* White on primary, 4.9:1. */
        .jd-apply { margin-top: .5rem; padding: .6rem 1.1rem; border-radius: 6px; background: var(--dz-color-primary, #5b5ef0);
                    font-weight: 700; text-decoration: none; color: #fff; }
        .jd-apply:hover { background: #4a4dd6; }

        /* ---- Body: sections beside the boxes; stacked (boxes first) when narrow. */
        .jd-layout { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; align-items: start; gap: 1.5rem;
                     padding: 1.35rem 1.5rem 1.6rem; }
        @container (max-width: 46rem) {
            .jd-layout { grid-template-columns: minmax(0, 1fr); padding: 1.1rem; }
            .jd-aside { order: -1; }
            .jd-head { padding: 1.1rem; }
            .jd-title { font-size: 1.45rem; }
        }
        .jd-main { display: flex; flex-direction: column; gap: 1.4rem; min-width: 0; }
        .jd-section-title { margin: 0 0 .5rem; padding-bottom: .3rem; border-bottom: 2px solid var(--dz-color-border, #e4e6ee);
                            font-size: 1.125rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .jd-sub { margin-top: .85rem; }
        .jd-sub-title { margin: 0 0 .3rem; font-size: .9375rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .jd-text { margin: 0 0 .5rem; line-height: 1.65; white-space: pre-line; overflow-wrap: anywhere; }
        .jd-text:last-child { margin-bottom: 0; }
        .jd-bullets { margin: .25rem 0 0; padding-left: 1.25rem; line-height: 1.6; }
        .jd-bullets li + li { margin-top: .25rem; }

        .jd-aside { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
        .jd-box { padding: 1rem 1.1rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 8px;
                  background: var(--dz-color-bg, #f7f7fb); }
        .jd-box-title { margin: 0 0 .65rem; font-size: .8125rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .jd-facts { display: flex; flex-direction: column; gap: .6rem; margin: 0; }
        .jd-fact dt { margin: 0; font-size: .75rem; font-weight: 600; }
        .jd-fact dd { margin: .1rem 0 0; font-weight: 600; color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .jd-contact-name { margin: 0 0 .6rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .jd-link { color: #4a4dd6; }

        .jd-missing { padding: 1.5rem 1.25rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px;
                      background: var(--dz-color-surface, #fff); }
        .jd-missing-text { margin: .4rem 0 0; color: var(--dz-color-muted, #6b7180); }

        @media print {
            .jd-actions, .jd-apply { display: none; }
            .jd-card { border: 0; }
        }
    `
});
