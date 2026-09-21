export default Deezul.Component({
    // JobListings — job openings as cards, with search, filters, sorting and a result count.
    //
    // DATA: `items` is the list of jobs from the CMS; the job shape is documented in
    // job-helpers.js (id, title, division, jobType, payType, pay, posted, closes, location,
    // summary, ...). This component only lays them out.
    //
    //   <dz-component dz-type="job_listings" :title="'Job openings'" :items="jobs"
    //                 :detailsHref="'/jobs/{id}'"></dz-component>
    //
    // CARDS: division, title, a two-line summary, chips for job type, pay type and status
    // (open until filled / closes <date> / closed — closing soon is highlighted), then pay,
    // location and the posted date. The whole card is clickable: with `detailsHref` the title
    // is a link to the details page; without it, a button that emits job-click.
    //
    // FINDING A JOB: a search box (title, division, location, job type, pay type, summary), a
    // division filter and a job type filter (both built from the jobs), and a sort: newest
    // first, title A–Z or closing soonest. The count above the cards says how many match and
    // is announced to screen readers as it changes.
    //
    // OPTIONS:
    //   title            a heading above the list (blank = none)
    //   detailsHref      link template for a job's page, e.g. '/jobs/{id}' (blank = no link)
    //   showFilters      the search, filter and sort bar (default true)
    //   sort             starting order: 'newest' (default), 'title' or 'closing'
    //   hideClosed       leave out jobs whose closing date has passed (default true)
    //   closingSoonDays  jobs closing within this many days are highlighted (default 7)
    //   pageSize         cards per page (default 10; 0 = all on one page)
    //   headingLevel     level of each job title (default 3; the list title is one above)
    //   locale           date names, e.g. 'fr-FR' (blank = the browser's)
    //   labels           text overrides; see the `ui` computed for the keys
    //
    // PAGES: `pageSize` cards at a time, with Previous, Next and numbered page buttons (at most
    // seven, with gaps). Changing page moves focus to the top of the list.
    //
    // EVENTS emitted:
    //   job-click     { job }                a card was opened; job is the item as passed in
    //   page-change   { page, pageCount }    the visitor went to another page
    //
    // NEEDS: window.DzJobs (job-helpers.js) and window.DzGlobal, both imported by main.js, and
    // the --dz-icon-search / -payments / -location-on / -calendar-today properties (assets/icons.css).
    schema: {
        inputs: {
            title:           { type: 'string', default: '', label: 'Title' },
            items:           { type: 'array', default: [], label: 'Jobs' },
            detailsHref:     { type: 'string', default: '', label: 'Details page link ({id} = job id; blank = no link)' },
            showFilters:     { type: 'boolean', default: true, label: 'Show search and filters' },
            sort:            { type: 'enum', options: ['newest', 'title', 'closing'], default: 'newest', label: 'Starting sort' },
            hideClosed:      { type: 'boolean', default: true, label: 'Hide closed jobs' },
            closingSoonDays: { type: 'number', default: 7, label: '"Closing soon" within (days)' },
            pageSize:        { type: 'number', default: 10, label: 'Jobs per page (0 = all)' },
            headingLevel:    { type: 'number', default: 3, label: 'Job title heading level' },
            locale:          { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:          { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Selects mark their current option with :selected;
    // clearing the filters also resets the controls directly (see clearFilters).
    template: html`
    <div class="jl" ref="root">
        <div class="jl-top">
            <p class="jl-title" :if="title" role="heading" :aria-level="levels.title">{{ title }}</p>
            <p class="jl-count" role="status" aria-live="polite" aria-atomic="true">{{ countText }}</p>
        </div>

        <div class="jl-controls" :if="showFilters" role="search" :aria-label="searchName">
            <div class="jl-field jl-search">
                <label class="jl-label" for="jl-query">{{ ui.search }}</label>
                <div class="jl-search-box">
                    <span class="jl-icon i-search" aria-hidden="true"></span>
                    <input class="jl-input" id="jl-query" type="search" autocomplete="off"
                           :placeholder="ui.searchPlaceholder" @input="onSearch($event)">
                </div>
            </div>
            <div class="jl-field">
                <label class="jl-label" for="jl-division">{{ ui.division }}</label>
                <select class="jl-select" id="jl-division" @change="onDivision($event)">
                    <option :for="opt in divisionOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="jl-field">
                <label class="jl-label" for="jl-type">{{ ui.jobType }}</label>
                <select class="jl-select" id="jl-type" @change="onJobType($event)">
                    <option :for="opt in typeOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="jl-field">
                <label class="jl-label" for="jl-sort">{{ ui.sortBy }}</label>
                <select class="jl-select" id="jl-sort" @change="onSort($event)">
                    <option :for="opt in sortOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
        </div>

        <ul class="jl-list" :if="pager.items.length" tabindex="-1" :aria-label="listName">
            <li :for="job in pager.items" :key="job.key">
                <article class="jl-card" :class="job.cls">
                    <p class="jl-division" :if="job.division">{{ job.division }}</p>
                    <p class="jl-job-title" role="heading" :aria-level="levels.job">
                        <a class="jl-link" :if="job.href" :href="job.href" @click="open(job)">{{ job.title }}</a>
                        <button type="button" class="jl-link" :if="!job.href" @click="open(job)">{{ job.title }}</button>
                    </p>
                    <p class="jl-summary" :if="job.summary">{{ job.summary }}</p>
                    <ul class="jl-chips">
                        <li class="jl-chip" :if="job.jobType">{{ job.jobType }}</li>
                        <li class="jl-chip" :if="job.payType">{{ job.payType }}</li>
                        <li class="jl-chip" :class="'is-' + job.statusKind">{{ job.statusText }}</li>
                    </ul>
                    <dl class="jl-facts">
                        <div class="jl-fact" :if="job.pay">
                            <dt><span class="jl-icon i-pay" aria-hidden="true"></span><span class="jl-sr">{{ ui.pay }}</span></dt>
                            <dd>{{ job.pay }}</dd>
                        </div>
                        <div class="jl-fact" :if="job.location">
                            <dt><span class="jl-icon i-place" aria-hidden="true"></span><span class="jl-sr">{{ ui.location }}</span></dt>
                            <dd>{{ job.location }}</dd>
                        </div>
                        <div class="jl-fact" :if="job.postedText">
                            <dt><span class="jl-icon i-date" aria-hidden="true"></span><span class="jl-sr">{{ ui.posted }}</span></dt>
                            <dd>{{ job.postedText }}</dd>
                        </div>
                    </dl>
                </article>
            </li>
        </ul>

        <div class="jl-empty" :if="!pager.items.length">
            <p class="jl-empty-text">{{ emptyMessage }}</p>
            <button type="button" class="jl-clear" :if="filtered" @click="clearFilters($event)">{{ ui.clear }}</button>
        </div>

        <nav class="jl-pages" :if="pager.pageCount > 1" :aria-label="pagesName">
            <button type="button" class="jl-step is-prev" :disabled="pager.atFirst" @click="step(-1, $event)">
                <span class="jl-icon i-prev" aria-hidden="true"></span><span>{{ ui.previous }}</span>
            </button>
            <ul class="jl-numbers">
                <li :for="entry in pager.entries" :key="entry.key">
                    <button type="button" class="jl-page" :if="entry.page" :class="entry.current ? 'is-current' : ''"
                            :aria-current="entry.current ? 'page' : 'false'" :aria-label="entry.label"
                            @click="goTo(entry.page, $event)">{{ entry.page }}</button>
                    <span class="jl-gap" :if="!entry.page" aria-hidden="true">…</span>
                </li>
            </ul>
            <p class="jl-of">{{ pager.pageOfText }}</p>
            <button type="button" class="jl-step is-next" :disabled="pager.atLast" @click="step(1, $event)">
                <span>{{ ui.next }}</span><span class="jl-icon i-next" aria-hidden="true"></span>
            </button>
        </nav>
    </div>
    `,

    data: () => ({
        title: '', items: [], detailsHref: '', showFilters: true, sort: 'newest', hideClosed: true,
        closingSoonDays: 7, pageSize: 10, headingLevel: 3, locale: '', labels: {},
        query: '', division: '', jobType: '', sortBy: '', page: 1
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                search: 'Search',
                searchPlaceholder: 'Title, division or location',
                searchJobs: 'Job search',
                searchIn: 'Search {title}',
                division: 'Division',
                allDivisions: 'All divisions',
                jobType: 'Job type',
                allTypes: 'All job types',
                sortBy: 'Sort by',
                newest: 'Newest first',
                byTitle: 'Title A–Z',
                closingSoonest: 'Closing soonest',
                countOne: '1 position',
                countMany: '{count} positions',
                showing: 'Showing {count} of {total} positions',
                showingPage: 'Showing {from}–{to} of {count} positions',
                showingMatches: 'Showing {from}–{to} of {count} matching positions',
                jobs: 'Job openings',
                listPage: '{name}, page {page} of {count}',
                pages: 'Pages',
                pagesOf: '{name} pages',
                previous: 'Previous',
                next: 'Next',
                pageLabel: 'Page {page}',
                pageOf: 'Page {page} of {count}',
                noMatches: 'No jobs match your search.',
                noJobs: 'There are no open positions right now.',
                clear: 'Clear filters',
                openUntilFilled: 'Open until filled',
                closesOn: 'Closes {date}',
                closed: 'Closed',
                pay: 'Pay',
                location: 'Location',
                posted: 'Posted',
                untitled: '(untitled position)'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const job = n >= 1 && n <= 6 ? n : 3;
            return { title: Math.max(job - 1, 1), job };
        },

        // Two search landmarks on one page need different names, so the title goes in the name.
        searchName() {
            return this.title ? DzGlobal.format(this.ui.searchIn, { title: this.title }) : this.ui.searchJobs;
        },

        jobs() {
            const count = (value, fallback) => {
                const n = Math.round(Number(value));
                return Number.isFinite(n) && n >= 0 ? n : fallback;
            };
            const options = {
                ui: this.ui, href: this.detailsHref,
                date: DzGlobal.dateFormatter(this.locale, { month: 'short', day: 'numeric', year: 'numeric' }),
                soonDays: count(this.closingSoonDays, 7)
            };
            return (Array.isArray(this.items) ? this.items : []).map((item, index) => DzJobs.normalize(item, index, options));
        },

        // The jobs a visitor can see at all (closed ones left out when hideClosed).
        available() {
            return this.hideClosed ? this.jobs.filter(job => job.statusKind !== 'closed') : this.jobs;
        },

        activeSort() {
            const sort = this.sortBy || this.sort;
            return sort === 'title' || sort === 'closing' ? sort : 'newest';
        },

        filtered() {
            return !!(this.query.trim() || this.division || this.jobType);
        },

        visible() {
            const query = this.query.trim().toLowerCase();
            const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
            const orders = {
                newest: (a, b) => (b.posted || '').localeCompare(a.posted || '') || byTitle(a, b),
                title: byTitle,
                closing: (a, b) => (a.closes || '9999').localeCompare(b.closes || '9999') || byTitle(a, b)
            };
            return this.available
                .filter(job => (!this.division || job.division === this.division)
                    && (!this.jobType || job.jobType === this.jobType)
                    && (!query || [job.title, job.division, job.location, job.jobType, job.payType, job.summary]
                        .join(' ').toLowerCase().includes(query)))
                .sort(orders[this.activeSort])
                .map(job => ({ ...job, cls: 'is-' + job.statusKind }));
        },

        divisionOptions() {
            return this.optionsFor('division', this.division, this.ui.allDivisions);
        },

        typeOptions() {
            return this.optionsFor('jobType', this.jobType, this.ui.allTypes);
        },

        sortOptions() {
            const ui = this.ui;
            return [['newest', ui.newest], ['title', ui.byTitle], ['closing', ui.closingSoonest]]
                .map(([value, label]) => ({ key: value, value, label, selected: value === this.activeSort }));
        },

        // The page on screen: its jobs, its buttons and its numbers.
        pager() {
            return DzGlobal.paging(this.visible, this.page, this.pageSize, this.ui);
        },

        countText() {
            const ui = this.ui;
            const { count, from, to, pageCount } = this.pager;
            if (pageCount > 1) {
                return this.filtered
                    ? DzGlobal.format(ui.showingMatches, { from, to, count })
                    : DzGlobal.format(ui.showingPage, { from, to, count });
            }
            if (this.filtered) return DzGlobal.format(ui.showing, { count, total: this.available.length });
            return count === 1 ? ui.countOne : DzGlobal.format(ui.countMany, { count });
        },

        // Two lists (or two page navs) on one page need different names.
        listName() {
            const name = this.title || this.ui.jobs;
            const { page, pageCount } = this.pager;
            return pageCount > 1 ? DzGlobal.format(this.ui.listPage, { name, page, count: pageCount }) : name;
        },

        pagesName() {
            return this.title ? DzGlobal.format(this.ui.pagesOf, { name: this.title }) : this.ui.pages;
        },

        emptyMessage() {
            return this.available.length ? this.ui.noMatches : this.ui.noJobs;
        }
    },

    methods: {
        // "All" plus each distinct value of a field among the available jobs, A–Z.
        optionsFor(field, current, allLabel) {
            const values = [...new Set(this.available.map(job => job[field]).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            return [{ key: '~all', value: '', label: allLabel, selected: !current },
                    ...values.map(value => ({ key: value, value, label: value, selected: value === current }))];
        },

        onSearch(event) {
            this.query = event.target.value;
            this.page = 1;
        },

        onDivision(event) {
            this.division = event.target.value;
            this.page = 1;
        },

        onJobType(event) {
            this.jobType = event.target.value;
            this.page = 1;
        },

        onSort(event) {
            this.sortBy = event.target.value;
            this.page = 1;
        },

        // Show another page, then move focus to the top of the list: the button pressed may have
        // just been disabled (Next on the last page), and the new cards start up there.
        async goTo(page, event) {
            const root = event.target.getRootNode();
            const { pageCount, page: current } = this.pager;
            const target = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pageCount);
            if (target === current) return;
            this.page = target;
            this.$emit('page-change', { page: target, pageCount });

            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            const list = root.querySelector('.jl-list');
            const top = root.querySelector('.jl');
            if (!list || !top) return;
            list.focus({ preventScroll: true });
            if (top.getBoundingClientRect().top < 0) {
                const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                top.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
            }
        },

        // Previous (-1) and Next (1).
        step(by, event) {
            return this.goTo(this.pager.page + by, event);
        },

        // Reset the filters (not the sort) and put focus back in the search box.
        clearFilters(event) {
            const root = event.target.getRootNode();
            this.query = '';
            this.division = '';
            this.jobType = '';
            this.page = 1;
            const input = root.querySelector('#jl-query');
            if (input) input.value = '';
            ['#jl-division', '#jl-type'].forEach(selector => {
                const select = root.querySelector(selector);
                if (select) select.value = '';
            });
            if (input) input.focus();
        },

        // A link still navigates (the router takes the click); this only reports it.
        open(job) {
            const list = DzGlobal.raw(this.items);
            const item = Array.isArray(list) ? list[job.index] : null;
            this.$emit('job-click', { job: item ? JSON.parse(JSON.stringify(item)) : null });
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .jl { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a);
              --jl-field-border: #8a8f9c; }
        .jl-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
                 overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
        .jl-icon { display: block; flex: none; width: 1.1rem; height: 1.1rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-search { --icon: var(--dz-icon-search); }
        .i-pay    { --icon: var(--dz-icon-payments); }
        .i-place  { --icon: var(--dz-icon-location-on); }
        .i-date   { --icon: var(--dz-icon-calendar-today); }
        .i-prev   { --icon: var(--dz-icon-chevron-left); }
        .i-next   { --icon: var(--dz-icon-chevron-right); }

        .jl-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem 1rem;
                  margin: 0 0 .75rem; }
        .jl-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.35rem; font-weight: 700;
                    color: var(--dz-color-heading, #1f2330); }
        .jl-count { margin: 0; font-size: .875rem; font-weight: 600; }

        /* ---- Search bar. Field borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1). */
        .jl-controls { display: grid; grid-template-columns: minmax(14rem, 2fr) repeat(3, minmax(9rem, 1fr)); align-items: end;
                       gap: .75rem; margin: 0 0 1rem; padding: .9rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                       border-radius: 10px; background: var(--dz-color-bg, #f7f7fb); }
        @container (max-width: 52rem) {
            .jl-controls { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .jl-search { grid-column: 1 / -1; }
        }
        @container (max-width: 30rem) {
            .jl-controls { grid-template-columns: minmax(0, 1fr); }
        }
        .jl-field { min-width: 0; }
        .jl-label { display: block; margin: 0 0 .3rem; font-size: .75rem; font-weight: 700; letter-spacing: .04em;
                    text-transform: uppercase; color: var(--dz-color-text, #2b2f3a); }
        .jl-search-box { position: relative; }
        .jl-search-box .jl-icon { position: absolute; left: .65rem; top: 50%; margin-top: -.55rem; pointer-events: none;
                                  color: var(--dz-color-muted, #6b7180); }
        .jl-input, .jl-select { box-sizing: border-box; width: 100%; height: 2.5rem; border: 1px solid var(--jl-field-border);
                                border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem;
                                color: var(--dz-color-heading, #1f2330); }
        .jl-input { padding: 0 .75rem 0 2.1rem; }
        .jl-select { padding: 0 .5rem; cursor: pointer; }
        .jl-input:focus-visible, .jl-select:focus-visible, .jl-clear:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px; }

        /* ---- Cards: as many ~20rem columns as fit. The title's link covers the whole card. */
        .jl-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(20rem, 100%), 1fr)); gap: .8rem;
                   margin: 0; padding: 0; list-style: none; }
        .jl-list > li { display: flex; min-width: 0; }
        .jl-card { position: relative; box-sizing: border-box; display: flex; flex: 1; flex-direction: column; gap: .5rem; min-width: 0;
                   padding: 1rem 1.1rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                   border-left: 4px solid var(--dz-color-primary, #5b5ef0); border-radius: 10px;
                   background: var(--dz-color-surface, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
                   transition: box-shadow .15s ease, transform .15s ease; }
        .jl-card.is-closing { border-left-color: #c77700; }
        .jl-card.is-closed { border-left-color: #8a8f9c; }
        .jl-card:hover { box-shadow: 0 10px 24px -12px rgba(0, 0, 0, .35); transform: translateY(-1px); }
        .jl-card:focus-within { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        .jl-division { margin: 0; font-size: .75rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .jl-job-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.125rem; font-weight: 700; line-height: 1.3; }
        .jl-link { padding: 0; border: 0; background: none; font: inherit; text-align: left; text-decoration: none; cursor: pointer;
                   color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .jl-link::after { content: ""; position: absolute; inset: 0; border-radius: 10px; }
        .jl-link:focus-visible { outline: none; }
        .jl-card:hover .jl-link { color: #4a4dd6; text-decoration: underline; }
        .jl-summary { display: -webkit-box; margin: 0; overflow: hidden; font-size: .875rem; line-height: 1.5;
                      -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        /* Chips: dark text on light tints, all above 6:1. */
        .jl-chips { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0; padding: 0; list-style: none; }
        .jl-chip { padding: .12rem .55rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 999px;
                   font-size: .75rem; font-weight: 600; background: var(--dz-color-bg, #f7f7fb); }
        .jl-chip.is-open { border-color: #b5dcc9; background: #e6f4ee; color: #17613f; }
        .jl-chip.is-closing { border-color: #f1cf9c; background: #fdf1e0; color: #8a4b00; }
        .jl-chip.is-closed { border-color: #d5d8e0; background: #eef0f4; color: #4b5060; }

        .jl-facts { display: flex; flex-wrap: wrap; gap: .35rem 1.1rem; margin: auto 0 0; padding-top: .6rem;
                    border-top: 1px solid var(--dz-color-border, #e4e6ee); font-size: .8125rem; }
        .jl-fact { display: flex; align-items: center; gap: .3rem; min-width: 0; }
        .jl-fact dt { display: flex; color: var(--dz-color-muted, #6b7180); }
        .jl-fact dd { margin: 0; overflow-wrap: anywhere; }

        .jl-empty { padding: 1.5rem 1rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px; text-align: center; }
        .jl-empty-text { margin: 0; font-style: italic; color: var(--dz-color-muted, #6b7180); }
        .jl-clear { margin-top: .75rem; padding: .45rem .9rem; border: 1px solid var(--jl-field-border); border-radius: 6px;
                    background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer;
                    color: var(--dz-color-heading, #1f2330); }
        .jl-clear:hover { background: var(--dz-color-bg, #f7f7fb); }

        /* ---- Pages. Buttons are 44px targets; the numbers give way to "Page 2 of 6" when narrow. */
        .jl-pages { display: flex; align-items: center; justify-content: center; gap: .5rem; margin: 1rem 0 0; }
        .jl-numbers { display: flex; align-items: center; gap: .25rem; margin: 0; padding: 0; list-style: none; }
        .jl-step, .jl-page { box-sizing: border-box; min-width: 2.75rem; height: 2.75rem; border: 1px solid transparent;
                             border-radius: 8px; background: none; font: inherit; font-size: .9375rem; font-weight: 600;
                             color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .jl-step { display: inline-flex; align-items: center; gap: .3rem; padding: 0 .75rem; border-color: var(--jl-field-border);
                   background: var(--dz-color-surface, #fff); }
        .jl-step.is-prev { padding-left: .45rem; }
        .jl-step.is-next { padding-right: .45rem; }
        .jl-page { padding: 0 .5rem; }
        .jl-step:hover:not(:disabled), .jl-page:hover:not(.is-current) { background: var(--dz-color-bg, #f7f7fb); border-color: var(--jl-field-border); }
        .jl-step:disabled { cursor: default; opacity: .45; }
        .jl-page.is-current { background: #4a4dd6; border-color: #4a4dd6; color: #fff; }
        .jl-gap { display: inline-block; min-width: 1.5rem; text-align: center; color: var(--dz-color-muted, #6b7180); }
        .jl-of { display: none; margin: 0 .25rem; font-size: .875rem; font-weight: 600; }
        .jl-step:focus-visible, .jl-page:focus-visible, .jl-list:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        @container (max-width: 34rem) {
            .jl-numbers { display: none; }
            .jl-of { display: block; }
            .jl-pages { justify-content: space-between; }
        }
    `
});
