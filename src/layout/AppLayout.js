export default Deezul.Component({
    // The gallery chrome: the library's own side_nav, fed from the catalog, and the outlet the
    // router mounts the current view into. Groups come from the catalog's `group` field, so the
    // sidebar organises itself as the library grows.
    //
    // Under 768px — side_nav's default collapseBelow — the nav becomes a top bar, so the shell
    // stacks it above the content. Keep the two breakpoints in step.
    template: `
        <div class="shell">
            <dz-component class="side" dz-type="side_nav" :title="'Deezul Components'" :titleHref="'/'"
                          :subtitle="countLabel" :items="links" :navLabel="'Components'"></dz-component>
            <main class="content">
                <router-component></router-component>
            </main>
        </div>
    `,

    data: () => ({ items: (typeof window !== 'undefined' && window.DzCatalog) || [] }),

    computed: {
        countLabel() {
            return this.items.length + (this.items.length === 1 ? ' component' : ' components');
        },

        // The catalog as side_nav links, in catalog.config.js order.
        links() {
            return this.items.map(c => ({ label: c.name, href: '/c/' + c.ref, group: c.group || 'Components' }));
        }
    },

    styles: `
        :host { display: block; height: 100%; }
        .shell { display: flex; height: 100%; }
        .side { flex: none; height: 100%; }
        .content { flex: 1; min-width: 0; overflow-y: auto; }

        @media (max-width: 767.98px) {
            .shell { flex-direction: column; }
            .side { height: auto; }
            .content { flex: 1; }
        }
    `
});
