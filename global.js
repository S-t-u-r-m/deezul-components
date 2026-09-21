/*
 * global.js — helpers shared by the library's components, published as window.DzGlobal.
 *
 * Compiled components can't import app modules; they only see globals. main.js imports this
 * file before Deezul.init, so every component can call DzGlobal.* from its computed
 * properties and methods (never at module top level, and never in `styles`, which the
 * compiler reads as a literal string).
 *
 * Kept free of regex and backslash escapes on purpose — see the note in the project memory
 * about escapes turning into real control characters when files are generated.
 */
const DzGlobal = {
    // ---- Values ------------------------------------------------------------------------

    // A field value as display text: null and undefined become ''.
    text(value) {
        return value === undefined || value === null ? '' : String(value);
    },

    // The raw object behind a reactive proxy, so results handed to a host carry no proxies.
    raw(value) {
        const deezul = window.Deezul;
        return deezul && typeof deezul.toRaw === 'function' ? deezul.toRaw(value) : value;
    },

    // A stable row key: the parent's key plus the item's id, or '#index' without one.
    keyFor(parentKey, id, index) {
        return parentKey + '/' + (id === undefined || id === null || id === '' ? '#' + index : id);
    },

    // ---- Ordering ----------------------------------------------------------------------

    // An item's order as a finite number, or null when it has none.
    orderOf(item, orderKey) {
        const raw = item ? item[orderKey] : undefined;
        if (raw === undefined || raw === null || raw === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    },

    // Sort nodes ({ order, label, index }) in place: by order where they have one, then A–Z by
    // label (numeric-aware, case-insensitive), then by original position.
    sortNodes(nodes) {
        return nodes.sort((a, b) => {
            if (a.order !== b.order) {
                if (a.order === null) return 1;
                if (b.order === null) return -1;
                return a.order - b.order;
            }
            return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }) || a.index - b.index;
        });
    },

    // The next free order number in a list, or null when nothing in it has one (an A–Z list).
    nextOrder(list, orderKey) {
        let max = null;
        (Array.isArray(list) ? list : []).forEach(item => {
            const value = item && typeof item === 'object' ? DzGlobal.orderOf(item, orderKey) : null;
            if (value !== null) max = max === null ? value : Math.max(max, value);
        });
        return max === null ? null : max + 1;
    },

    // Number a list 1..n in the order `sequence` gives (raw array indices, display order).
    // Returns the new array (untouched entries kept as-is) and { item, order } for each change.
    renumber(list, sequence, orderKey) {
        const rank = new Map(sequence.map((index, i) => [index, i + 1]));
        const changes = [];
        const items = list.map((entry, i) => {
            if (!rank.has(i) || entry[orderKey] === rank.get(i)) return entry;
            changes.push({ item: entry, order: rank.get(i) });
            return { ...entry, [orderKey]: rank.get(i) };
        });
        return { items, changes, rank };
    },

    // ---- Move mode ---------------------------------------------------------------------

    // Rows for a level in move mode: each row gets the divider above it. `gapPos` is where a
    // drop there lands among the rows other than the moving item; `gap` is false where a drop
    // would change nothing (directly above or below the moving item). Also returns the divider
    // under the last row. `names` builds the accessible names: { before(target), end() }.
    placeGaps(nodes, movingKey, names) {
        let placed = 0;
        const rows = nodes.map((node, i) => {
            const prev = nodes[i - 1];
            const gapPos = placed;
            if (node.key !== movingKey) placed++;
            return {
                ...node,
                blocked: node.key === movingKey,
                gap: !!movingKey && node.key !== movingKey && !(prev && prev.key === movingKey),
                gapPos,
                gapName: movingKey ? names.before(node.label) : ''
            };
        });
        const last = nodes[nodes.length - 1];
        const endGap = {
            show: !!movingKey && !(last && last.key === movingKey),
            pos: placed,
            name: movingKey ? names.end(nodes.length > 0) : ''
        };
        return { rows, endGap };
    },

    // ---- Labels ------------------------------------------------------------------------

    // Defaults overlaid with a host's `labels` option (unknown or non-string entries ignored).
    labels(defaults, overrides) {
        const out = { ...defaults };
        if (overrides && typeof overrides === 'object') {
            Object.keys(defaults).forEach(key => {
                if (typeof overrides[key] === 'string') out[key] = overrides[key];
            });
        }
        return out;
    },

    // Fill {placeholders} in a label: format('Move {name}', { name: 'Bug' }) → 'Move Bug'.
    format(template, values) {
        let out = String(template);
        Object.keys(values || {}).forEach(key => {
            out = out.split('{' + key + '}').join(DzGlobal.text(values[key]));
        });
        return out;
    },

    // A label split around one placeholder, for markup that styles the value:
    // parts('Moving {name}.', 'name', 'Bug') → { before: 'Moving ', value: 'Bug', after: '.' }.
    parts(template, key, value) {
        const token = '{' + key + '}';
        const at = String(template).indexOf(token);
        if (at < 0) return { before: String(template), value: '', after: '' };
        return { before: template.slice(0, at), value: DzGlobal.text(value), after: template.slice(at + token.length) };
    },

    // ---- Dates -------------------------------------------------------------------------
    // Dates are local 'YYYY-MM-DD' keys, optionally 'YYYY-MM-DDTHH:mm', which compare as plain
    // strings. Never new Date('YYYY-MM-DD'): that parses as UTC, a day early west of Greenwich.

    // A local-midnight Date for a key (anything after the first 10 characters ignored), or null.
    parseDate(value) {
        if (typeof value !== 'string' || value.length < 10) return null;
        const parts = value.slice(0, 10).split('-');
        if (parts.length !== 3) return null;
        const [year, month, day] = parts.map(Number);
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 1000) return null;
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
    },

    todayKey() {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    },

    // Whole days from key a to key b (negative when b is earlier).
    daysBetween(a, b) {
        return Math.round((DzGlobal.parseDate(b) - DzGlobal.parseDate(a)) / 86400000);
    },

    // The 'HH:mm' of a 'YYYY-MM-DDTHH:mm' value (or of a bare 'HH:mm'), or '' when it has none.
    timeOf(value) {
        if (typeof value !== 'string') return '';
        const text = value.length === 5 ? value : (value.length >= 16 && value.charAt(10) === 'T' ? value.slice(11, 16) : '');
        if (text.charAt(2) !== ':') return '';
        const hours = Number(text.slice(0, 2));
        const minutes = Number(text.slice(3, 5));
        return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? text : '';
    },

    // A local Date for a date or date-time value (time applied), or null.
    dateTime(value) {
        const date = DzGlobal.parseDate(value);
        const time = date ? DzGlobal.timeOf(value) : '';
        if (time) date.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)));
        return date;
    },

    // Intl date formatter for a locale; an invalid locale falls back to the browser's.
    dateFormatter(locale, options) {
        try {
            return new Intl.DateTimeFormat(locale || undefined, options);
        } catch (error) {
            return new Intl.DateTimeFormat(undefined, options);
        }
    },

    // ---- Links and contacts --------------------------------------------------------------

    // A link from data that is safe to put in an href: http(s), mailto, tel, or a site or
    // relative path. Anything else (javascript:, data:, a protocol-relative //host) becomes ''.
    safeHref(value) {
        const text = DzGlobal.text(value).trim();
        if (!text) return '';
        const lower = text.toLowerCase();
        if (lower.startsWith('https://') || lower.startsWith('http://') || lower.startsWith('mailto:') || lower.startsWith('tel:')) return text;
        if (text.startsWith('//')) return '';
        const colon = text.indexOf(':');
        const slash = text.indexOf('/');
        return colon === -1 || (slash !== -1 && slash < colon) ? text : '';
    },

    // { name, email, emailHref, phone, phoneHref, fax, any } from a contact object. An email
    // without "@" (or with spaces) is dropped; the phone link keeps only digits and "+".
    contact(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const t = value => DzGlobal.text(value).trim();
        const email = t(source.email);
        const validEmail = email.includes('@') && !email.includes(' ') ? email : '';
        const phone = t(source.phone);
        const dial = phone.split('').filter(ch => '0123456789+'.includes(ch)).join('');
        const out = {
            name: t(source.name), email: validEmail, emailHref: validEmail ? 'mailto:' + validEmail : '',
            phone, phoneHref: dial ? 'tel:' + dial : '', fax: t(source.fax)
        };
        out.any = !!(out.name || out.email || out.phone || out.fax);
        return out;
    },

    // ---- Files -------------------------------------------------------------------------

    // A file's short type for display, 'PDF' or 'DOCX': from `type` (text such as 'pdf', or a
    // MIME type such as 'application/pdf'), else from the extension of the first of `names` (a
    // file name, a link) that has one. A CMS link like /api/documents/12 has no extension, so
    // the type or file name has to come with the data there.
    fileType(type, ...names) {
        const mimes = {
            'application/pdf': 'PDF', 'application/msword': 'DOC', 'application/vnd.ms-excel': 'XLS',
            'application/vnd.ms-powerpoint': 'PPT', 'application/rtf': 'RTF', 'application/zip': 'ZIP',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
            'text/plain': 'TXT', 'text/csv': 'CSV', 'image/jpeg': 'JPG', 'image/svg+xml': 'SVG'
        };
        const explicit = DzGlobal.text(type).trim();
        if (explicit) {
            const lower = explicit.toLowerCase();
            if (mimes[lower]) return mimes[lower];
            const slash = lower.indexOf('/');
            const subtype = slash > 0 ? lower.slice(slash + 1) : '';
            return (subtype && subtype.length <= 5 ? subtype : explicit).toUpperCase();
        }
        for (const source of names) {
            const path = DzGlobal.text(source).trim().split('?')[0].split('#')[0];
            const file = path.slice(path.lastIndexOf('/') + 1);
            const dot = file.lastIndexOf('.');
            const extension = dot > 0 ? file.slice(dot + 1) : '';
            if (extension && extension.length <= 5) return extension.toUpperCase();
        }
        return '';
    },

    // A type's family, for its icon color: pdf, word, sheet, slides, image, archive, media, text
    // or other.
    fileKind(type) {
        const t = DzGlobal.text(type).trim().toLowerCase();
        const families = {
            pdf: ['pdf'],
            word: ['doc', 'docx', 'odt', 'rtf', 'pages'],
            sheet: ['xls', 'xlsx', 'xlsm', 'csv', 'ods', 'numbers'],
            slides: ['ppt', 'pptx', 'odp', 'key'],
            image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'tif', 'tiff', 'bmp', 'heic'],
            archive: ['zip', '7z', 'rar', 'gz', 'tar'],
            media: ['mp3', 'mp4', 'm4a', 'wav', 'mov', 'webm', 'avi'],
            text: ['txt', 'md', 'json', 'xml', 'html', 'htm']
        };
        return Object.keys(families).find(kind => families[kind].includes(t)) || 'other';
    },

    // Bytes as '512 B', '180 KB' or '2.3 MB'; text passes through.
    fileSize(size) {
        if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
            if (size < 1024) return size + ' B';
            if (size < 1048576) return Math.round(size / 1024) + ' KB';
            return Math.round(size / 1048576 * 10) / 10 + ' MB';
        }
        return DzGlobal.text(size).trim();
    },

    // ---- Pagination ----------------------------------------------------------------------

    // The page buttons to show for `page` of `count`: numbers, with 0 for a gap. At most seven
    // entries, always the first and last page, so the row keeps its width as the page changes:
    // [1, 2, 3, 4, 5, 0, 12] · [1, 0, 5, 6, 7, 0, 12] · [1, 0, 8, 9, 10, 11, 12].
    pageList(page, count) {
        const total = Math.max(1, Math.floor(Number(count)) || 1);
        const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), total);
        const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
        if (total <= 7) return range(1, total);
        if (current <= 4) return [...range(1, 5), 0, total];
        if (current >= total - 3) return [1, 0, ...range(total - 4, total)];
        return [1, 0, current - 1, current, current + 1, 0, total];
    },

    // Everything a numbered pager draws, for `list` shown `size` at a time at page `page`:
    // the rows for that page, the button entries (0 = a gap, from pageList), how many pages,
    // and the "from–to of count" numbers. `size` 0 puts everything on one page. `labels` gives
    // pageLabel ('Page {page}', each button's name) and pageOf ('Page {page} of {count}', the
    // narrow-screen line).
    paging(list, page, size, labels) {
        const rows = Array.isArray(list) ? list : [];
        const n = Math.floor(Number(size));
        const per = n > 0 ? n : 0;
        const count = rows.length;
        const pageCount = per ? Math.max(1, Math.ceil(count / per)) : 1;
        const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pageCount);
        const start = per ? (current - 1) * per : 0;
        const items = per ? rows.slice(start, start + per) : rows;
        let gaps = 0;
        const entries = DzGlobal.pageList(current, pageCount).map(number => ({
            key: number ? 'p' + number : 'gap' + (++gaps), page: number, current: number === current,
            label: number ? DzGlobal.format((labels && labels.pageLabel) || 'Page {page}', { page: number }) : ''
        }));
        return {
            items, count, pageCount, page: current, entries,
            from: items.length ? start + 1 : 0,
            to: items.length ? start + items.length : 0,
            atFirst: current <= 1, atLast: current >= pageCount,
            pageOfText: DzGlobal.format((labels && labels.pageOf) || 'Page {page} of {count}', { page: current, count: pageCount })
        };
    },

    // ---- Child components --------------------------------------------------------------

    // Create components listed as data — [{ type: 'event_details', props: { ... }, slot }] — as
    // light-DOM children of `host`, each by its dz-type (the module handler loads it like any
    // other), in the named `slot` when one is given. Earlier ones made the same way (marked with
    // the `marker` attribute) are removed first; children placed inside by hand are left alone.
    // Container components use this for an `items` option.
    renderItems(host, list, marker) {
        if (!host) return;
        Array.prototype.filter.call(host.children, el => el.hasAttribute(marker)).forEach(el => el.remove());
        (Array.isArray(list) ? list : []).forEach(entry => {
            const type = entry && typeof entry === 'object' ? DzGlobal.text(entry.type).trim() : '';
            if (!type) return;
            const el = document.createElement('dz-component');
            el.setAttribute('dz-type', type);
            el.setAttribute(marker, '');
            const slot = DzGlobal.text(entry.slot).trim();
            if (slot) el.setAttribute('slot', slot);
            el._props = JSON.parse(JSON.stringify(entry.props && typeof entry.props === 'object' ? entry.props : {}));
            host.appendChild(el);
        });
    },

    // ---- Menu --------------------------------------------------------------------------

    // Valid `menu` entries ({ event, label, needsSelection }), each marked off when it needs a
    // selection there isn't. `hint` formats the tooltip of an unavailable entry.
    menuEntries(menu, hasSelection, hint) {
        const entries = Array.isArray(menu) ? menu : [];
        return entries
            .filter(entry => entry && typeof entry === 'object' && entry.event && entry.label)
            .map((entry, i) => {
                const disabled = !!entry.needsSelection && !hasSelection;
                const label = String(entry.label);
                return { key: String(entry.event) + '#' + i, event: String(entry.event), label, disabled,
                         title: disabled ? DzGlobal.format(hint, { label }) : label };
            });
    },

    // Up/Down between dropdown entries. Returns true when it handled the key.
    menuArrowKeys(event, root, selector) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
        const entries = [...root.querySelectorAll(selector)];
        if (!entries.length) return false;
        const at = entries.indexOf(event.target);
        const next = event.key === 'ArrowDown' ? (at + 1) % entries.length : (at <= 0 ? entries.length - 1 : at - 1);
        entries[next].focus();
        event.preventDefault();
        return true;
    },

    // Close a dropdown on a click outside `root` or when focus leaves it. Returns a cleanup.
    closeOnOutside(root, isOpen, close) {
        const onPointer = event => {
            if (isOpen() && !event.composedPath().includes(root)) close();
        };
        const onFocusOut = event => {
            if (isOpen() && event.relatedTarget && !root.contains(event.relatedTarget)) close();
        };
        document.addEventListener('pointerdown', onPointer);
        root.addEventListener('focusout', onFocusOut);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            root.removeEventListener('focusout', onFocusOut);
        };
    },

    // ---- Focus and announcements -------------------------------------------------------

    // Focus the first match once the pending render has landed. Resolves true if found.
    async focusIn(root, selector) {
        const deezul = window.Deezul;
        if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
        const target = root.querySelector(selector);
        if (target) target.focus();
        return !!target;
    },

    // Say something through a component's live region (a role="status" element bound to
    // `liveMessage`). Cleared first, so repeating the same message is announced again.
    async announce(component, message) {
        component.liveMessage = '';
        const deezul = window.Deezul;
        if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
        await new Promise(resolve => setTimeout(resolve, 50));
        component.liveMessage = message;
    }
};

window.DzGlobal = DzGlobal;
export default DzGlobal;
