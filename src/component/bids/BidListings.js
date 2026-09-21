export default Deezul.Component({
    // BidListings — bids, RFQs and RFPs as cards, with search, type and status filters, sorting
    // and a result count.
    //
    // DATA: `items` is the list of solicitations from the CMS, in the shape documented in
    // bid-helpers.js (title, description, type, status, posted, due, closes, location, contact,
    // meetings, documents). This component only lays them out; anything empty is left out.
    //
    //   <dz-component dz-type="bid_listings" :title="'Bids and proposals'" :items="bids"
    //                 :detailsHref="'/bids/{id}'"></dz-component>
    //
    // CARDS: type and status chips (plus "Due in 3 days" while an open listing is due soon),
    // the title, a two-line description, then the due date and time, the posted date, the
    // number of documents and the next meeting. The closing date is never shown: once it has
    // passed the listing is left out (hideClosed). The whole card is clickable: with
    // `detailsHref` the title is a link to the details page; without it, a button that emits
    // bid-click.
    //
    // FINDING ONE: a search box (title, description, type, status, location), type and status
    // filters built from the listings, and a sort: due soonest (upcoming first, past due after),
    // newest first or title A–Z. The count above the cards is announced as it changes.
    //
    // OPTIONS:
    //   title          a heading above the list (blank = none)
    //   detailsHref    link template for a listing's page, e.g. '/bids/{id}' (blank = no link)
    //   showFilters    the search, filter and sort bar (default true)
    //   sort           starting order: 'due' (default), 'newest' or 'title'
    //   hideClosed     leave out listings whose closing date has passed (default true)
    //   dueSoonDays    open listings due within this many days are highlighted (default 7)
    //   pageSize       cards per page (default 10; 0 = all on one page)
    //   headingLevel   level of each listing title (default 3; the list title is one above)
    //   locale         date and time names, e.g. 'fr-FR' (blank = the browser's)
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // PAGES: `pageSize` cards at a time, with Previous, Next and numbered page buttons (at most
    // seven, with gaps). Changing page moves focus to the top of the list.
    //
    // EVENTS emitted:
    //   bid-click     { bid }               a card was opened; bid is the item as passed in
    //   page-change   { page, pageCount }   the visitor went to another page
    //
    // NEEDS: window.DzBids (bid-helpers.js) and window.DzGlobal, both imported by main.js, and
    // the --dz-icon-search / -schedule / -calendar-today / -description / -groups properties.
    schema: {
        inputs: {
            title:        { type: 'string', default: '', label: 'Title' },
            items:        { type: 'array', default: [], label: 'Bids, RFQs and RFPs' },
            detailsHref:  { type: 'string', default: '', label: 'Details page link ({id} = listing id; blank = no link)' },
            showFilters:  { type: 'boolean', default: true, label: 'Show search and filters' },
            sort:         { type: 'enum', options: ['due', 'newest', 'title'], default: 'due', label: 'Starting sort' },
            hideClosed:   { type: 'boolean', default: true, label: 'Hide listings past their closing date' },
            dueSoonDays:  { type: 'number', default: 7, label: '"Due soon" within (days)' },
            pageSize:     { type: 'number', default: 10, label: 'Listings per page (0 = all)' },
            headingLevel: { type: 'number', default: 3, label: 'Listing title heading level' },
            locale:       { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Selects mark their current option with :selected;
    // clearing the filters also resets the controls directly (see clearFilters).
    template: html`
    <div class="bl" ref="root">
        <div class="bl-top">
            <p class="bl-title" :if="title" role="heading" :aria-level="levels.title">{{ title }}</p>
            <p class="bl-count" role="status" aria-live="polite" aria-atomic="true">{{ countText }}</p>
        </div>

        <div class="bl-controls" :if="showFilters" role="search" :aria-label="searchName">
            <div class="bl-field bl-search">
                <label class="bl-label" for="bl-query">{{ ui.search }}</label>
                <div class="bl-search-box">
                    <span class="bl-icon i-search" aria-hidden="true"></span>
                    <input class="bl-input" id="bl-query" type="search" autocomplete="off"
                           :placeholder="ui.searchPlaceholder" @input="onSearch($event)">
                </div>
            </div>
            <div class="bl-field">
                <label class="bl-label" for="bl-type">{{ ui.type }}</label>
                <select class="bl-select" id="bl-type" @change="onType($event)">
                    <option :for="opt in typeOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="bl-field">
                <label class="bl-label" for="bl-status">{{ ui.status }}</label>
                <select class="bl-select" id="bl-status" @change="onStatus($event)">
                    <option :for="opt in statusOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="bl-field">
                <label class="bl-label" for="bl-sort">{{ ui.sortBy }}</label>
                <select class="bl-select" id="bl-sort" @change="onSort($event)">
                    <option :for="opt in sortOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
        </div>

        <ul class="bl-list" :if="pager.items.length" tabindex="-1" :aria-label="listName">
            <li :for="bid in pager.items" :key="bid.key">
                <article class="bl-card" :class="bid.cls">
                    <ul class="bl-chips" :if="bid.type || bid.status || bid.dueSoon">
                        <li class="bl-chip is-type" :if="bid.type">{{ bid.type }}</li>
                        <li class="bl-chip" :if="bid.status" :class="'is-' + bid.statusKind">{{ bid.status }}</li>
                        <li class="bl-chip is-soon" :if="bid.dueSoon">{{ bid.dueSoonText }}</li>
                    </ul>
                    <p class="bl-bid-title" role="heading" :aria-level="levels.bid">
                        <a class="bl-link" :if="bid.href" :href="bid.href" @click="open(bid)">{{ bid.title }}</a>
                        <button type="button" class="bl-link" :if="!bid.href" @click="open(bid)">{{ bid.title }}</button>
                    </p>
                    <p class="bl-desc" :if="bid.description">{{ bid.description }}</p>
                    <ul class="bl-facts" :if="bid.dueText || bid.postedText || bid.documents.length || bid.nextMeeting">
                        <li class="bl-fact is-due" :if="bid.dueText">
                            <span class="bl-icon i-due" aria-hidden="true"></span>{{ bid.dueLine }}
                        </li>
                        <li class="bl-fact" :if="bid.postedText">
                            <span class="bl-icon i-posted" aria-hidden="true"></span>{{ bid.postedLine }}
                        </li>
                        <li class="bl-fact" :if="bid.documents.length">
                            <span class="bl-icon i-doc" aria-hidden="true"></span>{{ bid.documentsLine }}
                        </li>
                        <li class="bl-fact" :if="bid.nextMeeting">
                            <span class="bl-icon i-meeting" aria-hidden="true"></span>{{ bid.meetingLine }}
                        </li>
                    </ul>
                </article>
            </li>
        </ul>

        <div class="bl-empty" :if="!pager.items.length">
            <p class="bl-empty-text">{{ emptyMessage }}</p>
            <button type="button" class="bl-clear" :if="filtered" @click="clearFilters($event)">{{ ui.clear }}</button>
        </div>

        <nav class="bl-pages" :if="pager.pageCount > 1" :aria-label="pagesName">
            <button type="button" class="bl-step is-prev" :disabled="pager.atFirst" @click="step(-1, $event)">
                <span class="bl-icon i-prev" aria-hidden="true"></span><span>{{ ui.previous }}</span>
            </button>
            <ul class="bl-numbers">
                <li :for="entry in pager.entries" :key="entry.key">
                    <button type="button" class="bl-page" :if="entry.page" :class="entry.current ? 'is-current' : ''"
                            :aria-current="entry.current ? 'page' : 'false'" :aria-label="entry.label"
                            @click="goTo(entry.page, $event)">{{ entry.page }}</button>
                    <span class="bl-gap" :if="!entry.page" aria-hidden="true">…</span>
                </li>
            </ul>
            <p class="bl-of">{{ pager.pageOfText }}</p>
            <button type="button" class="bl-step is-next" :disabled="pager.atLast" @click="step(1, $event)">
                <span>{{ ui.next }}</span><span class="bl-icon i-next" aria-hidden="true"></span>
            </button>
        </nav>
    </div>
    `,

    data: () => ({
        title: '', items: [], detailsHref: '', showFilters: true, sort: 'due', hideClosed: true, dueSoonDays: 7,
        pageSize: 10, headingLevel: 3, locale: '', labels: {},
        query: '', type: '', status: '', sortBy: '', page: 1
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                search: 'Search',
                searchPlaceholder: 'Title, description or location',
                searchListings: 'Bid search',
                searchIn: 'Search {title}',
                type: 'Type',
                allTypes: 'All types',
                status: 'Status',
                allStatuses: 'All statuses',
                sortBy: 'Sort by',
                dueSoonest: 'Due soonest',
                newest: 'Newest first',
                byTitle: 'Title A–Z',
                countOne: '1 opportunity',
                countMany: '{count} opportunities',
                showing: 'Showing {count} of {total} opportunities',
                showingPage: 'Showing {from}–{to} of {count} opportunities',
                showingMatches: 'Showing {from}–{to} of {count} matching opportunities',
                listings: 'Bids, RFQs and RFPs',
                listPage: '{name}, page {page} of {count}',
                pages: 'Pages',
                pagesOf: '{name} pages',
                previous: 'Previous',
                next: 'Next',
                pageLabel: 'Page {page}',
                pageOf: 'Page {page} of {count}',
                noMatches: 'Nothing matches your search.',
                noListings: 'There are no open bids, RFQs or RFPs right now.',
                clear: 'Clear filters',
                dueOn: 'Due {when}',
                postedOn: 'Posted {date}',
                oneDocument: '1 document',
                manyDocuments: '{count} documents',
                nextMeeting: '{title}: {when}',
                meeting: 'Meeting',
                dateTime: '{date} at {time}',
                dueToday: 'Due today',
                dueTomorrow: 'Due tomorrow',
                dueInDays: 'Due in {count} days',
                untitled: '(untitled listing)'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const bid = n >= 1 && n <= 6 ? n : 3;
            return { title: Math.max(bid - 1, 1), bid };
        },

        // Two search landmarks on one page need different names, so the title goes in the name.
        searchName() {
            return this.title ? DzGlobal.format(this.ui.searchIn, { title: this.title }) : this.ui.searchListings;
        },

        bids() {
            const ui = this.ui;
            const soon = Math.round(Number(this.dueSoonDays));
            const options = {
                ui, href: this.detailsHref, soonDays: Number.isFinite(soon) && soon >= 0 ? soon : 7,
                formats: {
                    date: DzGlobal.dateFormatter(this.locale, { month: 'short', day: 'numeric', year: 'numeric' }),
                    time: DzGlobal.dateFormatter(this.locale, { hour: 'numeric', minute: '2-digit' })
                }
            };
            return (Array.isArray(this.items) ? this.items : []).map((item, index) => {
                const bid = DzBids.normalize(item, index, options);
                const count = bid.documents.length;
                return {
                    ...bid,
                    dueLine: DzGlobal.format(ui.dueOn, { when: bid.dueText }),
                    postedLine: DzGlobal.format(ui.postedOn, { date: bid.postedText }),
                    documentsLine: count === 1 ? ui.oneDocument : DzGlobal.format(ui.manyDocuments, { count }),
                    meetingLine: bid.nextMeeting
                        ? DzGlobal.format(ui.nextMeeting, { title: bid.nextMeeting.title || ui.meeting, when: bid.nextMeeting.when }) : ''
                };
            });
        },

        // The listings a visitor can see at all (past their closing date left out when hideClosed).
        available() {
            return this.hideClosed ? this.bids.filter(bid => !bid.closed) : this.bids;
        },

        activeSort() {
            const sort = this.sortBy || this.sort;
            return sort === 'newest' || sort === 'title' ? sort : 'due';
        },

        filtered() {
            return !!(this.query.trim() || this.type || this.status);
        },

        visible() {
            const query = this.query.trim().toLowerCase();
            const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
            // Upcoming due dates soonest first, then past due most recent first, then no due date.
            const rank = bid => (!bid.due ? 2 : bid.daysToDue < 0 ? 1 : 0);
            const orders = {
                due: (a, b) => rank(a) - rank(b)
                    || (rank(a) === 1 ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due)) || byTitle(a, b),
                newest: (a, b) => (b.posted || '').localeCompare(a.posted || '') || byTitle(a, b),
                title: byTitle
            };
            return this.available
                .filter(bid => (!this.type || bid.type === this.type)
                    && (!this.status || bid.status === this.status)
                    && (!query || [bid.title, bid.description, bid.type, bid.status, bid.location].join(' ').toLowerCase().includes(query)))
                .sort(orders[this.activeSort])
                .map(bid => ({ ...bid, cls: 'is-' + (bid.dueSoon ? 'soon' : bid.statusKind || 'none') }));
        },

        typeOptions() {
            return this.optionsFor('type', this.type, this.ui.allTypes);
        },

        statusOptions() {
            return this.optionsFor('status', this.status, this.ui.allStatuses);
        },

        sortOptions() {
            const ui = this.ui;
            return [['due', ui.dueSoonest], ['newest', ui.newest], ['title', ui.byTitle]]
                .map(([value, label]) => ({ key: value, value, label, selected: value === this.activeSort }));
        },

        // The page on screen: its listings, its buttons and its numbers.
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
            const name = this.title || this.ui.listings;
            const { page, pageCount } = this.pager;
            return pageCount > 1 ? DzGlobal.format(this.ui.listPage, { name, page, count: pageCount }) : name;
        },

        pagesName() {
            return this.title ? DzGlobal.format(this.ui.pagesOf, { name: this.title }) : this.ui.pages;
        },

        emptyMessage() {
            return this.available.length ? this.ui.noMatches : this.ui.noListings;
        }
    },

    methods: {
        // "All" plus each distinct value of a field among the available listings, A–Z.
        optionsFor(field, current, allLabel) {
            const values = [...new Set(this.available.map(bid => bid[field]).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            return [{ key: '~all', value: '', label: allLabel, selected: !current },
                    ...values.map(value => ({ key: value, value, label: value, selected: value === current }))];
        },

        onSearch(event) {
            this.query = event.target.value;
            this.page = 1;
        },

        onType(event) {
            this.type = event.target.value;
            this.page = 1;
        },

        onStatus(event) {
            this.status = event.target.value;
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
            const list = root.querySelector('.bl-list');
            const top = root.querySelector('.bl');
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
            this.type = '';
            this.status = '';
            this.page = 1;
            const input = root.querySelector('#bl-query');
            if (input) input.value = '';
            ['#bl-type', '#bl-status'].forEach(selector => {
                const select = root.querySelector(selector);
                if (select) select.value = '';
            });
            if (input) input.focus();
        },

        // A link still navigates (the router takes the click); this only reports it.
        open(bid) {
            const list = DzGlobal.raw(this.items);
            const item = Array.isArray(list) ? list[bid.index] : null;
            this.$emit('bid-click', { bid: item ? JSON.parse(JSON.stringify(item)) : null });
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .bl { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a);
              --bl-field-border: #8a8f9c; }
        .bl-icon { display: block; flex: none; width: 1.1rem; height: 1.1rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-search  { --icon: var(--dz-icon-search); }
        .i-due     { --icon: var(--dz-icon-schedule); }
        .i-posted  { --icon: var(--dz-icon-calendar-today); }
        .i-doc     { --icon: var(--dz-icon-description); }
        .i-meeting { --icon: var(--dz-icon-groups); }
        .i-prev    { --icon: var(--dz-icon-chevron-left); }
        .i-next    { --icon: var(--dz-icon-chevron-right); }

        .bl-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem 1rem;
                  margin: 0 0 .75rem; }
        .bl-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.35rem; font-weight: 700;
                    color: var(--dz-color-heading, #1f2330); }
        .bl-count { margin: 0; font-size: .875rem; font-weight: 600; }

        /* ---- Search bar. Field borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1). */
        .bl-controls { display: grid; grid-template-columns: minmax(14rem, 2fr) repeat(3, minmax(9rem, 1fr)); align-items: end;
                       gap: .75rem; margin: 0 0 1rem; padding: .9rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                       border-radius: 10px; background: var(--dz-color-bg, #f7f7fb); }
        @container (max-width: 52rem) {
            .bl-controls { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .bl-search { grid-column: 1 / -1; }
        }
        @container (max-width: 30rem) {
            .bl-controls { grid-template-columns: minmax(0, 1fr); }
        }
        .bl-field { min-width: 0; }
        .bl-label { display: block; margin: 0 0 .3rem; font-size: .75rem; font-weight: 700; letter-spacing: .04em;
                    text-transform: uppercase; }
        .bl-search-box { position: relative; }
        .bl-search-box .bl-icon { position: absolute; left: .65rem; top: 50%; margin-top: -.55rem; pointer-events: none;
                                  color: var(--dz-color-muted, #6b7180); }
        .bl-input, .bl-select { box-sizing: border-box; width: 100%; height: 2.5rem; border: 1px solid var(--bl-field-border);
                                border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem;
                                color: var(--dz-color-heading, #1f2330); }
        .bl-input { padding: 0 .75rem 0 2.1rem; }
        .bl-select { padding: 0 .5rem; cursor: pointer; }
        .bl-input:focus-visible, .bl-select:focus-visible, .bl-clear:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px; }

        /* ---- Cards: as many ~21rem columns as fit. The title's link covers the whole card. The
           left accent follows the state: open, due soon, awarded, closed, cancelled. */
        .bl-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(21rem, 100%), 1fr)); gap: .8rem;
                   margin: 0; padding: 0; list-style: none; }
        .bl-list > li { display: flex; min-width: 0; }
        .bl-card { position: relative; box-sizing: border-box; display: flex; flex: 1; flex-direction: column; gap: .5rem; min-width: 0;
                   padding: 1rem 1.1rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-left: 4px solid #8a8f9c;
                   border-radius: 10px; background: var(--dz-color-surface, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
                   transition: box-shadow .15s ease, transform .15s ease; }
        .bl-card.is-open, .bl-card.is-other, .bl-card.is-none { border-left-color: var(--dz-color-primary, #5b5ef0); }
        .bl-card.is-soon { border-left-color: #c77700; }
        .bl-card.is-awarded { border-left-color: #2f64c0; }
        .bl-card.is-cancelled { border-left-color: #c23a4b; }
        .bl-card:hover { box-shadow: 0 10px 24px -12px rgba(0, 0, 0, .35); transform: translateY(-1px); }
        .bl-card:focus-within { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        .bl-bid-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.125rem; font-weight: 700; line-height: 1.3; }
        .bl-link { padding: 0; border: 0; background: none; font: inherit; text-align: left; text-decoration: none; cursor: pointer;
                   color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .bl-link::after { content: ""; position: absolute; inset: 0; border-radius: 10px; }
        .bl-link:focus-visible { outline: none; }
        .bl-card:hover .bl-link { color: #4a4dd6; text-decoration: underline; }
        .bl-desc { display: -webkit-box; margin: 0; overflow: hidden; font-size: .875rem; line-height: 1.5;
                   -webkit-line-clamp: 2; -webkit-box-orient: vertical; }   /* paragraphs run together in the preview */

        /* Chips: dark text on light tints, all above 6:1. */
        .bl-chips { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0; padding: 0; list-style: none; }
        .bl-chip { padding: .12rem .55rem; border: 1px solid #d5d8e0; border-radius: 999px; font-size: .75rem; font-weight: 600;
                   background: var(--dz-color-bg, #f7f7fb); }
        .bl-chip.is-type { border-color: #c9caf7; background: #eeeefd; color: #3b3ec2; font-weight: 700; }
        .bl-chip.is-open { border-color: #b5dcc9; background: #e6f4ee; color: #17613f; }
        .bl-chip.is-soon { border-color: #f1cf9c; background: #fdf1e0; color: #8a4b00; }
        .bl-chip.is-awarded { border-color: #bcd0f2; background: #e8effb; color: #1f4fa3; }
        .bl-chip.is-closed { border-color: #d5d8e0; background: #eef0f4; color: #4b5060; }
        .bl-chip.is-cancelled { border-color: #efc2c8; background: #fbe9eb; color: #9b1c2c; }

        .bl-facts { display: flex; flex-direction: column; gap: .3rem; margin: auto 0 0; padding: .6rem 0 0; list-style: none;
                    border-top: 1px solid var(--dz-color-border, #e4e6ee); font-size: .8125rem; }
        .bl-fact { display: flex; align-items: center; gap: .4rem; min-width: 0; overflow-wrap: anywhere; }
        .bl-fact .bl-icon { color: var(--dz-color-muted, #6b7180); }
        .bl-fact.is-due { font-weight: 700; color: var(--dz-color-heading, #1f2330); }

        .bl-empty { padding: 1.5rem 1rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px; text-align: center; }
        .bl-empty-text { margin: 0; font-style: italic; color: var(--dz-color-muted, #6b7180); }
        .bl-clear { margin-top: .75rem; padding: .45rem .9rem; border: 1px solid var(--bl-field-border); border-radius: 6px;
                    background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer;
                    color: var(--dz-color-heading, #1f2330); }
        .bl-clear:hover { background: var(--dz-color-bg, #f7f7fb); }

        /* ---- Pages. Buttons are 44px targets; the numbers give way to "Page 2 of 6" when narrow. */
        .bl-pages { display: flex; align-items: center; justify-content: center; gap: .5rem; margin: 1rem 0 0; }
        .bl-numbers { display: flex; align-items: center; gap: .25rem; margin: 0; padding: 0; list-style: none; }
        .bl-step, .bl-page { box-sizing: border-box; min-width: 2.75rem; height: 2.75rem; border: 1px solid transparent;
                             border-radius: 8px; background: none; font: inherit; font-size: .9375rem; font-weight: 600;
                             color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .bl-step { display: inline-flex; align-items: center; gap: .3rem; padding: 0 .75rem; border-color: var(--bl-field-border);
                   background: var(--dz-color-surface, #fff); }
        .bl-step.is-prev { padding-left: .45rem; }
        .bl-step.is-next { padding-right: .45rem; }
        .bl-page { padding: 0 .5rem; }
        .bl-step:hover:not(:disabled), .bl-page:hover:not(.is-current) { background: var(--dz-color-bg, #f7f7fb); border-color: var(--bl-field-border); }
        .bl-step:disabled { cursor: default; opacity: .45; }
        .bl-page.is-current { background: #4a4dd6; border-color: #4a4dd6; color: #fff; }
        .bl-gap { display: inline-block; min-width: 1.5rem; text-align: center; color: var(--dz-color-muted, #6b7180); }
        .bl-of { display: none; margin: 0 .25rem; font-size: .875rem; font-weight: 600; }
        .bl-step:focus-visible, .bl-page:focus-visible, .bl-list:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        @container (max-width: 34rem) {
            .bl-numbers { display: none; }
            .bl-of { display: block; }
            .bl-pages { justify-content: space-between; }
        }
    `
});
