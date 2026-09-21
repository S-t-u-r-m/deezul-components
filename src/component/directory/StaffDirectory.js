export default Deezul.Component({
    // StaffDirectory — people and how to reach them: contact cards or a table, with search, a
    // department filter, and pages.
    //
    // DATA: `items` is the staff list from the CMS. Every field is optional except a name:
    //   {
    //     id, name     'Frank Adams Jr.'
    //     sortName     how to alphabetize, 'Adams, Frank' (blank = last name, then first; suffixes
    //                  like Jr., III and PhD are skipped when finding the last name)
    //     title        job title
    //     department   'Health Department'
    //     division     'Vital Statistics'
    //     phone        '740-555-0140'
    //     ext          '305' — shown as "ext. 305" and dialed after a pause
    //     email
    //     location     'Health Building, Window 2'
    //     photo:       { src } — or just the src as a string; decorative (the name is beside it).
    //                  Without one, initials show.
    //     bio          a biography, HTML from rich_text_editor (shown with rich_text): behind a
    //                  "Read biography" button on cards, in full on profiles, not in tables
    //   }
    // Anything empty is left out. Links: tel: and mailto:; a photo src must be http(s) or a site
    // or relative path.
    //
    //   <dz-component dz-type="staff_directory" :title="'Staff directory'" :items="staff"></dz-component>
    //
    // FINDING SOMEONE: a search box (name, title, department, division, location, email, phone),
    // a department filter when there are two or more, a division filter once a department is
    // chosen (or on a department page) that has two or more. They combine, and changing any of them
    // goes back to page 1. The count is announced as it changes.
    //
    // BROKEN OUT BY DEPARTMENT: groupBy 'division' (default) puts a heading over each department,
    // then one over each of its divisions (sub-departments). People without a division come first,
    // right under their department's heading; people without a department come last, under
    // "Other staff". groupBy 'department' leaves the divisions out of the headings (they show on
    // each person instead), and 'none' is one A–Z list. On a department page the headings start at
    // the divisions. Pages cut through groups; a group that continues repeats its headings.
    //
    // LAYOUTS:
    //   cards      a card per person: photo or initials, name, title, department, phone, email,
    //              location, and a "Read biography" button that opens the bio in place (the card
    //              then takes the whole row)
    //   profiles   a row per person with a large photo, contact details and the whole biography;
    //              for small departments such as a board or an elected office
    //   table      a table per group: Name, Title, Phone and Email, plus Department (not grouped) or
    //              Division (grouped by department only, or on a department page that is not grouped);
    //              each row stacks into a block
    //              under ~46rem of its own width
    //
    // A DEPARTMENT PAGE: set `department` to show only that department. Its filter goes away and
    // the division filter shows instead.
    //
    // OPTIONS:
    //   title          a heading above the directory (blank = none)
    //   layout         'cards' (default), 'profiles' or 'table'
    //   department     show only this department (blank = everyone)
    //   groupBy        'division' (default), 'department' or 'none'; see BROKEN OUT BY DEPARTMENT
    //   sort           within groups: 'name' (last name, default) or 'order' (as given, which also
    //                  orders the groups by who comes first); 'department' sorts an ungrouped list
    //                  by department, then last name
    //   showFilters    the search and department filter (default true)
    //   showPhotos     photos and initials on cards and table rows (default true)
    //   pageSize       people per page (default 24; 0 = all)
    //   headingLevel   level of the first heading under the title: department, division or, when
    //                  not grouped, each name on cards (default 3; the title is one above). Names are
    //                  always one below the heading they sit under, and a bio's headings below the name.
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   page-change   { page, pageCount }   the visitor went to another page
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js, the rich_text component (bios), and
    // the --dz-icon-search, -call,
    // -mail, -location-on, -chevron-left and -chevron-right properties.
    schema: {
        inputs: {
            title:        { type: 'string', default: '', label: 'Title' },
            items:        { type: 'array', default: [], label: 'Staff' },
            layout:       { type: 'enum', options: ['cards', 'profiles', 'table'], default: 'cards', label: 'Layout' },
            department:   { type: 'string', default: '', label: 'Only this department (blank = everyone)' },
            groupBy:      { type: 'enum', options: ['division', 'department', 'none'], default: 'division', label: 'Break out by' },
            sort:         { type: 'enum', options: ['name', 'department', 'order'], default: 'name', label: 'Order' },
            showFilters:  { type: 'boolean', default: true, label: 'Show search and department filter' },
            showPhotos:   { type: 'boolean', default: true, label: 'Show photos and initials' },
            pageSize:     { type: 'number', default: 24, label: 'People per page (0 = all)' },
            headingLevel: { type: 'number', default: 3, label: 'First heading level under the title' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Table cells for an optional column carry an :if on the
    // cell, never on the row (a :for element).
    template: html`
    <div class="sd" ref="root" :class="'is-' + activeLayout">
        <div class="sd-top">
            <p class="sd-title" :if="title" role="heading" :aria-level="levels.title">{{ title }}</p>
            <p class="sd-count" role="status" aria-live="polite" aria-atomic="true">{{ countText }}</p>
        </div>

        <div class="sd-controls" :if="showFilters" role="search" :aria-label="searchName">
            <div class="sd-field sd-search">
                <label class="sd-label" for="sd-query">{{ ui.search }}</label>
                <div class="sd-search-box">
                    <span class="sd-glyph i-search" aria-hidden="true"></span>
                    <input class="sd-input" id="sd-query" type="search" autocomplete="off"
                           :placeholder="ui.searchPlaceholder" @input="onSearch($event)">
                </div>
            </div>
            <div class="sd-field" :if="departmentOptions.length > 2">
                <label class="sd-label" for="sd-department">{{ ui.department }}</label>
                <select class="sd-select" id="sd-department" @change="onDepartment($event)">
                    <option :for="opt in departmentOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
            <div class="sd-field" :if="divisionOptions.length > 2">
                <label class="sd-label" for="sd-division">{{ ui.division }}</label>
                <select class="sd-select" id="sd-division" @change="onDivision($event)">
                    <option :for="opt in divisionOptions" :key="opt.key" :value="opt.value" :selected="opt.selected">{{ opt.label }}</option>
                </select>
            </div>
        </div>

        <div class="sd-results" :if="pageItems.length" tabindex="-1">
            <section class="sd-group" :for="group in groups" :key="group.key" :class="group.heading ? 'is-new' : ''">
                <p class="sd-group-title" :if="group.heading" role="heading" :aria-level="group.headingLevel">{{ group.heading }}</p>
                <p class="sd-subgroup-title" :if="group.subheading" role="heading" :aria-level="group.subheadingLevel">{{ group.subheading }}</p>

                <ul class="sd-cards" :if="activeLayout === 'cards'" :aria-label="group.listName">
                    <li class="sd-item" :for="person in group.people" :key="person.key">
                        <article class="sd-card">
                            <span class="sd-avatar" :if="showPhotos" :class="person.tone" aria-hidden="true">
                                <img class="sd-photo" :if="person.photo" :src="person.photo" alt="" loading="lazy">
                                <span class="sd-initials" :if="!person.photo">{{ person.initials }}</span>
                            </span>
                            <div class="sd-info">
                                <p class="sd-name" role="heading" :aria-level="group.nameLevel">{{ person.name }}</p>
                                <p class="sd-job" :if="person.title">{{ person.title }}</p>
                                <p class="sd-dept" :if="person.orgLine">{{ person.orgLine }}</p>
                                <ul class="sd-contact" :if="person.phoneText || person.email || person.location">
                                    <li class="sd-line" :if="person.phoneText">
                                        <span class="sd-glyph i-call" aria-hidden="true"></span>
                                        <a class="sd-link" :href="person.phoneHref">{{ person.phoneText }}</a>
                                    </li>
                                    <li class="sd-line" :if="person.email">
                                        <span class="sd-glyph i-mail" aria-hidden="true"></span>
                                        <a class="sd-link" :href="person.emailHref">{{ person.email }}</a>
                                    </li>
                                    <li class="sd-line" :if="person.location">
                                        <span class="sd-glyph i-place" aria-hidden="true"></span>{{ person.location }}
                                    </li>
                                </ul>
                                <button type="button" class="sd-bio-toggle" :if="person.bio" :aria-expanded="person.bioOpen ? 'true' : 'false'"
                                        :aria-label="person.bioLabel" @click="toggleBio(person.key)">
                                    <span>{{ person.bioOpen ? ui.hideBio : ui.showBio }}</span><span class="sd-glyph i-more" aria-hidden="true"></span>
                                </button>
                                <div class="sd-bio" :if="person.bio && person.bioOpen">
                                    <dz-component dz-type="rich_text" :html="person.bio" :size="'small'" :minHeadingLevel="group.bioLevel"></dz-component>
                                </div>
                            </div>
                        </article>
                    </li>
                </ul>

                <ul class="sd-profiles" :if="activeLayout === 'profiles'" :aria-label="group.listName">
                    <li :for="person in group.people" :key="person.key">
                        <article class="sd-profile" :class="person.bio ? '' : 'is-short'">
                            <span class="sd-portrait" :if="showPhotos" :class="person.tone" aria-hidden="true">
                                <img class="sd-photo" :if="person.photo" :src="person.photo" alt="" loading="lazy">
                                <span class="sd-initials" :if="!person.photo">{{ person.initials }}</span>
                            </span>
                            <div class="sd-profile-body">
                                <p class="sd-name" role="heading" :aria-level="group.nameLevel">{{ person.name }}</p>
                                <p class="sd-job" :if="person.title">{{ person.title }}</p>
                                <p class="sd-dept" :if="person.orgLine">{{ person.orgLine }}</p>
                                <ul class="sd-contact" :if="person.phoneText || person.email || person.location">
                                    <li class="sd-line" :if="person.phoneText">
                                        <span class="sd-glyph i-call" aria-hidden="true"></span>
                                        <a class="sd-link" :href="person.phoneHref">{{ person.phoneText }}</a>
                                    </li>
                                    <li class="sd-line" :if="person.email">
                                        <span class="sd-glyph i-mail" aria-hidden="true"></span>
                                        <a class="sd-link" :href="person.emailHref">{{ person.email }}</a>
                                    </li>
                                    <li class="sd-line" :if="person.location">
                                        <span class="sd-glyph i-place" aria-hidden="true"></span>{{ person.location }}
                                    </li>
                                </ul>
                                <div class="sd-profile-bio" :if="person.bio">
                                    <dz-component dz-type="rich_text" :html="person.bio" :minHeadingLevel="group.bioLevel"></dz-component>
                                </div>
                            </div>
                        </article>
                    </li>
                </ul>

                <table class="sd-table" :if="activeLayout === 'table'" :class="orgColumnLabel ? 'has-org' : ''">
                    <caption class="sd-sr">{{ group.listName }}</caption>
                    <thead>
                        <tr>
                            <th scope="col" class="sd-col-name">{{ ui.name }}</th>
                            <th scope="col" class="sd-col-title">{{ ui.jobTitle }}</th>
                            <th scope="col" class="sd-col-org" :if="orgColumnLabel">{{ orgColumnLabel }}</th>
                            <th scope="col" class="sd-col-phone">{{ ui.phone }}</th>
                            <th scope="col" class="sd-col-email">{{ ui.email }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr :for="person in group.people" :key="person.key">
                            <th scope="row" class="sd-cell-name">
                                <span class="sd-row-name">
                                    <span class="sd-avatar is-small" :if="showPhotos" :class="person.tone" aria-hidden="true">
                                        <img class="sd-photo" :if="person.photo" :src="person.photo" alt="" loading="lazy">
                                        <span class="sd-initials" :if="!person.photo">{{ person.initials }}</span>
                                    </span>
                                    <span>{{ person.name }}</span>
                                </span>
                            </th>
                            <td :class="person.titleCell" :data-label="ui.jobTitle">{{ person.title }}</td>
                            <td :if="orgColumnLabel" :class="person.orgCell" :data-label="orgColumnLabel">{{ person.orgLine }}</td>
                            <td :class="person.phoneCell" :data-label="ui.phone">
                                <a class="sd-link" :if="person.phoneText" :href="person.phoneHref">{{ person.phoneText }}</a>
                            </td>
                            <td :class="person.emailCell" :data-label="ui.email">
                                <a class="sd-link" :if="person.email" :href="person.emailHref">{{ person.email }}</a>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </div>

        <div class="sd-empty" :if="!pageItems.length">
            <p class="sd-empty-text">{{ emptyMessage }}</p>
            <button type="button" class="sd-clear" :if="filtered" @click="clearFilters($event)">{{ ui.clear }}</button>
        </div>

        <nav class="sd-pages" :if="pageCount > 1" :aria-label="pagesName">
            <button type="button" class="sd-step is-prev" :disabled="currentPage <= 1" @click="step(-1, $event)">
                <span class="sd-glyph i-prev" aria-hidden="true"></span><span>{{ ui.previous }}</span>
            </button>
            <ul class="sd-numbers">
                <li :for="entry in pageEntries" :key="entry.key">
                    <button type="button" class="sd-page" :if="entry.page" :class="entry.current ? 'is-current' : ''"
                            :aria-current="entry.current ? 'page' : 'false'" :aria-label="entry.label"
                            @click="goTo(entry.page, $event)">{{ entry.page }}</button>
                    <span class="sd-gap" :if="!entry.page" aria-hidden="true">…</span>
                </li>
            </ul>
            <p class="sd-of">{{ pageOfText }}</p>
            <button type="button" class="sd-step is-next" :disabled="currentPage >= pageCount" @click="step(1, $event)">
                <span>{{ ui.next }}</span><span class="sd-glyph i-next" aria-hidden="true"></span>
            </button>
        </nav>
    </div>
    `,

    data: () => ({
        title: '', items: [], layout: 'cards', department: '', groupBy: 'division', sort: 'name', showFilters: true,
        showPhotos: true, pageSize: 24, headingLevel: 3, labels: {},
        query: '', departmentFilter: '', divisionFilter: '', page: 1, openBios: []
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                search: 'Search',
                searchPlaceholder: 'Name, title or department',
                searchStaff: 'Staff search',
                searchIn: 'Search {title}',
                department: 'Department',
                allDepartments: 'All departments',
                division: 'Division',
                allDivisions: 'All divisions',
                otherStaff: 'Other staff',
                countOne: '1 person',
                countMany: '{count} people',
                showing: 'Showing {from}–{to} of {count} people',
                matchCount: '{count} of {total} people match',
                showingMatches: 'Showing {from}–{to} of {count} matching people',
                noMatches: 'Nobody matches your search.',
                noStaff: 'There is no one to show in this directory.',
                clear: 'Clear filters',
                staff: 'Staff',
                listPage: '{name}, page {page} of {count}',
                pages: 'Staff pages',
                pagesOf: '{name} pages',
                previous: 'Previous',
                next: 'Next',
                pageLabel: 'Page {page}',
                pageOf: 'Page {page} of {count}',
                name: 'Name',
                jobTitle: 'Title',
                phone: 'Phone',
                email: 'Email',
                extension: 'ext. {ext}',
                showBio: 'Read biography',
                hideBio: 'Hide biography',
                bioFor: '{action}: {name}'
            }, this.labels);
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const item = n >= 1 && n <= 6 ? n : 3;
            return { title: Math.max(item - 1, 1), item };
        },

        groupMode() {
            return this.groupBy === 'department' || this.groupBy === 'none' ? this.groupBy : 'division';
        },

        // The table's where-they-work column: Department (department · division) when nothing is
        // grouped, Division when only the department is in a heading (or known from the page), and
        // none when the division is in a heading too.
        orgColumnLabel() {
            if (this.groupMode === 'division') return '';
            return this.groupMode === 'none' && !this.fixedDepartment ? this.ui.department : this.ui.division;
        },

        activeLayout() {
            return this.layout === 'table' || this.layout === 'profiles' ? this.layout : 'cards';
        },

        fixedDepartment() {
            return DzGlobal.text(this.department).trim();
        },

        searchName() {
            return this.title ? DzGlobal.format(this.ui.searchIn, { title: this.title }) : this.ui.searchStaff;
        },

        pagesName() {
            return this.title ? DzGlobal.format(this.ui.pagesOf, { name: this.title }) : this.ui.pages;
        },

        // Everyone this directory can show (the fixed department applied), in order.
        people() {
            const fixed = this.fixedDepartment.toLowerCase();
            const byName = (a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' });
            const orders = {
                name: byName,
                department: (a, b) => (!a.department - !b.department)   // no department last
                    || a.department.localeCompare(b.department, undefined, { sensitivity: 'base' }) || byName(a, b),
                order: (a, b) => a.index - b.index
            };
            const within = orders[this.sort] || byName;
            const list = (Array.isArray(this.items) ? this.items : [])
                .map((item, index) => this.normalize(item, index))
                .filter(person => person.name && (!fixed || person.department.toLowerCase() === fixed));

            // Grouped: department (none last), then division (none first), then the order within.
            // With sort 'order', groups keep the order their first person has.
            const mode = this.groupMode;
            if (mode === 'none') return list.sort(within);
            const given = this.sort === 'order';
            const firstSeen = new Map();
            list.forEach(person => {
                if (!firstSeen.has(person.department)) firstSeen.set(person.department, person.index);
                const both = person.department + '|' + person.division;
                if (!firstSeen.has(both)) firstSeen.set(both, person.index);
            });
            const text = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
            const groupOrder = (a, b) => {
                const byDepartment = (!a.department - !b.department)
                    || (given ? firstSeen.get(a.department) - firstSeen.get(b.department) : text(a.department, b.department));
                if (byDepartment || mode === 'department') return byDepartment;
                return (!!a.division - !!b.division)
                    || (given ? firstSeen.get(a.department + '|' + a.division) - firstSeen.get(b.department + '|' + b.division) : text(a.division, b.division));
            };
            const inGroup = this.sort === 'department' ? byName : within;
            return list.sort((a, b) => groupOrder(a, b) || inGroup(a, b));
        },

        filtered() {
            return !!(this.query.trim() || this.departmentFilter || this.divisionFilter);
        },

        // Search, department and division applied.
        matches() {
            const words = this.query.trim().toLowerCase().split(' ').filter(Boolean);
            const department = this.fixedDepartment ? '' : this.departmentFilter;
            const division = this.divisionOptions.length ? this.divisionFilter : '';
            return this.people.filter(person => {
                if (department && person.department !== department) return false;
                if (division && person.division !== division) return false;
                return words.every(word => person.haystack.includes(word));
            });
        },

        size() {
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
            const fixed = !!this.fixedDepartment;
            const mode = this.groupMode;
            const list = this.size ? this.matches.slice((this.currentPage - 1) * this.size, this.currentPage * this.size) : this.matches;
            const open = Array.isArray(this.openBios) ? this.openBios : [];
            const ui = this.ui;
            // Whatever a heading (or a department page) already says is left off the person.
            return list.map(person => {
                const bioOpen = !!person.bio && open.includes(person.key);
                const orgLine = mode === 'division' ? ''
                    : mode === 'department' || fixed ? person.division
                    : [person.department, person.division].filter(Boolean).join(' · ');
                return {
                    ...person, orgLine, bioOpen,
                    bioLabel: DzGlobal.format(ui.bioFor, { action: bioOpen ? ui.hideBio : ui.showBio, name: person.name }),
                    titleCell: person.title ? '' : 'is-empty', orgCell: orgLine ? '' : 'is-empty',
                    phoneCell: person.phoneText ? '' : 'is-empty', emailCell: person.email ? '' : 'is-empty'
                };
            });
        },

        // The page's people in runs that share a department (and division), each with the
        // headings it opens with and the level of its names.
        groups() {
            const mode = this.groupMode;
            const fixed = !!this.fixedDepartment;
            const ui = this.ui;
            const base = this.levels.item;
            const departmentHeadings = mode !== 'none' && !fixed;
            const subLevel = Math.min(departmentHeadings ? base + 1 : base, 6);
            const out = [];
            let current = null;
            this.pageItems.forEach(person => {
                const department = mode === 'none' ? '' : person.department;
                const division = mode === 'division' ? person.division : '';
                const id = department + '|' + division;
                if (!current || current.id !== id) {
                    const opensDepartment = departmentHeadings && (!current || current.department !== department);
                    const heading = opensDepartment ? department || ui.otherStaff : '';
                    const nearest = division ? subLevel : departmentHeadings ? base : base - 1;
                    current = {
                        id, key: id + '~' + out.length, department, heading, subheading: division,
                        headingLevel: base, subheadingLevel: subLevel, nameLevel: Math.min(nearest + 1, 6),
                        bioLevel: Math.min(nearest + 2, 6),
                        listName: division || (mode === 'none' ? this.listName : department || ui.otherStaff),
                        people: []
                    };
                    out.push(current);
                }
                current.people.push(person);
            });
            return out;
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
            const name = this.title || this.ui.staff;
            return this.pageCount > 1 ? DzGlobal.format(this.ui.listPage, { name, page: this.currentPage, count: this.pageCount }) : name;
        },

        departmentOptions() {
            if (this.fixedDepartment) return [];
            const current = this.departmentFilter;
            const values = [...new Set(this.people.map(person => person.department).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            return [{ key: '~all', value: '', label: this.ui.allDepartments, selected: !current },
                    ...values.map(value => ({ key: value, value, label: value, selected: value === current }))];
        },

        // A department's divisions, once a department is chosen (or fixed). Blank when it has
        // fewer than two, so the filter stays hidden.
        divisionOptions() {
            const department = this.fixedDepartment ? '' : this.departmentFilter;
            if (!this.fixedDepartment && !department) return [];
            const current = this.divisionFilter;
            const values = [...new Set(this.people
                .filter(person => !department || person.department === department)
                .map(person => person.division).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            if (values.length < 2) return [];
            return [{ key: '~all', value: '', label: this.ui.allDivisions, selected: !current },
                    ...values.map(value => ({ key: value, value, label: value, selected: value === current }))];
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
                    : DzGlobal.format(ui.matchCount, { count, total: this.people.length });
            }
            if (this.pageCount > 1) return DzGlobal.format(ui.showing, { from, to, count });
            return count === 1 ? ui.countOne : DzGlobal.format(ui.countMany, { count });
        },

        emptyMessage() {
            return this.people.length ? this.ui.noMatches : this.ui.noStaff;
        }
    },

    methods: {
        // One person as drawn: sort key, initials, contact links and search text.
        normalize(raw, index) {
            const item = raw && typeof raw === 'object' ? raw : {};
            const t = value => DzGlobal.text(value).trim();
            const name = t(item.name);
            const words = name.split(' ').filter(Boolean);
            const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'phd', 'md', 'esq', 'cpa'];
            const bare = word => word.toLowerCase().split('.').join('').split(',').join('');
            let lastIndex = words.length - 1;
            while (lastIndex > 0 && suffixes.includes(bare(words[lastIndex]))) lastIndex--;
            const last = lastIndex >= 0 ? words[lastIndex].split(',').join('') : '';
            const first = words.slice(0, Math.max(lastIndex, 0)).join(' ');
            const sortKey = t(item.sortName) || (lastIndex > 0 ? last + ', ' + first : name);
            const initials = ((words[0] || '').charAt(0) + (lastIndex > 0 ? last.charAt(0) : '')).toUpperCase();

            const contact = DzGlobal.contact({ phone: item.phone, email: item.email });
            const ext = t(item.ext).split('').filter(ch => ch >= '0' && ch <= '9').join('');
            const phoneText = contact.phone ? contact.phone + (ext ? ' ' + DzGlobal.format(this.ui.extension, { ext }) : '') : '';
            const rawPhoto = typeof item.photo === 'string' ? item.photo : item.photo && item.photo.src;
            const photo = DzGlobal.safeHref(rawPhoto);
            const safePhoto = photo.toLowerCase().startsWith('mailto:') || photo.toLowerCase().startsWith('tel:') ? '' : photo;

            const department = t(item.department);
            const division = t(item.division);
            const location = t(item.location);
            const title = t(item.title);
            // Initials sit on one of eight dark colors (white text, 5:1 or more), picked by name.
            const tones = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
            let hash = 0;
            for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;

            return {
                key: (t(item.id) || 'p') + '~' + index, index, name, sortKey, initials, tone: tones[hash % 8],
                title, department, division, location, photo: safePhoto, bio: t(item.bio),
                phoneText, phoneHref: contact.phoneHref ? contact.phoneHref + (ext ? ',' + ext : '') : '',
                email: contact.email, emailHref: contact.emailHref,
                haystack: [name, title, department, division, location, contact.email, contact.phone].join(' ').toLowerCase()
            };
        },

        // Open or close one person's biography on a card.
        toggleBio(key) {
            const open = Array.isArray(this.openBios) ? [...this.openBios] : [];
            const at = open.indexOf(key);
            if (at >= 0) open.splice(at, 1);
            else open.push(key);
            this.openBios = open;
        },

        onSearch(event) {
            this.query = event.target.value;
            this.page = 1;
        },

        // A new department starts with all of its divisions.
        onDepartment(event) {
            this.departmentFilter = event.target.value;
            this.divisionFilter = '';
            this.page = 1;
        },

        onDivision(event) {
            this.divisionFilter = event.target.value;
            this.page = 1;
        },

        // Reset the search, department and division, and put focus back in the search box.
        clearFilters(event) {
            const root = event.target.getRootNode();
            this.query = '';
            this.departmentFilter = '';
            this.divisionFilter = '';
            this.page = 1;
            const input = root.querySelector('#sd-query');
            if (input) input.value = '';
            ['#sd-department', '#sd-division'].forEach(selector => {
                const select = root.querySelector(selector);
                if (select) select.value = '';
            });
            if (input) input.focus();
        },

        // Show another page, then move focus to the top of the results: the button pressed may
        // have just been disabled (Next on the last page), and the new people start up there.
        async goTo(page, event) {
            const root = event.target.getRootNode();
            const count = this.pageCount;
            const target = Math.min(Math.max(1, Math.floor(Number(page)) || 1), count);
            if (target === this.currentPage) return;
            this.page = target;
            this.$emit('page-change', { page: target, pageCount: count });

            const deezul = window.Deezul;
            if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
            const results = root.querySelector('.sd-results');
            const top = root.querySelector('.sd');
            if (!results || !top) return;
            results.focus({ preventScroll: true });
            if (top.getBoundingClientRect().top < 0) {
                const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                top.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
            }
        },

        // Previous (-1) and Next (1).
        step(by, event) {
            return this.goTo(this.currentPage + by, event);
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .sd { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a);
              --sd-field-border: #8a8f9c; --sd-link: #4a4dd6; }
        .sd-glyph { display: block; flex: none; width: 1.1rem; height: 1.1rem; background: currentColor;
                    -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-search { --icon: var(--dz-icon-search); }
        .i-call   { --icon: var(--dz-icon-call); }
        .i-mail   { --icon: var(--dz-icon-mail); }
        .i-place  { --icon: var(--dz-icon-location-on); }
        .i-prev   { --icon: var(--dz-icon-chevron-left); }
        .i-more   { --icon: var(--dz-icon-chevron-right); }
        .i-next   { --icon: var(--dz-icon-chevron-right); }
        .sd-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
                 clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

        .sd-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem 1rem;
                  margin: 0 0 .75rem; }
        .sd-title { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.35rem; font-weight: 700;
                    color: var(--dz-color-heading, #1f2330); }
        .sd-count { margin: 0 0 0 auto; font-size: .875rem; font-weight: 600; }

        /* ---- Search bar. Field borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1). */
        .sd-controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem; margin: 0 0 .75rem; padding: .9rem;
                       border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px; background: var(--dz-color-bg, #f7f7fb); }
        .sd-field { flex: 1 1 12rem; min-width: 0; }
        .sd-search { flex: 3 1 16rem; }
        .sd-label { display: block; margin: 0 0 .3rem; font-size: .75rem; font-weight: 700; letter-spacing: .04em;
                    text-transform: uppercase; }
        .sd-search-box { position: relative; }
        .sd-search-box .sd-glyph { position: absolute; left: .65rem; top: 50%; margin-top: -.55rem; pointer-events: none;
                                   color: var(--dz-color-muted, #6b7180); }
        .sd-input, .sd-select { box-sizing: border-box; width: 100%; height: 2.5rem; border: 1px solid var(--sd-field-border);
                                border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem;
                                color: var(--dz-color-heading, #1f2330); }
        .sd-input { padding: 0 .75rem 0 2.1rem; }
        .sd-select { padding: 0 .5rem; cursor: pointer; }
        .sd-input:focus-visible, .sd-select:focus-visible, .sd-clear:focus-visible, .sd-step:focus-visible, .sd-page:focus-visible,
        .sd-link:focus-visible, .sd-results:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .sd-results:focus:not(:focus-visible) { outline: none; }

        /* ---- Groups: a department heading with a rule, division headings under it. */
        .sd-group + .sd-group { margin-top: 1.25rem; }
        .sd-group.is-new + .sd-group.is-new, .sd-group + .sd-group.is-new { margin-top: 2rem; }
        .sd-group-title { margin: 0 0 .85rem; padding-bottom: .4rem; border-bottom: 2px solid var(--dz-color-border, #e4e6ee);
                          font-family: var(--dz-font-heading, inherit); font-size: 1.2rem; font-weight: 700;
                          color: var(--dz-color-heading, #1f2330); }
        .sd-subgroup-title { display: flex; align-items: center; gap: .5rem; margin: 0 0 .6rem; font-size: .8125rem; font-weight: 700;
                             letter-spacing: .05em; text-transform: uppercase; color: #3b3ec2; }
        .sd-subgroup-title::before { content: ""; width: .6rem; height: 2px; border-radius: 2px; background: currentColor; }
        .sd-group-title + .sd-subgroup-title { margin-top: .25rem; }

        /* ---- Avatars: a photo, or initials on a dark tone. */
        .sd-avatar { position: relative; display: inline-flex; flex: none; align-items: center; justify-content: center; overflow: hidden;
                     width: 3.5rem; height: 3.5rem; border-radius: 50%; background: #475467; color: #fff; }
        .sd-avatar.is-small { width: 2.25rem; height: 2.25rem; }
        .sd-photo { width: 100%; height: 100%; object-fit: cover; }
        .sd-initials { font-size: 1.15rem; font-weight: 700; letter-spacing: .02em; }
        .is-small .sd-initials { font-size: .8rem; }
        .t0 { background: #3b3ec2; } .t1 { background: #1d5bbf; } .t2 { background: #1a7f45; } .t3 { background: #b42318; }
        .t4 { background: #6d3fc0; } .t5 { background: #0e7490; } .t6 { background: #b54708; } .t7 { background: #475467; }

        /* ---- Cards. */
        .sd-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr)); gap: .8rem;
                    margin: 0; padding: 0; list-style: none; }
        .sd-item { display: flex; min-width: 0; }
        .sd-card { box-sizing: border-box; display: flex; flex: 1; gap: .9rem; min-width: 0; padding: 1rem 1.1rem;
                   border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 12px; background: var(--dz-color-surface, #fff);
                   box-shadow: 0 1px 2px rgba(0, 0, 0, .04); }
        .sd-info { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
        .sd-name { margin: 0; font-family: var(--dz-font-heading, inherit); font-size: 1.0625rem; font-weight: 700; line-height: 1.3;
                   color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .sd-job { margin: 0; font-size: .9rem; font-weight: 600; }
        .sd-dept { margin: 0; font-size: .8125rem; color: #555b69; }
        .sd-contact { display: flex; flex-direction: column; gap: .3rem; margin: .5rem 0 0; padding: 0; list-style: none; font-size: .875rem; }
        .sd-line { display: flex; align-items: flex-start; gap: .45rem; min-width: 0; overflow-wrap: anywhere; }
        .sd-line .sd-glyph { width: 1rem; height: 1rem; margin-top: .15rem; color: var(--dz-color-muted, #6b7180); }
        .sd-link { color: var(--sd-link); text-underline-offset: 2px; overflow-wrap: anywhere; }

        /* ---- Biographies: a disclosure on cards; an open card takes the whole row. */
        .sd-bio-toggle { display: inline-flex; align-self: flex-start; align-items: center; gap: .2rem; min-height: 2.25rem;
                         margin-top: .6rem; padding: 0 .45rem 0 .7rem; border: 1px solid var(--sd-field-border); border-radius: 6px;
                         background: var(--dz-color-surface, #fff); font: inherit; font-size: .8125rem; font-weight: 700;
                         color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .sd-bio-toggle:hover { background: var(--dz-color-bg, #f7f7fb); }
        .sd-bio-toggle:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }
        .sd-bio-toggle .sd-glyph { width: 1rem; height: 1rem; transition: transform .15s ease; }
        .sd-bio-toggle[aria-expanded="true"] .sd-glyph { transform: rotate(90deg); }
        .sd-item:has(.sd-bio) { grid-column: 1 / -1; }
        .sd-bio { max-width: 46rem; margin-top: .8rem; padding-top: .8rem; border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        @media (prefers-reduced-motion: reduce) { .sd-bio-toggle .sd-glyph { transition: none; } }

        /* ---- Profiles: a large portrait beside the details and the whole biography. */
        .sd-profiles { display: flex; flex-direction: column; gap: 1rem; margin: 0; padding: 0; list-style: none; }
        .sd-profile { display: grid; grid-template-columns: 10rem minmax(0, 1fr); align-items: start; gap: 1.5rem; padding: 1.5rem;
                      border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 14px; background: var(--dz-color-surface, #fff);
                      box-shadow: 0 1px 2px rgba(0, 0, 0, .04); }
        .sd-portrait { display: flex; align-items: center; justify-content: center; overflow: hidden; width: 100%; aspect-ratio: 1;
                       border-radius: 12px; color: #fff; }   /* background: the person’s tone class */
        .sd-portrait .sd-initials { font-size: 2.6rem; }
        .sd-profile-body { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
        .sd-profile .sd-name { font-size: 1.4rem; }
        .sd-profile .sd-job { font-size: 1rem; }
        .sd-profile .sd-contact { flex-direction: row; flex-wrap: wrap; gap: .35rem 1.25rem; }
        .sd-profile-bio { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        @container (max-width: 36rem) {
            .sd-profile { grid-template-columns: minmax(0, 1fr); gap: 1rem; padding: 1.1rem; }
            .sd-portrait { width: 7rem; }
            .sd-profile .sd-contact { flex-direction: column; }
        }

        /* ---- Table. */
        .sd-table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; font-size: .9375rem;
                    border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 12px; background: var(--dz-color-surface, #fff); }
        .sd-table th, .sd-table td { padding: .65rem .9rem; text-align: left; vertical-align: middle; }
        .sd-table thead th { font-size: .75rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
                             background: var(--dz-color-bg, #f7f7fb); border-bottom: 1px solid var(--dz-color-border, #e4e6ee); }
        .sd-table tbody tr + tr > * { border-top: 1px solid var(--dz-color-border, #e4e6ee); }
        .sd-table tbody tr:hover > * { background: var(--dz-color-bg, #f7f7fb); }
        .sd-cell-name { font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        /* The same share per column in every group's table, so the columns line up down the page. */
        .sd-col-name { width: 26%; } .sd-col-title { width: 26%; } .sd-col-phone { width: 22%; } .sd-col-email { width: 26%; }
        .has-org .sd-col-name { width: 21%; } .has-org .sd-col-title { width: 20%; } .has-org .sd-col-org { width: 19%; }
        .has-org .sd-col-phone { width: 18%; } .has-org .sd-col-email { width: 22%; }
        /* Phone numbers and emails stay whole in columns; the table stacks before they would overflow. */
        .sd-table td .sd-link { white-space: nowrap; overflow-wrap: normal; }
        .sd-row-name { display: inline-flex; align-items: center; gap: .6rem; }
        @container (max-width: 46rem) {
            .sd-table td .sd-link { white-space: normal; overflow-wrap: anywhere; }
            .sd-table, .sd-table tbody, .sd-table tr, .sd-table th, .sd-table td { display: block; }
            .sd-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
            .sd-table tbody tr { padding: .75rem .9rem; }
            .sd-table th, .sd-table td { padding: .15rem 0; }
            .sd-table tbody tr + tr > * { border-top: 0; }
            .sd-table tbody tr + tr { border-top: 1px solid var(--dz-color-border, #e4e6ee); }
            .sd-table td::before { content: attr(data-label); display: block; font-size: .6875rem; font-weight: 700;
                                   letter-spacing: .04em; text-transform: uppercase; color: #555b69; }
            .sd-table td.is-empty { display: none; }
            .sd-cell-name { padding-bottom: .35rem !important; }
        }

        .sd-empty { padding: 1.5rem 1rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px; text-align: center; }
        .sd-empty-text { margin: 0; font-style: italic; color: var(--dz-color-muted, #6b7180); }
        .sd-clear { margin-top: .75rem; padding: .45rem .9rem; border: 1px solid var(--sd-field-border); border-radius: 6px;
                    background: var(--dz-color-surface, #fff); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer;
                    color: var(--dz-color-heading, #1f2330); }
        .sd-clear:hover { background: var(--dz-color-bg, #f7f7fb); }

        /* ---- Pages. Buttons are 44px targets. */
        .sd-pages { display: flex; align-items: center; justify-content: center; gap: .5rem; margin: 1.1rem 0 0; }
        .sd-numbers { display: flex; align-items: center; gap: .25rem; margin: 0; padding: 0; list-style: none; }
        .sd-step, .sd-page { box-sizing: border-box; min-width: 2.75rem; height: 2.75rem; border: 1px solid transparent;
                             border-radius: 8px; background: none; font: inherit; font-size: .9375rem; font-weight: 600;
                             color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .sd-step { display: inline-flex; align-items: center; gap: .3rem; padding: 0 .75rem; border-color: var(--sd-field-border);
                   background: var(--dz-color-surface, #fff); }
        .sd-step.is-prev { padding-left: .45rem; }
        .sd-step.is-next { padding-right: .45rem; }
        .sd-page { padding: 0 .5rem; }
        .sd-step:hover:not(:disabled), .sd-page:hover:not(.is-current) { background: var(--dz-color-bg, #f7f7fb); border-color: var(--sd-field-border); }
        .sd-step:disabled { cursor: default; opacity: .45; }
        .sd-page.is-current { background: var(--sd-link); border-color: var(--sd-link); color: #fff; }
        .sd-gap { display: inline-block; min-width: 1.5rem; text-align: center; color: var(--dz-color-muted, #6b7180); }
        .sd-of { display: none; margin: 0 .25rem; font-size: .875rem; font-weight: 600; }
        @container (max-width: 34rem) {
            .sd-numbers { display: none; }
            .sd-of { display: block; }
            .sd-pages { justify-content: space-between; }
        }
    `
});
