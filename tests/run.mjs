/*
 * tests/run.mjs — browser tests for the library, run against the built gallery.
 *
 *   npm test            build, then test
 *   npm run test:only   test the dist/ that is already there
 *
 * Serves dist/ on a free port, starts a headless Chromium browser (Edge or Chrome) and drives
 * it over the DevTools protocol — no test framework, no browser download. It checks that every
 * gallery page loads without console errors and without axe-core accessibility violations, and
 * a handful of behaviours that are easy to break without noticing.
 *
 * Browser: set BROWSER to an executable to choose one; otherwise the usual Edge and Chrome
 * install paths are tried. Exits 1 when anything fails.
 *
 * Kept free of backslash escapes on purpose (see global.js).
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const AXE = path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js');
const catalog = (await import('../catalog.config.js')).default;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ is missing. Run "npm test" (which builds first) or "npm run build".');
    process.exit(1);
}
if (!fs.existsSync(AXE)) {
    console.error('axe-core is missing. Run "npm install".');
    process.exit(1);
}

// ---- Static server: files from dist/, everything else falls back to index.html (client routes).
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
                '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const BASE = 'http://127.0.0.1:' + server.address().port;

// ---- Browser.
const candidates = [
    process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'
].filter(Boolean);
const executable = candidates.find(file => fs.existsSync(file));
if (!executable) {
    console.error('No Edge or Chrome found. Set BROWSER to a Chromium-based browser executable.');
    server.close();
    process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-components-test-'));
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });

// With port 0 the browser picks one and writes it to DevToolsActivePort in the profile.
let debugPort = null;
for (let i = 0; i < 100 && !debugPort; i++) {
    const file = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(file)) debugPort = fs.readFileSync(file, 'utf8').split(String.fromCharCode(10))[0].trim() || null;
    if (!debugPort) await sleep(100);
}
let pageTarget = null;
for (let i = 0; debugPort && i < 50 && !pageTarget; i++) {
    try {
        const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json();
        pageTarget = targets.find(target => target.type === 'page') || null;
    } catch { /* not ready yet */ }
    if (!pageTarget) await sleep(100);
}
if (!pageTarget) {
    console.error('Could not connect to ' + executable);
    await shutdown(1);
}

// ---- DevTools protocol client.
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve));
let nextId = 0;
const pending = new Map();
const consoleErrors = [];
const dialogAnswers = [];   // queued answers for prompt/confirm: a string, or false to cancel
ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
    }
    if (message.method === 'Page.javascriptDialogOpening') {
        const answer = dialogAnswers.length ? dialogAnswers.shift() : true;
        send('Page.handleJavaScriptDialog', { accept: answer !== false, promptText: typeof answer === 'string' ? answer : '' });
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        consoleErrors.push('console.error: ' + message.params.args.map(a => a.value ?? a.description).join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        consoleErrors.push('exception: ' + ((details.exception && details.exception.description) || details.text));
    }
});
function send(method, params = {}) {
    return new Promise(resolve => {
        const id = ++nextId;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

// Helpers available to every page-side snippet.
const HELPERS = [
    'const deepAll = (sel, root = document) => { const out = [...root.querySelectorAll(sel)];',
    '  root.querySelectorAll("*").forEach(el => { if (el.shadowRoot) out.push(...deepAll(sel, el.shadowRoot)); }); return out; };',
    'const hosts = type => deepAll("dz-component[dz-type=" + JSON.stringify(type) + "]").filter(h => !h.classList.contains("side"));',
    'const wait = (ms = 250) => new Promise(r => setTimeout(r, ms));',
    'const click = async el => { if (!el) throw new Error("element not found"); el.click(); await wait(); };',
    'const labelOf = el => (el.querySelector(".acc-label, .dl-label") || el).textContent.trim();',
    'const rowButton = (sr, text) => [...sr.querySelectorAll(".acc-row button:not(.acc-gap), .dl-row button:not(.dl-gap)")].find(b => labelOf(b) === text);',
    'const tool = (sr, name) => { const icon = sr.querySelector(".acc-tools .i-" + name + ", .dl-tools .i-" + name); return icon && icon.closest("button"); };',
    'const labels = sr => [...sr.querySelectorAll(".acc-row button:not(.acc-gap), .dl-row button:not(.dl-gap)")].map(labelOf);',
    'const logLines = () => deepAll(".log-list > div:not(.log-empty)").map(li => li.textContent.trim());',
    'const openPrompt = async () => { for (let i = 0; i < 60; i++) { const h = [...document.querySelectorAll("dz-component[data-dz-prompt]")].pop();',
    '  const m = h && h.shadowRoot && h.shadowRoot.querySelector("dz-component[dz-type=modal_dialog]"); const d = m && m.shadowRoot && m.shadowRoot.querySelector("dialog");',
    '  if (d && d.open) return h.shadowRoot; await wait(100); } throw new Error("no DzPrompt dialog opened"); };',
    'const answer = async reply => { const sr = await openPrompt(); if (typeof reply === "string") { const input = sr.querySelector("#pd-input");',
    '  input.value = reply; input.dispatchEvent(new Event("input", { bubbles: true })); }',
    '  sr.querySelector(reply === false ? ".pd-cancel" : ".pd-confirm").click(); await wait(500); };'
].join(String.fromCharCode(10));

async function run(snippet) {
    const response = await send('Runtime.evaluate', {
        expression: '(async () => {' + HELPERS + String.fromCharCode(10) + snippet + '})()',
        awaitPromise: true, returnByValue: true
    });
    const details = response.result.exceptionDetails;
    if (details) throw new Error((details.exception && details.exception.description) || details.text);
    return response.result.result.value;
}

// Navigate and wait until every component on the page has rendered, and the count has settled.
async function load(urlPath) {
    consoleErrors.length = 0;
    await send('Page.navigate', { url: BASE + urlPath });
    let last = -1;
    for (let i = 0; i < 60; i++) {
        await sleep(250);
        const count = await run('const all = deepAll("dz-component"); return document.readyState === "complete" && all.length &&'
            + ' all.every(h => h.shadowRoot && h.shadowRoot.childElementCount > 0) ? all.length : 0;').catch(() => 0);
        if (count && count === last) return;
        last = count;
    }
    throw new Error('page did not finish rendering: ' + urlPath);
}

// ---- Tiny runner.
const results = [];
async function test(name, fn) {
    try {
        await fn();
        if (consoleErrors.length) throw new Error(consoleErrors.join(' | '));
        results.push(true);
        console.log('  ok    ' + name);
    } catch (error) {
        results.push(false);
        console.log('  FAIL  ' + name);
        console.log('        ' + error.message.split(String.fromCharCode(10))[0]);
    }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
};

async function shutdown(code) {
    try { ws.close(); } catch { /* not open */ }
    browser.kill();
    server.close();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold a lock */ }
    process.exit(code);
}

await send('Runtime.enable');
await send('Page.enable');
const axeSource = fs.readFileSync(AXE, 'utf8');

// ---- Every page: renders, no console errors, no accessibility violations.
console.log('Pages');
for (const urlPath of ['/', ...catalog.map(entry => '/c/' + entry.ref), '/events/conference', '/events/missing', '/jobs/dispatcher', '/bids/road-resurfacing', '/news/road-resurfacing-begins', '/news/missing']) {
    await test(urlPath + ' has no console errors or axe violations', async () => {
        await load(urlPath);
        await send('Runtime.evaluate', { expression: axeSource });
        const response = await send('Runtime.evaluate', {
            awaitPromise: true, returnByValue: true,
            expression: 'axe.run(document).then(r => r.violations.map(v => v.impact + " " + v.id + " at " + JSON.stringify(v.nodes[0].target)))'
        });
        const violations = response.result.result.value || [];
        assert(!violations.length, violations.join(' | '));
    });
}

// ---- Behaviour.
console.log('Dynamic list');
await test('add, then delete, go through the gallery event log', async () => {
    await load('/c/dynamic_list');
    const added = await run('const sr = hosts("dynamic_list")[0].shadowRoot; await click(tool(sr, "add")); await answer("Zebra"); return { labels: labels(sr), log: logLines()[0] };');
    assert(added.labels.includes('Zebra'), 'Zebra was not added: ' + JSON.stringify(added.labels));
    assert(added.log.startsWith('add'), 'log did not record add: ' + added.log);
    const kept = await run('const sr = hosts("dynamic_list")[0].shadowRoot; await click(rowButton(sr, "Bug")); await click(tool(sr, "delete")); await answer(false); return { labels: labels(sr), log: logLines()[0] };');
    assert(kept.labels.includes('Bug') && kept.log.includes('(kept)'), 'cancelling the delete kept Bug: ' + JSON.stringify(kept));
    const deleted = await run('const sr = hosts("dynamic_list")[0].shadowRoot; await click(tool(sr, "delete")); await answer(true); return { labels: labels(sr), log: logLines()[0] };');
    assert(!deleted.labels.includes('Bug'), 'Bug is still listed');
    assert(deleted.log.startsWith('delete'), 'log did not record delete: ' + deleted.log);
});
await test('add and delete send toasts; Undo in the toast puts the item back', async () => {
    await load('/c/dynamic_list');
    const state = await run('const sr = hosts("dynamic_list")[0].shadowRoot; const out = {};'
        + ' await click(tool(sr, "add")); await answer("Zebra"); out.added = DzToast.list().map(t => t.tone + " " + t.message);'
        + ' await click(rowButton(sr, "Bug")); await click(tool(sr, "delete")); await answer(true); await wait(300);'
        + ' const region = document.querySelector("dz-component[data-dz-toast]").shadowRoot;'
        + ' const undo = [...region.querySelectorAll(".tr-toast")].find(li => li.textContent.includes("Deleted")).querySelector(".tr-action");'
        + ' out.deleted = [labels(sr).includes("Bug"), undo.textContent.trim()];'
        + ' await click(undo); await wait(300); out.undone = [labels(sr).includes("Bug"), DzToast.list().map(t => t.message)]; return out;');
    equal(state.added, ['success Added "Zebra"'], 'add sends a success toast');
    equal(state.deleted, [false, 'Undo'], 'delete sends a toast with Undo');
    equal(state.undone[0], true, 'Undo restores Bug');
    assert(state.undone[1].includes('Restored') && !state.undone[1].some(m => m.startsWith('Deleted')), 'the Undo toast closed: ' + JSON.stringify(state.undone[1]));
});

console.log('Accordion list');
await test('move places the item where it was dropped', async () => {
    await load('/c/accordion_list');
    const order = await run('const sr = hosts("accordion_list")[0].shadowRoot;'
        + ' await click(rowButton(sr, "Residents")); await click(rowButton(sr, "Voter registration")); await click(tool(sr, "move"));'
        + ' const gap = [...sr.querySelectorAll(".acc-gap")].find(g => g.getAttribute("aria-label").includes("before Property taxes"));'
        + ' await click(gap); await wait(300); return labels(sr);');
    equal(order, ['Voter registration', 'Property taxes', 'Trash & recycling'], 'order after the move');
});
await test('deleting the last child keeps its parent open', async () => {
    await load('/c/accordion_list');
    const state = await run('const sr = hosts("accordion_list")[0].shadowRoot;'
        + ' await click(rowButton(sr, "Parks & recreation"));'
        + ' for (const name of ["Programs & classes", "Reserve a shelter"]) { await click(rowButton(sr, name)); await click(tool(sr, "delete")); await answer(true); }'
        + ' const here = sr.querySelector(".acc-here"); const empty = sr.querySelector(".acc-empty");'
        + ' const out = { here: here && here.textContent.trim(), empty: empty && empty.textContent.trim(), rows: labels(sr).length };'
        + ' await click(sr.querySelector(".acc-up.is-home")); out.leafAfter = !!rowButton(sr, "Parks & recreation") && rowButton(sr, "Parks & recreation").classList.contains("acc-leaf");'
        + ' return out;');
    equal(state, { here: 'Parks & recreation', empty: 'No items', rows: 0, leafAfter: true }, 'view after deleting both children');
});

console.log('Accordion');
await test('closed bodies are hidden and linked from their button', async () => {
    await load('/c/accordion');
    const state = await run('const sr = hosts("accordion")[0].shadowRoot; const btn = sr.querySelector(".ac-toggle");'
        + ' const body = () => sr.getElementById(btn.getAttribute("aria-controls"));'
        + ' const closed = [btn.getAttribute("aria-expanded"), getComputedStyle(body().closest(".ac-row")).display];'
        + ' await click(btn); const opened = [btn.getAttribute("aria-expanded"), getComputedStyle(body().closest(".ac-row")).display];'
        + ' return { closed, opened };');
    equal(state, { closed: ['false', 'none'], opened: ['true', 'block'] }, 'aria-expanded and display');
});
await test('heading levels stop at 6', async () => {
    const levels = await run('const el = document.createElement("dz-component"); el.setAttribute("dz-type", "accordion");'
        + ' el._props = { title: "Deep", headingLevel: 5, openAll: true, items: [{ id: "a", label: "A", children: [{ id: "b", label: "B", children: [{ id: "c", label: "C", content: "x" }] }] }] };'
        + ' document.body.appendChild(el); await wait(700);'
        + ' const out = [...el.shadowRoot.querySelectorAll("[role=heading]")].map(h => h.getAttribute("aria-level")); el.remove(); return out;');
    equal(levels, ['5', '6', '6', '6'], 'aria-level of title and sections');
});

console.log('Side nav');
await test('matchPrefix keeps a link current on the pages below it', async () => {
    await load('/c/side_nav');
    const current = await run('const sr = hosts("side_nav").find(h => h.shadowRoot.querySelector("nav").getAttribute("aria-label") === "Shop (matchPrefix)").shadowRoot;'
        + ' return [...sr.querySelectorAll("[aria-current=page]")].map(a => a.textContent.trim());');
    equal(current, ['Orders'], 'links marked current');
});

console.log('Calendar: month');
const CAL = 'const cals = hosts("calendar_month").map(h => h.shadowRoot);'
    + ' const tabStop = sr => [...sr.querySelectorAll(".cal-date")].find(b => b.tabIndex === 0);'
    + ' const focusKey = sr => tabStop(sr).getAttribute("data-date");'
    + ' const heading = sr => sr.querySelector(".cal-month").textContent.trim();'
    + ' const navBtn = (sr, i) => sr.querySelectorAll(".cal-nav .cal-btn")[i];';
await test('next month moves the view, and a view of the same calendar follows', async () => {
    await load('/c/calendar_month');
    const state = await run(CAL + ' const before = cals.map(focusKey); const headingBefore = heading(cals[0]);'
        + ' await click(navBtn(cals[0], 2)); await wait(300);'
        + ' return { before, after: cals.map(focusKey), headingChanged: heading(cals[0]) !== headingBefore, log: logLines()[0] };');
    assert(state.headingChanged, 'the month heading did not change');
    assert(state.after[0].slice(0, 7) !== state.before[0].slice(0, 7), 'the first view stayed on its month');
    equal(state.after[1], state.after[0], 'the second view of calendar "demo" follows the first');
    equal(state.after[2], state.before[2], 'the view of calendar "wide" is unaffected');
    assert(state.log.startsWith('month-change'), 'month-change was not logged: ' + state.log);
});
await test('arrow keys, Home and Page Down move the focused day', async () => {
    await load('/c/calendar_month');
    const moves = await run(CAL + ' const sr = cals[2]; const keys = [];'
        + ' const press = async key => {'
        + '   sr.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true })); await wait(250); keys.push(sr.activeElement.getAttribute("data-date")); };'
        + ' tabStop(sr).focus(); const start = sr.activeElement.getAttribute("data-date");'
        + ' await press("ArrowRight"); await press("ArrowDown"); await press("Home"); await press("PageDown");'
        + ' return { start, keys, weekday: new Date(keys[2] + "T00:00").getDay() };');
    const addDays = (key, n) => {
        const [y, m, d] = key.split('-').map(Number);
        const date = new Date(y, m - 1, d + n);
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    };
    equal(moves.keys[0], addDays(moves.start, 1), 'ArrowRight');
    equal(moves.keys[1], addDays(moves.start, 8), 'ArrowDown');
    equal(moves.weekday, 0, 'Home lands on Sunday (weekStart 0)');
    assert(moves.keys[3].slice(0, 7) !== moves.keys[2].slice(0, 7), 'PageDown stayed in the month: ' + moves.keys[3]);
});
await test('the range stops at December of next year', async () => {
    await load('/c/calendar_month');
    const state = await run(CAL + ' const sr = cals[0]; const year = new Date().getFullYear() + 1;'
        + ' const pick = async (cls, value) => { const s = sr.querySelector(cls); s.value = String(value); s.dispatchEvent(new Event("change", { bubbles: true })); await wait(300); };'
        + ' await pick(".cal-select-year", year); await pick(".cal-select-month", 11);'
        + ' const at = focusKey(sr); const disabled = navBtn(sr, 2).getAttribute("aria-disabled");'
        + ' await click(navBtn(sr, 2)); await wait(300);'
        + ' const years = [...sr.querySelectorAll(".cal-select-year option")].map(o => o.value);'
        + ' return { month: at.slice(0, 7), expected: year + "-12", disabled, after: focusKey(sr).slice(0, 7), years };');
    equal(state.month, state.expected, 'month after choosing December of next year');
    equal(state.disabled, 'true', 'next is marked unavailable');
    equal(state.after, state.expected, 'next did not move past the range');
    equal(state.years.length, 3, 'year choices (one back, this one, one ahead)');
});
await test('selecting today lists its events, announces and logs select-date', async () => {
    await load('/c/calendar_month');
    const state = await run(CAL + ' const sr = cals[0]; const today = sr.querySelector(".cal-day.is-today .cal-date");'
        + ' await click(today); await wait(400);'
        + ' return { pressed: today.closest(".cal-day").getAttribute("aria-selected"), heading: (sr.querySelector(".cal-day-heading") || {}).textContent,'
        + '   items: [...sr.querySelectorAll(".cal-agenda-label")].map(e => e.textContent.trim()), live: sr.querySelector(".cal-sr[role=status]").textContent.trim(),'
        + '   log: logLines()[0], name: today.getAttribute("aria-label") };');
    equal(state.pressed, 'true', 'aria-selected on the day');
    equal(state.items, ['Release notes due', 'Standup', 'Team lunch', 'Design review'], 'the day list (all-day first, then by time)');
    assert(state.heading && state.heading.startsWith('Events on'), 'day list heading: ' + state.heading);
    assert(state.live.includes('selected, 4 events'), 'announcement: ' + state.live);
    assert(state.name.includes('today, 4 events'), 'day name: ' + state.name);
    assert(state.log.startsWith('select-date'), 'select-date was not logged: ' + state.log);
});

console.log('Calendar: week');
const WEEK = 'const weeks = hosts("calendar_week").map(h => h.shadowRoot);'
    + ' const cards = (sr, col) => [...sr.querySelectorAll(".wk-col")[col].querySelectorAll(".wk-card")];';
const localKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
await test('two columns: cards for this week, then upcoming cards after it', async () => {
    await load('/c/calendar_week');
    const state = await run(WEEK + ' const sr = weeks[0];'
        + ' const standup = cards(sr, 0).find(c => c.querySelector(".wk-card-title").textContent.trim() === "Standup");'
        + ' return { columns: getComputedStyle(sr.querySelector(".wk-columns")).gridTemplateColumns.split(" ").length,'
        + '   headings: [...sr.querySelectorAll(".wk-heading")].map(h => h.textContent.trim()),'
        + '   week: cards(sr, 0).map(c => c.getAttribute("data-date")), upcoming: cards(sr, 1).map(c => c.getAttribute("data-date")),'
        + '   standup: standup && { tag: standup.tagName, meta: standup.querySelector(".wk-meta").textContent.trim(),'
        + '     loc: standup.querySelector(".wk-loc").textContent.trim(), name: standup.getAttribute("aria-label") },'
        + '   limited: cards(weeks[1], 1).length };');
    const today = new Date();
    const from = localKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()));
    const to = localKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 6));
    equal(state.columns, 2, 'grid columns');
    equal(state.headings, ['This week', 'Upcoming'], 'column headings');
    assert(state.week.length > 0 && state.week.every(key => key >= from && key <= to), 'this week: ' + JSON.stringify(state.week));
    assert(state.upcoming.length >= 1 && state.upcoming.length <= 5 && state.upcoming.every(key => key > to), 'upcoming: ' + JSON.stringify(state.upcoming));
    equal([...state.upcoming].sort(), state.upcoming, 'upcoming is soonest first');
    assert(state.limited <= 3, 'upcomingLimit 3 showed ' + state.limited);
    assert(state.standup, 'no Standup card this week');
    equal(state.standup.tag, 'BUTTON', 'without detailsHref a card is a button');
    assert(state.standup.meta.includes('9:00') && state.standup.meta.includes('9:15'), 'time range: ' + state.standup.meta);
    equal(state.standup.loc, 'Room 2B', 'location');
    assert(state.standup.name.startsWith('Standup, ') && state.standup.name.endsWith(', Room 2B'), 'card name: ' + state.standup.name);
});
await test('a card reports event-click, and detailsHref makes cards links', async () => {
    await load('/c/calendar_week');
    const state = await run(WEEK + ' await click(cards(weeks[0], 0)[0]); await wait(300);'
        + ' const links = cards(weeks[1], 0).concat(cards(weeks[1], 1));'
        + ' return { log: logLines()[0], tags: [...new Set(links.map(c => c.tagName))], hrefs: links.map(c => c.getAttribute("href")) };');
    assert(state.log.startsWith('event-click'), 'event-click was not logged: ' + state.log);
    equal(state.tags, ['A'], 'card elements with detailsHref');
    assert(state.hrefs.includes('/events/standup'), 'links: ' + JSON.stringify(state.hrefs));
});
await test('an empty calendar says so, and the columns stack when narrow', async () => {
    await load('/c/calendar_week');
    const state = await run(WEEK + ' const sr = weeks[2]; const host = hosts("calendar_week")[2]; host.style.width = "360px"; await wait(300);'
        + ' return { empty: [...sr.querySelectorAll(".wk-empty")].map(p => p.textContent.trim()),'
        + '   columns: getComputedStyle(sr.querySelector(".wk-columns")).gridTemplateColumns.split(" ").length };');
    equal(state, { empty: ['Nothing this week', 'Nothing in the next 30 days'], columns: 1 }, 'empty and narrow');
});

