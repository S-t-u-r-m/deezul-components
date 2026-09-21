/*
 * modules.config.js — every component the app can mount, keyed by the `dz-type` that
 * names it in a template. `src` is the component's source file under src/; deezul
 * resolves it to the compiled module in dev and in the build, so no compiled path is
 * ever written here.
 */
export default [
    // Gallery shell
    { ref: 'app-layout',     src: 'layout/AppLayout.js' },
    { ref: 'catalog-page',   src: 'view/CatalogPage.js' },
    { ref: 'component-page', src: 'view/ComponentPage.js' },
    { ref: 'event-page',     src: 'view/EventPage.js' },
    { ref: 'job-page',       src: 'view/JobPage.js' },
    { ref: 'bid-page',       src: 'view/BidPage.js' },
    { ref: 'news-page',      src: 'view/NewsPage.js' },

    // Library — add each new component here, then give it a catalog.config.js entry.
    { ref: 'dz-button',      src: 'component/Button.js' },
    { ref: 'accordion',      src: 'component/Accordion.js' },
    { ref: 'accordion_list', src: 'component/AccordionList.js' },
    { ref: 'dynamic_list',   src: 'component/lists/DynamicList.js' },
    { ref: 'page_feedback',  src: 'component/PageFeedback.js' },
    { ref: 'alert_banner',   src: 'component/AlertBanner.js' },
    { ref: 'side_nav',       src: 'component/navigation/SideNav.js' },
    { ref: 'calendar_month', src: 'component/calendar/CalendarMonth.js' },
    { ref: 'calendar_week',  src: 'component/calendar/CalendarWeek.js' },
    { ref: 'event_details',  src: 'component/calendar/EventDetails.js' },
    { ref: 'job_listings',   src: 'component/jobs/JobListings.js' },
    { ref: 'job_details',    src: 'component/jobs/JobDetails.js' },
    { ref: 'bid_listings',   src: 'component/bids/BidListings.js' },
    { ref: 'bid_details',    src: 'component/bids/BidDetails.js' },
    { ref: 'document_list',  src: 'component/documents/DocumentList.js' },
    { ref: 'news_list',      src: 'component/news/NewsList.js' },
    { ref: 'news_details',   src: 'component/news/NewsDetails.js' },
    { ref: 'rich_text_editor', src: 'component/text/RichTextEditor.js' },
    { ref: 'rich_text',      src: 'component/text/RichText.js' },
    { ref: 'staff_directory', src: 'component/directory/StaffDirectory.js' },
    { ref: 'department_card', src: 'component/directory/DepartmentCard.js' },
    { ref: 'department_list', src: 'component/directory/DepartmentList.js' },
    { ref: 'service_list',   src: 'component/directory/ServiceList.js' },
    { ref: 'content_carousel', src: 'component/layout/ContentCarousel.js' },
    { ref: 'tabs',           src: 'component/layout/Tabs.js' },
    { ref: 'modal_dialog',   src: 'component/layout/ModalDialog.js' },
    { ref: 'prompt_dialog',  src: 'component/layout/PromptDialog.js' },
    { ref: 'toast_region',   src: 'component/layout/ToastRegion.js' }
];
