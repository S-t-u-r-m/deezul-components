export default [
    // The gallery is two screens: the index of everything in the library, and one
    // workbench page per component (`ref` is the component's dz-type).
    { path: '/',        component: 'catalog-page',   layouts: ['app-layout'] },
    { path: '/c/:ref',  component: 'component-page', layouts: ['app-layout'] },
    // Where the calendar demos' event links lead: one event of the demo calendar.
    { path: '/events/:id', component: 'event-page', layouts: ['app-layout'] },
    // Where the job listing demo's card links lead: one of the demo jobs.
    { path: '/jobs/:id', component: 'job-page', layouts: ['app-layout'] },
    // Where the bid listing demo's card links lead: one of the demo bids.
    { path: '/bids/:id', component: 'bid-page', layouts: ['app-layout'] },
    // Where the news list demo's card links lead: one of the demo articles.
    { path: '/news/:id', component: 'news-page', layouts: ['app-layout'] }
];