console.log('Event details');
const DETAILS = 'const details = () => hosts("event_details").map(h => h.shadowRoot);'
    + ' const read = sr => ({ title: (sr.querySelector(".ed-title") || {}).textContent, when: (sr.querySelector(".ed-when") || {}).textContent,'
    + '   facts: [...sr.querySelectorAll(".ed-fact")].map(f => f.querySelector("dt").textContent.trim() + ": " + f.querySelector("dd").textContent.trim()),'
    + '   ended: !!sr.querySelector(".ed-ended"), link: (sr.querySelector(".ed-link") || { getAttribute: () => null }).getAttribute("href"),'
    + '   lines: sr.querySelector(".ed-description") ? sr.querySelector(".ed-description").innerText.split(String.fromCharCode(10)).length : 0,'
    + '   back: (sr.querySelector(".ed-back") || { getAttribute: () => null }).getAttribute("href") });';
await test('a week card link opens the event details page', async () => {
    await load('/c/calendar_week');
    await run('const link = [...deepAll("dz-component[dz-type=calendar_week]")[1].shadowRoot.querySelectorAll("a.wk-card")].find(a => a.getAttribute("href") === "/events/standup");'
        + ' if (!link) throw new Error("no link to /events/standup"); link.click();');
    let state = null;
    for (let i = 0; i < 40 && !(state && state.title); i++) {
        await sleep(250);
        state = await run(DETAILS + ' const sr = details()[0]; return sr ? { path: location.pathname, ...read(sr) } : { path: location.pathname };').catch(() => null);
    }
    assert(state, 'the details page did not render');
    equal(state.path, '/events/standup', 'address after the click');
    equal(state.title && state.title.trim(), 'Standup', 'title');
    assert(state.when.includes('9:00') && state.when.includes('9:15'), 'when: ' + state.when);
    equal(state.facts, ['Where: Room 2B', 'Organizer: Priya Shah'], 'facts');
    equal(state.back, '/c/calendar_week', 'back link');
});
await test('a direct load shows the event; description, ended and not found', async () => {
    await load('/events/conference');
    const conference = await run(DETAILS + ' return read(details()[0]);');
    equal(conference.title.trim(), 'Conference', 'title');
    equal(conference.link, null, 'no more information button');
    assert(conference.lines >= 3, 'description line breaks were not kept: ' + conference.lines + ' lines');
    equal(conference.ended, false, 'upcoming event marked ended');
    await load('/c/event_details');
    const demos = await run(DETAILS + ' return details().map(read);');
    equal(demos[2].ended, true, 'past event is marked ended');
    equal(demos[3].title.trim(), 'Event not found', 'unknown id');
});

console.log('Job listings');
const JOBS = 'const lists = () => hosts("job_listings").map(h => h.shadowRoot);'
    + ' const titles = sr => [...sr.querySelectorAll(".jl-job-title")].map(t => t.textContent.trim());'
    + ' const setValue = async (sr, selector, value, type) => { const el = sr.querySelector(selector); el.value = value;'
    + '   el.dispatchEvent(new Event(type, { bubbles: true })); await wait(300); };'
    + ' const count = sr => sr.querySelector(".jl-count").textContent.trim();';
await test('open jobs show as cards, newest first, closed ones hidden', async () => {
    await load('/c/job_listings');
    const state = await run(JOBS + ' const sr = lists()[0]; const first = sr.querySelector(".jl-card");'
        + ' return { titles: titles(sr), count: count(sr), href: first.querySelector("a.jl-link").getAttribute("href"),'
        + '   chips: [...first.querySelectorAll(".jl-chip")].map(c => c.textContent.trim()),'
        + '   facts: [...first.querySelectorAll(".jl-fact")].map(f => f.textContent.trim().split(" ").filter(Boolean).join(" ")) };');
    equal(state.titles.length, 7, 'cards');
    equal(state.titles[0], 'Case Manager', 'newest first');
    assert(!state.titles.includes('Highway Maintenance Worker'), 'the closed job is listed');
    equal(state.count, '7 positions', 'count');
    equal(state.href, '/jobs/case-manager', 'card link');
    equal(state.chips, ['Full Time', 'Hourly', state.chips[2]], 'chips: job type, pay type, status (no "New")');
    assert(state.chips[2].startsWith('Closes '), 'status chip: ' + state.chips[2]);
    equal(state.facts.length, 3, 'pay, location and posted facts');
});
await test('search, division filter, no matches and clear filters', async () => {
    await load('/c/job_listings');
    const state = await run(JOBS + ' const sr = lists()[0]; const out = {};'
        + ' await setValue(sr, "#jl-query", "dispatch", "input"); out.search = titles(sr); out.searchCount = count(sr);'
        + ' await setValue(sr, "#jl-query", "", "input"); await setValue(sr, "#jl-division", "Parks", "change"); out.division = titles(sr);'
        + ' await setValue(sr, "#jl-query", "zzz", "input"); out.empty = sr.querySelector(".jl-empty-text").textContent.trim();'
        + ' await click(sr.querySelector(".jl-clear")); await wait(300);'
        + ' out.cleared = titles(sr).length; out.input = sr.querySelector("#jl-query").value; out.select = sr.querySelector("#jl-division").value;'
        + ' out.focus = sr.activeElement && sr.activeElement.id; return out;');
    equal(state.search, ['911 Dispatcher'], 'search "dispatch"');
    equal(state.searchCount, 'Showing 1 of 7 positions', 'filtered count');
    equal(state.division, ['Seasonal Park Aide'], 'division Parks');
    equal(state.empty, 'No jobs match your search.', 'no matches');
    equal([state.cleared, state.input, state.select, state.focus], [7, '', '', 'jl-query'], 'after clearing');
});
await test('closing-date sort with closed jobs included, and job-click without links', async () => {
    await load('/c/job_listings');
    const state = await run(JOBS + ' const sr = lists()[1];'
        + ' const out = { controls: !!sr.querySelector(".jl-controls"), titles: titles(sr), count: count(sr),'
        + '   closed: sr.querySelector(".jl-chip.is-closed").textContent.trim(), soon: !!sr.querySelector(".jl-card.is-closing") };'
        + ' await click(sr.querySelector("button.jl-link")); await wait(300); out.log = logLines()[0]; return out;');
    equal(state.controls, false, 'filters hidden');
    equal(state.titles.slice(0, 2), ['Highway Maintenance Worker', 'Assessment Officer'], 'closing soonest first');
    equal(state.count, '8 positions', 'count with closed');
    equal(state.closed, 'Closed', 'closed chip');
    assert(state.soon, 'no closing-soon card');
    assert(state.log.startsWith('job-click'), 'job-click was not logged: ' + state.log);
});
await test('pages: three per page, numbered buttons, page-change, focus to the list, and filtering goes back to page 1', async () => {
    await load('/c/job_listings');
    const state = await run(JOBS + ' const sr = lists()[2]; const out = {};'
        + ' const numbers = () => [...sr.querySelectorAll(".jl-page")].map(b => b.textContent.trim() + (b.classList.contains("is-current") ? "*" : ""));'
        + ' out.first = [titles(sr).length, count(sr), numbers(), sr.querySelector(".jl-step.is-prev").disabled, sr.querySelector(".jl-list").getAttribute("aria-label")];'
        + ' await click(sr.querySelector(".jl-step.is-next"));'
        + ' out.second = [titles(sr).length, count(sr), numbers(), sr.activeElement && sr.activeElement.className, logLines()[0]];'
        + ' await click([...sr.querySelectorAll(".jl-page")].pop());'
        + ' out.last = [count(sr), sr.querySelector(".jl-step.is-next").disabled];'
        + ' await setValue(sr, "#jl-query", "aide", "input");'
        + ' out.searched = [titles(sr), count(sr), !!sr.querySelector(".jl-pages")]; return out;');
    equal(state.first, [3, 'Showing 1–3 of 7 positions', ['1*', '2', '3'], true, 'All job openings, page 1 of 3'], 'first page of three');
    equal(state.second.slice(0, 4), [3, 'Showing 4–6 of 7 positions', ['1', '2*', '3'], 'jl-list'], 'Next moves on and focuses the list');
    assert(state.second[4].startsWith('page-change') && state.second[4].includes('page: 2'), 'page-change: ' + state.second[4]);
    equal(state.last, ['Showing 7–7 of 7 positions', true], 'the last page has one card and disables Next');
    equal(state.searched, [['Seasonal Park Aide'], 'Showing 1 of 7 positions', false], 'searching from page 3 shows the match, and the pager goes');
});

console.log('Job details');
await test('a listing card opens the job details page', async () => {
    await load('/c/job_listings');
    await run('const link = [...deepAll("dz-component[dz-type=job_listings]")[0].shadowRoot.querySelectorAll("a.jl-link")].find(a => a.getAttribute("href") === "/jobs/dispatcher");'
        + ' if (!link) throw new Error("no link to /jobs/dispatcher"); link.click();');
    let state = null;
    for (let i = 0; i < 40 && !(state && state.title); i++) {
        await sleep(250);
        state = await run('const host = deepAll("dz-component[dz-type=job_details]")[0]; if (!host) return null; const sr = host.shadowRoot;'
            + ' const title = sr.querySelector(".jd-title"); if (!title) return null;'
            + ' return { path: location.pathname, title: title.textContent.trim(),'
            + '   sections: [...sr.querySelectorAll(".jd-section-title")].map(h => h.textContent.trim()),'
            + '   subs: [...sr.querySelectorAll(".jd-sub-title")].map(h => h.textContent.trim()),'
            + '   bullets: sr.querySelectorAll(".jd-bullets li").length,'
            + '   facts: [...sr.querySelectorAll(".jd-fact dt")].map(d => d.textContent.trim()),'
            + '   links: [...sr.querySelectorAll(".jd-link")].map(a => a.getAttribute("href")),'
            + '   back: sr.querySelector(".jd-back").getAttribute("href"), print: !!sr.querySelector(".jd-print"),'
            + '   levels: [...sr.querySelectorAll("[role=heading]")].map(h => h.getAttribute("aria-level")).join("") };').catch(() => null);
    }
    assert(state, 'the job details page did not render');
    equal(state.path, '/jobs/dispatcher', 'address after the click');
    equal(state.title, '911 Dispatcher', 'title');
    equal(state.sections, ['Brief description', 'Position description', 'Job prerequisites', 'Compensation', 'Application procedure', 'About the division'], 'sections');
    equal(state.subs, ['Minimum qualifications', 'Additional qualifications'], 'subsections');
    assert(state.bullets >= 14, 'bullets: ' + state.bullets);
    equal(state.facts, ['Pay', 'Status', 'Posted', 'Location', 'Job type', 'Pay type', 'Email', 'Phone', 'Fax'], 'at a glance and contact');
    equal(state.links, ['mailto:careers@example.gov', 'tel:7405550148'], 'contact links');
    equal(state.back, '/c/job_listings', 'back link');
    assert(state.print, 'no print button');
    // title 1; brief description, three sections 2 (prerequisites' two subsections 3); two more sections, then both boxes 2
    equal(state.levels, '12223322222', 'heading levels');
});
await test('apply link, closing soon, and a missing job', async () => {
    await load('/c/job_details');
    const state = await run('const srs = hosts("job_details").map(h => h.shadowRoot);'
        + ' return { apply: srs[0].querySelector(".jd-apply").getAttribute("href"), soon: srs[1].querySelector(".jd-chip.is-closing").textContent.trim(),'
        + '   noApply: !srs[1].querySelector(".jd-apply"), missing: srs[2].querySelector(".jd-title").textContent.trim(), noPrint: !srs[2].querySelector(".jd-print") };');
    equal(state.apply, '/apply/dispatcher', 'apply link');
    assert(state.soon.startsWith('Closes '), 'closing soon chip: ' + state.soon);
    equal([state.noApply, state.missing, state.noPrint], [true, 'Job not found', true], 'no apply link, missing job');
});

console.log('Bid listings');
const BIDS = 'const bidLists = () => hosts("bid_listings").map(h => h.shadowRoot);'
    + ' const bidTitles = sr => [...sr.querySelectorAll(".bl-bid-title")].map(t => t.textContent.trim());'
    + ' const setValue = async (sr, selector, value, type) => { const el = sr.querySelector(selector); el.value = value;'
    + '   el.dispatchEvent(new Event(type, { bubbles: true })); await wait(300); };'
    + ' const card = (sr, title) => [...sr.querySelectorAll(".bl-card")].find(c => c.querySelector(".bl-bid-title").textContent.trim() === title);'
    + ' const bidCount = sr => sr.querySelector(".bl-count").textContent.trim();';
