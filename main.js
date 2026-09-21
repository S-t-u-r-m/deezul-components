import Deezul from './deezul.esm.js';
import modules from './modules.config.js';
import routes from './routes.config.js';
import catalog, { demoEvents } from './catalog.config.js';
// Shared component helpers, published as window.DzGlobal. Imported here so the build ships it.
import './global.js';
// In-page alert, confirm and prompt dialogs from code, published as window.DzPrompt.
import './prompt.js';
// Short messages that don't interrupt ("Page saved", "Deleted · Undo"), published as window.DzToast.
import './toast.js';
// Shared calendar data for the calendar views, published as window.DzCalendarStore.
import DzCalendarStore from './calendar-store.js';
// Shared job component logic, published as window.DzJobs.
import './job-helpers.js';
import { demoJobs } from './demo-jobs.js';
// Shared bid, RFQ and RFP component logic, published as window.DzBids.
import './bid-helpers.js';
import { demoBids } from './demo-bids.js';
// Shared news component logic, published as window.DzNews.
import './news-helpers.js';
import { demoNews } from './demo-news.js';

// The gallery's demo articles, for the /news/:id page.
window.DzDemoNews = demoNews;

// The gallery's demo bids, for the /bids/:id page.
window.DzDemoBids = demoBids;

// The gallery's demo jobs, for the /jobs/:id page.
window.DzDemoJobs = demoJobs;

// The gallery's demo calendar, loaded up front so /events/:id works even as the first page opened.
DzCalendarStore.use('demo').setEvents(demoEvents);

// Compiled components can't import app modules — they only see globals. The catalog is
// how the gallery views learn what exists, so it is published on window here at boot.
window.DzCatalog = catalog;

// Design tokens are adopted into every component's shadow root, so a component can use
// the library's utility classes as well as its own scoped styles.
const styles = [await (await fetch('/assets/tokens.css')).text()];   // absolute: survives deep links like /c/button

Deezul.init({
    rootElement: 'app',
    modules,
    routes,
    styles
});
