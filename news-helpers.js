/*
 * news-helpers.js — logic shared by the news components, published as window.DzNews.
 *
 * Layout only: the Deezul CMS owns the articles, their images and attachments, and hands them
 * in as props. DzNews.normalize turns one article, as the CMS sends it, into what the components
 * draw. Anything empty is left out of the display. Dates, contacts, files and safe links come
 * from window.DzGlobal (global.js).
 *
 * ARTICLE SHAPE (every field optional except a title, in practice):
 *   {
 *     id, title,
 *     date         published, 'YYYY-MM-DD' (a time after it is ignored)
 *     updated      'YYYY-MM-DD'; shown only when later than the published date
 *     category     'Press release', 'News', 'Announcement' — any text
 *     department   'Parks and Recreation'
 *     author       'Office of Communications'
 *     summary      one or two sentences: the card text, and the article's opening lede
 *     body         HTML from rich_text_editor; news_details shows it with rich_text, which
 *                  keeps only what the editor can produce (see RichText.js)
 *     image:       { src, alt, caption } — or just the src as a string (then no alt text)
 *     href         a link to the article somewhere else; wins over the list's detailsHref
 *     contact:     { name, phone, email, heading } — the media contact. `heading` names the box
 *                  for one article, for a notice that isn't a press enquiry: 'Questions about
 *                  this notice' (blank = the component's own label)
 *     documents:   [{ name, href, type, size }] — attachments (type and size as in document_list)
 *     links:       [{ label, href }] — related pages
 *   }
 * Links and image sources must be http(s), or a site or relative path; anything else is dropped.
 *
 * Kept free of regex and backslash escapes on purpose (see global.js).
 */

const DzNews = {
    text(value) {
        return DzGlobal.text(value).trim();
    },

    // One article as the components draw it.
    //   options.ui     labels: untitled, file
    //   options.date   an Intl date formatter
    //   options.href   link template with {id} (URL-encoded), or '' for none
    normalize(raw, index, options) {
        const article = raw && typeof raw === 'object' ? raw : {};
        const t = DzNews.text;
        const ui = options.ui;
        const dateKey = value => (DzGlobal.parseDate(t(value)) ? t(value).slice(0, 10) : '');
        const format = key => (key ? options.date.format(DzGlobal.parseDate(key)) : '');

        const id = t(article.id) || String(index);
        const date = dateKey(article.date);
        const updatedKey = dateKey(article.updated);
        const updated = updatedKey && updatedKey > date ? updatedKey : '';

        const rawImage = typeof article.image === 'string' ? { src: article.image } : article.image;
        const image = rawImage && typeof rawImage === 'object'
            ? { src: DzGlobal.safeHref(rawImage.src), alt: t(rawImage.alt), caption: t(rawImage.caption) }
            : { src: '', alt: '', caption: '' };

        const documents = (Array.isArray(article.documents) ? article.documents : [])
            .filter(doc => doc && typeof doc === 'object')
            .map((doc, i) => {
                const href = DzGlobal.safeHref(doc.href);
                const name = t(doc.name) || (href ? href.split('?')[0].split('#')[0].split('/').pop() : '');
                const type = DzGlobal.fileType(doc.type, doc.fileName, doc.href);
                const size = DzGlobal.fileSize(doc.size);
                const details = [type, size].filter(Boolean);
                return {
                    key: 'd' + i, name, href, type, size, meta: details.join(' · '),
                    kind: DzGlobal.fileKind(type), badge: type && type.length <= 4 ? type : ui.file.toUpperCase().slice(0, 4),
                    label: details.length ? name + ' (' + details.join(', ') + ')' : name
                };
            })
            .filter(doc => doc.href && doc.name);

        const links = (Array.isArray(article.links) ? article.links : [])
            .filter(link => link && typeof link === 'object')
            .map((link, i) => {
                const href = DzGlobal.safeHref(link.href);
                return { key: 'l' + i, href, label: t(link.label) || href };
            })
            .filter(link => link.href);

        const ownHref = DzGlobal.safeHref(article.href);
        const template = t(options.href);
        const title = t(article.title);
        return {
            key: id + '~' + index, id, index, found: !!title,
            title: title || ui.untitled, summary: t(article.summary), body: t(article.body),
            category: t(article.category), department: t(article.department), author: t(article.author),
            date, dateText: format(date), updated, updatedText: format(updated),
            image, contact: { ...DzGlobal.contact(article.contact), heading: t(article.contact && article.contact.heading) }, documents, links,
            href: ownHref || (template ? DzGlobal.safeHref(template.split('{id}').join(encodeURIComponent(id))) : '')
        };
    }
};

window.DzNews = DzNews;
export default DzNews;
