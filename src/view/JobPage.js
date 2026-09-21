export default Deezul.Component({
    // The gallery's stand-in for an app's job page. /jobs/:id shows that job from the demo jobs
    // (published on window by main.js), so the job listing's card links have somewhere to go. In
    // the CMS, the page would load the job itself and pass it the same way.
    template: `
        <div class="page">
            <dz-component dz-type="job_details" :job="job" :backHref="'/c/job_listings'"></dz-component>
        </div>
    `,

    computed: {
        job() {
            const route = this.$route;
            const id = route && route.params && route.params.id ? String(route.params.id) : '';
            const jobs = (typeof window !== 'undefined' && window.DzDemoJobs) || [];
            return jobs.find(job => job.id === id) || {};
        }
    },

    styles: `
        .page { max-width: 1040px; padding: 40px 44px 64px; }
        @media (max-width: 767.98px) { .page { padding: 24px 16px 40px; } }
    `
});
