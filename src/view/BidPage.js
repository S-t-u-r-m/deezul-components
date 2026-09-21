export default Deezul.Component({
    // The gallery's stand-in for an app's bid page. /bids/:id shows that listing from the demo
    // bids (published on window by main.js), so the bid listing's card links have somewhere to
    // go. In the CMS, the page would load the listing itself and pass it the same way.
    template: `
        <div class="page">
            <dz-component dz-type="bid_details" :bid="bid" :backHref="'/c/bid_listings'"></dz-component>
        </div>
    `,

    computed: {
        bid() {
            const route = this.$route;
            const id = route && route.params && route.params.id ? String(route.params.id) : '';
            const bids = (typeof window !== 'undefined' && window.DzDemoBids) || [];
            return bids.find(bid => bid.id === id) || {};
        }
    },

    styles: `
        .page { max-width: 1040px; padding: 40px 44px 64px; }
        @media (max-width: 767.98px) { .page { padding: 24px 16px 40px; } }
    `
});
