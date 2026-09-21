export default Deezul.Component({
    // ServiceList — the "What do you want to do?" page: every service a resident can start, in
    // sections by topic or by letter, with a search box over the lot and an optional "Most
    // requested" shelf on top.
    //
    // A SERVICE is a thing to DO ("Pay property taxes"), not a department. The department is shown
    // beside it so people know who they are dealing with, and links to it if `departmentHref` is
    // given.
    //
    // DATA: `items` comes from the CMS. Every field is optional except a name and a link:
    //   {
    //     id           the CMS id
    //     name         'Pay property taxes'
    //     href         where it starts: a page, a form, an outside system
    //     description  one line on what it is
    //     category     the topic it files under: 'Taxes and payments'
    //     tags         how it can be done: ['Online', 'Form', 'Pay', 'In person', 'Phone']
    //     department   'County Treasurer'
    //     keywords     words people search for that aren't in the text ('foia, open records')
    //     popular      true to put it in "Most requested"
    //   }
    //
    //   <dz-component dz-type="service_list" :items="services" :title="'Services A–Z'"></dz-component>
    //
    // SEARCH looks at the name, description, topic, tags, department and keywords; every word has
    // to match, so "pay water" finds only the water bill. The count is announced as it changes.
    //
    // Everything is on one page: a services index is made to be searched or scanned in one go,
    // including with the browser's own find.
    //
    // OPTIONS:
    //   items            the services (above)
    //   title            a heading above the list (blank = none)
    //   groupBy          'category' (default: sections by topic), 'letter' (A, B, C ...) or 'none'
    //   groups           the topics in the order to show them, for topics that don't belong in
    //                    alphabetical order: ['Taxes and payments', ...] or 'a, b' as one string.
    //                    Topics left out follow, A–Z; services with no topic come last
    //   showPopular      a "Most requested" shelf of the services marked popular (default true)
    //   popularLimit     most services on that shelf (default 6)
    //   showSearch       the search box (default true)
    //   showFilter       a topic filter, when groupBy is not 'category' (default true)
    //   showTags         the Online / Form / Pay chips (default true)
    //   departmentHref   link template for a department page, '{department}' = its name, url-encoded
    //                    (blank = the department is plain text)
    //   headingLevel     level of the title (default 2); sections and names follow below
    //   labels           text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   service-click   { service }   a service was opened; service is the item as passed in
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js, and the --dz-icon-search and
    // -chevron-right properties (assets/icons.css).
    schema: {
        inputs: {
            items:          { type: 'array', default: [], label: 'Services' },
            title:          { type: 'string', default: '', label: 'Heading (blank = none)' },
            groupBy:        { type: 'enum', options: ['category', 'letter', 'none'], default: 'category', label: 'Sections' },
            groups:         { type: 'array', default: [], label: 'Topics in the order to show them' },
            showPopular:    { type: 'boolean', default: true, label: 'Show "Most requested"' },
            popularLimit:   { type: 'number', default: 6, label: 'Most services in "Most requested"' },
            showSearch:     { type: 'boolean', default: true, label: 'Show search' },
            showFilter:     { type: 'boolean', default: true, label: 'Show the topic filter' },
            showTags:       { type: 'boolean', default: true, label: 'Show the Online / Form / Pay chips' },
            departmentHref: { type: 'string', default: '', label: 'Department link ({department} = its name)' },
            headingLevel:   { type: 'number', default: 2, label: 'Heading level' },
            labels:         { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. The search box and the filter keep their own values in
    // the DOM (no :value binding); clearFilters resets them by id.
    template: html`
    <div class="sv" ref="root">
        <div class="sv-head">
            <p class="sv-title" :if="title" role="heading" :aria-level="levels.title">{{ title }}</p>
            <div class="sv-tools" :if="hasSearch || hasFilter">
                <div class="sv-field sv-search" :if="hasSearch">
                    <label class="sv-label" for="sv-query">{{ ui.search }}</label>
                    <span class="sv-glyph i-search" aria-hidden="true"></span>
                    <input class="sv-input" id="sv-query" type="search" :placeholder="ui.searchPlaceholder"
                           autocomplete="off" @input="onQuery($event)">
                </div>
                <div class="sv-field" :if="hasFilter">
                    <label class="sv-label" for="sv-topic">{{ ui.topic }}</label>
                    <select class="sv-select" id="sv-topic" @change="onTopic($event)">
                        <option value="" :for="option in topicOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                </div>
            </div>
            <p class="sv-count" role="status" aria-live="polite">{{ countText }}</p>
        </div>

        <section class="sv-popular" :if="popular.length">
            <p class="sv-section-title" role="heading" :aria-level="levels.section">{{ ui.popular }}</p>
            <ul class="sv-shelf">
                <li :for="service in popular" :key="service.key">
                    <a class="sv-tile" :href="service.href" @click="open(service)">
                        <span class="sv-tile-name">{{ service.name }}</span>
                        <span class="sv-glyph i-go" aria-hidden="true"></span>
                    </a>
                </li>
            </ul>
        </section>

        <div class="sv-sections">
            <section class="sv-section" :for="section in sections" :key="section.key">
                <p class="sv-section-title" :if="section.label" role="heading" :aria-level="levels.section">{{ section.label }}</p>
                <ul class="sv-list">
                    <li class="sv-row" :for="service in section.rows" :key="service.key">
                        <p class="sv-name" role="heading" :aria-level="levels.name">
                            <a class="sv-link" :href="service.href" @click="open(service)">{{ service.name }}</a>
                        </p>
                        <p class="sv-desc" :if="service.description">{{ service.description }}</p>
                        <p class="sv-meta" :if="service.tags.length || service.department">
                            <span class="sv-tag" :for="tag in service.tags" :key="tag.key">{{ tag.text }}</span>
                            <span class="sv-dept" :if="service.department && !service.departmentHref">{{ service.department }}</span>
                            <a class="sv-dept sv-dept-link" :if="service.departmentHref" :href="service.departmentHref">{{ service.department }}</a>
                        </p>
                    </li>
                </ul>
            </section>
        </div>

        <div class="sv-empty" :if="!count">
            <p class="sv-empty-text">{{ emptyText }}</p>
            <button type="button" class="sv-clear" :if="filtering" @click="clearFilters()">{{ ui.clear }}</button>
        </div>
    </div>
    `,

    data: () => ({
        items: [], title: '', groupBy: 'category', groups: [], showPopular: true, popularLimit: 6,
        showSearch: true, showFilter: true, showTags: true, departmentHref: '', headingLevel: 2, labels: {},
        query: '', topic: ''
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                search: 'Search services',
                searchPlaceholder: 'What do you want to do?',
                topic: 'Topic',
                allTopics: 'All topics',
                popular: 'Most requested',
                other: 'Other',
                countOne: '1 service',
                countMany: '{count} services',
                countMatches: '{count} of {total} services match',
                countOneMatch: '1 of {total} services matches',
                noServices: 'No services to show yet.',
                noMatches: 'No services match. Try fewer words, or a different topic.',
                clear: 'Clear search'
            }, this.labels);
        },

        // The title, then section headings, then each service's name. Without sections the names
        // move up one, so the levels never skip a step.
        levels() {
            const n = Math.round(Number(this.headingLevel));
            const title = n >= 1 && n <= 6 ? n : 2;
            const section = Math.min(title + 1, 6);
            return { title, section, name: Math.min(this.sectionMode === 'none' ? section : title + 2, 6) };
        },

        // What the sections really are: asking for topics when nothing has one would put every
        // service under "Other", so that falls back to letters.
        sectionMode() {
            if (this.groupBy === 'none') return 'none';
            if (this.groupBy === 'letter') return 'letter';
            return this.entries.some(entry => entry.category) ? 'category' : 'letter';
        },

        // One entry per service: what the row draws, plus what this list sorts, groups and searches on.
        entries() {
            const list = Array.isArray(this.items) ? this.items : [];
            const template = DzGlobal.text(this.departmentHref).trim();
            return list
                .map((raw, index) => {
                    const item = DzGlobal.raw(raw);
                    if (!item || typeof item !== 'object') return null;
                    const name = DzGlobal.text(item.name).trim();
                    const href = DzGlobal.safeHref(item.href);
                    if (!name || !href) return null;
                    const category = DzGlobal.text(item.category).trim();
                    const department = DzGlobal.text(item.department).trim();
                    const tags = (Array.isArray(item.tags) ? item.tags : [])
                        .map(tag => DzGlobal.text(tag).trim())
                        .filter(Boolean)
                        .map((text, at) => ({ key: text + '#' + at, text }));
                    const words = [name, item.description, category, department, item.keywords, tags.map(tag => tag.text).join(' ')]
                        .map(value => DzGlobal.text(value)).join(' ').toLowerCase();
                    return {
                        key: (DzGlobal.text(item.id).trim() || 's' + index) + '~' + index,
                        index, name, href, category, department,
                        description: DzGlobal.text(item.description).trim(),
                        tags: this.showTags ? tags : [],
                        departmentHref: department && template
                            ? DzGlobal.safeHref(template.split('{department}').join(encodeURIComponent(department)))
                            : '',
                        popular: item.popular === true,
                        letter: this.letterOf(name),
                        text: words
                    };
                })
                .filter(Boolean);
        },

        // The topics in the data, in `groups` order, then the rest A–Z.
        topicOptions() {
            const seen = [];
            this.entries.forEach(entry => {
                if (entry.category && !seen.includes(entry.category)) seen.push(entry.category);
            });
            seen.sort((a, b) => this.compareTopics(a, b));
            return [{ value: '', label: this.ui.allTopics }, ...seen.map(topic => ({ value: topic, label: topic }))];
        },

        hasSearch() {
            return !!this.showSearch && this.entries.length > 1;
        },

        // No point in the filter when the sections already are the topics.
        hasFilter() {
            return !!this.showFilter && this.sectionMode !== 'category' && this.topicOptions.length > 2;
        },

        filtering() {
            return !!this.query.trim() || !!this.topic;
        },

        // The services to show, A–Z, after the search and the filter.
        matches() {
            const words = this.query.toLowerCase().split(' ').map(word => word.trim()).filter(Boolean);
            const topic = this.topic;
            return this.entries
                .filter(entry => {
                    if (topic && entry.category !== topic) return false;
                    return words.every(word => entry.text.includes(word));
                })
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || a.index - b.index);
        },

        count() {
            return this.matches.length;
        },

        // "Most requested": only while nothing is filtered, so the shelf never repeats a search.
        popular() {
            if (!this.showPopular || this.filtering) return [];
            const limit = Math.floor(Number(this.popularLimit));
            const shelf = this.matches.filter(entry => entry.popular);
            return limit > 0 ? shelf.slice(0, limit) : shelf;
        },

        // A section per topic or per letter, each holding its rows A–Z. Topics read in `groups`
        // order, then A–Z; a service with no topic, or a name that doesn't start with a letter,
        // comes last.
        sections() {
            if (this.sectionMode === 'none') {
                return this.count ? [{ key: 'all', label: '', rows: this.matches }] : [];
            }
            const byLetter = this.sectionMode === 'letter';
            const groups = new Map();
            this.matches.forEach(entry => {
                const label = byLetter ? entry.letter : (entry.category || this.ui.other);
                if (!groups.has(label)) groups.set(label, []);
                groups.get(label).push(entry);
            });
            const last = byLetter ? '#' : this.ui.other;
            const labels = [...groups.keys()].sort((a, b) => {
                if ((a === last) !== (b === last)) return a === last ? 1 : -1;
                return byLetter ? a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) : this.compareTopics(a, b);
            });
            return labels.map((label, index) => ({ key: 's' + index + '~' + label, label, rows: groups.get(label) }));
        },

        countText() {
            const ui = this.ui;
            const total = this.entries.length;
            const count = this.count;
            if (!total) return '';
            if (!this.filtering) return count === 1 ? ui.countOne : DzGlobal.format(ui.countMany, { count });
            if (count === 1) return DzGlobal.format(ui.countOneMatch, { total });
            return DzGlobal.format(ui.countMatches, { count, total });
        },

        emptyText() {
            return this.entries.length ? this.ui.noMatches : this.ui.noServices;
        }
    },

    methods: {
        // The section a name goes in: its first letter, or '#' for anything else.
        letterOf(name) {
            const first = name.trim().charAt(0).toUpperCase();
            return first >= 'A' && first <= 'Z' ? first : '#';
        },

        // Two topics in reading order: the ones named in `groups` first, then the rest A–Z.
        compareTopics(a, b) {
            const given = DzGlobal.raw(this.groups);
            const list = Array.isArray(given) ? given : DzGlobal.text(given).split(',');
            const order = list.map(name => DzGlobal.text(name).trim().toLowerCase()).filter(Boolean);
            const rank = name => {
                const at = order.indexOf(DzGlobal.text(name).trim().toLowerCase());
                return at < 0 ? order.length : at;
            };
            return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        },

        onQuery(event) {
            this.query = event.target.value;
        },

        onTopic(event) {
            this.topic = event.target.value;
        },

        clearFilters() {
            const root = DzGlobal.raw(this.$refs.root);
            this.query = '';
            this.topic = '';
            const box = root && root.querySelector('#sv-query');
            const select = root && root.querySelector('#sv-topic');
            if (box) box.value = '';
            if (select) select.value = '';
            if (box) box.focus();
        },

        // The link still navigates (the router takes the click); this only reports it.
        open(service) {
            const list = DzGlobal.raw(this.items);
            const item = Array.isArray(list) ? list[service.index] : null;
            this.$emit('service-click', { service: item ? JSON.parse(JSON.stringify(item)) : null });
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .sv { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a);
              --sv-link: #3b3ec2; }

        /* ---- Head: the title, the search box and the filter, then the live count. */
        .sv-title { margin: 0 0 .85rem; font-family: var(--dz-font-heading, inherit); font-size: 1.5rem; font-weight: 650;
                    letter-spacing: -.01em; color: var(--dz-color-heading, #1f2330); }
        .sv-tools { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem; }
        .sv-field { display: flex; position: relative; flex: 1 1 12rem; flex-direction: column; gap: .3rem; min-width: 0; }
        .sv-search { flex: 2 1 18rem; }
        .sv-label { font-size: .8125rem; font-weight: 650; color: #454a57; }
        .sv-glyph { display: block; width: 1.1rem; height: 1.1rem; background: currentColor;
                    -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-search { --icon: var(--dz-icon-search); }
        .i-go { --icon: var(--dz-icon-chevron-right); }
        .sv-search .sv-glyph { position: absolute; left: .7rem; bottom: .8rem; color: #6b7180; }
        /* Borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1 for controls). */
        .sv-input, .sv-select { box-sizing: border-box; width: 100%; min-height: 2.75rem; padding: .5rem .75rem;
                                border: 1px solid #8a8f9c; border-radius: 10px; background: var(--dz-color-surface, #fff);
                                font: inherit; font-size: .9375rem; color: var(--dz-color-heading, #1f2330); }
        .sv-input { padding-left: 2.35rem; }
        .sv-input:focus-visible, .sv-select:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px;
                                                            border-color: var(--dz-color-primary, #5b5ef0); }
        .sv-count { margin: .7rem 0 0; font-size: .875rem; color: #555b69; }
        .sv-count:empty { display: none; }

        /* ---- Most requested: big tiles, the whole tile a link. */
        .sv-popular { margin-top: 1.5rem; }
        .sv-shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: .6rem;
                    margin: 0; padding: 0; list-style: none; }
        .sv-tile { display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 3.5rem;
                   padding: .75rem 1rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 12px;
                   background: var(--dz-color-surface, #fff); color: var(--sv-link); font-weight: 650;
                   text-decoration: none; transition: border-color .15s ease, background-color .15s ease; }
        .sv-tile:hover { border-color: var(--sv-link); background: #f2f3ff; }
        .sv-tile .sv-glyph { flex: none; }

        /* ---- Sections and rows. */
        .sv-section { margin-top: 1.75rem; }
        .sv-section-title { margin: 0 0 .75rem; padding-bottom: .3rem; border-bottom: 2px solid var(--dz-color-border, #e4e6ee);
                            font-family: var(--dz-font-heading, inherit); font-size: 1.1rem; font-weight: 700;
                            color: var(--dz-color-heading, #1f2330); }
        .sv-list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
        @container (min-width: 46rem) {
            .sv-list { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 2rem; }
        }
        .sv-row { padding: .7rem 0; border-bottom: 1px solid var(--dz-color-border, #eceef4); }
        .sv-name { margin: 0; font-size: 1rem; font-weight: 650; line-height: 1.4; }
        .sv-link { color: var(--sv-link); text-decoration: none; text-underline-offset: 3px; }
        .sv-link:hover { text-decoration: underline; }
        .sv-link:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 3px; border-radius: 4px; }
        .sv-desc { margin: .2rem 0 0; font-size: .875rem; line-height: 1.5; color: #454a57; }
        .sv-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .5rem; margin: .4rem 0 0; font-size: .8125rem; }
        .sv-tag { padding: .1rem .5rem; border: 1px solid #cdd1dd; border-radius: 999px; background: var(--dz-color-bg, #f3f4f8);
                  font-weight: 650; color: #454a57; }
        .sv-dept { color: #555b69; }
        .sv-dept-link { color: var(--sv-link); text-underline-offset: 2px; }

        .sv-empty { margin-top: 1.25rem; padding: 1.75rem 1.25rem; border: 1px dashed var(--dz-color-border, #d9dce5);
                    border-radius: 12px; text-align: center; }
        .sv-empty-text { margin: 0; color: #555b69; }
        .sv-clear { min-height: 2.75rem; margin-top: .85rem; padding: 0 1.1rem; border: 1px solid #8a8f9c; border-radius: 999px;
                    background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem; font-weight: 650;
                    color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .sv-clear:hover { background: var(--dz-color-bg, #f3f4f8); }
        .sv-clear:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 3px; }

        @container (max-width: 34rem) {
            .sv-field, .sv-search { flex: 1 1 100%; }
        }
    `
});
