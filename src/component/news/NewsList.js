export default Deezul.Component({
    // NewsList — news, press releases and announcements, newest first, as a grid of cards, a
    // list with thumbnails, or compact headlines for a homepage or sidebar.
    //
    // DATA: `items` is the list of articles from the CMS, in the shape documented in
    // news-helpers.js (title, date, category, department, summary, image, ...). This component
    // only lays them out; anything empty is left out.
    //
    //   <dz-component dz-type="news_list" :title="'News'" :items="articles"
    //                 :detailsHref="'/news/{id}'"></dz-component>
    //
    // LAYOUTS:
    //   grid      cards with the image on top, as many ~18rem columns as fit (default).
    //             featureFirst makes the newest article a wide card, image beside the text,
    //             on the first page while nothing is filtered.
    //   list      one article per row, thumbnail on the left
    //   compact   date and headline only: a "Latest news" box
    //
    // FINDING ONE: a search box (title, summary, category, department), and category and
    // department filters when there are two or more of either. Changing them goes back to
    // page 1. The count is announced as it changes.
    //
    // PAGES or LIMIT: `pageSize` articles per page with Previous, Next and page buttons. Or
    // `limit` shows only the newest few, with no filters or pages, and a "View all news" link
    // to `moreHref`.
    //
    // OPTIONS:
    //   title          a heading above the list (blank = none)
    //   categories     only articles in these categories, e.g. ['Public notice', 'Legal notice'] for a
    //                  notices page (an array or 'a, b'; blank = every category). The category filter
    //                  then offers just these.
    //   detailsHref    link template for an article's page, e.g. '/news/{id}' (an article's own
    //                  href wins; neither = a button that emits news-click)
    //   layout         'grid' (default), 'list' or 'compact'
    //   featureFirst   show the newest article as a wide card (grid only; default false)
    //   showImages     show article images (default true; never in compact)
    //   showSummary    show the summary (default true; never in compact)
    //   showFilters    the search and filter bar (default true; off while `limit` is set)
    //   pageSize       articles per page (default 9; 0 = all)
    //   limit          show only the newest N, no filters or pages (default 0 = off)
    //   moreHref       a "View all news" link below the list (blank = none)
    //   headingLevel   level of each article title (default 3; the list title is one above)
    //   locale         date names, e.g. 'fr-FR' (blank = the browser's)
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   news-click    { article }             an article was opened; article is the item as passed in
    //   page-change   { page, pageCount }     the visitor went to another page
    //
    // NEEDS: window.DzNews (news-helpers.js) and window.DzGlobal, both imported by main.js, and
    // the --dz-icon-search, -chevron-left and -chevron-right properties.
    schema: {
        inputs: {
            title:        { type: 'string', default: '', label: 'Title' },
            items:        { type: 'array', default: [], label: 'Articles' },
            categories:   { type: 'array', default: [], label: 'Only these categories (blank = all)' },
            detailsHref:  { type: 'string', default: '', label: 'Article page link ({id} = article id)' },
            layout:       { type: 'enum', options: ['grid', 'list', 'compact'], default: 'grid', label: 'Layout' },
            featureFirst: { type: 'boolean', default: false, label: 'Feature the newest article (grid)' },
            showImages:   { type: 'boolean', default: true, label: 'Show images' },
            showSummary:  { type: 'boolean', default: true, label: 'Show summaries' },
            showFilters:  { type: 'boolean', default: true, label: 'Show search and filters' },
            pageSize:     { type: 'number', default: 9, label: 'Articles per page (0 = all)' },
            limit:        { type: 'number', default: 0, label: 'Show only the newest (0 = off)' },
            moreHref:     { type: 'string', default: '', label: '"View all" link (blank = none)' },
            headingLevel: { type: 'number', default: 3, label: 'Article title heading level' },
            locale:       { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Card images are decorative (alt=""): the title link
    // right after them names the article.
    template: html`
    <div class="nl" ref="root" :class="'is-' + activeLayout">
        <div class="nl-top" :if="title || filtersOn">
            <p class="nl-title" :if="title" role="heading" :aria-level="levels.title">{{ title }}</p>
            <p class="nl-count" :if="filtersOn" role="status" aria-live="polite" aria-atomic="true">{{ countText }}</p>
        </div>

        <div class="nl-controls" :if="filtersOn" role="search" :aria-label="searchName">
            <div class="nl-field nl-search">
                <label class="nl-label" for="nl-query">{{ ui.search }}</label>
                <div class="nl-search-box">
                    <span class="nl-glyph i-search" aria-hidden="true"></span>
                    <input class="nl-input" id="nl-query" type="search" autocomplete="off"
                           :placeholder="ui.searchPlaceholder" @input="onSearch($event)">
                </div>
            </div>
            <div class="nl-field" :if="categoryOptions.length > 2">
                <label class="nl-label" for="nl-category">{{ ui.category }}</label>
                <select class="nl-select" id="nl-category" @change="onCategory($event)">
                    <option :for="opt in categoryOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="nl-field" :if="departmentOptions.length > 2">
                <label class="nl-label" for="nl-department">{{ ui.department }}</label>
                <select class="nl-select" id="nl-department" @change="onDepartment($event)">
                    <option :for="opt in departmentOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
        </div>

        <ul class="nl-list" :if="pageItems.length" tabindex="-1" :aria-label="listName">
            <li class="nl-item" :for="article in pageItems" :key="article.key">
                <article class="nl-card" :class="article.cls">
                    <div class="nl-media" :if="article.showImage">
                        <img class="nl-img" :src="article.image.src" alt="" loading="lazy">
                    </div>
                    <div class="nl-body">
                        <p class="nl-meta" :if="article.category || article.dateText">
                            <span class="nl-chip" :if="article.category">{{ article.category }}</span>
                            <time class="nl-date" :if="article.dateText" :datetime="article.date">{{ article.dateText }}</time>
                        </p>
                        <p class="nl-headline" role="heading" :aria-level="levels.item">
                            <a class="nl-link" :if="article.href" :href="article.href" @click="open(article)">{{ article.title }}</a>
                            <button type="button" class="nl-link" :if="!article.href" @click="open(article)">{{ article.title }}</button>
                        </p>
                        <p class="nl-summary" :if="article.showSummary">{{ article.summary }}</p>
                        <p class="nl-dept" :if="article.showDepartment">{{ article.department }}</p>
                    </div>
                </article>
            </li>
        </ul>

        <div class="nl-empty" :if="!pageItems.length">
            <p class="nl-empty-text">{{ emptyMessage }}</p>
            <button type="button" class="nl-clear" :if="filtered" @click="clearFilters($event)">{{ ui.clear }}</button>
        </div>

        <nav class="nl-pages" :if="pageCount > 1" :aria-label="pagesName">
            <button type="button" class="nl-step is-prev" :disabled="currentPage <= 1" @click="step(-1, $event)">
                <span class="nl-glyph i-prev" aria-hidden="true"></span><span>{{ ui.previous }}</span>
            </button>
            <ul class="nl-numbers">
                <li :for="entry in pageEntries" :key="entry.key">
                    <button type="button" class="nl-page" :if="entry.page" :class="entry.current ? 'is-current' : ''"
                            :aria-current="entry.current ? 'page' : 'false'" :aria-label="entry.label"
                            @click="goTo(entry.page, $event)">{{ entry.page }}</button>
                    <span class="nl-gap" :if="!entry.page" aria-hidden="true">…</span>
                </li>
            </ul>
            <p class="nl-of">{{ pageOfText }}</p>
            <button type="button" class="nl-step is-next" :disabled="currentPage >= pageCount" @click="step(1, $event)">
                <span>{{ ui.next }}</span><span class="nl-glyph i-next" aria-hidden="true"></span>
            </button>
        </nav>

        <a class="nl-more" :if="moreHref" :href="moreHref">{{ ui.viewAll }}<span class="nl-glyph i-next" aria-hidden="true"></span></a>
    </div>
    `,

    data: () => ({
        title: '', items: [], categories: [], detailsHref: '', layout: 'grid', featureFirst: false, showImages: true, showSummary: true,
        showFilters: true, pageSize: 9, limit: 0, moreHref: '', headingLevel: 3, locale: '', labels: {},
        query: '', category: '', department: '', page: 1
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                search: 'Search',
                searchPlaceholder: 'Headline or keyword',
                searchNews: 'News search',
                searchIn: 'Search {title}',
                category: 'Category',
                allCategories: 'All categories',
                department: 'Department',
                allDepartments: 'All departments',
                countOne: '1 article',
                countMany: '{count} articles',
                showing: 'Showing {from}–{to} of {count} articles',
                matchCount: '{count} of {total} articles match',
                showingMatches: 'Showing {from}–{to} of {count} matching articles',
                noMatches: 'No articles match your search.',
                noNews: 'There is no news to show right now.',
                clear: 'Clear filters',
                news: 'News',
                listPage: '{name}, page {page} of {count}',
                pages: 'News pages',
                pagesOf: '{name} pages',
                previous: 'Previous',
                next: 'Next',
                pageLabel: 'Page {page}',
                pageOf: 'Page {page} of {count}',
                viewAll: 'View all news',
                untitled: '(untitled article)',
                file: 'File'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const item = n >= 1 && n <= 6 ? n : 3;
            return { title: Math.max(item - 1, 1), item };
        },

        activeLayout() {
            return this.layout === 'list' || this.layout === 'compact' ? this.layout : 'grid';
        },

        limited() {
            const n = Math.floor(Number(this.limit));
            return n > 0 ? n : 0;
        },

        filtersOn() {
            return !!this.showFilters && !this.limited;
        },

        // Two search landmarks (or two page navs) on one page need different names.
        searchName() {
            return this.title ? DzGlobal.format(this.ui.searchIn, { title: this.title }) : this.ui.searchNews;
        },

        pagesName() {
            return this.title ? DzGlobal.format(this.ui.pagesOf, { name: this.title }) : this.ui.pages;
        },

        // The categories option as lowercase names; empty = every category.
        onlyCategories() {
            const raw = Array.isArray(this.categories) ? this.categories : DzGlobal.text(this.categories).split(',');
            return raw.map(name => DzGlobal.text(name).trim().toLowerCase()).filter(Boolean);
        },

        // Newest first; same day A–Z. Articles without a title, or outside the categories option, are left out.
        articles() {
            const only = this.onlyCategories;
            const options = {
                ui: this.ui, href: this.detailsHref,
                date: DzGlobal.dateFormatter(this.locale, { month: 'short', day: 'numeric', year: 'numeric' })
            };
            return (Array.isArray(this.items) ? this.items : [])
                .map((item, index) => DzNews.normalize(item, index, options))
                .filter(article => article.found && (!only.length || only.includes(article.category.toLowerCase())))
                .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        },

        filtered() {
            return !!(this.query.trim() || this.category || this.department);
        },

        matches() {
            if (!this.filtersOn) return this.articles;
            const words = this.query.trim().toLowerCase().split(' ').filter(Boolean);
            return this.articles.filter(article => {
                if (this.category && article.category !== this.category) return false;
                if (this.department && article.department !== this.department) return false;
                const haystack = [article.title, article.summary, article.category, article.department].join(' ').toLowerCase();
                return words.every(word => haystack.includes(word));
            });
        },

        size() {
            if (this.limited) return 0;
            const n = Math.floor(Number(this.pageSize));
            return n > 0 ? n : 0;
        },

        pageCount() {
            return this.size ? Math.max(1, Math.ceil(this.matches.length / this.size)) : 1;
        },

        currentPage() {
            return Math.min(Math.max(1, Math.floor(Number(this.page)) || 1), this.pageCount);
        },

        pageItems() {
            const layout = this.activeLayout;
            let list = this.matches;
            if (this.limited) list = list.slice(0, this.limited);
            else if (this.size) list = list.slice((this.currentPage - 1) * this.size, this.currentPage * this.size);
            const feature = layout === 'grid' && this.featureFirst && this.currentPage === 1 && !this.filtered;
            return list.map((article, i) => ({
                ...article,
                cls: feature && i === 0 ? 'is-featured' : '',
                showImage: layout !== 'compact' && !!this.showImages && !!article.image.src,
                showSummary: layout !== 'compact' && !!this.showSummary && !!article.summary,
                showDepartment: layout !== 'compact' && !!article.department
            }));
        },

        pageEntries() {
            const current = this.currentPage;
            let gaps = 0;
            return DzGlobal.pageList(current, this.pageCount).map(page => ({
                key: page ? 'p' + page : 'gap' + (++gaps), page, current: page === current,
                label: page ? DzGlobal.format(this.ui.pageLabel, { page }) : ''
            }));
        },

        pageOfText() {
            return DzGlobal.format(this.ui.pageOf, { page: this.currentPage, count: this.pageCount });
        },

        listName() {
            const name = this.title || this.ui.news;
            return this.pageCount > 1 ? DzGlobal.format(this.ui.listPage, { name, page: this.currentPage, count: this.pageCount }) : name;
        },

        categoryOptions() {
            return this.optionsFor('category', this.category, this.ui.allCategories);
        },

        departmentOptions() {
            return this.optionsFor('department', this.department, this.ui.allDepartments);
        },

        countText() {
            const ui = this.ui;
            const count = this.matches.length;
            const start = this.size ? (this.currentPage - 1) * this.size : 0;
            const from = count ? start + 1 : 0;
            const to = count ? start + this.pageItems.length : 0;
            if (this.filtered) {
                return this.pageCount > 1
                    ? DzGlobal.format(ui.showingMatches, { from, to, count })
                    : DzGlobal.format(ui.matchCount, { count, total: this.articles.length });
            }
            if (this.pageCount > 1) return DzGlobal.format(ui.showing, { from, to, count });
            return count === 1 ? ui.countOne : DzGlobal.format(ui.countMany, { count });
        },

        emptyMessage() {
            return this.articles.length ? this.ui.noMatches : this.ui.noNews;
        }
    },

    methods: {
        // "All" plus each distinct value of a field, A–Z.
        optionsFor(field, current, allLabel) {
            const values = [...new Set(this.articles.map(article => article[field]).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            return [{ key: '~all', value: '', label: allLabel, selected: !current },
                    ...values.map(value => ({ key: value, value, label: value, selected: value === current }))];
        },

        onSearch(event) {
            this.query = event.target.value;
            this.page = 1;
        },

        onCategory(event) {
            this.category = event.target.value;
            this.page = 1;
        },

        onDepartment(event) {
            this.department = event.target.value;
            this.page = 1;
        },

        // Reset the search and filters and put focus back in the search box.
        clearFilters(event) {
            const root = event.target.getRootNode();
            this.query = '';
            this.category = '';
            this.department = '';
            this.page = 1;
            const input = root.querySelector('#nl-query');
            if (input) input.value = '';
            ['#nl-category', '#nl-department'].forEach(selector => {
                const select = root.querySelector(selector);
                if (select) select.value = '';
            });
            if (input) input.focus();
        },

        // Show another page, then move focus to the top of the list: the button pressed may
        // have just been disabled (Next on the last page), and the new articles start up there.
        async goTo(page, event) {
            const root = event.target.getRootNode();
            const count = this.pageCount;
            const target = Math.min(Math.max(1, Math.floor(Number(page)) || 1), count);
            if (target === this.currentPage) return;
            this.page = target;
            this.$emit('page-change', { page: target, pageCount: count });

            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            const list = root.querySelector('.nl-list');
            const top = root.querySelector('.nl');
            if (!list || !top) return;
            list.focus({ preventScroll: true });
            if (top.getBoundingClientRect().top < 0) {
                const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                top.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
            }
        },

        // Previous (-1) and Next (1).
        step(by, event) {
            return this.goTo(this.currentPage + by, event);
        },

        // A link still navigates (the router takes the click); this only reports it.
        open(article) {
            const list = DzGlobal.raw(this.items);
            const item = Array.isArray(list) ? list[article.index] : null;
            this.$emit('news-click', { article: item ? JSON.parse(JSON.stringify(item)) : null });
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .nl { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a);
              --nl-field-border: #8a8f9c; --nl-link: #4a4dd6; }
        .nl-glyph { display: block; flex: none; width: 1.1rem; height: 1.1rem; background: currentColor;
                    -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-search { --icon: var(--dz-icon-search); }
        .i-prev   { --icon: var(--dz-icon-chevron-left); }
        .i-next   { --icon: var(--dz-icon-chevron-right); }

        .nl-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem 1rem;
                  margin: 0 0 .75rem; }
        .nl-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.35rem; font-weight: 700;
                    color: var(--dz-color-heading, #1f2330); }
        .nl-count { margin: 0; font-size: .875rem; font-weight: 600; }

        /* ---- Search bar. Field borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1). */
        .nl-controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem; margin: 0 0 1rem; padding: .9rem;
                       border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px; background: var(--dz-color-bg, #f7f7fb); }
        .nl-field { flex: 1 1 11rem; min-width: 0; }
        .nl-search { flex: 3 1 16rem; }
        .nl-label { display: block; margin: 0 0 .3rem; font-size: .75rem; font-weight: 700; letter-spacing: .04em;
                    text-transform: uppercase; }
        .nl-search-box { position: relative; }
        .nl-search-box .nl-glyph { position: absolute; left: .65rem; top: 50%; margin-top: -.55rem; pointer-events: none;
                                   color: var(--dz-color-muted, #6b7180); }
        .nl-input, .nl-select { box-sizing: border-box; width: 100%; height: 2.5rem; border: 1px solid var(--nl-field-border);
                                border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem;
                                color: var(--dz-color-heading, #1f2330); }
        .nl-input { padding: 0 .75rem 0 2.1rem; }
        .nl-select { padding: 0 .5rem; cursor: pointer; }
        .nl-input:focus-visible, .nl-select:focus-visible, .nl-clear:focus-visible, .nl-step:focus-visible,
        .nl-page:focus-visible, .nl-list:focus-visible, .nl-more:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .nl-list:focus:not(:focus-visible) { outline: none; }

        /* ---- Cards. The headline's link covers the whole card. */
        .nl-list { margin: 0; padding: 0; list-style: none; }
        .nl-item { display: flex; min-width: 0; }
        .nl-card { position: relative; box-sizing: border-box; display: flex; flex: 1; flex-direction: column; min-width: 0;
                   overflow: hidden; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 12px;
                   background: var(--dz-color-surface, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
                   transition: box-shadow .15s ease, transform .15s ease; }
        .nl-card:hover { box-shadow: 0 12px 28px -14px rgba(0, 0, 0, .35); transform: translateY(-2px); }
        .nl-card:focus-within { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .nl-media { flex: none; aspect-ratio: 16 / 9; overflow: hidden; background: var(--dz-color-bg, #f7f7fb); }
        .nl-img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
        .nl-card:hover .nl-img { transform: scale(1.03); }
        .nl-body { display: flex; flex: 1; flex-direction: column; gap: .45rem; min-width: 0; padding: 1rem 1.1rem 1.1rem; }
        .nl-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .6rem; margin: 0; font-size: .8125rem; }
        /* Dark text on a light tint, 7:1. */
        .nl-chip { padding: .1rem .55rem; border-radius: 999px; background: #eeeefd; color: #3b3ec2; font-size: .75rem; font-weight: 700; }
        .nl-date { font-weight: 600; color: #555b69; }
        .nl-headline { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.125rem; font-weight: 700; line-height: 1.3; }
        .nl-link { padding: 0; border: 0; background: none; font: inherit; text-align: left; text-decoration: none; cursor: pointer;
                   color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .nl-link::after { content: ""; position: absolute; inset: 0; }
        .nl-link:focus-visible { outline: none; }
        .nl-card:hover .nl-link { color: var(--nl-link); text-decoration: underline; }
        .nl-summary { display: -webkit-box; margin: 0; overflow: hidden; font-size: .9rem; line-height: 1.55;
                      -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
        .nl-dept { margin: auto 0 0; padding-top: .35rem; font-size: .8125rem; font-weight: 600; color: #555b69; }

        /* Grid: as many ~18rem columns as fit. */
        .is-grid .nl-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr)); gap: 1rem; }
        /* Featured: the whole first row, image beside the text when there is room. */
        .is-grid .nl-item:has(> .is-featured) { grid-column: 1 / -1; }
        @container (min-width: 40rem) {
            .is-grid .nl-card.is-featured { flex-direction: row; }
            .is-grid .is-featured .nl-media { flex: 0 0 55%; aspect-ratio: auto; min-height: 17rem; }
            .is-grid .is-featured .nl-body { justify-content: center; padding: 1.5rem 1.75rem; }
            .is-grid .is-featured .nl-headline { font-size: 1.6rem; }
            .is-grid .is-featured .nl-summary { font-size: 1rem; -webkit-line-clamp: 4; }
            .is-grid .is-featured .nl-dept { margin-top: .25rem; }
        }

        /* List: a row per article, thumbnail on the left. */
        .is-list .nl-list { display: flex; flex-direction: column; gap: .75rem; }
        .is-list .nl-card { flex-direction: row; }
        .is-list .nl-media { flex: 0 0 min(15rem, 34%); aspect-ratio: 4 / 3; }
        .is-list .nl-dept { margin-top: 0; }
        @container (max-width: 30rem) {
            .is-list .nl-card { flex-direction: column; }
            .is-list .nl-media { flex-basis: auto; aspect-ratio: 16 / 9; }
        }

        /* Compact: headlines only, in one bordered box. */
        .is-compact .nl-list { border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 12px; background: var(--dz-color-surface, #fff); }
        .is-compact .nl-item + .nl-item { border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .is-compact .nl-card { border: 0; border-radius: 0; box-shadow: none; background: none; }
        .is-compact .nl-card:hover { transform: none; box-shadow: none; background: var(--dz-color-bg, #f7f7fb); }
        .is-compact .nl-item:first-child .nl-card { border-radius: 12px 12px 0 0; }
        .is-compact .nl-item:last-child .nl-card { border-radius: 0 0 12px 12px; }
        .is-compact .nl-item:only-child .nl-card { border-radius: 12px; }
        .is-compact .nl-card:focus-within { outline-offset: -2px; }
        .is-compact .nl-body { gap: .2rem; padding: .75rem 1rem; }
        .is-compact .nl-headline { font-size: 1rem; }

        .nl-empty { padding: 1.5rem 1rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px; text-align: center; }
        .nl-empty-text { margin: 0; font-style: italic; color: var(--dz-color-muted, #6b7180); }
        .nl-clear { margin-top: .75rem; padding: .45rem .9rem; border: 1px solid var(--nl-field-border); border-radius: 6px;
                    background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer;
                    color: var(--dz-color-heading, #1f2330); }
        .nl-clear:hover { background: var(--dz-color-bg, #f7f7fb); }

        .nl-more { display: inline-flex; align-items: center; gap: .2rem; margin-top: .9rem; padding: .35rem .2rem;
                   border-radius: 6px; font-weight: 700; text-decoration: none; color: var(--nl-link); }
        .nl-more:hover { text-decoration: underline; }

        /* ---- Pages. Buttons are 44px targets. */
        .nl-pages { display: flex; align-items: center; justify-content: center; gap: .5rem; margin: 1.1rem 0 0; }
        .nl-numbers { display: flex; align-items: center; gap: .25rem; margin: 0; padding: 0; list-style: none; }
        .nl-step, .nl-page { box-sizing: border-box; min-width: 2.75rem; height: 2.75rem; border: 1px solid transparent;
                             border-radius: 8px; background: none; font: inherit; font-size: .9375rem; font-weight: 600;
                             color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .nl-step { display: inline-flex; align-items: center; gap: .3rem; padding: 0 .75rem; border-color: var(--nl-field-border);
                   background: var(--dz-color-surface, #fff); }
        .nl-step.is-prev { padding-left: .45rem; }
        .nl-step.is-next { padding-right: .45rem; }
        .nl-page { padding: 0 .5rem; }
        .nl-step:hover:not(:disabled), .nl-page:hover:not(.is-current) { background: var(--dz-color-bg, #f7f7fb); border-color: var(--nl-field-border); }
        .nl-step:disabled { cursor: default; opacity: .45; }
        .nl-page.is-current { background: var(--nl-link); border-color: var(--nl-link); color: #fff; }
        .nl-gap { display: inline-block; min-width: 1.5rem; text-align: center; color: var(--dz-color-muted, #6b7180); }
        .nl-of { display: none; margin: 0 .25rem; font-size: .875rem; font-weight: 600; }
        @container (max-width: 34rem) {
            .nl-numbers { display: none; }
            .nl-of { display: block; }
            .nl-pages { justify-content: space-between; }
        }

        @media (prefers-reduced-motion: reduce) {
            .nl-card, .nl-img { transition: none; }
            .nl-card:hover { transform: none; }
            .nl-card:hover .nl-img { transform: none; }
        }
    `
});