await test('cards: due soonest first, past due after, closed left out, empty fields hidden', async () => {
    await load('/c/bid_listings');
    const state = await run(BIDS + ' const sr = bidLists()[0]; const road = card(sr, "2027 Road Resurfacing Program"); const salt = card(sr, "Road Salt Supply");'
        + ' const it = card(sr, "IT Consulting Services");'
        + ' const facts = c => [...c.querySelectorAll(".bl-fact")].map(f => f.textContent.trim());'
        + ' return { titles: bidTitles(sr), count: bidCount(sr), href: road.querySelector("a.bl-link").getAttribute("href"),'
        + '   roadChips: [...road.querySelectorAll(".bl-chip")].map(c => c.textContent.trim()), roadFacts: facts(road),'
        + '   itChips: [...it.querySelectorAll(".bl-chip")].map(c => c.textContent.trim()), itSoon: it.classList.contains("is-soon"),'
        + '   saltChips: [...salt.querySelectorAll(".bl-chip")].map(c => c.textContent.trim()), saltDesc: !!salt.querySelector(".bl-desc"), saltFacts: facts(salt),'
        + '   text: sr.textContent };');
    equal(state.titles, ['IT Consulting Services', 'Office Supplies', 'Road Salt Supply', '2027 Road Resurfacing Program', 'Janitorial Services'], 'order');
    equal(state.count, '5 opportunities', 'count');
    equal(state.href, '/bids/road-resurfacing', 'card link');
    equal(state.roadChips, ['Bid', 'Open'], 'type and status chips');
    equal(state.roadFacts.length, 4, 'due, posted, documents, next meeting: ' + JSON.stringify(state.roadFacts));
    assert(state.roadFacts[0].startsWith('Due ') && state.roadFacts[0].includes('2:00'), 'due line: ' + state.roadFacts[0]);
    equal(state.roadFacts[2], '4 documents', 'documents line');
    assert(state.roadFacts[3].startsWith('Pre-bid meeting: '), 'next meeting is the earliest upcoming: ' + state.roadFacts[3]);
    equal(state.itChips, ['RFP', 'Open', 'Due in 4 days'], 'due soon chip');
    assert(state.itSoon, 'due soon accent');
    equal([state.saltChips, state.saltDesc, state.saltFacts.length], [['RFQ'], false, 2], 'a listing with only title, type and dates');
    assert(!state.text.includes('Fleet Vehicle Purchase'), 'a listing past its closing date is shown');
});
await test('search, type and status filters, no matches and clear filters', async () => {
    await load('/c/bid_listings');
    const state = await run(BIDS + ' const sr = bidLists()[0]; const out = {};'
        + ' await setValue(sr, "#bl-query", "paving", "input"); out.search = bidTitles(sr); out.searchCount = bidCount(sr);'
        + ' await setValue(sr, "#bl-query", "", "input"); await setValue(sr, "#bl-type", "RFP", "change"); out.type = bidTitles(sr);'
        + ' await setValue(sr, "#bl-status", "Awarded", "change"); out.status = bidTitles(sr);'
        + ' out.statusOptions = [...sr.querySelectorAll("#bl-status option")].map(o => o.value);'
        + ' await setValue(sr, "#bl-query", "zzz", "input"); out.empty = sr.querySelector(".bl-empty-text").textContent.trim();'
        + ' await click(sr.querySelector(".bl-clear")); await wait(300); out.cleared = bidTitles(sr).length; return out;');
    equal(state.search, ['2027 Road Resurfacing Program'], 'search "paving" (description)');
    equal(state.searchCount, 'Showing 1 of 5 opportunities', 'filtered count');
    equal(state.type, ['IT Consulting Services', 'Janitorial Services'], 'type RFP');
    equal(state.status, ['Janitorial Services'], 'RFP and Awarded');
    equal(state.statusOptions, ['', 'Awarded', 'Open'], 'statuses come from the available listings');
    equal(state.empty, 'Nothing matches your search.', 'no matches');
    equal(state.cleared, 5, 'after clearing');
});
await test('newest first with closed listings, and bid-click without links', async () => {
    await load('/c/bid_listings');
    const state = await run(BIDS + ' const sr = bidLists()[1];'
        + ' const out = { controls: !!sr.querySelector(".bl-controls"), titles: bidTitles(sr), count: bidCount(sr) };'
        + ' await click(sr.querySelector("button.bl-link")); await wait(300); out.log = logLines()[0]; return out;');
    equal(state.controls, false, 'filters hidden');
    equal(state.titles.slice(0, 3), ['Office Supplies', 'Road Salt Supply', '2027 Road Resurfacing Program'], 'newest first');
    equal(state.count, '6 opportunities', 'count with closed');
    assert(state.log.startsWith('bid-click'), 'bid-click was not logged: ' + state.log);
});
await test('pages: two per page, Previous and Next, page-change, and clearing goes back to page 1', async () => {
    await load('/c/bid_listings');
    const state = await run(BIDS + ' const sr = bidLists()[2]; const out = {};'
        + ' const numbers = () => [...sr.querySelectorAll(".bl-page")].map(b => b.textContent.trim() + (b.classList.contains("is-current") ? "*" : ""));'
        + ' out.first = [bidTitles(sr).length, bidCount(sr), numbers(), sr.querySelector(".bl-step.is-prev").disabled];'
        + ' await click([...sr.querySelectorAll(".bl-page")][2]);'
        + ' out.third = [bidCount(sr), numbers(), sr.querySelector(".bl-step.is-next").disabled, sr.activeElement && sr.activeElement.className, logLines()[0]];'
        + ' await click(sr.querySelector(".bl-step.is-prev")); out.back = bidCount(sr);'
        + ' await setValue(sr, "#bl-query", "zzz", "input"); out.none = [!!sr.querySelector(".bl-pages"), sr.querySelector(".bl-empty-text").textContent.trim()];'
        + ' await click(sr.querySelector(".bl-clear")); await wait(300); out.cleared = bidCount(sr); return out;');
    equal(state.first, [2, 'Showing 1–2 of 5 opportunities', ['1*', '2', '3'], true], 'two per page');
    equal(state.third.slice(0, 4), ['Showing 5–5 of 5 opportunities', ['1', '2', '3*'], true, 'bl-list'], 'the last page, Next disabled, focus on the list');
    assert(state.third[4].startsWith('page-change') && state.third[4].includes('page: 3'), 'page-change: ' + state.third[4]);
    equal(state.back, 'Showing 3–4 of 5 opportunities', 'Previous goes back a page');
    equal(state.none, [false, 'Nothing matches your search.'], 'no matches: no pager');
    equal(state.cleared, 'Showing 1–2 of 5 opportunities', 'clearing puts it back on page 1');
});

console.log('Bid details');
await test('a listing card opens the bid details page', async () => {
    await load('/c/bid_listings');
    await run('const link = [...deepAll("dz-component[dz-type=bid_listings]")[0].shadowRoot.querySelectorAll("a.bl-link")].find(a => a.getAttribute("href") === "/bids/road-resurfacing");'
        + ' if (!link) throw new Error("no link to /bids/road-resurfacing"); link.click();');
    let state = null;
    for (let i = 0; i < 40 && !(state && state.title); i++) {
        await sleep(250);
        state = await run('const host = deepAll("dz-component[dz-type=bid_details]")[0]; if (!host) return null; const sr = host.shadowRoot;'
            + ' const title = sr.querySelector(".bd-title"); if (!title) return null; const boxes = sr.querySelectorAll(".bd-box");'
            + ' return { path: location.pathname, title: title.textContent.trim(), due: sr.querySelector(".bd-due").textContent.trim(),'
            + '   sections: [...sr.querySelectorAll(".bd-section-title")].map(h => h.textContent.trim()),'
            + '   meetings: [...sr.querySelectorAll(".bd-meeting")].map(m => m.textContent.trim().split(" ").filter(Boolean).join(" ")),'
            + '   docs: [...sr.querySelectorAll(".bd-doc")].map(a => [a.getAttribute("href"), a.getAttribute("aria-label")]),'
            + '   glance: [...boxes[0].querySelectorAll("dt")].map(d => d.textContent.trim()),'
            + '   contact: [...boxes[1].querySelectorAll(".bd-link")].map(a => a.getAttribute("href")),'
            + '   text: sr.textContent };').catch(() => null);
    }
    assert(state, 'the bid details page did not render');
    equal(state.path, '/bids/road-resurfacing', 'address after the click');
    equal(state.title, '2027 Road Resurfacing Program', 'title');
    assert(state.due.startsWith('Due ') && state.due.includes('2:00'), 'due line: ' + state.due);
    equal(state.sections, ['Description', 'Meetings', 'Documents'], 'sections');
    equal(state.meetings.length, 2, 'meetings');
    assert(state.meetings[0].startsWith('Pre-bid meeting') && state.meetings[0].includes('10:00') && state.meetings[0].includes('11:00'),
        'meetings sorted by time, with a time range: ' + state.meetings[0]);
    equal(state.docs[1], ['/documents/bids/road-resurfacing/specifications.pdf', 'Specifications (PDF, 2.3 MB)'], 'document link and name');
    equal(state.docs[2][1], 'Bid Form (DOCX, 53 KB)', 'type from the extension');
    equal(state.glance, ['Type', 'Status', 'Posted', 'Due', 'Location'], 'at a glance');
    equal(state.contact, ['mailto:purchasing@example.gov', 'tel:7405550170'], 'contact links');
    assert(!state.text.includes('Clos'), 'the closing date is displayed');
});
await test('empty fields and sections are left out, and a missing listing', async () => {
    await load('/c/bid_details');
    const state = await run('const srs = hosts("bid_details").map(h => h.shadowRoot); const salt = srs[2]; const it = srs[1];'
        + ' return { saltSections: salt.querySelectorAll(".bd-section").length, saltNothing: salt.querySelector(".bd-nothing").textContent.trim(),'
        + '   saltGlance: [...salt.querySelectorAll(".bd-box dt")].map(d => d.textContent.trim()), saltBoxes: salt.querySelectorAll(".bd-box").length,'
        + '   saltChips: [...salt.querySelectorAll(".bd-chip")].map(c => c.textContent.trim()),'
        + '   itContact: [...it.querySelectorAll(".bd-box")][1].textContent.trim().split(" ").filter(Boolean).join(" "),'
        + '   itSoon: it.querySelector(".bd-chip.is-soon").textContent.trim(),'
        + '   missing: srs[3].querySelector(".bd-title").textContent.trim() };');
    equal([state.saltSections, state.saltNothing], [0, 'No other details.'], 'no description, meetings or documents');
    equal(state.saltGlance, ['Type', 'Posted', 'Due'], 'only the facts it has');
    equal(state.saltBoxes, 1, 'no contact box');
    equal(state.saltChips, ['RFQ'], 'no status chip');
    assert(!state.itContact.includes('Phone') && state.itContact.includes('it-rfp@example.gov'), 'email-only contact: ' + state.itContact);
    equal(state.itSoon, 'Due in 4 days', 'due soon chip');
    equal(state.missing, 'Listing not found', 'missing listing');
});

console.log('Document list');
const DOCS = 'const docLists = () => hosts("document_list").map(h => h.shadowRoot);'
    + ' const docNames = sr => [...sr.querySelectorAll(".doc-link")].map(a => a.firstChild.textContent.trim());'
    + ' const docCount = sr => sr.querySelector(".doc-count").textContent.trim();'
    + ' const pageButtons = sr => [...sr.querySelectorAll(".doc-numbers li")].map(li => li.textContent.trim());'
    + ' const setValue = async (sr, selector, value, type) => { const el = sr.querySelector(selector); el.value = value;'
    + '   el.dispatchEvent(new Event(type, { bubbles: true })); await wait(300); };'
    + ' const row = (sr, name) => [...sr.querySelectorAll(".doc-row")].find(r => r.querySelector(".doc-link").firstChild.textContent.trim() === name);';
