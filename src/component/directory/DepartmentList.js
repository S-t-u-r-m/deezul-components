export default Deezul.Component({
    // DepartmentList — the departments A–Z page: every department with how to reach it, in
    // sections by first letter (or by service area), with a search box over the lot.
    //
    // Each department is a department_card in its compact variant, so a row shows the name (a
    // link to its page), whether it is open now, today's hours, the phone number and the address,
    // and the hours logic lives in one place.
    //
    // DATA: `items` is a list of departments, each one exactly as department_card takes it (name,
    // href, description, phone, email, address, hours, closures, closedMessage, ...) plus:
    //   group      a service area, for grouping and the filter: 'Public safety'
    //   order      a number to sort by, for a hand-made order (sort 'order')
    //   keywords   extra words search should find, 'dog licences, kennel' — never shown
    //
    //   <dz-component dz-type="department_list" :items="departments" :timeZone="'America/New_York'"></dz-component>
    //
    // SEARCH looks at the name, description, service area, keywords, the head's name and the
    // phone number; every word has to match somewhere, so "health clinic" finds only rows with
    // both. The count under the box is announced as it changes.
    //
    // EVERY department is on the page: there are no pages to click through, because an A–Z index
    // is meant to be searched (or found with the browser's own find) in one go.
    //
    // OPTIONS:
    //   items         the departments (above)
    //   title         a heading above the list (blank = none)
    //   groupBy       'group' (default: sections by service area), 'letter' (A, B, C ...) or 'none'.
    //                 With 'group' and no department carrying an area, it falls back to letters
    //   groups        the service areas in the order to show them, for areas that don't belong in
    //                 alphabetical order: ['Public safety', 'Health and family'] or the same as
    //                 'Public safety, Health and family'. Areas left out follow, A–Z; departments
    //                 with no area come last. It orders the sections and the filter, and hides
    //                 nothing
    //   sort          'name' (default) or 'order' (the order field, then name)
    //   layout        'grid' (default: cards, several across when there is room) or 'rows'
    //   showSearch    the search box (default true)
    //   showFilter    a service-area filter, when the departments have areas and groupBy is not
    //                 'group' (default true)
    //   showStatus    "Open now" on each row (default true)
    //   showDescription  what each department does, under its name (default true)
    //   headingLevel  level of the title (default 2); section and department names follow below
    //   timeZone      the offices' IANA time zone, e.g. 'America/New_York' (blank = the visitor's)
    //   now           show it at a moment, 'YYYY-MM-DDTHH:mm' (blank = now); for the CMS and tests
    //   locale        day and time names (blank = the browser's)
    //   labels        text overrides; see the `ui` computed for the keys
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js, the department_card component, and
    // the --dz-icon-search property (assets/icons.css).
    schema: {
        inputs: {
            items:        { type: 'array', default: [], label: 'Departments' },
            title:        { type: 'string', default: '', label: 'Heading (blank = none)' },
            groupBy:      { type: 'enum', options: ['group', 'letter', 'none'], default: 'group', label: 'Sections' },
            groups:       { type: 'array', default: [], label: 'Service areas in the order to show them' },
            sort:         { type: 'enum', options: ['name', 'order'], default: 'name', label: 'Order' },
            layout:       { type: 'enum', options: ['grid', 'rows'], default: 'grid', label: 'Layout' },
            showSearch:   { type: 'boolean', default: true, label: 'Show search' },
            showFilter:   { type: 'boolean', default: true, label: 'Show the service area filter' },
            showStatus:   { type: 'boolean', default: true, label: 'Show open or closed' },
            showDescription: { type: 'boolean', default: true, label: 'Show what each department does' },
            headingLevel: { type: 'number', default: 2, label: 'Heading level' },
            timeZone:     { type: 'string', default: '', label: 'Offices time zone (blank = visitor)' },
            now:          { type: 'string', default: '', label: 'Show at (YYYY-MM-DDTHH:mm)' },
            locale:       { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. The search box and the filter keep their own values in
    // the DOM (no :value binding), and clearFilters resets them by id.
    template: html`
    <div class="dp" ref="root" :class="rootClass">
        <div class="dp-head">
            <p class="dp-title" :if="title" role="heading" :aria-level="levels.title">{{ title }}</p>
            <div class="dp-tools" :if="hasSearch || hasFilter">
                <div class="dp-field dp-search" :if="hasSearch">
                    <label class="dp-label" for="dp-query">{{ ui.search }}</label>
                    <span class="dp-glyph i-search" aria-hidden="true"></span>
                    <input class="dp-input" id="dp-query" type="search" :placeholder="ui.searchPlaceholder"
                           autocomplete="off" @input="onQuery($event)">
                </div>
                <div class="dp-field" :if="hasFilter">
                    <label class="dp-label" for="dp-group">{{ ui.groupLabel }}</label>
                    <select class="dp-select" id="dp-group" @change="onGroup($event)">
                        <option value="" :for="option in groupOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                </div>
            </div>
            <p class="dp-count" role="status" aria-live="polite">{{ countText }}</p>
        </div>

        <div class="dp-sections">
            <section class="dp-section" :for="section in sections" :key="section.key">
                <p class="dp-section-title" :if="section.label" role="heading" :aria-level="levels.section">{{ section.label }}</p>
                <ul class="dp-list">
                    <li class="dp-item" :for="row in section.rows" :key="row.key">
                        <dz-component dz-type="department_card" :department="row.item" :variant="'compact'"
                                      :headingLevel="levels.name" :showStatus="showStatus" :showDescription="showDescription" :timeZone="timeZone"
                                      :now="now" :locale="locale" :labels="labels"></dz-component>
                    </li>
                </ul>
            </section>
        </div>

        <div class="dp-empty" :if="!count">
            <p class="dp-empty-text">{{ emptyText }}</p>
            <button type="button" class="dp-clear" :if="filtering" @click="clearFilters()">{{ ui.clear }}</button>
        </div>
    </div>
    `,

    data: () => ({
        items: [], title: '', groupBy: 'group', groups: [], sort: 'name', layout: 'grid', showSearch: true, showFilter: true,
        showStatus: true, showDescription: true, headingLevel: 2, timeZone: '', now: '', locale: '', labels: {},
        query: '', group: ''
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides. The
        // department_card keys are passed through to the rows, so a host sets them all in one place.
        ui() {
            return DzGlobal.labels({
                search: 'Search departments',
                searchPlaceholder: 'Name or service',
                groupLabel: 'Service area',
                allGroups: 'All areas',
                countOne: '1 department',
                countMany: '{count} departments',
                countMatches: '{count} of {total} departments match',
                countOneMatch: '1 of {total} departments matches',
                other: 'Other',
                noDepartments: 'No departments to show yet.',
                noMatches: 'No departments match. Try fewer words, or a different service area.',
                clear: 'Clear search'
            }, this.labels);
        },

        rootClass() {
            return 'is-' + (this.layout === 'rows' ? 'rows' : 'grid');
        },

        // The title, then section headings, then each department's name.
        levels() {
            const n = Math.round(Number(this.headingLevel));
            const title = n >= 1 && n <= 6 ? n : 2;
            const sectioned = this.groupBy !== 'none';   // the level is the same either way
            return {
                title,
                section: Math.min(title + 1, 6),
                name: Math.min(title + (sectioned ? 2 : 1), 6)
            };
        },

        // One entry per department: the raw item for the card, plus what this list sorts,
        // groups, filters and searches on.
        entries() {
            const list = Array.isArray(this.items) ? this.items : [];
            return list
                .map((raw, index) => {
                    const item = DzGlobal.raw(raw);
                    if (!item || typeof item !== 'object') return null;
                    const name = DzGlobal.text(item.name).trim();
                    if (!name) return null;
                    const head = item.head && typeof item.head === 'object' ? DzGlobal.text(item.head.name) : '';
                    const group = DzGlobal.text(item.group).trim();
                    const words = [name, item.description, group, item.keywords, head, item.phone, item.email]
                        .map(value => DzGlobal.text(value))
                        .join(' ')
                        .toLowerCase();
                    return {
                        key: 'd' + index + '~' + name,
                        item,
                        name,
                        group,
                        order: DzGlobal.orderOf(item, 'order'),
                        letter: this.letterOf(name),
                        text: words,
                        index
                    };
                })
                .filter(Boolean);
        },

        // The service areas named in `groups`, lower case, in the order given. An array, or one
        // string with commas between the names.
        groupOrder() {
            const given = DzGlobal.raw(this.groups);
            const list = Array.isArray(given) ? given : DzGlobal.text(given).split(',');
            return list.map(name => DzGlobal.text(name).trim().toLowerCase()).filter(Boolean);
        },

        // The service areas in the data, in `groups` order, then the rest A–Z.
        groupOptions() {
            const seen = [];
            this.entries.forEach(entry => {
                if (entry.group && !seen.includes(entry.group)) seen.push(entry.group);
            });
            seen.sort((a, b) => this.compareGroups(a, b));
            return [{ value: '', label: this.ui.allGroups }, ...seen.map(group => ({ value: group, label: group }))];
        },

        // What the sections really are: asking for areas when nothing has one would put every
        // department under "Other", so that falls back to letters.
        sectionMode() {
            if (this.groupBy === 'none') return 'none';
            if (this.groupBy === 'letter') return 'letter';
            return this.entries.some(entry => entry.group) ? 'group' : 'letter';
        },

        hasSearch() {
            return !!this.showSearch && this.entries.length > 1;
        },

        // No point in the filter when everything is in one area, or the sections are the areas.
        hasFilter() {
            return !!this.showFilter && this.sectionMode !== 'group' && this.groupOptions.length > 2;
        },

        filtering() {
            return !!this.query.trim() || !!this.group;
        },

        // The departments to show, in order, after the search and the filter.
        matches() {
            const words = this.query.toLowerCase().split(' ').map(word => word.trim()).filter(Boolean);
            const group = this.group;
            const rows = this.entries.filter(entry => {
                if (group && entry.group !== group) return false;
                return words.every(word => entry.text.includes(word));
            });
            const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || a.index - b.index;
            if (this.sort !== 'order') return rows.sort(byName);
            return rows.sort((a, b) => {
                if (a.order !== b.order) {
                    if (a.order === null) return 1;
                    if (b.order === null) return -1;
                    return a.order - b.order;
                }
                return byName(a, b);
            });
        },

        count() {
            return this.matches.length;
        },

        // A section per letter or per service area, each holding its rows in the list's order; or
        // one nameless section. Letters read A–Z, areas in `groups` order and then A–Z. Anything
        // that doesn't start with a letter, and departments with no area, come last.
        sections() {
            if (this.sectionMode === 'none') {
                return this.count ? [{ key: 'all', label: '', rows: this.matches }] : [];
            }
            const byLetter = this.sectionMode === 'letter';
            const groups = new Map();
            this.matches.forEach(entry => {
                const label = byLetter ? entry.letter : (entry.group || this.ui.other);
                if (!groups.has(label)) groups.set(label, []);
                groups.get(label).push(entry);
            });
            const last = byLetter ? '#' : this.ui.other;
            const labels = [...groups.keys()].sort((a, b) => {
                if ((a === last) !== (b === last)) return a === last ? 1 : -1;
                return byLetter ? a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) : this.compareGroups(a, b);
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
            return this.entries.length ? this.ui.noMatches : this.ui.noDepartments;
        }
    },

    methods: {
        // The section a name goes in: its first letter, or '#' for anything else. "The Office of
        // the Sheriff" is filed under T, the way it reads.
        letterOf(name) {
            const first = name.trim().charAt(0).toUpperCase();
            return first >= 'A' && first <= 'Z' ? first : '#';
        },

        // Two service areas in reading order: the ones named in `groups` first, in that order,
        // then the rest A–Z.
        compareGroups(a, b) {
            const order = this.groupOrder;
            const rank = name => {
                const at = order.indexOf(DzGlobal.text(name).trim().toLowerCase());
                return at < 0 ? order.length : at;
            };
            return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        },

        onQuery(event) {
            this.query = event.target.value;
        },

        onGroup(event) {
            this.group = event.target.value;
        },

        clearFilters() {
            const root = DzGlobal.raw(this.$refs.root);
            this.query = '';
            this.group = '';
            const box = root && root.querySelector('#dp-query');
            const select = root && root.querySelector('#dp-group');
            if (box) box.value = '';
            if (select) select.value = '';
            if (box) box.focus();
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .dp { font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); container-type: inline-size; }

        /* ---- Head: the title, the search box and the filter, then the live count. */
        .dp-title { margin: 0 0 .85rem; font-family: var(--dz-font-heading, inherit); font-size: 1.5rem; font-weight: 650;
                    letter-spacing: -.01em; color: var(--dz-color-heading, #1f2330); }
        .dp-tools { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem; }
        .dp-field { display: flex; position: relative; flex: 1 1 12rem; flex-direction: column; gap: .3rem; min-width: 0; }
        .dp-search { flex: 2 1 16rem; }
        .dp-label { font-size: .8125rem; font-weight: 650; color: #454a57; }
        .dp-glyph { position: absolute; left: .7rem; bottom: .8rem; width: 1.1rem; height: 1.1rem; background: #6b7180;
                    -webkit-mask: var(--dz-icon-search) center / contain no-repeat; mask: var(--dz-icon-search) center / contain no-repeat; }
        /* Borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1 for controls). */
        .dp-input, .dp-select { box-sizing: border-box; width: 100%; min-height: 2.75rem; padding: .5rem .75rem;
                                border: 1px solid #8a8f9c; border-radius: 10px; background: var(--dz-color-surface, #fff);
                                font: inherit; font-size: .9375rem; color: var(--dz-color-heading, #1f2330); }
        .dp-input { padding-left: 2.35rem; }
        .dp-input:focus-visible, .dp-select:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px;
                                                            border-color: var(--dz-color-primary, #5b5ef0); }
        .dp-count { margin: .7rem 0 0; font-size: .875rem; color: #555b69; }
        .dp-count:empty { display: none; }

        /* ---- Sections: a letter or a service area, with a rule under the heading. */
        .dp-section { margin-top: 1.5rem; }
        .dp-section-title { margin: 0 0 .75rem; padding-bottom: .3rem; border-bottom: 2px solid var(--dz-color-border, #e4e6ee);
                            font-family: var(--dz-font-heading, inherit); font-size: 1.1rem; font-weight: 700;
                            color: var(--dz-color-heading, #1f2330); }

        /* ---- The departments: compact department cards, which draw their own card, several
           across in the grid layout. Each one fills its cell, so a row of cards lines up. */
        .dp-list { display: grid; gap: .75rem; margin: 0; padding: 0; list-style: none; }
        .is-grid .dp-list { grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); }
        .dp-item { box-sizing: border-box; min-width: 0; }

        .dp-empty { margin-top: 1.25rem; padding: 1.75rem 1.25rem; border: 1px dashed var(--dz-color-border, #d9dce5);
                    border-radius: 12px; text-align: center; }
        .dp-empty-text { margin: 0; color: #555b69; }
        .dp-clear { min-height: 2.75rem; margin-top: .85rem; padding: 0 1.1rem; border: 1px solid #8a8f9c; border-radius: 999px;
                    background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem; font-weight: 650;
                    color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .dp-clear:hover { background: var(--dz-color-bg, #f3f4f8); }
        .dp-clear:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 3px; }

        @container (max-width: 34rem) {
            .dp-field, .dp-search { flex: 1 1 100%; }
        }
    `
});
