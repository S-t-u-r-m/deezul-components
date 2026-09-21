export default Deezul.Component({
    // NewsDetails — one news article or press release as a page: category and department,
    // the headline, publish and update dates, a figure with its caption, the summary as a lede,
    // the body, attachments and related links, with a media contact box beside it.
    //
    // DATA: `article` is one article from the CMS, in the shape documented in news-helpers.js.
    // This component only lays it out; anything empty is left out. The body is HTML from
    // rich_text_editor, shown with rich_text (its headings start one level below the headline).
    //
    //   <dz-component dz-type="news_details" :article="article" :backHref="'/news'"></dz-component>
    //
    // SHARE: uses the device's share sheet where there is one (phones), otherwise copies the
    // link and says "Link copied". The link is `shareUrl` ({id} = article id) or, when blank, the
    // address of the page it is on.
    //
    // OPTIONS:
    //   backHref       a "Back to news" link (blank = none)
    //   showShare      a Share button (default true)
    //   showPrint      a Print button (default true); buttons are left off the printout
    //   shareUrl       the link to share, with {id} (blank = this page's address)
    //   headingLevel   level of the headline (default 1, as a page's main heading); sections and
    //                  the contact box are one below
    //   locale         date names, e.g. 'fr-FR' (blank = the browser's)
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // An empty `article` (or one without a title) shows "Article not found".
    //
    // EVENTS emitted:
    //   share   { method: 'share' | 'copy', url }   the article was shared or its link copied
    //
    // NARROW: under ~46rem of its own width (a container query) the contact box moves below.
    //
    // NEEDS: window.DzNews (news-helpers.js) and window.DzGlobal, both imported by main.js, the
    // rich_text component, and the --dz-icon-chevron-left / -print / -share properties.
    schema: {
        inputs: {
            article:      { type: 'object', default: {}, label: 'Article' },
            backHref:     { type: 'string', default: '', label: 'Back link (blank = none)' },
            showShare:    { type: 'boolean', default: true, label: 'Show share button' },
            showPrint:    { type: 'boolean', default: true, label: 'Show print button' },
            shareUrl:     { type: 'string', default: '', label: 'Share link ({id} = article id; blank = this page)' },
            headingLevel: { type: 'number', default: 1, label: 'Headline heading level' },
            locale:       { type: 'string', default: '', label: 'Locale (blank = browser)' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. Bindings inside the :if blocks read `info`, which is
    // never null (every field has a value when the article is missing).
    template: html`
    <article class="nd" ref="root">
        <div class="nd-actions" :if="backHref || info.found">
            <a class="nd-back" :if="backHref" :href="backHref">
                <span class="nd-icon i-back" aria-hidden="true"></span>{{ ui.back }}
            </a>
            <div class="nd-tools" :if="info.found && (showShare || showPrint)">
                <button type="button" class="nd-tool" :if="showShare" @click="share">
                    <span class="nd-icon i-share" aria-hidden="true"></span>{{ ui.share }}
                </button>
                <button type="button" class="nd-tool" :if="showPrint" @click="print">
                    <span class="nd-icon i-print" aria-hidden="true"></span>{{ ui.print }}
                </button>
            </div>
        </div>
        <p class="nd-sr" role="status" aria-live="polite">{{ liveMessage }}</p>

        <div class="nd-card" :if="info.found">
            <header class="nd-head">
                <p class="nd-eyebrow" :if="info.category || info.department">
                    <span class="nd-chip" :if="info.category">{{ info.category }}</span>
                    <span class="nd-dept" :if="info.department">{{ info.department }}</span>
                </p>
                <p class="nd-title" role="heading" :aria-level="levels.title">{{ info.title }}</p>
                <p class="nd-byline" :if="info.dateText || info.author">
                    <span :if="info.dateText">{{ ui.published }} <time :datetime="info.date">{{ info.dateText }}</time></span>
                    <span :if="info.updatedText">{{ ui.updated }} <time :datetime="info.updated">{{ info.updatedText }}</time></span>
                    <span :if="info.author">{{ authorLine }}</span>
                </p>
            </header>

            <figure class="nd-figure" :if="info.image.src">
                <img class="nd-img" :src="info.image.src" :alt="info.image.alt">
                <figcaption class="nd-caption" :if="info.image.caption">{{ info.image.caption }}</figcaption>
            </figure>

            <div class="nd-layout" :class="info.contact.any ? '' : 'is-single'">
                <div class="nd-main">
                    <p class="nd-lede" :if="info.summary">{{ info.summary }}</p>
                    <div class="nd-body" :if="info.body">
                        <dz-component dz-type="rich_text" :html="info.body" :minHeadingLevel="levels.section"></dz-component>
                    </div>

                    <section class="nd-section" :if="info.documents.length">
                        <p class="nd-section-title" role="heading" :aria-level="levels.section">{{ ui.attachments }}</p>
                        <ul class="nd-docs">
                            <li :for="doc in info.documents" :key="doc.key">
                                <a class="nd-doc" :href="doc.href" :aria-label="doc.label" data-no-router>
                                    <span class="nd-file" :class="'is-' + doc.kind" aria-hidden="true">
                                        <span class="nd-sheet"></span><span class="nd-ext">{{ doc.badge }}</span>
                                    </span>
                                    <span class="nd-doc-name">{{ doc.name }}</span>
                                    <span class="nd-doc-meta" :if="doc.meta">{{ doc.meta }}</span>
                                </a>
                            </li>
                        </ul>
                    </section>

                    <section class="nd-section" :if="info.links.length">
                        <p class="nd-section-title" role="heading" :aria-level="levels.section">{{ ui.related }}</p>
                        <ul class="nd-links">
                            <li :for="link in info.links" :key="link.key"><a class="nd-link" :href="link.href">{{ link.label }}</a></li>
                        </ul>
                    </section>
                </div>

                <div class="nd-aside" :if="info.contact.any">
                    <div class="nd-box">
                        <p class="nd-box-title" role="heading" :aria-level="levels.section">{{ contactTitle }}</p>
                        <p class="nd-contact-name" :if="info.contact.name">{{ info.contact.name }}</p>
                        <dl class="nd-facts">
                            <div class="nd-fact" :if="info.contact.email">
                                <dt>{{ ui.email }}</dt>
                                <dd><a class="nd-link" :href="info.contact.emailHref">{{ info.contact.email }}</a></dd>
                            </div>
                            <div class="nd-fact" :if="info.contact.phone">
                                <dt>{{ ui.phone }}</dt>
                                <dd><a class="nd-link" :href="info.contact.phoneHref">{{ info.contact.phone }}</a></dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <div class="nd-missing" :if="!info.found">
            <p class="nd-title" role="heading" :aria-level="levels.title">{{ ui.notFound }}</p>
            <p class="nd-missing-text">{{ ui.notFoundText }}</p>
        </div>
    </article>
    `,

    data: () => ({
        article: {}, backHref: '', showShare: true, showPrint: true, shareUrl: '', headingLevel: 1, locale: '', labels: {},
        liveMessage: ''
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                back: 'Back to news',
                share: 'Share',
                print: 'Print',
                published: 'Published',
                updated: 'Updated',
                byAuthor: 'By {author}',
                attachments: 'Attachments',
                related: 'Related links',
                mediaContact: 'Media contact',
                email: 'Email',
                phone: 'Phone',
                copied: 'Link copied',
                copyFailed: 'Could not copy the link',
                untitled: '(untitled article)',
                file: 'File',
                notFound: 'Article not found',
                notFoundText: 'This article may have been moved or removed.'
            }, this.labels);
        },

        // A notice asks for its own heading ("Questions about this notice") through the article's
        // contact; news articles fall back to the label.
        contactTitle() {
            return DzGlobal.text(this.info.contact.heading).trim() || this.ui.mediaContact;
        },

        levels() {
            const n = Math.round(Number(this.headingLevel));
            const title = n >= 1 && n <= 6 ? n : 1;
            return { title, section: Math.min(title + 1, 6) };
        },

        // The article as drawn. Never null: `found` says whether there is one.
        info() {
            const raw = DzGlobal.raw(this.article);
            return DzNews.normalize(raw && typeof raw === 'object' ? raw : {}, 0, {
                ui: this.ui, href: '',
                date: DzGlobal.dateFormatter(this.locale, { month: 'long', day: 'numeric', year: 'numeric' })
            });
        },

        authorLine() {
            return DzGlobal.format(this.ui.byAuthor, { author: this.info.author });
        }
    },

    methods: {
        async share() {
            const info = this.info;
            const template = DzGlobal.text(this.shareUrl).trim();
            const url = template
                ? new URL(template.split('{id}').join(encodeURIComponent(info.id)), window.location.href).href
                : window.location.href;
            if (navigator.share) {
                try {
                    await navigator.share({ title: info.title, text: info.summary, url });
                    this.$emit('share', { method: 'share', url });
                } catch (error) {
                    // Closing the share sheet rejects too; there is nothing to say about that.
                }
                return;
            }
            try {
                await navigator.clipboard.writeText(url);
                this.$emit('share', { method: 'copy', url });
                DzGlobal.announce(this, this.ui.copied);
            } catch (error) {
                DzGlobal.announce(this, this.ui.copyFailed);
            }
        },

        print() {
            window.print();
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .nd { container-type: inline-size; font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a);
              --nd-link: #4a4dd6; }
        .nd-icon { display: block; flex: none; width: 1.2rem; height: 1.2rem; background: currentColor;
                   -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
        .i-back  { --icon: var(--dz-icon-chevron-left); }
        .i-print { --icon: var(--dz-icon-print); }
        .i-share { --icon: var(--dz-icon-share); }
        .nd-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
                 clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

        .nd-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0 0 .75rem; }
        .nd-back { display: inline-flex; align-items: center; gap: .15rem; margin-left: -.35rem; padding: .3rem .6rem .3rem .2rem;
                   border-radius: 6px; font-size: .875rem; font-weight: 600; text-decoration: none; color: var(--nd-link); }
        .nd-back:hover { background: color-mix(in srgb, var(--dz-color-primary, #5b5ef0) 10%, transparent); }
        .nd-tools { display: flex; gap: .5rem; margin-left: auto; }
        .nd-tool { display: inline-flex; align-items: center; gap: .35rem; height: 2.25rem; padding: 0 .8rem;
                   border: 1px solid #8a8f9c; border-radius: 6px; background: var(--dz-color-surface, #fff); font: inherit;
                   font-size: .875rem; font-weight: 600; color: var(--dz-color-heading, #1f2330); cursor: pointer; }
        .nd-tool .nd-icon { width: 1.05rem; height: 1.05rem; }
        .nd-tool:hover { background: var(--dz-color-bg, #f7f7fb); }
        .nd-back:focus-visible, .nd-tool:focus-visible, .nd-doc:focus-visible, .nd-link:focus-visible {
            outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 2px; }

        .nd-card { overflow: hidden; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 12px;
                   background: var(--dz-color-surface, #fff); }

        /* ---- Header. */
        .nd-head { display: flex; flex-direction: column; gap: .6rem; padding: 1.75rem 2rem 1.35rem; }
        .nd-eyebrow { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .75rem; margin: 0; }
        /* Dark text on a light tint, 7:1. */
        .nd-chip { padding: .15rem .65rem; border-radius: 999px; background: #eeeefd; color: #3b3ec2; font-size: .8125rem; font-weight: 700; }
        .nd-dept { font-size: .8125rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .nd-title { margin: 0; max-width: 34ch; font-family: var(--dz-font-heading, inherit); font-size: 2.1rem; font-weight: 800;
                    line-height: 1.15; letter-spacing: -.01em; color: var(--dz-color-heading, #1f2330); overflow-wrap: anywhere; }
        .nd-byline { display: flex; flex-wrap: wrap; margin: 0; font-size: .875rem; color: #555b69; }
        /* Every part has its dot in the gap before it; a part that starts a line has it clipped. */
        .nd-byline { margin-left: -1rem; clip-path: inset(0 0 0 1rem); }
        .nd-byline > span { position: relative; margin-left: 1rem; }
        .nd-byline > span::before { content: "·"; position: absolute; left: -1rem; width: 1rem; text-align: center; }

        .nd-figure { margin: 0; }
        .nd-img { display: block; width: 100%; max-height: 32rem; object-fit: cover; background: var(--dz-color-bg, #f7f7fb); }
        .nd-caption { padding: .6rem 2rem 0; font-size: .8125rem; line-height: 1.5; color: #555b69; }

        /* ---- Body beside the contact box; stacked (box after) when narrow. */
        .nd-layout { display: grid; grid-template-columns: minmax(0, 1fr) 17rem; align-items: start; gap: 2rem;
                     padding: 1.5rem 2rem 2rem; }
        .nd-layout.is-single { grid-template-columns: minmax(0, 1fr); }
        @container (max-width: 46rem) {
            .nd-layout { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; padding: 1.25rem; }
            .nd-head { padding: 1.35rem 1.25rem 1.1rem; }
            .nd-caption { padding: .6rem 1.25rem 0; }
            .nd-title { font-size: 1.6rem; }
        }
        .nd-main { display: flex; flex-direction: column; min-width: 0; max-width: 42rem; }
        .nd-lede { margin: 0 0 1.1rem; font-size: 1.2rem; line-height: 1.55; font-weight: 500; color: var(--dz-color-heading, #1f2330); }
        .nd-body { margin: 0 0 .5rem; }
        .nd-section { margin-top: 1.25rem; }
        .nd-section-title { margin: 0 0 .6rem; padding-bottom: .3rem; border-bottom: 2px solid var(--dz-color-border, #e4e6ee);
                            font-size: 1.125rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }

        .nd-docs, .nd-links { display: flex; flex-direction: column; gap: .45rem; margin: 0; padding: 0; list-style: none; }
        .nd-doc { display: flex; align-items: center; gap: .8rem; padding: .6rem .85rem; border: 1px solid var(--dz-color-border, #e4e6ee);
                  border-radius: 8px; text-decoration: none; color: inherit; }
        .nd-doc:hover { border-color: var(--dz-color-primary, #5b5ef0); background: var(--dz-color-bg, #f7f7fb); }
        .nd-doc-name { flex: 1; min-width: 0; font-weight: 600; color: var(--nd-link); text-decoration: underline; overflow-wrap: anywhere; }
        .nd-doc-meta { flex: none; font-size: .8125rem; }
        .nd-link { font-weight: 600; color: var(--nd-link); overflow-wrap: anywhere; }

        /* File icon, as in document_list: a sheet with a folded corner, tinted by type. */
        .nd-file { position: relative; flex: none; width: 1.7rem; height: 2.1rem; margin-left: .2rem;
                   --kind: #475467; --tint: #eef0f3; }
        .nd-file.is-pdf    { --kind: #b42318; --tint: #fdecea; }
        .nd-file.is-word   { --kind: #1d5bbf; --tint: #e8f0fc; }
        .nd-file.is-sheet  { --kind: #1a7f45; --tint: #e6f4ec; }
        .nd-file.is-slides { --kind: #b54708; --tint: #fdf0e4; }
        .nd-file.is-image  { --kind: #6d3fc0; --tint: #f0eafb; }
        .nd-file.is-media  { --kind: #0e7490; --tint: #e3f4f7; }
        .nd-sheet { position: absolute; inset: 0; border-radius: 3px; background: var(--tint); box-shadow: inset 0 0 0 1.5px var(--kind);
                    clip-path: polygon(0 0, 66% 0, 100% 28%, 100% 100%, 0 100%); }
        .nd-sheet::before { content: ""; position: absolute; top: 0; right: 0; width: 34%; height: 28%; background: var(--kind); opacity: .45; }
        .nd-ext { position: absolute; left: -.3rem; bottom: .3rem; padding: .05rem .2rem; border-radius: 3px; background: var(--kind);
                  color: #fff; font-size: .5rem; font-weight: 800; line-height: 1.2; }

        .nd-aside { min-width: 0; }
        .nd-box { padding: 1rem 1.1rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 10px;
                  background: var(--dz-color-bg, #f7f7fb); }
        .nd-box-title { margin: 0 0 .65rem; font-size: .8125rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .nd-contact-name { margin: 0 0 .6rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .nd-facts { display: flex; flex-direction: column; gap: .6rem; margin: 0; }
        .nd-fact dt { margin: 0; font-size: .75rem; font-weight: 600; }
        .nd-fact dd { margin: .1rem 0 0; overflow-wrap: anywhere; }

        .nd-missing { padding: 1.5rem 1.25rem; border: 1px dashed var(--dz-color-border, #e4e6ee); border-radius: 10px;
                      background: var(--dz-color-surface, #fff); }
        .nd-missing .nd-title { font-size: 1.5rem; }
        .nd-missing-text { margin: .4rem 0 0; color: var(--dz-color-muted, #6b7180); }

        @media print {
            .nd-actions { display: none; }
            .nd-card { border: 0; }
            .nd-img { max-height: 18rem; }
        }
    `
});