const { demoDocuments } = await import('../demo-documents.js');
const allDocNames = demoDocuments.filter(doc => doc.name && (doc.id || doc.href)).map(doc => doc.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
await test('rows: type icons, links by id, details; next page moves focus to the list', async () => {
    await load('/c/document_list');
    const state = await run(DOCS + ' const sr = docLists()[0]; const out = { names: docNames(sr), count: docCount(sr), pages: pageButtons(sr) };'
        + ' const budget = row(sr, "2026 Budget Summary"); const link = budget.querySelector(".doc-link");'
        + ' out.budget = [link.getAttribute("href"), link.getAttribute("target"), link.hasAttribute("data-no-router"), link.textContent.trim(),'
        + '   budget.querySelector(".doc-ext").textContent.trim(), budget.querySelector(".doc-file").className,'
        + '   [...budget.querySelectorAll(".doc-meta-part")].map(p => p.textContent.trim())];'
        + ' out.categories = [...sr.querySelectorAll("#doc-category option")].map(o => o.value);'
        + ' out.prevDisabled = sr.querySelector(".doc-step.is-prev").disabled;'
        + ' await click(sr.querySelector(".doc-step.is-next")); await wait(300);'
        + ' out.page2 = docNames(sr); out.count2 = docCount(sr); out.focus = sr.activeElement && sr.activeElement.className;'
        + ' out.listName = sr.querySelector(".doc-list").getAttribute("aria-label"); out.current = sr.querySelector(".doc-page.is-current").textContent.trim();'
        + ' out.log = logLines()[0];'
        + ' const w9 = [...sr.querySelectorAll(".doc-link")].find(a => a.textContent.includes("W-9"));'
        + ' out.w9 = w9 ? w9.getAttribute("href") : "not on page 2"; return out;');
    equal(state.names, allDocNames.slice(0, 10), 'page 1, name A–Z');
    equal(allDocNames.length, 26, 'documents without a name or a link are left out');
    equal(state.count, 'Showing 1–10 of 26 documents', 'count');
    equal(state.pages, ['1', '2', '3'], 'page buttons');
    equal(state.budget, ['/api/documents/202', '_blank', true, '2026 Budget Summary (XLSX, 92 KB, opens in a new tab)', 'XLSX', 'doc-file is-sheet',
        ['XLSX', '92 KB', state.budget[6][2], 'Budget and finance']], 'a row from a MIME type');
    assert(state.budget[6][2].startsWith('Updated '), 'updated date: ' + state.budget[6][2]);
    equal(state.categories, ['', 'Budget and finance', 'Forms', 'Maps', 'Minutes', 'Ordinances', 'Permits'], 'categories');
    equal(state.prevDisabled, true, 'previous disabled on page 1');
    equal([state.page2, state.count2, state.current], [allDocNames.slice(10, 20), 'Showing 11–20 of 26 documents', '2'], 'page 2');
    equal([state.focus, state.listName], ['doc-list', 'Documents and forms, page 2 of 3'], 'focus moves to the list');
    assert(state.log.startsWith('page-change page: 2, pageCount: 3'), 'page-change was not logged: ' + state.log);
    assert(state.w9 === 'not on page 2' || state.w9 === 'https://www.irs.gov/pub/irs-pdf/fw9.pdf', 'own href wins: ' + state.w9);
});
await test('search (every word), category, no matches and clear filters go back to page 1', async () => {
    await load('/c/document_list');
    const state = await run(DOCS + ' const sr = docLists()[0]; const out = {};'
        + ' await click(sr.querySelector(".doc-step.is-next"));'
        + ' await setValue(sr, "#doc-query", "permit", "input"); out.permit = docNames(sr); out.permitCount = docCount(sr); out.nav = !!sr.querySelector(".doc-pages");'
        + ' await setValue(sr, "#doc-query", "minutes august", "input"); out.words = docNames(sr);'
        + ' await setValue(sr, "#doc-query", "zip", "input"); out.type = docNames(sr);'
        + ' const flood = row(sr, "Floodplain Map Data"); out.flood = flood ? [...flood.querySelectorAll(".doc-meta-part")].map(p => p.textContent.trim()).slice(0, 2) : null;'
        + ' await setValue(sr, "#doc-query", "", "input"); await setValue(sr, "#doc-category", "Maps", "change"); out.maps = docNames(sr);'
        + ' await setValue(sr, "#doc-query", "zzz", "input"); out.empty = sr.querySelector(".doc-empty-text").textContent.trim();'
        + ' await click(sr.querySelector(".doc-clear")); await wait(300); out.cleared = docCount(sr);'
        + ' out.focus = sr.activeElement && sr.activeElement.id; return out;');
    equal(state.permit, ['Building Permit Application', 'Electrical Permit Application', 'Fence and Driveway Permit', 'Sign Permit Checklist', 'Zoning Variance Request'],
        'search "permit" (name and category), from page 2 back to page 1');
    equal([state.permitCount, state.nav], ['5 of 26 documents match', false], 'filtered count, one page');
    equal(state.words, ['Board of Commissioners Minutes, August', 'Planning Commission Minutes, August'], 'every word must match');
    equal([state.type, state.flood], [['Floodplain Map Data'], ['ZIP', '45.8 MB']], 'type from the file name, size in MB');
    equal(state.maps, ['County Road Map', 'Floodplain Map Data', 'Zoning Map'], 'category');
    equal(state.empty, 'No documents match your search.', 'no matches');
    equal([state.cleared, state.focus], ['Showing 1–10 of 26 documents', 'doc-query'], 'after clearing');
});
await test('newest first with page gaps, the last page, and document-click', async () => {
    await load('/c/document_list');
    const state = await run(DOCS + ' const sr = docLists()[1];'
        + ' const out = { controls: !!sr.querySelector(".doc-controls"), names: docNames(sr), pages: pageButtons(sr) };'
        + ' await click([...sr.querySelectorAll(".doc-page")].find(b => b.textContent.trim() === "9")); await wait(300);'
        + ' out.last = docNames(sr); out.lastPages = pageButtons(sr); out.nextDisabled = sr.querySelector(".doc-step.is-next").disabled;'
        + ' out.current = sr.querySelector(".doc-page.is-current").getAttribute("aria-current");'
        + ' sr.addEventListener("click", e => e.preventDefault(), true);'
        + ' await click(sr.querySelector(".doc-link")); await wait(300); out.log = logLines()[0];'
        + ' await click(sr.querySelector(".doc-step.is-prev")); await wait(300); out.prev = sr.querySelector(".doc-page.is-current").textContent.trim(); return out;');
    equal(state.controls, false, 'filters hidden');
    equal(state.names, ['Zoning Variance Request', 'Dog License Application', 'Board of Commissioners Minutes, August'], 'newest first, 3 per page');
    equal(state.pages, ['1', '2', '3', '4', '5', '…', '9'], 'gap before the last page');
    equal([state.last, state.nextDisabled, state.current], [['Noise Ordinance', 'W-9 Request for Taxpayer Identification'], true, 'page'],
        'last page: undated last, next disabled');
    equal(state.lastPages, ['1', '…', '5', '6', '7', '8', '9'], 'gap after the first page');
    assert(state.log.startsWith('document-click document: "Noise Ordinance"'), 'document-click was not logged: ' + state.log);
    equal(state.prev, '8', 'previous');
});
await test('given order on one page, nothing posted, and "Page 1 of 9" when narrow', async () => {
    await load('/c/document_list');
    const state = await run(DOCS + ' const srs = docLists(); const forms = srs[2]; const none = srs[4];'
        + ' const out = { forms: docNames(forms), formsCount: docCount(forms), formsNav: !!forms.querySelector(".doc-pages"),'
        + '   sorts: [...forms.querySelectorAll("#doc-sort option")].map(o => o.value), category: !!forms.querySelector("#doc-category"),'
        + '   none: none.querySelector(".doc-empty-text").textContent.trim(), noneClear: !!none.querySelector(".doc-clear"), noneList: !!none.querySelector(".doc-list") };'
        + ' const host = hosts("document_list")[1]; host.style.width = "360px"; await wait(300);'
        + ' out.narrow = [getComputedStyle(srs[1].querySelector(".doc-numbers")).display, srs[1].querySelector(".doc-of").textContent.trim(),'
        + '   getComputedStyle(srs[1].querySelector(".doc-of")).display];'
        + ' out.wide = getComputedStyle(srs[0].querySelector(".doc-of")).display; return out;');
    equal(state.forms, ['Dog License Application', 'Public Records Request', 'Employment Application', 'Facility Rental Agreement', 'W-9 Request for Taxpayer Identification'], 'order given');
    equal([state.formsCount, state.formsNav], ['5 documents', false], 'all on one page');
    equal([state.sorts, state.category], [['order', 'name', 'newest'], false], 'suggested order option; no filter for one category');
    equal([state.none, state.noneClear, state.noneList], ['No documents have been posted yet.', false, false], 'nothing posted');
    equal(state.narrow, ['none', 'Page 1 of 9', 'block'], 'narrow pages');
    equal(state.wide, 'none', 'wide pages show numbers');
});
await test('an archive: the year filter, its own date wording, and clearing resets both filters', async () => {
    await load('/c/document_list');
    const state = await run(DOCS + ' const sr = docLists()[3]; const out = {};'
        + ' const year = new Date().getFullYear();'
        + ' out.years = [...sr.querySelectorAll("#doc-year option")].map(o => o.textContent.trim());'
        + ' out.date = [...sr.querySelectorAll(".doc-meta-part")].map(p => p.textContent.trim()).find(t => t.startsWith("Meeting"));'
        + ' out.start = docCount(sr);'
        + ' await setValue(sr, "#doc-year", String(year - 2), "change");'
        + ' out.filtered = [docCount(sr), docNames(sr).every(name => name.endsWith(String(year - 2)))];'
        + ' await setValue(sr, "#doc-category", "Agendas", "change"); out.both = docCount(sr);'
        + ' await setValue(sr, "#doc-query", "zzz", "input"); await click(sr.querySelector(".doc-clear")); await wait(300);'
        + ' out.cleared = [docCount(sr), sr.querySelector("#doc-year").value, sr.querySelector("#doc-category").value];'
        + ' const host = hosts("document_list")[3]; host.component.proxy.showYears = false; await wait(400);'
        + ' out.off = [!!sr.querySelector("#doc-year"), docCount(sr)]; return out;');
    const year = new Date().getFullYear();
    equal(state.years, ['All years', String(year), String(year - 1), String(year - 2), String(year - 3)], 'years, newest first');
    assert(state.date && state.date.startsWith('Meeting '), 'dateLabel changes the wording: ' + state.date);
    equal(state.start, 'Showing 1–8 of 90 documents', 'the whole archive');
    equal(state.filtered, ['Showing 1–8 of 24 matching documents', true], 'one year: 12 agendas and 12 minutes');
    equal(state.both, 'Showing 1–8 of 12 matching documents', 'year and category together');
    equal(state.cleared, ['Showing 1–8 of 90 documents', '', ''], 'clearing resets the year as well');
    equal(state.off, [false, 'Showing 1–8 of 90 documents'], 'showYears false hides the filter');
});

console.log('News list');
const NEWS = 'const newsLists = () => hosts("news_list").map(h => h.shadowRoot);'
    + ' const headlines = sr => [...sr.querySelectorAll(".nl-headline")].map(h => h.textContent.trim());'
    + ' const newsCount = sr => sr.querySelector(".nl-count").textContent.trim();'
    + ' const setValue = async (sr, selector, value, type) => { const el = sr.querySelector(selector); el.value = value;'
    + '   el.dispatchEvent(new Event(type, { bubbles: true })); await wait(300); };';
const { demoNews } = await import('../demo-news.js');
const newestTitles = [...demoNews].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)).map(article => article.title);
await test('grid: newest first and featured, links and images; search from page 2 goes back to page 1', async () => {
    await load('/c/news_list');
    const state = await run(NEWS + ' const sr = newsLists()[0]; const cards = [...sr.querySelectorAll(".nl-card")];'
        + ' const out = { titles: headlines(sr), count: newsCount(sr), featured: cards.map(c => c.classList.contains("is-featured")).slice(0, 2),'
        + '   href: cards[0].querySelector("a.nl-link").getAttribute("href"), img: [cards[0].querySelector("img").getAttribute("src"), cards[0].querySelector("img").getAttribute("alt")],'
        + '   noImage: !cards[3].querySelector(".nl-media"), date: cards[0].querySelector("time").getAttribute("datetime"),'
        + '   departments: sr.querySelectorAll("#nl-department option").length, categories: [...sr.querySelectorAll("#nl-category option")].map(o => o.value) };'
        + ' await click(sr.querySelector(".nl-step.is-next")); await wait(300); out.page2 = headlines(sr); out.page2Featured = !!sr.querySelector(".is-featured");'
        + ' await setValue(sr, "#nl-query", "election", "input"); out.search = headlines(sr); out.searchCount = newsCount(sr);'
        + '   out.nav = !!sr.querySelector(".nl-pages"); out.searchFeatured = !!sr.querySelector(".is-featured");'
        + ' await setValue(sr, "#nl-query", "", "input"); await setValue(sr, "#nl-category", "Announcement", "change");'
        + ' await setValue(sr, "#nl-department", "Board of Elections", "change"); out.both = headlines(sr);'
        + ' await setValue(sr, "#nl-department", "Library", "change"); out.empty = sr.querySelector(".nl-empty-text").textContent.trim();'
        + ' await click(sr.querySelector(".nl-clear")); await wait(300); out.cleared = [newsCount(sr), !!sr.querySelector(".is-featured")]; return out;');
    equal(state.titles, newestTitles.slice(0, 7), 'page 1, newest first');
    equal(state.count, 'Showing 1–7 of 19 articles', 'count');
    equal(state.featured, [true, false], 'the newest is featured');
    equal([state.href, state.img, state.noImage], ['/news/road-resurfacing-begins', ['/assets/demo/news-road.svg', ''], true], 'link, decorative image, no image');
    assert(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(state.date), 'time datetime: ' + state.date);
    equal([state.categories, state.departments], [['', 'Announcement', 'Legal notice', 'News', 'Press release', 'Public notice'], 13], 'filters: 12 departments plus All');
    equal([state.page2, state.page2Featured], [newestTitles.slice(7, 14), false], 'page 2, nothing featured');
    equal(state.search, ['Board of Elections Seeks Poll Workers', 'Voter Registration Deadline Approaches'], 'search from page 2 shows the matches');
    equal([state.searchCount, state.nav, state.searchFeatured], ['2 of 19 articles match', false, false], 'filtered: one page, nothing featured');
    equal(state.both, ['Board of Elections Seeks Poll Workers', 'Voter Registration Deadline Approaches'], 'category and department');
    equal(state.empty, 'No articles match your search.', 'no matches');
    equal(state.cleared, ['Showing 1–7 of 19 articles', true], 'cleared');
});
await test('list without filters, compact newest five with news-click and View all, notices only, and nothing posted', async () => {
    await load('/c/news_list');
    const state = await run(NEWS + ' const [list, compact, notices, none] = newsLists().slice(1);'
        + ' const out = { listControls: !!list.querySelector(".nl-controls"), listCount: !!list.querySelector(".nl-count"),'
        + '   listTitles: headlines(list), listPages: [...list.querySelectorAll(".nl-page")].map(b => b.textContent.trim()),'
        + '   listMedia: [...list.querySelectorAll(".nl-card")].map(c => !!c.querySelector(".nl-media")),'
        + '   compactTitles: headlines(compact), compactExtras: compact.querySelectorAll(".nl-media, .nl-summary, .nl-dept, .nl-pages, .nl-controls").length,'
        + '   more: compact.querySelector(".nl-more").getAttribute("href"), buttons: compact.querySelectorAll("button.nl-link").length,'
        + '   notices: [headlines(notices), newsCount(notices), [...notices.querySelectorAll("#nl-category option")].map(o => o.value), [...notices.querySelectorAll(".nl-chip")].map(c => c.textContent.trim())],'
        + '   none: none.querySelector(".nl-empty-text").textContent.trim() };'
        + ' await click(compact.querySelector("button.nl-link")); await wait(300); out.log = logLines()[0]; return out;');
    equal([state.listControls, state.listCount], [false, false], 'no filters or count');
    equal([state.listTitles, state.listPages], [newestTitles.slice(0, 4), ['1', '2', '3', '4', '5']], 'list page 1');
    equal(state.listMedia, [true, true, true, false], 'thumbnails only where there is an image');
    equal([state.compactTitles, state.compactExtras, state.more, state.buttons], [newestTitles.slice(0, 5), 0, '/c/news_list', 5], 'compact');
    assert(state.log.startsWith('news-click article: "Road Resurfacing Season Begins Monday"'), 'news-click was not logged: ' + state.log);
    equal(state.notices, [['Notice of Public Hearing: Zoning Amendment for the Route 16 Corridor', 'Public Notice: Hydrant Flushing in the Northside Service Area',
        'Public Notice: Draft Hazard Mitigation Plan Open for Comment', 'Legal Notice: Petition to Vacate Part of Old Mill Road'], '4 notices',
        ['', 'Legal notice', 'Public notice'], ['Legal notice', 'Public notice', 'Public notice', 'Legal notice']], 'categories option: only notices, and only their categories to filter by');
    equal(state.none, 'There is no news to show right now.', 'nothing posted');
});

console.log('News details');
await test('a card opens the article page: byline, figure, body, attachments and media contact', async () => {
    await load('/c/news_list');
    await run('const link = [...deepAll("dz-component[dz-type=news_list]")[0].shadowRoot.querySelectorAll("a.nl-link")].find(a => a.getAttribute("href") === "/news/road-resurfacing-begins");'
        + ' if (!link) throw new Error("no link to /news/road-resurfacing-begins"); link.click();');
    let state = null;
    for (let i = 0; i < 40 && !(state && state.title); i++) {
        await sleep(250);
        state = await run('const host = deepAll("dz-component[dz-type=news_details]")[0]; if (!host) return null; const sr = host.shadowRoot;'
            + ' const title = sr.querySelector(".nd-card .nd-title"); if (!title) return null;'
            + ' return { path: location.pathname, title: title.textContent.trim(), eyebrow: [...sr.querySelectorAll(".nd-eyebrow > span")].map(s => s.textContent.trim()),'
            + '   byline: [...sr.querySelectorAll(".nd-byline > span")].map(s => s.textContent.trim()),'
            + '   img: sr.querySelector(".nd-img").getAttribute("alt"), caption: sr.querySelector(".nd-caption").textContent.trim(),'
            + '   lede: !!sr.querySelector(".nd-lede"), body: (() => { const rt = sr.querySelector("dz-component[dz-type=rich_text]"); const b = rt && rt.shadowRoot && rt.shadowRoot.querySelector(".rt");'
            + '     return b ? { tags: [...b.children].map(el => el.tagName.toLowerCase()).join(" "), bold: !!b.querySelector("p b"), list: b.querySelectorAll("ul.dz-list-disc li").length } : null; })(),'
            + '   sections: [...sr.querySelectorAll(".nd-section-title")].map(h => h.textContent.trim()),'
            + '   docs: [...sr.querySelectorAll(".nd-doc")].map(a => [a.getAttribute("aria-label"), a.hasAttribute("data-no-router")]),'
            + '   contact: [...sr.querySelectorAll(".nd-box .nd-link")].map(a => a.getAttribute("href")),'
            + '   levels: [...sr.querySelectorAll("[role=heading]")].map(h => h.getAttribute("aria-level")).join("") };').catch(() => null);
    }
    assert(state, 'the article page did not render');
    equal([state.path, state.title], ['/news/road-resurfacing-begins', 'Road Resurfacing Season Begins Monday'], 'address and headline');
    equal(state.eyebrow, ['Press release', 'County Engineer'], 'category and department');
    equal(state.byline.length, 3, 'published, updated, author: ' + JSON.stringify(state.byline));
    assert(state.byline[0].startsWith('Published ') && state.byline[1].startsWith('Updated ') && state.byline[2] === 'By Office of Communications', 'byline: ' + JSON.stringify(state.byline));
    equal([state.img, state.caption], ['Illustration of a paving crew working on a two-lane road', 'Paving starts on Township Road 12 and moves north.'], 'figure');
    equal(state.lede, true, 'lede');
    equal(state.body, { tags: 'p h2 p ul h3 div p p', bold: true, list: 3 }, 'rich text body: h1 and h2 start below the headline (h2, h3), table in a scroll box');
    equal(state.sections, ['Attachments', 'Related links'], 'sections');
    equal(state.docs, [['Resurfacing schedule (PDF, 371 KB)', true], ['Road list and map (XLSX, 63 KB)', true]], 'attachments');
    equal(state.contact, ['mailto:news@example.gov', 'tel:7405550110'], 'media contact');
    equal(state.levels, '1222', 'heading levels');
});
await test('share copies the link; a legal notice, a minimal article and a missing one', async () => {
    await load('/c/news_details');
    const state = await run('const srs = hosts("news_details").map(h => h.shadowRoot);'
        + ' Object.defineProperty(navigator, "share", { value: undefined, configurable: true });'
        + ' Object.defineProperty(navigator, "clipboard", { value: { writeText: async text => { window.__copied = text; } }, configurable: true });'
        + ' const ndTool = (sr, text) => [...sr.querySelectorAll(".nd-tool")].find(b => b.textContent.trim() === text);'
        + ' await click(ndTool(srs[0], "Share")); await wait(400);'
        + ' const out = { copied: window.__copied === location.href, live: srs[0].querySelector(".nd-sr").textContent.trim(), log: logLines()[0] };'
        + ' const notice = srs[1]; out.notice = [[...notice.querySelectorAll(".nd-eyebrow > span")].map(x => x.textContent.trim()), notice.querySelectorAll(".nd-doc").length,'
        + '   notice.querySelector(".nd-contact-name").textContent.trim(), [...notice.querySelectorAll(".nd-byline > span")].pop().textContent.trim()];'
        + ' const min = srs[2]; out.minimal = { share: !!ndTool(min, "Share"), print: !!ndTool(min, "Print"), figure: !!min.querySelector(".nd-figure"),'
        + '   sections: min.querySelectorAll(".nd-section").length, aside: !!min.querySelector(".nd-aside"), single: min.querySelector(".nd-layout").classList.contains("is-single"),'
        + '   byline: [...min.querySelectorAll(".nd-byline > span")].map(s => s.textContent.trim().split(" ")[0]), eyebrow: !!min.querySelector(".nd-eyebrow") };'
        + ' out.missing = [srs[3].querySelector(".nd-title").textContent.trim(), srs[3].querySelectorAll(".nd-tool").length];'
        + ' out.contactHeadings = [notice.querySelector(".nd-box-title").textContent.trim(), srs[0].querySelector(".nd-box-title").textContent.trim()]; return out;');
    equal([state.copied, state.live], [true, 'Link copied'], 'copied and announced');
    assert(state.log.startsWith('share method: copy'), 'share was not logged: ' + state.log);
    equal(state.notice, [['Legal notice', 'Board of Commissioners'], 2, 'Clerk of the Board', 'By Clerk of the Board'], 'legal notice');
    equal(state.contactHeadings, ['Questions about this notice', 'Media contact'],
        'a notice names its own contact box; a news article keeps the label');
    equal(state.minimal, { share: false, print: true, figure: false, sections: 0, aside: false, single: true, byline: ['Published'], eyebrow: false }, 'minimal article');
    equal(state.missing, ['Article not found', 0], 'missing article');
});

console.log('Staff directory');
const STAFF = 'const dirs = () => hosts("staff_directory").map(h => h.shadowRoot);'
    + ' const staffNames = sr => [...sr.querySelectorAll(".sd-name, .sd-row-name > span:last-child")].map(n => n.textContent.trim());'
    + ' const staffCount = sr => sr.querySelector(".sd-count").textContent.trim();'
    + ' const texts = (sr, selector) => [...sr.querySelectorAll(selector)].map(n => n.textContent.trim());'
    + ' const setValue = async (sr, selector, value, type) => { const el = sr.querySelector(selector); el.value = value;'
    + '   el.dispatchEvent(new Event(type, { bubbles: true })); await wait(300); };'
    + ' const staffCard = (sr, name) => [...sr.querySelectorAll(".sd-card")].find(c => c.querySelector(".sd-name").textContent.trim() === name);';
