export default Deezul.Component({
    // The gallery's stand-in for an app's event page. /events/:id shows that event of the demo
    // calendar (loaded at boot in main.js), so the week view's card links have somewhere to go.
    // An app with one calendar can route straight to event_details instead; it reads the id
    // from the route itself.
    template: `
        <div class="page">
            <dz-component dz-type="event_details" :store="'demo'" :eventId="eventId" :backHref="'/c/calendar_week'"></dz-component>
        </div>
    `,

    computed: {
        eventId() {
            const route = this.$route;
            return route && route.params && route.params.id ? String(route.params.id) : '';
        }
    },

    styles: `
        .page { max-width: 960px; padding: 40px 44px 64px; }
        @media (max-width: 767.98px) { .page { padding: 24px 16px 40px; } }
    `
});
