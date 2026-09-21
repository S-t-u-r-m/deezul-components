export default Deezul.Component({
    // DocumentList — a searchable, paged list of documents: forms, applications, budgets,
    // minutes, maps. Each row has a file icon showing the type, the document's display name
    // linking to the file, and its size, updated date and category.
    //
    // DATA: `items` comes from the CMS, which owns the files. Every field is optional except a
    // name and a way to link to the file:
    //   {
    //     id           the CMS document id, used by documentHref
    //     name         display name: 'Building Permit Application'
    //     href         a direct link; when blank, documentHref with {id} is used
    //     type         'PDF', 'docx' or a MIME type; blank = from fileName's extension
    //     fileName     the uploaded file's name, 'permit-application.pdf' (only read for the type)
    //     size         bytes (shown as KB / MB) or display text
    //     updated      'YYYY-MM-DD'
    //     category     'Permits'
    //     description  one or two lines of plain text
    //   }
    // A document with no name, or with no link at all, is left out. Links must be http(s), or a
    // site or relative path. They load the file itself, never a page of this app (data-no-router).
    //
    //   <dz-component dz-type="document_list" :title="'Forms and applications'" :items="documents"
    //                 :documentHref="'/api/documents/{id}'"></dz-component>
    //
    // FINDING ONE: a search box (every word must match the name, description, category, type
    // or file name), a category filter when there are two or more categories, a year filter when
    // the dates cover more than one year (an agendas or minutes archive), and a sort:
    // name A–Z or recently updated (when there are dates). Changing any of them goes back to
    // page 1. The count above the list is announced as it changes.
    //
    // PAGES: `pageSize` rows at a time, with Previous, Next and numbered page buttons (at most
    // seven, with gaps). Changing page moves focus to the top of the list. When narrow, the
    // numbers give way to "Page 2 of 6".
    //
    // OPTIONS:
    //   title          a heading above the list (blank = none)
    //   documentHref   link template for a document without its own href, e.g. '/api/documents/{id}'
    //   showFilters    the search, category and sort bar (default true)
    //   showYears      a year filter, when the documents' dates cover more than one year
    //                  (default true): an archive of agendas or minutes
    //   dateLabel      how the date reads, with {date}: 'Meeting {date}', 'Adopted {date}'
    //                  (blank = 'Updated {date}')
    //   sort           starting order: 'name' (default), 'newest' (updated date) or 'order' (as given)
    //   pageSize       rows per page (default 10; 0 = all on one page)
    //   newTab         open documents in a new tab, and say so to screen readers (default false)
    //   headingLevel   level of the title (default 2)
    //   locale         date names, e.g. 'fr-FR' (blank = the browser's)
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   document-click   { document }          a document link was followed; document is the item as passed in
    //   page-change      { page, pageCount }   the visitor went to another page
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js, and the --dz-icon-search,
    // -chevron-left and -chevron-right properties.
    schema: {
        inputs: {
            title:        { type: 'string', default: '', label: 'Title' },
            items:        { type: 'array', default: [], label: 'Documents' },
            documentHref: { type: 'string', default: '', label: 'Document link ({id} = document id)' },
            showFilters:  { type: 'boolean', default: true, label: 'Show search and filters' },
            showYears:    { type: 'boolean', default: true, label: 'Show the year filter (when the dates span years)' },
            dateLabel:    { type: 'string', default: '', label: 'Date wording, {date} (blank = Updated {date})' },
            sort:         { type: 'enum', options: ['name', 'newest', 'order'], default: 'name', label: 'Starting sort' },
            pageSize:     { type: 'number', default: 10, label: 'Documents per page (0 = all)' },
            newTab:       { type: 'boolean', default: false, label: 'Open documents in a new tab' },
            headingLevel: { type: 'number', default: 2, label: 'Title heading level' },
            locale:       { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Selects mark their current option with :selected;
    // clearing the filters also resets the controls directly (see clearFilters).
    template: html`
    <div class="doc" ref="root">
        <div class="doc-top">
            <p class="doc-title" :if="title" role="heading" :aria-level="level">{{ title }}</p>
            <p class="doc-count" role="status" aria-live="polite" aria-atomic="true">{{ view.countText }}</p>
        </div>

        <div class="doc-controls" :if="showFilters" role="search" :aria-label="searchName">
            <div class="doc-field doc-search">
                <label class="doc-label" for="doc-query">{{ ui.search }}</label>
                <div class="doc-search-box">
                    <span class="doc-glyph i-search" aria-hidden="true"></span>
                    <input class="doc-input" id="doc-query" type="search" autocomplete="off"
                           :placeholder="ui.searchPlaceholder" @input="onSearch($event)">
                </div>
            </div>
            <div class="doc-field" :if="view.categoryOptions.length > 2">
                <label class="doc-label" for="doc-category">{{ ui.category }}</label>
                <select class="doc-select" id="doc-category" @change="onCategory($event)">
                    <option :for="opt in view.categoryOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="doc-field" :if="view.yearOptions.length > 2">
                <label class="doc-label" for="doc-year">{{ ui.year }}</label>
                <select class="doc-select" id="doc-year" @change="onYear($event)">
                    <option :for="opt in view.yearOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="doc-field" :if="view.sortOptions.length > 1">
                <label class="doc-label" for="doc-sort">{{ ui.sortBy }}</label>
                <select class="doc-select" id="doc-sort" @change="onSort($event)">
                    <option :for="opt in view.sortOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
        </div>

        <ul class="doc-list" :if="view.pageItems.length" tabindex="-1" :aria-label="view.listName">
            <li class="doc-row" :for="doc in view.pageItems" :key="doc.key">
                <span class="doc-file" :class="'is-' + doc.kind" aria-hidden="true">
                    <span class="doc-sheet"></span>
                    <span class="doc-ext">{{ doc.badge }}</span>
                </span>
                <div class="doc-body">
                    <a class="doc-link" :href="doc.href" :target="doc.target" :rel="doc.rel" data-no-router
                       @click="open(doc)">{{ doc.name }}<span class="doc-sr">{{ doc.spoken }}</span></a>
                    <p class="doc-desc" :if="doc.description">{{ doc.description }}</p>
                    <p class="doc-meta" :if="doc.meta.length">
                        <span class="doc-meta-part" :for="part in doc.meta" :key="part.key" :aria-hidden="part.hidden">{{ part.text }}</span>
                    </p>
                </div>
            </li>
        </ul>

        <div class="doc-empty" :if="!view.pageItems.length">
            <p class="doc-empty-text">{{ view.emptyMessage }}</p>
            <button type="button" class="doc-clear" :if="view.filtered" @click="clearFilters($event)">{{ ui.clear }}</button>
        </div>

        <nav class="doc-pages" :if="view.pageCount > 1" :aria-label="pagesName">
            <button type="button" class="doc-step is-prev" :disabled="view.atFirst" @click="step(-1, $event)">
                <span class="doc-glyph i-prev" aria-hidden="true"></span><span>{{ ui.previous }}</span>
            </button>
            <ul class="doc-numbers">
                <li :for="entry in view.pageEntries" :key="entry.key">
                    <button type="button" class="doc-page" :if="entry.page" :class="entry.current ? 'is-current' : ''"
                            :aria-current="entry.current ? 'page' : 'false'" :aria-label="entry.label"
                            @click="goTo(entry.page, $event)">{{ entry.page }}</button>
                    <span class="doc-gap" :if="!entry.page" aria-hidden="true">…</span>
                </li>
            </ul>
            <p class="doc-of">{{ view.pageOfText }}</p>
            <button type="button" class="doc-step is-next" :disabled="view.atLast" @click="step(1, $event)">
                <span>{{ ui.next }}</span><span class="doc-glyph i-next" aria-hidden="true"></span>
            </button>
        </nav>
    </div>
    `,

    data: () => ({
        title: '', items: [], documentHref: '', showFilters: true, showYears: true, dateLabel: '', sort: 'name',
        pageSize: 10, newTab: false, headingLevel: 2, locale: '', labels: {},
        query: '', category: '', year: '', sortBy: '', page: 1
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                search: 'Search',
                searchPlaceholder: 'Document name or keyword',
                searchDocuments: 'Document search',
                searchIn: 'Search {title}',
                category: 'Category',
                allCategories: 'All categories',
                year: 'Year',
                allYears: 'All years',
                sortBy: 'Sort by',
                byName: 'Name A–Z',
                newest: 'Recently updated',
                given: 'Suggested order',
                countOne: '1 document',
                countMany: '{count} documents',
                showing: 'Showing {from}–{to} of {count} documents',
                matchCount: '{count} of {total} documents match',
                showingMatches: 'Showing {from}–{to} of {count} matching documents',
                noMatches: 'No documents match your search.',
                noDocuments: 'No documents have been posted yet.',
                clear: 'Clear filters',
                documents: 'Documents',
                listPage: '{name}, page {page} of {count}',
                updated: 'Updated {date}',
                opensNewTab: 'opens in a new tab',
                pages: 'Pages',
                pagesOf: '{name} pages',
                previous: 'Previous',
                next: 'Next',
                pageLabel: 'Page {page}',
                pageOf: 'Page {page} of {count}',
                file: 'File'
            }, this.labels);
        },

        level() {
            const n = Math.round(Number(this.headingLevel));
            return n >= 1 && n <= 6 ? n : 2;
        },

        // Two search landmarks (or two page navs) on one page need different names.
        searchName() {
            return this.title ? DzGlobal.format(this.ui.searchIn, { title: this.title }) : this.ui.searchDocuments;
        },

        pagesName() {
            return this.title ? DzGlobal.format(this.ui.pagesOf, { name: this.title }) : this.ui.pages;
        },

        // Everything the list draws, in ONE computed built from plain data. Deezul runtimes
        // before the computed-ordering fix (computedDiamond.test.js) left a chain like
        // matches → pageCount → currentPage → pageItems stale: a search from page 2 showed an
        // empty list. One computed works on every runtime.
        view() {
            const ui = this.ui;
            const documents = this.normalize(ui);
            const hasDates = documents.some(doc => doc.updated);
            const wanted = this.sortBy || this.sort;
            const activeSort = wanted === 'order' || (wanted === 'newest' && hasDates) ? wanted : 'name';
            const query = DzGlobal.text(this.query).trim().toLowerCase();
            const category = this.category;
            const year = this.year;
            const filtered = !!(query || category || year);

            const words = query.split(' ').filter(Boolean);
            const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            const orders = {
                name: byName,
                newest: (a, b) => b.updated.localeCompare(a.updated) || byName(a, b),
                order: (a, b) => a.index - b.index
            };
            const matches = documents
                .filter(doc => {
                    if (category && doc.category !== category) return false;
                    if (year && doc.updated.slice(0, 4) !== year) return false;
                    const haystack = [doc.name, doc.description, doc.category, doc.type, doc.fileName].join(' ').toLowerCase();
                    return words.every(word => haystack.includes(word));
                })
                .sort(orders[activeSort]);

            const n = Math.floor(Number(this.pageSize));
            const size = n > 0 ? n : 0;
            const count = matches.length;
            const pageCount = size ? Math.max(1, Math.ceil(count / size)) : 1;
            const currentPage = Math.min(Math.max(1, Math.floor(Number(this.page)) || 1), pageCount);
            const start = size ? (currentPage - 1) * size : 0;
            const pageItems = size ? matches.slice(start, start + size) : matches;
            const from = pageItems.length ? start + 1 : 0;
            const to = from ? start + pageItems.length : 0;

            let gaps = 0;
            const pageEntries = DzGlobal.pageList(currentPage, pageCount).map(page => ({
                key: page ? 'p' + page : 'gap' + (++gaps), page, current: page === currentPage,
                label: page ? DzGlobal.format(ui.pageLabel, { page }) : ''
            }));

            const categories = [...new Set(documents.map(doc => doc.category).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            const categoryOptions = [{ key: '~all', value: '', label: ui.allCategories, selected: !category },
                ...categories.map(value => ({ key: value, value, label: value, selected: value === category }))];
            // Years, newest first. Only worth a filter when the documents span more than one.
            const years = this.showYears
                ? [...new Set(documents.map(doc => doc.updated.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a))
                : [];
            const yearOptions = years.length > 1
                ? [{ key: '~allYears', value: '', label: ui.allYears, selected: !year },
                    ...years.map(value => ({ key: 'y' + value, value, label: value, selected: value === year }))]
                : [];
            const sortOptions = [
                this.sort === 'order' ? ['order', ui.given] : null,
                ['name', ui.byName],
                hasDates ? ['newest', ui.newest] : null
            ].filter(Boolean).map(([value, label]) => ({ key: value, value, label, selected: value === activeSort }));

            let countText;
            if (filtered) {
                countText = pageCount > 1
                    ? DzGlobal.format(ui.showingMatches, { from, to, count })
                    : DzGlobal.format(ui.matchCount, { count, total: documents.length });
            } else if (pageCount > 1) {
                countText = DzGlobal.format(ui.showing, { from, to, count });
            } else {
                countText = count === 1 ? ui.countOne : DzGlobal.format(ui.countMany, { count });
            }

            const name = this.title || ui.documents;
            return {
                filtered, pageItems, pageCount, currentPage, pageEntries, categoryOptions, yearOptions, sortOptions, countText,
                atFirst: currentPage <= 1, atLast: currentPage >= pageCount,
                pageOfText: DzGlobal.format(ui.pageOf, { page: currentPage, count: pageCount }),
                listName: pageCount > 1 ? DzGlobal.format(ui.listPage, { name, page: currentPage, count: pageCount }) : name,
                emptyMessage: documents.length ? ui.noMatches : ui.noDocuments
            };
        }
    },

    methods: {
        // The documents as the rows draw them; those without a name or a link are left out.
        normalize(ui) {
            const t = value => DzGlobal.text(value).trim();
            const dateFormat = DzGlobal.dateFormatter(this.locale, { month: 'short', day: 'numeric', year: 'numeric' });
            const template = t(this.documentHref);
            const newTab = !!this.newTab;
            return (Array.isArray(this.items) ? this.items : []).map((raw, index) => {
                const item = raw && typeof raw === 'object' ? raw : {};
                const id = t(item.id);
                const href = DzGlobal.safeHref(item.href)
                    || (template && id ? DzGlobal.safeHref(template.split('{id}').join(encodeURIComponent(id))) : '');
                const type = DzGlobal.fileType(item.type, item.fileName, item.href);
                const size = DzGlobal.fileSize(item.size);
                const updated = DzGlobal.parseDate(t(item.updated)) ? t(item.updated).slice(0, 10) : '';
                const category = t(item.category);
                const spoken = [type, size, newTab ? ui.opensNewTab : ''].filter(Boolean);
                // Type and size are already in the link's name for screen readers.
                const meta = [
                    { key: 'type', text: type, hidden: 'true' },
                    { key: 'size', text: size, hidden: 'true' },
                    { key: 'updated', text: updated ? DzGlobal.format(t(this.dateLabel) || ui.updated, { date: dateFormat.format(DzGlobal.parseDate(updated)) }) : '', hidden: 'false' },
                    { key: 'category', text: category, hidden: 'false' }
                ].filter(part => part.text);
                return {
                    key: (id || 'doc') + '~' + index, index, id, name: t(item.name), href, type, size, updated, category,
                    description: t(item.description), fileName: t(item.fileName),
                    kind: DzGlobal.fileKind(type), badge: type && type.length <= 4 ? type : ui.file.toUpperCase().slice(0, 4),
                    spoken: spoken.length ? ' (' + spoken.join(', ') + ')' : '', meta,
                    target: newTab ? '_blank' : '_self', rel: newTab ? 'noopener' : ''
                };
            }).filter(doc => doc.name && doc.href);
        },

        onSearch(event) {
            this.query = event.target.value;
            this.page = 1;
        },

        onCategory(event) {
            this.category = event.target.value;
            this.page = 1;
        },

        onYear(event) {
            this.year = event.target.value;
            this.page = 1;
        },

        onSort(event) {
            this.sortBy = event.target.value;
            this.page = 1;
        },

        // Reset the search, category and year (not the sort) and put focus back in the search box.
        clearFilters(event) {
            const root = event.target.getRootNode();
            this.query = '';
            this.category = '';
            this.year = '';
            this.page = 1;
            const input = root.querySelector('#doc-query');
            if (input) input.value = '';
            ['#doc-category', '#doc-year'].forEach(selector => {
                const select = root.querySelector(selector);
                if (select) select.value = '';
            });
            if (input) input.focus();
        },

        // Show another page, then move focus to the top of the list: the button pressed may
        // have just been disabled (Next on the last page), and the new rows start up there.
        async goTo(page, event) {
            const root = event.target.getRootNode();
            const { pageCount: count, currentPage } = this.view;
            const target = Math.min(Math.max(1, Math.floor(Number(page)) || 1), count);
            if (target === currentPage) return;
            this.page = target;
            this.$emit('page-change', { page: target, pageCount: count });

            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            const list = root.querySelector('.doc-list');
            const top = root.querySelector('.doc');
            if (!list || !top) return;
            list.focus({ preventScroll: true });
            if (top.getBoundingClientRect().top < 0) {
                const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                top.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
            }
        },

        // Previous (-1) and Next (1).
        step(by, event) {
            return this.goTo(this.view.currentPage + by, event);
        },

        // The link still loads the file; this only reports it.
        open(doc) {
            const list = DzGlobal.raw(this.items);
            const item = Array.isArray(list) ? list[doc.index] : null;
            this.$emit('document-click', { document: item ? JSON.parse(JSON.stringify(item)) : null });
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .doc { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a);
               --doc-field-border: #8a8f9c; --doc-link: #4a4dd6; }
        .doc-glyph { display: block; flex: none; width: 1.1rem; height: 1.1rem; background: currentColor;
                     -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-search { --icon: var(--dz-icon-search); }
        .i-prev   { --icon: var(--dz-icon-chevron-left); }
        .i-next   { --icon: var(--dz-icon-chevron-right); }
        .doc-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
                  clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

        .doc-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem 1rem;
                   margin: 0 0 .75rem; }
        .doc-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.35rem; font-weight: 700;
                     color: var(--dz-color-heading, #1f2330); }
        .doc-count { margin: 0; font-size: .875rem; font-weight: 600; }

        /* ---- Search bar. Field borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1). */
        .doc-controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem; margin: 0 0 1rem; padding: .9rem;
                        border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px; background: var(--dz-color-bg, #f7f7fb); }
        .doc-field { flex: 1 1 10rem; min-width: 0; }
        .doc-search { flex: 3 1 16rem; }
        .doc-label { display: block; margin: 0 0 .3rem; font-size: .75rem; font-weight: 700; letter-spacing: .04em;
                     text-transform: uppercase; }
        .doc-search-box { position: relative; }
        .doc-search-box .doc-glyph { position: absolute; left: .65rem; top: 50%; margin-top: -.55rem; pointer-events: none;
                                     color: var(--dz-color-muted, #6b7180); }
        .doc-input, .doc-select { box-sizing: border-box; width: 100%; height: 2.5rem; border: 1px solid var(--doc-field-border);
                                  border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem;
                                  color: var(--dz-color-heading, #1f2330); }
        .doc-input { padding: 0 .75rem 0 2.1rem; }
        .doc-select { padding: 0 .5rem; cursor: pointer; }
        .doc-input:focus-visible, .doc-select:focus-visible, .doc-clear:focus-visible, .doc-step:focus-visible,
        .doc-page:focus-visible, .doc-list:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .doc-list:focus:not(:focus-visible) { outline: none; }

        /* ---- Rows. The name's link covers the whole row. */
        .doc-list { margin: 0; padding: 0; list-style: none; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px;
                    background: var(--dz-color-surface, #fff); }
        .doc-row { position: relative; display: flex; align-items: flex-start; gap: 1rem; padding: .85rem 1.1rem;
                   transition: background-color .15s ease; }
        .doc-row + .doc-row { border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .doc-row:first-child { border-radius: 10px 10px 0 0; }
        .doc-row:last-child { border-radius: 0 0 10px 10px; }
        .doc-row:only-child { border-radius: 10px; }
        .doc-row:hover { background: var(--dz-color-bg, #f7f7fb); }
        .doc-row:focus-within { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: -2px; }
        .doc-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .2rem; }
        .doc-link { font-weight: 600; font-size: 1rem; line-height: 1.35; color: var(--doc-link); text-decoration: none;
                    overflow-wrap: anywhere; }
        .doc-link::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
        .doc-link:focus-visible { outline: none; }
        .doc-row:hover .doc-link { text-decoration: underline; }
        .doc-desc { display: -webkit-box; margin: 0; overflow: hidden; font-size: .875rem; line-height: 1.5;
                    -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        /* Every part has its dot in the gap before it; the list is pulled left by one gap and
           clipped there, so the dot of a part that starts a line is cut off. */
        .doc-meta { display: flex; flex-wrap: wrap; margin: .1rem 0 0 -1rem; font-size: .8125rem; color: #555b69;
                    clip-path: inset(0 0 0 1rem); }
        .doc-meta-part { position: relative; margin-left: 1rem; }
        .doc-meta-part::before { content: "·"; position: absolute; left: -1rem; width: 1rem; text-align: center; }

        /* ---- File icon: a sheet with a folded corner, tinted by type, and the type on a tab.
           White on every tab color is at least 5:1. */
        .doc-file { position: relative; flex: none; width: 2.2rem; height: 2.7rem; margin: .1rem .15rem 0 .2rem;
                    --kind: #475467; --tint: #eef0f3; }
        .doc-file.is-pdf     { --kind: #b42318; --tint: #fdecea; }
        .doc-file.is-word    { --kind: #1d5bbf; --tint: #e8f0fc; }
        .doc-file.is-sheet   { --kind: #1a7f45; --tint: #e6f4ec; }
        .doc-file.is-slides  { --kind: #b54708; --tint: #fdf0e4; }
        .doc-file.is-image   { --kind: #6d3fc0; --tint: #f0eafb; }
        .doc-file.is-media   { --kind: #0e7490; --tint: #e3f4f7; }
        .doc-sheet { position: absolute; inset: 0; border-radius: 4px; background: var(--tint);
                     box-shadow: inset 0 0 0 1.5px var(--kind);
                     clip-path: polygon(0 0, 66% 0, 100% 28%, 100% 100%, 0 100%); }
        .doc-sheet::before { content: ""; position: absolute; top: 0; right: 0; width: 34%; height: 28%;
                             background: var(--kind); opacity: .45; border-bottom-left-radius: 3px; }
        .doc-ext { position: absolute; left: -.35rem; bottom: .4rem; padding: .08rem .25rem; border-radius: 3px;
                   background: var(--kind); color: #fff; font-size: .58rem; font-weight: 800; line-height: 1.2;
                   letter-spacing: .02em; }

        .doc-empty { padding: 1.5rem 1rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px; text-align: center; }
        .doc-empty-text { margin: 0; font-style: italic; color: var(--dz-color-muted, #6b7180); }
        .doc-clear { margin-top: .75rem; padding: .45rem .9rem; border: 1px solid var(--doc-field-border); border-radius: 6px;
                     background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer;
                     color: var(--dz-color-heading, #1f2330); }
        .doc-clear:hover { background: var(--dz-color-bg, #f7f7fb); }

        /* ---- Pages. Buttons are 44px targets. */
        .doc-pages { display: flex; align-items: center; justify-content: center; gap: .5rem; margin: 1rem 0 0; }
        .doc-numbers { display: flex; align-items: center; gap: .25rem; margin: 0; padding: 0; list-style: none; }
        .doc-step, .doc-page { box-sizing: border-box; min-width: 2.75rem; height: 2.75rem; border: 1px solid transparent;
                               border-radius: 8px; background: none; font: inherit; font-size: .9375rem; font-weight: 600;
                               color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .doc-step { display: inline-flex; align-items: center; gap: .3rem; padding: 0 .75rem; border-color: var(--doc-field-border);
                    background: var(--dz-color-surface, #fff); }
        .doc-step.is-prev { padding-left: .45rem; }
        .doc-step.is-next { padding-right: .45rem; }
        .doc-page { padding: 0 .5rem; }
        .doc-step:hover:not(:disabled), .doc-page:hover:not(.is-current) { background: var(--dz-color-bg, #f7f7fb); border-color: var(--doc-field-border); }
        .doc-step:disabled { cursor: default; opacity: .45; }
        .doc-page.is-current { background: var(--doc-link); border-color: var(--doc-link); color: #fff; }
        .doc-gap { display: inline-block; min-width: 1.5rem; text-align: center; color: var(--dz-color-muted, #6b7180); }
        .doc-of { display: none; margin: 0 .25rem; font-size: .875rem; font-weight: 600; }

        @container (max-width: 34rem) {
            .doc-row { gap: .8rem; padding: .8rem .85rem; }
            .doc-numbers { display: none; }
            .doc-of { display: block; }
            .doc-pages { justify-content: space-between; }
        }
    `
});