await test('one A–Z list: last-name order, contact links, initials or photo; search and department filters', async () => {
    await load('/c/staff_directory');
    const state = await run(STAFF + ' const sr = dirs()[4]; const brooks = staffCard(sr, "Angela Brooks"); const alvarez = staffCard(sr, "Maria Alvarez");'
        + ' const out = { names: staffNames(sr).slice(0, 4), count: staffCount(sr), headings: sr.querySelectorAll(".sd-group-title, .sd-subgroup-title").length,'
        + '   brooks: [...brooks.querySelectorAll(".sd-link")].map(a => [a.getAttribute("href"), a.textContent.trim()]),'
        + '   org: brooks.querySelector(".sd-dept").textContent.trim(), level: brooks.querySelector(".sd-name").getAttribute("aria-level"),'
        + '   initials: brooks.querySelector(".sd-initials").textContent.trim(), photo: [alvarez.querySelector("img").getAttribute("src"), alvarez.querySelector("img").getAttribute("alt")],'
        + '   letters: sr.querySelectorAll(".sd-letters, .sd-letter").length };'
        + ' await click(sr.querySelector(".sd-step.is-next")); await wait(300);'
        + ' await setValue(sr, "#sd-query", "harper", "input");'
        + ' out.h = [staffNames(sr), staffCount(sr), !!sr.querySelector(".sd-pages")];'
        + ' await setValue(sr, "#sd-query", "nobody here", "input"); out.none = sr.querySelector(".sd-empty-text").textContent.trim();'
        + ' await click(sr.querySelector(".sd-clear")); await wait(300); out.cleared = [staffCount(sr), sr.querySelector("#sd-query").value, sr.activeElement && sr.activeElement.id];'
        + ' await setValue(sr, "#sd-department", "Library", "change"); out.library = [staffNames(sr), !!sr.querySelector("#sd-division")]; return out;');
    equal(state.names, ['Frank Adams Jr.', 'Maria Alvarez', 'Marcus Bell', 'Angela Brooks'], 'last names A–Z, suffix skipped');
    equal([state.count, state.headings, state.level], ['Showing 1–12 of 39 people', 0, '3'], 'count, no group headings, names at headingLevel');
    equal(state.brooks, [['tel:7405550110,1', '740-555-0110 ext. 1'], ['mailto:angela.brooks@example.gov', 'angela.brooks@example.gov']], 'phone with extension, email');
    equal([state.org, state.initials, state.photo], ['Board of Commissioners', 'AB', ['/assets/demo/staff-3.svg', '']], 'department on the card, initials, decorative photo');
    equal(state.letters, 0, 'no A–Z bar');
    equal(state.h, [['Denise Harper'], '1 of 39 people match', false], 'search from page 2');
    equal(state.none, 'Nobody matches your search.', 'search with no one');
    equal(state.cleared, ['Showing 1–12 of 39 people', '', 'sd-query'], 'cleared, focus back in the search box');
    equal(state.library, [['Rebecca Fowler', 'Charles Ingram', 'Daniel Jackson'], false], 'department filter; no divisions, no division filter');
});
await test('broken out by department and division: headings, levels, continued groups, division filter', async () => {
    await load('/c/staff_directory');
    const state = await run(STAFF + ' const sr = dirs()[0];'
        + ' const out = { titles: texts(sr, ".sd-group-title"), subs: texts(sr, ".sd-subgroup-title"), count: staffCount(sr),'
        + '   levels: [sr.querySelector(".sd-group-title").getAttribute("aria-level"), sr.querySelector(".sd-subgroup-title").getAttribute("aria-level"),'
        + '     staffCard(sr, "Maria Alvarez").querySelector(".sd-name").getAttribute("aria-level"), staffCard(sr, "Priya Natarajan").querySelector(".sd-name").getAttribute("aria-level")],'
        + '   orgLines: sr.querySelectorAll(".sd-dept").length, lists: [...sr.querySelectorAll(".sd-cards")].map(ul => ul.getAttribute("aria-label")).slice(0, 3),'
        + '   division: !!sr.querySelector("#sd-division") };'
        + ' await click(sr.querySelector(".sd-step.is-next")); await wait(300);'
        + ' out.page2 = [texts(sr, ".sd-group-title")[0], texts(sr, ".sd-subgroup-title")[0], staffNames(sr).slice(0, 3), sr.activeElement && sr.activeElement.className];'
        + ' await setValue(sr, "#sd-department", "Health Department", "change");'
        + ' out.divisions = [...sr.querySelectorAll("#sd-division option")].map(o => o.value);'
        + ' await setValue(sr, "#sd-division", "Clinical Services", "change");'
        + ' out.clinical = [staffNames(sr), texts(sr, ".sd-group-title"), texts(sr, ".sd-subgroup-title"), staffCount(sr)];'
        + ' await setValue(sr, "#sd-department", "Public Works", "change");'
        + ' out.works = [staffNames(sr), sr.querySelector("#sd-division").value, texts(sr, ".sd-subgroup-title")]; return out;');
    equal(state.titles, ['Administration', 'Board of Commissioners', 'Board of Elections', 'County Engineer'], 'department headings, A–Z');
    equal(state.subs, ['Budget Office'], 'division heading after the people without one');
    equal([state.count, state.levels, state.orgLines, state.division], ['Showing 1–12 of 39 people', ['3', '4', '4', '5'], 0, false],
        'levels: department 3, division 4, names one below; nothing repeated on cards; no division filter without a department');
    equal(state.lists, ['Administration', 'Budget Office', 'Board of Commissioners'], 'each card list is named by its group');
    equal(state.page2, ['County Engineer', 'Bridges', ['Hannah Fischer', 'Marcus Bell', 'Jorge Silva'], 'sd-results'], 'page 2 repeats the continued department; focus moves to the results');
    equal(state.divisions, ['', 'Clinical Services', 'Environmental Health', 'Vital Statistics'], 'division filter for the chosen department');
    equal(state.clinical, [['Amy Castillo', 'Grace Kim', 'Nathan Pierce'], ['Health Department'], ['Clinical Services'], '3 of 39 people match'], 'one division');
    equal(state.works, [['Michael Kowalski', 'Walter Hughes', 'Aisha Mohammed'], '', ['Fleet', 'Solid Waste']], 'a new department starts with all its divisions');
});
await test('tables by department, a department page by division, narrow rows stack, and nobody listed', async () => {
    await load('/c/staff_directory');
    const state = await run(STAFF + ' const [, byDept, dept, , , none] = dirs();'
        + ' const heads = table => [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());'
        + ' const priya = [...byDept.querySelectorAll("tbody tr")].find(tr => tr.textContent.includes("Priya Natarajan"));'
        + ' const out = { titles: texts(byDept, ".sd-group-title"), subs: byDept.querySelectorAll(".sd-subgroup-title").length,'
        + '   tables: byDept.querySelectorAll("table").length, heads: heads(byDept.querySelector("table")), priya: priya.querySelector("td:nth-of-type(2)").textContent.trim(),'
        + '   last: staffNames(byDept).pop(), pages: !!byDept.querySelector(".sd-pages"),'
        + '   deptTitles: dept.querySelectorAll(".sd-group-title").length, deptSubs: texts(dept, ".sd-subgroup-title"),'
        + '   deptTables: [...dept.querySelectorAll("table")].map(t => t.querySelector("caption").textContent.trim()), deptHeads: heads(dept.querySelector("table")),'
        + '   deptFirst: staffNames(dept)[0], deptFilters: [!!dept.querySelector("#sd-department"), dept.querySelectorAll("#sd-division option").length],'
        + '   none: none.querySelector(".sd-empty-text").textContent.trim() };'
        + ' hosts("staff_directory")[2].style.width = "360px"; await wait(300);'
        + ' const td = dept.querySelector("tbody td"); out.narrow = [getComputedStyle(td).display, getComputedStyle(dept.querySelector("thead")).position,'
        + '   getComputedStyle(td, "::before").content];'
        + ' return out;');
    equal(state.titles.length, 11, 'ten departments and Other staff: ' + JSON.stringify(state.titles));
    equal([state.titles[10], state.last, state.subs, state.tables], ['Other staff', 'Ruth Mendez', 0, 11], 'no department last; no division headings');
    equal([state.heads, state.priya], [['Name', 'Title', 'Division', 'Phone', 'Email'], 'Budget Office'], 'division column when grouped by department only');
    equal(state.pages, false, 'one page');
    equal([state.deptTitles, state.deptSubs], [0, ['Clinical Services', 'Environmental Health', 'Vital Statistics']], 'department page: division headings only');
    equal(state.deptTables, ['Health Department', 'Clinical Services', 'Environmental Health', 'Vital Statistics'], 'a table per group, named by it');
    equal([state.deptHeads, state.deptFirst], [['Name', 'Title', 'Phone', 'Email'], 'Olivia Dunn'], 'no organization column; the department head first');
    equal(state.deptFilters, [false, 4], 'division filter instead of department');
    equal(state.narrow, ['block', 'absolute', '"Title"'], 'rows stack with labels when narrow');
    equal(state.none, 'There is no one to show in this directory.', 'nobody listed');
});

await test('biographies: Read biography opens one in place on a card; profiles show them in full', async () => {
    await load('/c/staff_directory');
    const state = await run(STAFF + ' const [cards, , , profiles] = dirs();'
        + ' const toggles = [...cards.querySelectorAll(".sd-bio-toggle")].map(b => b.getAttribute("aria-label"));'
        + ' const brooks = () => staffCard(cards, "Angela Brooks"); const toggle = () => brooks().querySelector(".sd-bio-toggle");'
        + ' const out = { toggles, closed: [toggle().getAttribute("aria-expanded"), !!brooks().querySelector(".sd-bio")] };'
        + ' await click(toggle()); await wait(400);'
        + ' const rt = brooks().querySelector(".sd-bio dz-component[dz-type=rich_text]"); const body = rt && rt.shadowRoot && rt.shadowRoot.querySelector(".rt");'
        + ' out.open = [toggle().getAttribute("aria-expanded"), toggle().getAttribute("aria-label"), toggle().textContent.trim(),'
        + '   body ? [...body.children].map(el => el.tagName.toLowerCase()).join(" ") : null, getComputedStyle(brooks().closest("li")).gridColumnEnd];'
        + ' await click(toggle()); await wait(300); out.reclosed = [toggle().getAttribute("aria-expanded"), !!brooks().querySelector(".sd-bio")];'
        + ' const items = [...profiles.querySelectorAll(".sd-profile")];'
        + ' out.profiles = { names: staffNames(profiles), levels: items.map(p => p.querySelector(".sd-name").getAttribute("aria-level")),'
        + '   bios: items.map(p => !!p.querySelector(".sd-profile-bio")), photo: !!items[1].querySelector("img"), toggles: profiles.querySelectorAll(".sd-bio-toggle").length,'
        + '   headings: profiles.querySelectorAll(".sd-group-title, .sd-subgroup-title").length };'
        + ' await wait(300); const committees = items[0].querySelector("dz-component[dz-type=rich_text]").shadowRoot.querySelector("h1, h2, h3, h4, h5, h6");'
        + ' out.profiles.bioHeading = committees ? [committees.tagName.toLowerCase(), committees.textContent.trim()] : null; return out;');
    equal(state.toggles, ['Read biography: Maria Alvarez', 'Read biography: Angela Brooks', 'Read biography: Robert Chen', 'Read biography: Denise Harper'], 'only people with a bio get the button, named for them');
    equal(state.closed, ['false', false], 'closed to start');
    equal(state.open, ['true', 'Hide biography: Angela Brooks', 'Hide biography', 'p p h5 ul', '-1'], 'open: bio below, its heading under the name (h4), card on its own row');
    equal(state.reclosed, ['false', false], 'closes again');
    equal(state.profiles.names, ['Angela Brooks', 'Robert Chen', 'Denise Harper', 'Thomas O’Neill'], 'profiles for one department');
    equal([state.profiles.levels, state.profiles.bios, state.profiles.photo, state.profiles.toggles, state.profiles.headings],
        [['3', '3', '3', '3'], [true, true, true, false], true, 0, 0], 'bios in full, no buttons, no headings on a department page without divisions');
    equal(state.profiles.bioHeading, ['h4', 'Committees'], 'bio headings below the name');
});

console.log('Department card');
const DEPT = 'const cards = () => hosts("department_card").map(h => h.shadowRoot);'
    + ' const clean = value => value.split(String.fromCharCode(8239)).join(" ").split(String.fromCharCode(160)).join(" ").trim();'
    + ' const all = (sr, selector) => [...sr.querySelectorAll(selector)].map(n => clean(n.textContent));'
    + ' const one = (sr, selector) => sr.querySelector(selector) ? clean(sr.querySelector(selector).textContent) : null;'
    + ' const status = sr => sr.querySelector(".dc-status") ? [sr.querySelector(".dc-status").className, one(sr, ".dc-pill"), all(sr, ".dc-detail")] : null;';
await test('full card on a holiday: status, contact, addresses and directions, hours with today, closures, links', async () => {
    await load('/c/department_card');
    const state = await run(DEPT + ' const sr = cards()[1];'
        + ' return { status: status(sr), name: [one(sr, ".dc-name"), sr.querySelector(".dc-name").getAttribute("aria-level"), sr.querySelector(".dc-name a") ? "link" : "text"],'
        + '   sections: [...sr.querySelectorAll(".dc-section-title, .dc-subtitle")].map(h => h.textContent.trim() + " " + h.getAttribute("aria-level")),'
        + '   contact: all(sr, ".dc-section .dc-lines .dc-line"), links: [...sr.querySelectorAll(".dc-section .dc-link")].map(a => a.getAttribute("href")),'
        + '   office: all(sr, ".dc-place")[0], mailing: all(sr, ".dc-place .dc-address")[1],'
        + '   directions: [sr.querySelector(".dc-directions").getAttribute("href"), sr.querySelector(".dc-directions").getAttribute("target"), clean(sr.querySelector(".dc-directions").textContent)],'
        + '   rows: [...sr.querySelectorAll(".dc-hours tr")].map(tr => [clean(tr.querySelector("th").firstChild.textContent), clean(tr.querySelector("td").textContent), tr.classList.contains("is-today")]),'
        + '   note: one(sr, ".dc-hours-section > .dc-note"),'
        + '   closures: [...sr.querySelectorAll(".dc-closure")].map(li => [clean(li.querySelector(".dc-closure-name").firstChild.textContent), one(li, ".dc-closure-date"), one(li, ".dc-closure-hours"), li.classList.contains("is-today")]),'
        + '   quick: [...sr.querySelectorAll(".dc-quick")].map(a => [clean(a.textContent), a.getAttribute("href")]) };');
    equal(state.status, ['dc-status is-closed', 'Closed today', ['Thanksgiving', 'Opens Monday at 8:00 AM']], 'closed for the holiday, opens after the weekend');
    equal([state.name, state.sections], [['Health Department', '2', 'text'], ['Contact 3', 'Hours 3', 'Upcoming closures 4', 'Quick links 3']], 'heading levels');
    equal(state.contact, ['Dr. Olivia Dunn, Health Commissioner', '740-555-0140', 'Fax 740-555-0149', 'health@example.gov'], 'contact lines');
    equal(state.links, ['tel:7405550140', 'mailto:health@example.gov'], 'phone and email links');
    equal(state.office.startsWith('Office410 Hospital DriveSuite 100Riverton, OH 43000Free parking'), true, 'office address and note: ' + state.office);
    equal(state.mailing, 'PO Box 450Riverton, OH 43000', 'mailing address from an array');
    equal(state.directions, ['https://www.google.com/maps/search/?api=1&query=410%20Hospital%20Drive%2C%20Suite%20100%2C%20Riverton%2C%20OH%2043000', '_blank',
        'Get directions (opens in a new tab)'], 'directions built from the address');
    equal(state.rows, [['Monday–Wednesday', '8:00 AM – 4:30 PM', false], ['Thursday', '8:00 AM – 6:00 PM', true], ['Friday', '8:00 AM – 4:30 PM', false],
        ['Saturday–Sunday', 'Closed', false]], 'days with the same hours share a row; today marked');
    equal(state.note, 'Birth and death certificates are issued until 4:00 PM.', 'hours note');
    equal(state.closures, [['Thanksgiving', 'Thursday, November 26 – Friday, November 27', 'Closed', true], ['Christmas Eve', 'Thursday, December 24', '8:00 AM – 12:00 PM', false],
        ['Christmas Day', 'Friday, December 25', 'Closed', false]], 'the next three closures, shorter hours shown');
    equal(state.quick.length, 4, 'quick links');
});
await test('compact: closing soon, lunch break, 24 hours; temporarily closed, no hours, no department; live status', async () => {
    await load('/c/department_card');
    const state = await run(DEPT + ' const list = cards();'
        + ' const compact = sr => [status(sr), all(sr, ".dc-compact .dc-line"), sr.querySelector(".dc-name a") && sr.querySelector(".dc-name a").getAttribute("href"),'
        + '   sr.querySelectorAll(".dc-hours").length, sr.querySelector(".dc-desc") ? "described" : ""];'
        + ' return { soon: compact(list[2]), lunch: compact(list[3]), always: compact(list[4]),'
        + '   shelter: [status(list[5]), list[5].querySelectorAll(".dc-hours tr").length],'
        + '   soil: [status(list[6]), all(list[6], ".dc-section-title"), list[6].querySelector(".dc-body").className, list[6].querySelectorAll(".dc-directions, .dc-links-section, .dc-place").length],'
        + '   none: [one(list[7], ".dc-empty"), list[7].querySelectorAll(".dc-head").length],'
        + '   live: [status(list[0])[1], list[0].querySelectorAll(".dc-hours tr.is-today").length] };');
    equal(state.soon, [['dc-status is-closing', 'Closes soon', ['Christmas Eve', 'Closes at 12:00 PM']],
        ['Today: 8:00 AM – 12:00 PM (Christmas Eve)', '740-555-0140', '410 Hospital Drive, Suite 100, Riverton, OH 43000'], '/departments/health', 0, 'described'],
        'closing soon on a short day; the name links to the page, no hours table, the description shows');
    equal(state.lunch, [['dc-status is-closed', 'Closed', ['Opens at 1:00 PM']],
        ['Today: 8:00 AM – 12:00 PM, 1:00 PM – 4:30 PM', '740-555-0180', 'County Courthouse, Room 104, 1 Court Square, Riverton, OH 43000'], '/departments/recorder', 0, ''],
        'closed for lunch; an address string with line breaks, and no description to show');
    equal(state.always[0], ['dc-status is-open', 'Open now', ['Open 24 hours']], 'open 24 hours');
    equal(state.always[1][0], 'Today: Open 24 hours', 'today open 24 hours');
    equal(state.shelter, [['dc-status is-closed', 'Temporarily closed', ['Closed through Friday for flooring repairs. Adoptions resume Saturday at 10:00 AM.']], 4], 'the message wins over the hours');
    equal(state.soil, [null, ['Contact'], 'dc-body is-single', 0], 'no hours: no status, one column');
    equal(state.none, ['Department information is not available.', 0], 'no department');
    equal([['Open now', 'Closes soon', 'Closed', 'Closed today'].includes(state.live[0]), state.live[1]], [true, 1], 'live status: ' + state.live[0]);
});

