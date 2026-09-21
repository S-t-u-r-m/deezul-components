export default Deezul.Component({
    // The gallery's stand-in for an app's news article page. /news/:id shows that article from
    // the demo news (published on window by main.js), so the news list's card links have
    // somewhere to go. In the CMS, the page would load the article itself and pass it the same way.
    template: `
        <div class="page">
            <dz-component dz-type="news_details" :article="article" :backHref="'/c/news_list'"></dz-component>
        </div>
    `,

    computed: {
        article() {
            const route = this.$route;
            const id = route && route.params && route.params.id ? String(route.params.id) : '';
            const news = (typeof window !== 'undefined' && window.DzDemoNews) || [];
            return news.find(article => article.id === id) || {};
        }
    },

    styles: `
        .page { max-width: 1040px; padding: 40px 44px 64px; }
        @media (max-width: 767.98px) { .page { padding: 24px 16px 40px; } }
    `
});