console.log('Department list');
await test('sections A–Z (groupBy letter), search over keywords, the area filter, the live count, and clearing', async () => {
    await load('/c/department_list');
    const state = await run('const sr = hosts("department_list")[2].shadowRoot; const out = {};'
        + ' const count = () => sr.querySelector(".dp-count").textContent.trim();'
        + ' const sections = () => [...sr.querySelectorAll(".dp-section-title")].map(t => t.textContent.trim());'
        + ' const names = () => [...sr.querySelectorAll(".dp-item dz-component")].map(el => el.shadowRoot.querySelector(".dc-name").textContent.trim());'
        + ' const box = sr.querySelector("#dp-query"); const select = sr.querySelector("#dp-group");'
        + ' const type = async text => { box.value = text; box.dispatchEvent(new Event("input", { bubbles: true })); await wait(400); };'
        + ' out.start = [count(), sections(), names().length, sr.querySelector(".dp-count").getAttribute("role")];'
        + ' out.levels = [sr.querySelector(".dp-title").getAttribute("aria-level"), sr.querySelector(".dp-section-title").getAttribute("aria-level"),'
        + '   sr.querySelector(".dp-item dz-component").shadowRoot.querySelector(".dc-name").getAttribute("aria-level")];'
        + ' await type("dog licence"); out.keywords = [count(), names()];'
        + ' await type("water"); out.words = names();'
        + ' await type(""); select.value = "Finance"; select.dispatchEvent(new Event("change", { bubbles: true })); await wait(400);'
        + ' out.filtered = [count(), names()];'
        + ' await type("zzz"); out.none = [count(), sr.querySelector(".dp-empty-text").textContent.trim(), sr.querySelectorAll(".dp-item").length];'
        + ' await click(sr.querySelector(".dp-clear")); out.cleared = [count(), names().length, select.value, sr.activeElement.id];'
        + ' return out;');
    equal(state.start, ['18 departments', ['A', 'B', 'C', 'E', 'H', 'J', 'P', 'S', 'V', 'W'], 18, 'status'], 'letter sections and a live count');
    equal(state.levels, ['2', '3', '4'], 'title, then section, then each department name');
    equal(state.keywords, ['2 of 18 departments match', ['Animal Shelter', 'County Auditor']], 'search finds keywords, not just names');
    equal(state.words, ['Soil and Water Conservation District', 'Water and Sewer'], 'one word matches anywhere');
    equal(state.filtered, ['3 of 18 departments match', ['County Auditor', 'County Commissioners', 'County Treasurer']], 'the service area filter');
    equal(state.none, ['0 of 18 departments match', 'No departments match. Try fewer words, or a different service area.', 0], 'nothing matches');
    equal(state.cleared, ['18 departments', 18, '', 'dp-query'], 'clearing resets the box and the filter, and focuses the search');
});
await test('by service area by default and in a set order, one column, a hand-made order, and the empty list', async () => {
    await load('/c/department_list');
    const state = await run('const list = hosts("department_list"); const out = {};'
        + ' const names = sr => [...sr.querySelectorAll(".dp-item dz-component")].map(el => el.shadowRoot.querySelector(".dc-name").textContent.trim());'
        + ' const titles = sr => [...sr.querySelectorAll(".dp-section-title")].map(t => t.textContent.trim());'
        + ' const plain = list[0].shadowRoot; out.plain = [titles(plain), !!plain.querySelector("#dp-group")];'
        + ' const areas = list[1].shadowRoot; out.areas = [titles(areas), !!areas.querySelector("#dp-group")];'
        + ' const rows = list[3].shadowRoot;'
        + ' out.rows = [rows.querySelectorAll(".dp-section-title").length, rows.querySelector(".dp").classList.contains("is-rows"),'
        + '   [...rows.querySelectorAll(".dp-item dz-component")].slice(0, 2).map(el => el.shadowRoot.querySelector(".dc-pill").textContent.trim())];'
        + ' const order = list[4].shadowRoot;'
        + ' out.order = [names(order), !!order.querySelector("#dp-query"), !!order.querySelector(".dp-item dz-component").shadowRoot.querySelector(".dc-status")];'
        + ' const empty = list[5].shadowRoot; out.empty = [empty.querySelector(".dp-empty-text").textContent.trim(), !!empty.querySelector(".dp-clear"), empty.querySelector(".dp-count").textContent.trim()];'
        + ' const options = sr => [...sr.querySelectorAll("#dp-group option")].map(o => o.textContent.trim());'
        + ' out.optionsAZ = options(list[2].shadowRoot);'
        + ' list[2].component.proxy.groups = "Roads and utilities, Public safety"; await wait(400);'
        + ' out.optionsOrdered = options(list[2].shadowRoot);'
        + ' return out;');
    equal(state.plain, [['Finance', 'Health and family', 'Land and property', 'Parks and recreation', 'Public safety', 'Records and elections', 'Roads and utilities'], false],
        'with nothing set, sections are the service areas, A–Z, and there is no area filter');
    equal(state.areas, [['Public safety', 'Health and family', 'Records and elections', 'Land and property', 'Roads and utilities', 'Finance', 'Parks and recreation'], false],
        'sections are the areas in the order `groups` gives, the unlisted one last, and the filter is dropped');
    equal(state.rows, [0, true, ['Temporarily closed', 'Closed']], 'one column, no sections; the shelter keeps its message, the rest are closed after hours');
    equal(state.order, [['Sheriff’s Office', 'Health Department', 'County Recorder', 'Animal Shelter'], false, false], 'the order field, with no search box and no status');
    equal(state.empty, ['No departments to show yet.', false, ''], 'nothing yet: no count, no Clear');
    equal(state.optionsAZ, ['All areas', 'Finance', 'Health and family', 'Land and property', 'Parks and recreation', 'Public safety', 'Records and elections', 'Roads and utilities'],
        'without `groups` the filter reads A–Z');
    equal(state.optionsOrdered, ['All areas', 'Roads and utilities', 'Public safety', 'Finance', 'Health and family', 'Land and property', 'Parks and recreation', 'Records and elections'],
        '`groups` as a comma-separated string orders the filter too, the rest A–Z');
});

console.log('Service list');
await test('topics in order, "Most requested", keyword search, and the A–Z and single-topic variants', async () => {
    await load('/c/service_list');
    const state = await run('const lists = hosts("service_list").map(h => h.shadowRoot); const sr = lists[0]; const out = {};'
        + ' const names = root => [...root.querySelectorAll(".sv-link")].map(a => a.textContent.trim());'
        + ' const titles = root => [...root.querySelectorAll(".sv-section-title")].map(t => t.textContent.trim());'
        + ' const count = () => sr.querySelector(".sv-count").textContent.trim();'
        + ' const box = sr.querySelector("#sv-query");'
        + ' const type = async text => { box.value = text; box.dispatchEvent(new Event("input", { bubbles: true })); await wait(400); };'
        + ' out.sections = titles(sr).slice(0, 6);'
        + ' out.start = [count(), [...sr.querySelectorAll(".sv-tile-name")].map(t => t.textContent.trim()).length];'
        + ' const row = sr.querySelector(".sv-row");'
        + ' out.row = [row.querySelector(".sv-link").getAttribute("href"), [...row.querySelectorAll(".sv-tag")].map(t => t.textContent.trim()),'
        + '   row.querySelector(".sv-dept-link").getAttribute("href"), row.querySelector(".sv-name").getAttribute("aria-level")];'
        + ' await type("foia"); out.keyword = [names(sr), count(), !!sr.querySelector(".sv-popular")];'
        + ' await type("pay water"); out.words = names(sr);'
        + ' await type("zzz"); out.none = [sr.querySelector(".sv-empty-text").textContent.trim(), titles(sr).length];'
        + ' await click(sr.querySelector(".sv-clear")); out.cleared = [count(), sr.activeElement.id];'
        + ' out.az = [titles(lists[1]).slice(0, 4), !!lists[1].querySelector("#sv-topic"), !!lists[1].querySelector(".sv-popular")];'
        + ' out.one = [titles(lists[2]).length, names(lists[2]).length, lists[2].querySelectorAll(".sv-tag").length,'
        + '   !!lists[2].querySelector("#sv-query"), lists[2].querySelector(".sv-name").getAttribute("aria-level")];'
        + ' out.empty = [lists[3].querySelector(".sv-empty-text").textContent.trim(), lists[3].querySelector(".sv-count").textContent.trim()];'
        // Last: the link is a site path, so the router follows it and this page goes — the event
        // is caught on the host, since the gallery log goes with the page.
        + ' const seen = []; hosts("service_list")[0].addEventListener("service-click", event => seen.push(event.detail.service));'
        + ' await click(sr.querySelector(".sv-tile")); out.log = [seen.length, seen[0] && seen[0].name, location.pathname];'
        + ' return out;');
    equal(state.sections, ['Most requested', 'Taxes and payments', 'Permits and licences', 'Records and certificates', 'Roads and property', 'Courts and legal'],
        'the shelf, then the topics `groups` names, then the rest A–Z');
    equal(state.start, ['32 services', 6], 'every service counted, six on the shelf');
    equal(state.row, ['/services/homestead-exemption', ['Form'], '/departments?name=County%20Auditor', '4'], 'a row: link, chips, department link, heading level');
    equal(state.keyword, [['Request public records'], '1 of 32 services matches', false], 'a keyword that is not in the text finds it; the shelf goes while filtering');
    equal(state.words, ['Pay a water bill'], 'every word must match');
    equal(state.none, ['No services match. Try fewer words, or a different topic.', 0], 'nothing matches');
    equal(state.cleared, ['32 services', 'sv-query'], 'clearing puts everything back and focuses the search');
    equal(state.log, [1, 'Apply for a building permit', '/services/building-permit'],
        'service-click hands over the item, and the tile is a real link the router follows');
    equal(state.az, [['A', 'B', 'C', 'G'], true, false], 'A–Z sections, with the topic filter instead of topic sections');
    equal(state.one, [0, 3, 0, false, '3'], 'one topic: no sections, no chips, no search, and names move up a level');
    equal(state.empty, ['No services to show yet.', ''], 'nothing yet');
});

console.log('Rich text');
await test('rich_text: shifted headings, table box, and unsafe HTML dropped', async () => {
    await load('/c/rich_text');
    const state = await run('const roots = hosts("rich_text").map(h => h.shadowRoot.querySelector(".rt"));'
        + ' const [article, unsafe, large] = roots;'
        + ' const styled = unsafe.querySelector("p[style]"); const links = [...unsafe.querySelectorAll("a")]; const img = unsafe.querySelector("img");'
        + ' return { tags: [...article.children].map(el => el.tagName.toLowerCase()).join(" "),'
        + '   table: [article.querySelector(".rt-table").getAttribute("tabindex"), article.querySelectorAll(".rt-table th").length],'
        + '   highlight: !!article.querySelector("span.dz-bg-yellow"), link: article.querySelector("a").getAttribute("href"),'
        + '   dangerous: unsafe.querySelectorAll("script, iframe, section, [onerror], [onclick]").length,'
        + '   img: img ? [img.getAttribute("src"), img.getAttribute("alt"), img.attributes.length] : null,'
        + '   links: links.map(a => [a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]),'
        + '   styled: styled ? [styled.getAttribute("class"), styled.getAttribute("style")] : null,'
        + '   text: unsafe.textContent, large: large.className };');
    equal(state.tags, 'p h2 p ul h3 div p p', 'h1 and h2 shifted to h2 and h3; the table in its scroll box');
    equal([state.table, state.highlight, state.link], [['0', 3], true, '/roads/closures'], 'table, highlight and link kept');
    equal(state.dangerous, 0, 'script, iframe, handlers and unknown wrapper elements are gone');
    equal(state.img, ['x', 'Broken on purpose', 2], 'image keeps only src and alt');
    equal(state.links, [[null, null, null], ['https://example.gov/', '_blank', 'noopener noreferrer']], 'javascript: link loses its href; new-tab link gets rel');
    equal(state.styled, ['dz-align-center', 'color: rgb(192, 69, 91);'], 'only dz-* classes and safe style properties');
    assert(state.text.includes('Text from an unknown wrapper is kept.') && !state.text.includes('alert'), 'text: ' + state.text);
    equal(state.large, 'rt is-large', 'size');
});
await test('rich_text_editor: saved HTML seeds it, bold emits change, the link dialog opens and cancels', async () => {
    await load('/c/rich_text_editor');
    const state = await run('const [empty, saved] = hosts("rich_text_editor").map(h => h.shadowRoot);'
        + ' const surface = empty.querySelector(".rte-surface"); const out = { seeded: saved.querySelector(".rte-surface h1").textContent.trim(),'
        + '   placeholder: surface.getAttribute("data-placeholder"), emptyClass: surface.classList.contains("is-empty") };'
        + ' surface.focus(); const range = document.createRange(); range.selectNodeContents(surface.querySelector("p")); range.collapse(true);'
        + ' const sel = empty.getSelection ? empty.getSelection() : document.getSelection(); sel.removeAllRanges(); sel.addRange(range);'
        + ' document.execCommand("insertText", false, "Hello county"); await wait(300);'
        + ' const all = document.createRange(); all.selectNodeContents(surface.querySelector("p")); sel.removeAllRanges(); sel.addRange(all);'
        + ' await click([...empty.querySelectorAll(".rte-btn")].find(b => b.getAttribute("title") === "Bold")); await wait(300);'
        + ' out.html = surface.innerHTML; out.log = logLines()[0];'
        + ' const dialog = () => empty.querySelector("dz-component[dz-type=modal_dialog]").shadowRoot.querySelector("dialog");'
        + ' await click([...empty.querySelectorAll(".rte-btn")].find(b => b.getAttribute("title") === "Link")); await wait(400);'
        + ' out.linkOpen = dialog().open; out.linkText = empty.querySelector(".rte-link-form input").value;'
        + ' await click([...empty.querySelectorAll(".rte-dialog-actions button")].find(b => b.textContent.trim() === "Cancel")); await wait(400);'
        + ' out.linkClosed = !dialog().open; return out;');
    equal([state.seeded, state.placeholder, state.emptyClass], ['What to expect', 'Write the article…', true], 'seeded and empty');
    assert(/<(b|strong)>Hello county<\/(b|strong)>/.test(state.html), 'bold was not applied: ' + state.html);
    assert(state.log.startsWith('change <p><b>Hello county</b></p>') || state.log.startsWith('change <p><strong>Hello county</strong></p>'), 'change was not logged: ' + state.log);
    equal([state.linkOpen, state.linkText, state.linkClosed], [true, 'Hello county', true], 'link dialog in modal_dialog, prefilled from the selection');
});

console.log('Tabs');
const TABS = 'const tabHosts = () => hosts("tabs");'
    + ' const tabState = host => ({ tabs: [...host.shadowRoot.querySelectorAll("[role=tab]")].map(b => b.textContent.trim() + (b.getAttribute("aria-selected") === "true" ? "*" : "")),'
    + '   tabindex: [...host.shadowRoot.querySelectorAll("[role=tab]")].map(b => b.getAttribute("tabindex")).join(""),'
    + '   shown: [...host.children].map(k => (k.hasAttribute("hidden") ? 0 : 1)).join("") });'
    + ' const focusedIn = () => { let el = document.activeElement; while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement; return el; };'
    + ' const key = async name => { focusedIn().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, composed: true })); await wait(400);'
    + '   return [focusedIn().textContent.trim(), location.hash]; };';
await test('department tabs: tablist and named panels, arrow keys and Home/End, tab-change, the open tab in the address', async () => {
    await load('/c/tabs');
    const state = await run(TABS + ' const host = tabHosts()[0]; const sr = host.shadowRoot; const out = {};'
        + ' out.start = [tabState(host), sr.querySelector("[role=tablist]").getAttribute("aria-label"),'
        + '   [...host.children].map(k => [k.getAttribute("dz-type"), k.getAttribute("role"), k.getAttribute("aria-label"), k.getAttribute("tabindex"), getComputedStyle(k).display])];'
        + ' sr.querySelector("[role=tab]").focus();'
        + ' out.keys = [await key("ArrowRight"), await key("End"), await key("ArrowRight"), await key("ArrowLeft"), await key("Home")];'
        + ' await click(sr.querySelectorAll("[role=tab]")[1]); out.clicked = [tabState(host), location.hash, logLines()[0]];'
        + ' location.hash = "#documents"; await wait(600); out.linked = [tabState(host).shown, location.hash];'
        + ' return out;');
    equal(state.start[0], { tabs: ['Overview*', 'Staff', 'Forms and documents'], tabindex: '0-1-1', shown: '100' }, 'first tab open; only it is in the tab order');
    equal(state.start[1], 'Health Department', 'tablist named');
    equal(state.start[2], [['department_card', 'tabpanel', 'Overview', '0', 'block'], ['staff_directory', 'tabpanel', 'Staff', null, 'none'],
        ['document_list', 'tabpanel', 'Forms and documents', null, 'none']], 'panels created from items, named by their tabs; closed ones not displayed');
    equal(state.keys, [['Staff', '#staff'], ['Forms and documents', '#documents'], ['Overview', '#overview'], ['Forms and documents', '#documents'], ['Overview', '#overview']],
        'Right, End, Right wraps, Left wraps, Home: focus moves and the address follows');
    equal([state.clicked[0], state.clicked[1]], [{ tabs: ['Overview', 'Staff*', 'Forms and documents'], tabindex: '-10-1', shown: '010' }, '#staff'], 'click opens a tab');
    assert(state.clicked[2].startsWith('tab-change') && state.clicked[2].includes('"Staff"'), 'tab-change logged: ' + state.clicked[2]);
    equal(state.linked, ['001', '#documents'], 'a #documents link on the page opens that tab (the router keeps the fragment)');

    await load('/c/tabs#staff');
    const deep = await run(TABS + ' return [tabState(tabHosts()[0]).shown, location.hash];');
    equal(deep, ['010', '#staff'], 'opening /c/tabs#staff opens the Staff tab');
});
await test('boxed with plain children, titles and selected by id, a narrow row scrolls to the open tab, and empty', async () => {
    await load('/c/tabs');
    const state = await run(TABS + ' const [, boxed, permits, empty] = tabHosts(); const out = {};'
        + ' out.boxed = [tabState(boxed), [...boxed.children].map(k => k.getAttribute("aria-label"))];'
        + ' out.permits = tabState(permits);'
        + ' const list = permits.shadowRoot.querySelector(".tb-list"); permits.style.display = "block"; permits.style.width = "320px"; await wait(300);'
        + ' await click(permits.shadowRoot.querySelectorAll("[role=tab]")[7]); await wait(300);'
        + ' const tab = permits.shadowRoot.querySelectorAll("[role=tab]")[7]; const a = list.getBoundingClientRect(); const b = tab.getBoundingClientRect();'
        + ' out.narrow = [list.scrollLeft > 0, b.left >= a.left - 1 && b.right <= a.right + 1, list.scrollHeight <= list.clientHeight];'
        + ' out.empty = [empty.shadowRoot.querySelectorAll("[role=tablist]").length, empty.shadowRoot.querySelector(".tb-empty").textContent.trim()];'
        + ' return out;');
    equal(state.boxed, [{ tabs: ['Where to park*', 'Accessible parking', 'Bikes and buses'], tabindex: '0-1-1', shown: '100' },
        ['Where to park', 'Accessible parking', 'Bikes and buses']], 'plain elements named by data-tab-label');
    equal(state.permits.tabs[3], 'Fees*', 'selected by id');
    equal([state.permits.tabs.length, state.permits.shown], [9, '000100000'], 'names from titles; only Fees shown');
    equal(state.narrow, [true, true, true], 'the row scrolls to the open tab, with no vertical scrollbar');
    equal(state.empty, [0, 'Add components to show as tabs'], 'empty');
});

console.log('Content carousel');
const CAROUSEL = 'const states = host => [...host.children].map(k => k.getAttribute("data-cc"));'
    + ' const visible = host => [...host.children].map(k => getComputedStyle(k).visibility);'
    + ' const controls = host => host.shadowRoot.querySelectorAll(".cc-controls .cc-btn");'
    + ' const liveText = host => host.shadowRoot.querySelector(".cc-sr").textContent.trim();'
    + ' const mountProbe = async (props, count) => { const el = document.createElement("dz-component"); el.setAttribute("dz-type", "content_carousel");'
    + '   el._props = props; for (let i = 0; i < count; i++) { const kid = document.createElement("dz-component"); kid.setAttribute("dz-type", "dz-button");'
    + '   kid._props = { label: "Item " + (i + 1) }; el.appendChild(kid); } document.body.appendChild(el); await wait(900); return el; };'
    + ' const activeIndex = host => states(host).indexOf("on");';
await test('one item shows at a time; next, dots and announcements', async () => {
    await load('/c/content_carousel');
    const state = await run(CAROUSEL + ' const host = hosts("content_carousel")[1]; const sr = host.shadowRoot; const out = {};'
        + ' out.start = states(host); await wait(600); out.visible = visible(host);'
        + ' out.slideNames = [...host.children].map(k => k.getAttribute("aria-roledescription") + " " + k.getAttribute("aria-label"));'
        + ' out.buttons = [...controls(host)].map(b => b.getAttribute("aria-label"));'
        + ' await click(controls(host)[1]); await wait(400); out.afterNext = states(host); out.live = liveText(host);'
        + ' await click(controls(host)[0]); await click(controls(host)[0]); await wait(400); out.wrapped = states(host);'
        + ' const first = hosts("content_carousel")[0]; const dots = first.shadowRoot.querySelectorAll(".cc-dot");'
        + ' await click(dots[2]); await wait(300); out.dotState = activeIndex(first);'
        + ' out.current = [...first.shadowRoot.querySelectorAll(".cc-dot")].map(d => d.getAttribute("aria-current"));'
        + ' out.region = [sr.querySelector(".cc").getAttribute("role"), sr.querySelector(".cc").getAttribute("aria-label")];'
        + ' out.firstButtons = [...controls(first)].map(b => b.getAttribute("aria-label"));'
        + ' out.counters = [!!first.shadowRoot.querySelector(".cc-counter"), (sr.querySelector(".cc-counter") || { textContent: "" }).textContent.trim()];'
        + ' out.single = hosts("content_carousel")[3].shadowRoot.querySelectorAll(".cc-controls").length; return out;');
    equal(state.start, ['on', 'after', 'after'], 'first item on');
    equal(state.visible, ['visible', 'hidden', 'hidden'], 'only the current item is visible');
    equal(state.slideNames, ['slide 1 of 3', 'slide 2 of 3', 'slide 3 of 3'], 'slides are labelled');
    equal(state.buttons, ['Previous item', 'Next item'], 'no pause button when not rotating, no dots');
    equal(state.afterNext, ['before', 'on', 'after'], 'after next');
    equal(state.live, 'Item 2 of 3', 'announcement');
    equal(state.wrapped, ['before', 'before', 'on'], 'previous wraps from the first to the last');
    equal(state.dotState, 2, 'dot 3');
    equal(state.current, ['false', 'false', 'true'], 'aria-current on dots');
    equal(state.region, ['region', 'FAQ topics'], 'named region');
    equal(state.firstButtons, ['Pause rotation'], 'three items with dots: no arrows');
    equal(state.counters, [false, '3 / 3'], 'no counter when dots show every item; a counter when there are no dots (on item 3 by now)');
    equal(state.single, 0, 'one item has no controls');
});
await test('more than five items: arrows, and dots in groups of five', async () => {
    await load('/c/content_carousel');
    const state = await run(CAROUSEL + ' const host = hosts("content_carousel")[2]; const sr = host.shadowRoot;'
        + ' const read = () => ({ dots: [...sr.querySelectorAll("button.cc-dot")].map(d => d.getAttribute("aria-label")),'
        + '   current: [...sr.querySelectorAll("button.cc-dot")].findIndex(d => d.getAttribute("aria-current") === "true"),'
        + '   placeholders: sr.querySelectorAll(".cc-dot.is-placeholder").length, group: sr.querySelector(".cc-dots").getAttribute("aria-label"),'
        + '   counter: (sr.querySelector(".cc-counter") || { textContent: "" }).textContent.trim() });'
        + ' const out = { count: host.children.length, buttons: [...controls(host)].map(b => b.getAttribute("aria-label")), start: read() };'
        + ' for (let i = 0; i < 5; i++) await click(controls(host)[1]); await wait(300); out.sixth = read();'
        + ' await click(sr.querySelectorAll("button.cc-dot")[4]); await wait(300); out.tenth = read();'
        + ' await click(controls(host)[1]); await wait(300); out.eleventh = read();'
        + ' await click(controls(host)[0]); await wait(300); out.back = read(); return out;');
    equal(state.count, 12, 'items');
    equal(state.buttons, ['Previous item', 'Next item'], 'arrows (not rotating, so no pause)');
    equal([state.start.dots.length, state.start.current, state.start.placeholders, state.start.group],
        [5, 0, 0, 'Choose an item, 1 to 5 of 12'], 'first group');
    equal([state.sixth.dots[0], state.sixth.current, state.sixth.group], ['Item 6 of 12', 0, 'Choose an item, 6 to 10 of 12'], 'after five nexts');
    equal([state.start.counter, state.sixth.counter], ['1 / 12', '6 / 12'], 'visible counter');
    equal(state.tenth.current, 4, 'dot for item 10');
    equal([state.eleventh.dots, state.eleventh.current, state.eleventh.placeholders],
        [['Item 11 of 12', 'Item 12 of 12'], 0, 3], 'last group padded to five');
    equal([state.back.current, state.back.dots.length], [4, 5], 'previous goes back into the second group');
});
await test('auto-rotation advances, and pauses on hover and with the pause button', async () => {
    await load('/c/dz-button');
    const state = await run(CAROUSEL + ' const el = await mountProbe({ label: "Probe", interval: 3 }, 3); const sr = el.shadowRoot; const out = {};'
        + ' out.pauseLabel = controls(el)[0].getAttribute("aria-label");'
        + ' await wait(3300); out.after3s = activeIndex(el); out.live = liveText(el);'
        + ' sr.querySelector(".cc").dispatchEvent(new MouseEvent("mouseenter")); await wait(3300); out.hovered = activeIndex(el);'
        + ' sr.querySelector(".cc").dispatchEvent(new MouseEvent("mouseleave"));'
        + ' await click(controls(el)[0]); out.playLabel = controls(el)[0].getAttribute("aria-label");'
        + ' await wait(3300); out.paused = activeIndex(el); el.remove(); return out;');
    equal(state.pauseLabel, 'Pause rotation', 'pause button while rotating');
    equal(state.after3s, 1, 'advanced after one interval');
    equal(state.live, '', 'automatic changes are not announced');
    equal(state.hovered, 1, 'held while hovered');
    equal(state.playLabel, 'Start rotation', 'button after pausing');
    equal(state.paused, 1, 'held while paused');
});
await test('reduced motion: no auto-rotation and no pause button', async () => {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await load('/c/dz-button');
    const state = await run(CAROUSEL + ' const el = await mountProbe({ label: "Calm", interval: 3 }, 2);'
        + ' const out = { buttons: [...controls(el)].map(b => b.getAttribute("aria-label")) }; await wait(3300); out.active = activeIndex(el); el.remove(); return out;');
    await send('Emulation.setEmulatedMedia', { features: [] });
    equal(state, { buttons: [], active: 0 }, 'calm carousel: no pause button, and two items need no arrows');
});

console.log('Modal dialog');
const MODAL = 'const modals = () => hosts("modal_dialog");'
    + ' const dialogOf = host => host.shadowRoot.querySelector("dialog");'
    + ' const focusedIn = () => { let el = document.activeElement; while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement; return el; };'
    + ' const describe = el => el ? (el.getAttribute("aria-label") || el.textContent.trim()) : null;'
    + ' const backdrop = async dialog => { dialog.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(300); };';
const pressEscape = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(400);
};
await test('opens as a modal from its trigger, moves focus in, locks scrolling; Escape closes and returns focus', async () => {
    await load('/c/modal_dialog');
    const opened = await run(MODAL + ' const host = modals()[0]; const trigger = host.shadowRoot.querySelector(".md-trigger");'
        + ' trigger.focus(); await click(trigger); await wait(300); const dialog = dialogOf(host);'
        + ' return { open: dialog.open, modal: dialog.matches(":modal"), name: dialog.getAttribute("aria-label"), focus: describe(focusedIn()),'
        + '   overflow: document.documentElement.style.overflow, heading: dialog.querySelector("[role=heading]").getAttribute("aria-level"), log: logLines()[0] };');
    equal([opened.open, opened.modal, opened.name, opened.heading], [true, true, 'Delete this listing?', '2'], 'open as a modal, named by its title');
    equal(opened.focus, 'Close', 'focus moved into the dialog');
    equal(opened.overflow, 'hidden', 'page scrolling locked');
    assert(opened.log.startsWith('open') && opened.log.includes('trigger'), 'open was not logged: ' + opened.log);
    await pressEscape();
    const closed = await run(MODAL + ' const host = modals()[0];'
        + ' return { open: dialogOf(host).open, focus: describe(focusedIn()), overflow: document.documentElement.style.overflow, log: logLines()[0] };');
    equal([closed.open, closed.focus, closed.overflow], [false, 'Delete listing', ''], 'closed, focus back on the trigger, scrolling restored');
    assert(closed.log.startsWith('close') && closed.log.includes('escape'), 'close reason: ' + closed.log);
});
await test('slotted content with data-modal-close closes it with a value; the close button and the backdrop close it', async () => {
    await load('/c/modal_dialog');
    const state = await run(MODAL + ' const host = modals()[0]; const sr = host.shadowRoot; const out = {};'
        + ' out.slots = [...host.children].map(c => (c.getAttribute("slot") || "body") + ":" + (c.getAttribute("dz-type") || c.tagName.toLowerCase()));'
        + ' await click(sr.querySelector(".md-trigger")); out.footerShown = getComputedStyle(dialogOf(host).querySelector(".md-foot")).display !== "none";'
        + ' const del = host.querySelector("[data-modal-close=delete]"); await click(del.shadowRoot.querySelector("button, a")); await wait(200);'
        + ' out.afterAction = [dialogOf(host).open, logLines()[0]];'
        + ' await click(sr.querySelector(".md-trigger")); await click(sr.querySelector(".md-close")); out.afterClose = [dialogOf(host).open, logLines()[0]];'
        + ' await click(sr.querySelector(".md-trigger")); dialogOf(host).querySelector(".md-body").dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(200);'
        + ' out.insideClick = dialogOf(host).open; await backdrop(dialogOf(host)); out.afterBackdrop = [dialogOf(host).open, logLines()[0]]; return out;');
    equal(state.slots, ['body:p', 'footer:dz-button', 'footer:dz-button'], 'slot content');
    equal(state.footerShown, true, 'footer shown when its slot has content');
    equal(state.afterAction[0], false, 'closed by the footer button');
    assert(state.afterAction[1].includes('reason: action') && state.afterAction[1].includes('value: delete'), 'close with a value: ' + state.afterAction[1]);
    equal(state.afterClose[0], false, 'closed by the close button');
    assert(state.afterClose[1].includes('close-button'), 'close reason: ' + state.afterClose[1]);
    equal(state.insideClick, true, 'a click inside does not close it');
    equal(state.afterBackdrop[0], false, 'closed by the backdrop');
    assert(state.afterBackdrop[1].includes('backdrop'), 'close reason: ' + state.afterBackdrop[1]);
});
await test('components by dz-type inside; long content scrolls; backdrop close can be turned off', async () => {
    await load('/c/modal_dialog');
    const state = await run(MODAL + ' const withItem = modals()[1]; const policy = modals()[2]; const out = {};'
        + ' out.child = [...withItem.children].map(c => c.getAttribute("dz-type"));'
        + ' await click(withItem.shadowRoot.querySelector(".md-trigger")); await wait(500);'
        + ' const event = withItem.children[0]; out.childTitle = event.shadowRoot.querySelector(".ed-title").textContent.trim();'
        + ' out.childVisible = event.getBoundingClientRect().height > 0;'
        + ' out.footerHidden = getComputedStyle(dialogOf(withItem).querySelector(".md-foot")).display === "none";'
        + ' await click(withItem.shadowRoot.querySelector(".md-close")); await wait(300);'
        + ' await click(policy.shadowRoot.querySelector(".md-trigger")); await wait(300); const body = dialogOf(policy).querySelector(".md-body");'
        + ' out.scrolls = body.scrollHeight > body.clientHeight; out.dialogFits = dialogOf(policy).getBoundingClientRect().height <= window.innerHeight;'
        + ' await backdrop(dialogOf(policy)); out.stillOpen = dialogOf(policy).open;'
        + ' await click(policy.querySelector("[data-modal-close=accept]").shadowRoot.querySelector("button, a")); await wait(200);'
        + ' out.closed = !dialogOf(policy).open; return out;');
    equal(state.child, ['event_details'], 'item created by dz-type');
    equal([state.childTitle, state.childVisible], ['Conference', true], 'the component renders inside the open dialog');
    equal(state.footerHidden, true, 'an empty footer is hidden');
    equal([state.scrolls, state.dialogFits], [true, true], 'the body scrolls and the dialog fits the screen');
    equal([state.stillOpen, state.closed], [true, true], 'backdrop ignored; the action closes it');
});
await test('a page can open and close it with the open prop', async () => {
    await load('/c/dz-button');
    const state = await run(MODAL + ' const el = document.createElement("dz-component"); el.setAttribute("dz-type", "modal_dialog");'
        + ' el._props = { title: "Controlled", text: "Opened by the page.", open: false }; document.body.appendChild(el); await wait(800);'
        + ' const reasons = []; el.addEventListener("open", e => reasons.push("open:" + e.detail.reason)); el.addEventListener("close", e => reasons.push("close:" + e.detail.reason));'
        + ' const out = { trigger: !!el.shadowRoot.querySelector(".md-trigger") };'
        + ' el.component.proxy.open = true; await wait(400); out.opened = dialogOf(el).open;'
        + ' el.component.proxy.open = false; await wait(400); out.closed = !dialogOf(el).open; out.reasons = reasons; el.remove(); return out;');
    equal(state, { trigger: false, opened: true, closed: true, reasons: ['open:host', 'close:host'] }, 'controlled by open');
});

console.log('Prompt dialog');
const PROMPTS = 'const prompts = () => hosts("prompt_dialog");'
    + ' const modalOf = host => host.shadowRoot.querySelector("dz-component[dz-type=modal_dialog]");'
    + ' const dialogOf = host => modalOf(host).shadowRoot.querySelector("dialog");'
    + ' const openIt = async host => { const trigger = modalOf(host).shadowRoot.querySelector(".md-trigger"); trigger.focus(); trigger.click(); await wait(500); };'
    + ' const focusedIn = () => { let el = document.activeElement; while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement; return el; };'
    + ' const focusName = () => { const el = focusedIn(); return el ? (el.id || el.textContent.trim()) : null; };'
    + ' const type = (host, text) => { const input = host.shadowRoot.querySelector("#pd-input"); input.value = text; input.dispatchEvent(new Event("input", { bubbles: true })); return input; };'
    + ' const press = async (host, which) => { host.shadowRoot.querySelector(".pd-" + which).click(); await wait(500); };'
    + ' const errorText = host => { const el = host.shadowRoot.querySelector(".pd-error"); return el ? el.textContent.trim() : null; };';
await test('confirm and alert: alertdialog named and described, first focus, results, focus returns', async () => {
    await load('/c/prompt_dialog');
    const state = await run(PROMPTS + ' const [danger, alert] = prompts(); const out = {};'
        + ' await openIt(danger); const dialog = dialogOf(danger);'
        + ' out.danger = [dialog.open, dialog.getAttribute("role"), dialog.getAttribute("aria-label"), dialog.querySelector("#" + dialog.getAttribute("aria-describedby")).textContent.trim(),'
        + '   focusName(), [...danger.shadowRoot.querySelectorAll(".pd-btn")].map(b => b.textContent.trim()), !!dialog.querySelector(".md-close")];'
        + ' await press(danger, "cancel"); out.cancelled = [dialog.open, focusedIn() && focusedIn().classList.contains("md-trigger"), logLines()[0]];'
        + ' await openIt(danger); await press(danger, "confirm"); out.confirmed = logLines()[0];'
        + ' await openIt(alert); out.alert = [focusName(), alert.shadowRoot.querySelectorAll(".pd-cancel").length]; return out;');
    equal(state.danger, [true, 'alertdialog', 'Delete this listing?', 'The listing and its documents will no longer be shown on the site. This cannot be undone.',
        'Cancel', ['Cancel', 'Delete listing'], false], 'danger confirm: named and described, starts on Cancel, no close button');
    equal(state.cancelled.slice(0, 2), [false, true], 'cancel closes and returns focus to the trigger');
    assert(state.cancelled[2].startsWith('result') && state.cancelled[2].includes('confirmed: false') && state.cancelled[2].includes('reason: cancel'), 'cancel result: ' + state.cancelled[2]);
    assert(state.confirmed.includes('confirmed: true') && state.confirmed.includes('reason: confirm'), 'confirm result: ' + state.confirmed);
    equal(state.alert, ['OK', 0], 'alert: one button, focused');
    await pressEscape();
    const escaped = await run(PROMPTS + ' const alertLog = deepAll(".log-list")[1].querySelector("div:not(.log-empty)"); return [dialogOf(prompts()[1]).open, alertLog ? alertLog.textContent.trim() : ""];');
    equal(escaped[0], false, 'Escape closes the alert');
    assert(escaped[1].includes('reason: escape') && escaped[1].includes('confirmed: false'), 'escape result: ' + escaped[1]);
});
await test('prompt: selected starting value, required and email errors, Enter submits, phrase to confirm, DzPrompt from code', async () => {
    await load('/c/prompt_dialog');
    const state = await run(PROMPTS + ' const [, , rename, share, phrase] = prompts(); const out = {};'
        + ' await openIt(rename); const input = rename.shadowRoot.querySelector("#pd-input");'
        + ' out.start = [focusName(), input.value, input.selectionStart, input.selectionEnd, rename.shadowRoot.querySelector("label[for=pd-input]").textContent.trim(), input.getAttribute("aria-describedby")];'
        + ' type(rename, "   "); await press(rename, "confirm");'
        + ' out.blank = [dialogOf(rename).open, errorText(rename), input.getAttribute("aria-invalid"), input.getAttribute("aria-describedby"), focusName()];'
        + ' type(rename, "  Recycling  "); await wait(200); out.typing = [errorText(rename), input.getAttribute("aria-invalid")];'
        + ' input.closest("form").requestSubmit(); await wait(500); out.submitted = [dialogOf(rename).open, logLines()[0]];'
        + ' await openIt(share); type(share, "not-an-email"); await press(share, "confirm"); out.email = [dialogOf(share).open, errorText(share)];'
        + ' type(share, "clerk@example.gov"); await press(share, "confirm"); out.emailOk = [dialogOf(share).open, logLines()[0]];'
        + ' await openIt(phrase); out.phraseStart = [focusName(), phrase.shadowRoot.querySelector("label[for=pd-input]").textContent.trim()];'
        + ' type(phrase, "delete"); await press(phrase, "confirm"); out.phraseWrong = [dialogOf(phrase).open, errorText(phrase)];'
        + ' type(phrase, "DELETE"); await press(phrase, "confirm"); out.phraseOk = dialogOf(phrase).open;'
        + ' const asked = DzPrompt.prompt("Name the new page", "Draft"); const sr = await openPrompt();'
        + ' out.code = [sr.querySelector("#pd-input").value, sr.querySelector("label[for=pd-input]").textContent.trim()];'
        + ' type(sr.host, " Parks "); sr.querySelector(".pd-confirm").click(); out.code.push(await asked);'
        + ' const confirmAsk = DzPrompt.confirm({ title: "Leave this page?" }); await answer(false); out.code.push(await confirmAsk);'
        + ' await wait(500); out.code.push(document.querySelectorAll("dz-component[data-dz-prompt]").length); return out;');
    equal(state.start, ['pd-input', 'Trash & recycling', 0, 17, 'Page name', 'pd-hint'], 'focus in the field, current value selected, label and hint');
    equal(state.blank, [true, 'Error: Page name is required.', 'true', 'pd-hint pd-error', 'pd-input'], 'blank: stays open with the error, field focused');
    equal(state.typing, [null, 'false'], 'typing clears the error');
    equal(state.submitted[0], false, 'Enter (form submit) goes through');
    assert(state.submitted[1].includes('value: Recycling') && state.submitted[1].includes('confirmed: true'), 'trimmed answer: ' + state.submitted[1]);
    equal(state.email, [true, 'Error: Enter an email address, like name@example.gov.'], 'email checked');
    equal(state.emailOk[0], false, 'a valid email goes through');
    equal(state.phraseStart, ['pd-input', 'Type DELETE to confirm'], 'phrase field');
    equal([state.phraseWrong, state.phraseOk], [[true, 'Error: Type DELETE exactly as shown to confirm.'], false], 'the phrase must match exactly');
    equal(state.code, ['Draft', 'Name the new page', 'Parks', false, 0], 'DzPrompt.prompt resolves the answer, confirm resolves false on cancel, and the dialogs are removed');
});

console.log('Alert banner');
await test('levels, the band landmark, stacking with "Show all", dismissing with focus, and one at a time', async () => {
    await load('/c/alert_banner');
    const state = await run('const banners = hosts("alert_banner"); const out = {};'
        + ' const logOf = i => [...deepAll(".log-list")[i].children].map(d => d.textContent.trim()).filter(t => !t.startsWith("Use the demo"));'
        + ' const strips = sr => [...sr.querySelectorAll(".ab-alert")].map(a => [a.getAttribute("role") || "", a.className.split(" ").pop(),'
        + '   a.querySelector(".ab-sr").textContent, !!a.querySelector(".ab-dismiss")]);'
        + ' const text = sr => sr.querySelector(".ab-text").textContent.replace(/\\s+/g, " ").trim();'
        + ' const focusedIn = () => { let el = document.activeElement; while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement; return el; };'
        + ' const warn = banners[0].shadowRoot;'
        + ' out.warning = [strips(warn), warn.querySelector(".ab-band").getAttribute("aria-label"), text(warn),'
        + '   warn.querySelector(".ab-link").getAttribute("href"), warn.querySelector(".ab-dismiss").getAttribute("aria-label")];'
        + ' out.mixed = strips(banners[1].shadowRoot);'
        + ' const many = banners[2].shadowRoot;'
        + ' out.stack = [strips(many).length, many.querySelector(".ab-more").textContent.trim()];'
        + ' await click(many.querySelector(".ab-more")); out.expanded = [strips(many).length, !!many.querySelector(".ab-more")];'
        + ' many.querySelector(".ab-dismiss").focus(); await click(many.querySelector(".ab-dismiss"));'
        + ' out.dismissed = [strips(many).length, focusedIn().className, logOf(2)[0]];'
        + ' const single = banners[3].shadowRoot;'
        + ' out.single = [strips(single).length, single.querySelector(".ab-of").textContent.trim(), single.querySelector(".ab-of").getAttribute("role")];'
        + ' await click(single.querySelectorAll(".ab-step")[1]);'
        + ' out.next = [single.querySelector(".ab-of").textContent.trim(), text(single).slice(0, 24).trim(), logOf(3)[0]];'
        + ' await click(single.querySelectorAll(".ab-step")[0]); await click(single.querySelectorAll(".ab-step")[0]);'
        + ' out.wrapped = single.querySelector(".ab-of").textContent.trim();'
        + ' out.empty = [banners[4].shadowRoot.querySelectorAll(".ab-band").length, banners[4].getBoundingClientRect().height];'
        + ' return out;');
    equal(state.warning[0], [['none', 'is-warning', 'Warning: ', true]], 'a warning is not a live region and can be dismissed');
    equal(state.warning[1], 'County alert', 'the band is one landmark, named by label');
    equal(state.warning[2], 'Warning: Holiday closing. All county offices are closed Monday, September 1 for Labor Day. Emergency services are unaffected. See the full holiday schedule',
        'severity is spoken, and the title and message are separated');
    equal(state.warning.slice(3), ['/departments/holidays', 'Dismiss: Holiday closing.'], 'link and named dismiss button');
    equal(state.mixed, [['alert', 'is-emergency', 'Emergency: ', false], ['none', 'is-info', 'Notice: ', true]],
        'an emergency interrupts and cannot be dismissed; the notice can');
    equal(state.stack, [2, 'Show 2 more alerts'], 'two of four shown');
    equal(state.expanded, [4, false], 'Show all reveals the rest');
    equal(state.dismissed.slice(0, 2), [3, 'ab-dismiss'], 'dismissing removes it and focus moves to the next one');
    assert(state.dismissed[2].startsWith('dismiss') && state.dismissed[2].includes('boil'), 'dismiss event: ' + state.dismissed[2]);
    equal(state.single, [1, 'Alert 1 of 3', 'status'], 'one at a time, with an announced position');
    equal(state.next.slice(0, 2), ['Alert 2 of 3', 'Notice: Passport office'], 'Next moves on');
    assert(state.next[2].startsWith('alert-change') && state.next[2].includes('index: 1'), 'alert-change: ' + state.next[2]);
    equal(state.wrapped, 'Alert 3 of 3', 'Previous wraps around to the last');
    equal(state.empty, [0, 0], 'no alerts: nothing rendered, no height');
});
await test('a dismissal is remembered in the browser, and reload keeps it hidden', async () => {
    await load('/c/alert_banner');
    const first = await run('const sr = hosts("alert_banner")[0].shadowRoot; localStorage.removeItem("dz-alerts-dismissed");'
        + ' await click(sr.querySelector(".ab-dismiss"));'
        + ' return [sr.querySelectorAll(".ab-alert").length, JSON.parse(localStorage.getItem("dz-alerts-dismissed") || "[]")];');
    equal(first, [0, ['labor-day']], 'dismissed and remembered by id');
    await load('/c/alert_banner');
    const after = await run('const sr = hosts("alert_banner")[0].shadowRoot;'
        + ' const out = [sr.querySelectorAll(".ab-alert").length, hosts("alert_banner")[2].shadowRoot.querySelectorAll(".ab-alert").length];'
        + ' localStorage.removeItem("dz-alerts-dismissed"); return out;');
    equal(after, [0, 2], 'still hidden after a reload; a banner with remember false is unaffected');
});

console.log('Page feedback');
await test('the vote goes out at once, the note comes through the prompt, and the thank-you takes focus', async () => {
    await load('/c/page_feedback');
    const state = await run('const blocks = hosts("page_feedback"); const out = {};'
        + ' const logOf = i => [...deepAll(".log-list")[i].children].map(d => d.textContent.trim()).filter(t => t !== "Use the demo; its events show here.");'
        + ' const focusedIn = () => { let el = document.activeElement; while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement; return el; };'
        + ' const titleOf = sr => sr.host.shadowRoot.querySelector("dz-component[dz-type=modal_dialog]").shadowRoot.querySelector(".md-title").textContent.trim();'
        + ' const first = blocks[0].shadowRoot;'
        + ' out.ask = [[...first.querySelectorAll(".pf-button")].map(b => b.textContent.trim() + "/" + b.getAttribute("aria-describedby")), first.querySelector("#pf-question").textContent.trim()];'
        + ' first.querySelectorAll(".pf-button")[1].click(); const sr = await openPrompt();'
        + ' out.note = [titleOf(sr), sr.querySelector("label[for=pd-input]").textContent.trim(), sr.querySelector("#pd-input").tagName.toLowerCase(),'
        + '   [...sr.querySelectorAll(".pd-btn")].map(b => b.textContent.trim()), logOf(0)];'
        + ' const input = sr.querySelector("#pd-input"); input.value = "  The phone number is out of date.  "; input.dispatchEvent(new Event("input", { bubbles: true }));'
        + ' sr.querySelector(".pd-confirm").click(); await wait(700);'
        + ' out.sent = [first.querySelector(".pf-thanks").textContent.trim(), !!first.querySelector(".pf-ask"), focusedIn().className,'
        + '   first.querySelector(".pf-thanks").getAttribute("role"), logOf(0)];'
        + ' const second = blocks[1].shadowRoot; second.querySelector(".pf-button").click(); const sr2 = await openPrompt();'
        + ' out.always = titleOf(sr2); sr2.querySelector(".pd-cancel").click(); await wait(700);'
        + ' out.cancelled = [second.querySelector(".pf-thanks").textContent.trim(), logOf(1)];'
        + ' const third = blocks[2].shadowRoot; const before = document.querySelectorAll("dz-component[data-dz-prompt]").length;'
        + ' third.querySelector(".pf-button").click(); await wait(600);'
        + ' out.never = [third.querySelector(".pf-thanks").textContent.trim(), document.querySelectorAll("dz-component[data-dz-prompt]").length - before, logOf(2),'
        + '   third.querySelector("#pf-question") ? "asking" : "answered"];'
        + ' out.preset = [blocks[3].shadowRoot.querySelector(".pf-thanks").textContent.trim(), logOf(3).length]; return out;');
    equal(state.ask, [['Yes/pf-question', 'No/pf-question'], 'Was this page helpful?'], 'both buttons are described by the question');
    equal(state.note.slice(0, 4), ['What went wrong?', 'Your note', 'textarea', ['No thanks', 'Send']], 'No opens the note dialog');
    equal(state.note[4], ['feedback helpful: false, page: /departments/health'], 'the vote is recorded before the note is written');
    equal(state.sent.slice(0, 4), ['Thanks — your note has been sent.', false, 'pf-thanks', 'status'], 'the thank-you replaces the buttons, is announced and takes focus');
    equal(state.sent[4], ['comment helpful: false, comment: The phone number is out of date., page: /departments/health',
        'feedback helpful: false, page: /departments/health'], 'the note is emitted trimmed, as its own event');
    equal(state.always, 'Tell us more', 'askComment always: Yes asks too, with the given title');
    equal(state.cancelled, ['Thanks for your feedback.', ['feedback helpful: true, page: /services/pay-taxes']],
        'closing the note dialog keeps the vote and says plain thanks');
    equal(state.never, ['Thanks for your feedback.', 0, ['feedback helpful: true, page: /news'], 'answered'], 'askComment never: no dialog at all');
    equal(state.preset, ['Thanks for your feedback.', 0], 'answered as given, with nothing emitted');
});

console.log('Toasts');
// Focus events only fire in a page that has focus, and a headless page never does by itself.
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
const TOASTS = 'const region = () => document.querySelector("dz-component[data-dz-toast]");'
    + ' const rowsOf = sr => sr ? [...sr.querySelectorAll(".tr-toast")].map(li => li.getAttribute("data-toast-id")) : [];'
    + ' const rows = () => rowsOf(region() && region().shadowRoot);'
    + ' const spoken = sr => [...sr.querySelectorAll(".tr-polite p, .tr-assertive p")].map(p => p.parentNode.getAttribute("role") + ": " + p.textContent);'
    + ' const focusedIn = () => { let el = document.activeElement; while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement; return el; };'
    + ' const focusName = () => { const el = focusedIn(); return el ? (el.getAttribute("aria-label") || el.textContent.trim()) : null; };'
    + ' const key = (target, init) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, ...init }));';
await test('in the page from items: tones said with their prefix, not read out on load, action and close through events', async () => {
    await load('/c/toast_region');
    const state = await run(TOASTS + ' const [tones, actions] = hosts("toast_region").map(h => h.shadowRoot); const out = {};'
        + ' out.tones = [rowsOf(tones), [...tones.querySelectorAll(".tr-sr:not([role])")].map(s => s.textContent), spoken(tones).length,'
        + '   tones.querySelector("section").getAttribute("aria-label"), [...tones.querySelectorAll(".tr-close")].map(b => b.getAttribute("aria-label"))];'
        + ' await click(actions.querySelector(".tr-action")); await wait(300); out.action = [rowsOf(actions), logLines().slice(0, 2)];'
        + ' await click(actions.querySelector(".tr-close")); await wait(300); out.closed = [rowsOf(actions), !!actions.querySelector("section"), !!region()];'
        + ' return out;');
    equal(state.tones, [['saved', 'scheduled', 'session', 'failed'], ['', '', 'Warning: ', 'Error: '], 0, 'Notifications (tones)',
        ['Dismiss: Page saved', 'Dismiss: Publishing scheduled', 'Dismiss: Your session ends in 5 minutes', 'Dismiss: Couldn’t save the page']], 'tones demo');
    equal(state.action, [['draft'], ['close id: deleted, reason: action', 'action id: deleted']], 'Undo emits action then close, and the page removes it');
    equal(state.closed, [[], false, false], 'closing the last one removes the stack; DzToast made no region of its own');
});
await test('DzToast: region made once, read out in order, queue beyond three, replace by id, reasons, Alt+T, Escape and focus, timers pause while focused', async () => {
    await load('/c/toast_region');
    const state = await run(TOASTS + ' const out = {}; const reasons = {}; const note = (name, p) => p.then(r => { reasons[name] = r.reason; });'
        + ' note("saved", DzToast.success({ id: "saved", message: "Page saved" })); note("failed", DzToast.error({ id: "failed", title: "Couldn’t save", message: "Try again." }));'
        + ' note("undo", DzToast.show({ id: "undo", message: "Deleted", action: "Undo" })); note("saving", DzToast.info({ id: "save", message: "Saving…" }));'
        + ' await wait(800); const sr = region().shadowRoot;'
        + ' out.first = [document.querySelectorAll("dz-component[data-dz-toast]").length, rows(), sr.querySelector("section").getAttribute("aria-label"), spoken(sr)];'
        + ' note("save", DzToast.success({ id: "save", message: "Saved" })); DzToast.dismiss("saved"); await wait(400);'
        + ' out.replaced = [rows(), sr.querySelector("[data-toast-id=save]").textContent.trim(), { ...reasons }];'
        + ' const start = deepAll(".try-button")[0]; start.focus(); key(document, { key: "t", code: "KeyT", altKey: true }); await wait(200); out.hotkey = focusName();'
        + ' key(focusedIn(), { key: "Escape" }); await wait(400); out.escape = [rows(), focusName(), reasons.save];'
        + ' focusedIn().click(); await wait(400); out.undo = [rows(), focusName(), reasons.undo];'
        + ' key(focusedIn(), { key: "Escape" }); await wait(400); out.back = [rows(), focusName(), reasons.failed];'
        + ' note("quick", DzToast.info({ id: "quick", message: "Quick", duration: 300 })); await wait(1000); out.timeout = [rows(), reasons.quick];'
        + ' note("held", DzToast.info({ id: "held", message: "Held", duration: 700 })); await wait(150); sr.querySelector(".tr-close").focus(); await wait(900);'
        + ' out.held = [rows(), reasons.held || "open"]; start.focus(); await wait(2600); out.released = [rows(), reasons.held]; return out;');
    equal(state.first.slice(0, 3), [1, ['saved', 'failed', 'undo'], 'Notifications'], 'one region, three shown, the fourth waits');
    equal(state.first[3], ['status: Page saved', 'status: Deleted Press Alt+T to reach it.', 'alert: Error: Couldn’t save. Try again.'], 'read out, errors assertively');
    equal(state.replaced, [['failed', 'undo', 'save'], 'Saved', { saving: 'replaced', saved: 'code' }], 'replaced in the queue by id, dismissed from code');
    equal(state.hotkey, 'Dismiss: Saved', 'Alt+T focuses the newest toast');
    equal(state.escape, [['failed', 'undo'], 'Undo', 'close'], 'Escape closes it; focus moves to the toast in its place');
    equal(state.undo, [['failed'], 'Dismiss: Couldn’t save', 'action'], 'the action closes it with reason action');
    equal(state.back, [[], 'Page saved', 'close'], 'the last one closed: focus returns where it was');
    equal(state.timeout, [[], 'timeout'], 'a timed toast closes itself');
    equal(state.held, [['held'], 'open'], 'no timeout while focus is in the toast');
    equal(state.released, [[], 'timeout'], 'the timer runs again once focus leaves');
});
await send('Emulation.setFocusEmulationEnabled', { enabled: false });

console.log('Phone');
await test('move mode shows 44px "Place here" slots on touch screens', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] });
    await load('/c/dynamic_list');
    const slot = await run('const sr = hosts("dynamic_list")[0].shadowRoot; await click(rowButton(sr, "Bug")); await click(tool(sr, "move"));'
        + ' const gap = sr.querySelector(".dl-gap"); return { height: gap.offsetHeight, text: sr.querySelector(".dl-gap-text").textContent.trim() };');
    assert(slot.height >= 44, 'slot is ' + slot.height + 'px tall');
    equal(slot.text, 'Place here', 'slot text');
});

const failed = results.filter(ok => !ok).length;
console.log('');
console.log(failed ? failed + ' of ' + results.length + ' failed' : 'all ' + results.length + ' passed');
await shutdown(failed ? 1 : 0);
