/*
 * demo-news.js — made-up county news and press releases for the gallery's news demos. In an app
 * these come from the Deezul CMS, which also stores the images and attachments; the attachment
 * links here go nowhere. Dates sit relative to today so "newest first" always has an order.
 * The county, names, emails and phone numbers are fictional; the images are simple
 * illustrations in assets/demo.
 *
 * Public and legal notices are posted as news too, in the 'Public notice' and 'Legal notice'
 * categories; a notices page lists just those with news_list's categories option.
 */
const pad = n => String(n).padStart(2, '0');
const day = offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};
// Bodies are HTML as rich_text_editor writes it (paragraphs, headings, dz-* list and table classes).
const html = (...parts) => parts.join('');
const p = text => '<p>' + text + '</p>';

const communications = { name: 'Dana Whitfield, Public Information Officer', phone: '740-555-0110', email: 'news@example.gov' };

export const demoNews = [
    {
        id: 'road-resurfacing-begins', title: 'Road Resurfacing Season Begins Monday',
        date: day(-2), updated: day(-1), category: 'Press release', department: 'County Engineer', author: 'Office of Communications',
        summary: 'Crews will resurface 42 miles of county roads through October. Expect lane closures and short delays on weekdays.',
        image: { src: '/assets/demo/news-road.svg', alt: 'Illustration of a paving crew working on a two-lane road',
                 caption: 'Paving starts on Township Road 12 and moves north.' },
        body: html(
            p('The County Engineer’s office begins its annual resurfacing program on Monday. Over the next eight weeks, crews will repave <b>42 miles</b> of county roads, the most in a single season since 2019.'),
            '<h1>What to expect</h1>',
            p('Work runs weekdays from 7 a.m. to 5 p.m. Most roads stay open with flaggers directing one lane of traffic at a time.'),
            '<ul class="dz-list-disc"><li>Expect delays of up to 15 minutes.</li><li>A few narrow roads will close for a day while the surface is laid; detour signs will be posted.</li><li>Do not drive on fresh pavement marked with cones.</li></ul>',
            '<h2>First two weeks</h2>',
            '<table class="dz-table"><thead><tr><th>Road</th><th>Township</th><th>Dates</th></tr></thead><tbody><tr><td>Township Road 12</td><td>Madison</td><td>Monday to Wednesday</td></tr><tr><td>County Road 40</td><td>Granville</td><td>Thursday to next Tuesday</td></tr><tr><td>Linnville Road</td><td>Bowling Green</td><td>Next Wednesday to Friday</td></tr></tbody></table>',
            p('The schedule depends on the weather and may change. <span class="dz-bg-yellow">Updated closures are posted every Friday</span> on the <a href="/roads/closures">road closures page</a>.'),
            '<p class="dz-size-sm"><i>Updated: the Township Road 12 start moved from Tuesday to Monday.</i></p>'),
        contact: communications,
        documents: [
            { name: 'Resurfacing schedule', href: '/documents/news/resurfacing-schedule.pdf', size: 380000 },
            { name: 'Road list and map', href: '/documents/news/resurfacing-roads.xlsx', size: 64000 }
        ],
        links: [
            { label: 'Current road closures', href: '/roads/closures' },
            { label: 'Ohio Department of Transportation', href: 'https://www.transportation.ohio.gov/' }
        ]
    },
    {
        id: 'capital-plan-adopted', title: 'Commissioners Adopt 2027 Capital Plan',
        date: day(-4), category: 'Press release', department: 'Board of Commissioners', author: 'Office of Communications',
        summary: 'The five-year plan funds a new emergency operations center, bridge repairs and park improvements.',
        image: { src: '/assets/demo/news-building.svg', alt: 'Illustration of the county courthouse' },
        body: html(
            p('The Board of Commissioners adopted the 2027 to 2031 capital improvement plan at Tuesday’s meeting.'),
            p('The plan sets aside $18 million over five years, including a new emergency operations center, repairs to eleven bridges, and accessible paths at three parks.')),
        contact: communications,
        documents: [{ name: 'Capital improvement plan 2027–2031', href: '/documents/news/capital-plan.pdf', type: 'PDF', size: 2400000 }]
    },
    {
        id: 'riverside-playground', title: 'New Playground Opens at Riverside Park',
        date: day(-6), category: 'News', department: 'Parks and Recreation',
        summary: 'The accessible playground includes a wheelchair-friendly merry-go-round and a sensory garden.',
        image: { src: '/assets/demo/news-park.svg', alt: 'Illustration of a playground with swings and a slide' },
        body: html(p('Families can now use the new playground at Riverside Park, open daily from dawn to dusk.'),
            p('The project was paid for with a state grant and donations from local businesses.'))
    },
    {
        id: 'zoning-hearing', title: 'Notice of Public Hearing: Zoning Amendment for the Route 16 Corridor',
        date: day(-7), category: 'Legal notice', department: 'Board of Commissioners', author: 'Clerk of the Board',
        summary: 'The Board of Commissioners will hear public comment on rezoning 38 acres along Route 16 from agricultural to light industrial.',
        body: html(
            p('Notice is hereby given that the Board of Commissioners will hold a public hearing on a proposed amendment to the County Zoning Resolution, as recommended by the Regional Planning Commission.'),
            '<h2>Hearing</h2>',
            '<ul class="dz-list-disc"><li><b>When:</b> the second Tuesday of next month at 6:00 p.m.</li><li><b>Where:</b> Commissioners’ Hearing Room, County Administration Building, 20 South Second Street</li></ul>',
            '<h2>Proposed amendment</h2>',
            p('Rezone parcels 12-004500, 12-004510 and 12-004520, about 38 acres on the north side of Route 16, from A-1 Agricultural to I-1 Light Industrial.'),
            '<h2>How to comment</h2>',
            p('Anyone may speak at the hearing. Written comments received by the Clerk of the Board by 4:30 p.m. the day before the hearing will be entered into the record. The full text and map are below and at the Clerk’s office during business hours.')),
        contact: { heading: 'Questions about this notice', name: 'Clerk of the Board', phone: '740-555-0102', email: 'clerk@example.gov' },
        documents: [
            { name: 'Proposed zoning amendment', href: '/documents/notices/route-16-amendment.pdf', size: 540000 },
            { name: 'Parcel map', href: '/documents/notices/route-16-map.pdf', size: 1200000 }
        ]
    },
    {
        id: 'leaf-collection', title: 'Fall Leaf Collection Schedule Announced',
        date: day(-9), category: 'Announcement', department: 'Public Works',
        summary: 'Curbside leaf pickup runs from late October through early December, by zone.',
        body: p('Rake leaves to the curb, not into the street. Bagged leaves go out with yard waste.')
    },
    {
        id: 'library-hours', title: 'Library Extends Weekend Hours',
        date: day(-11), category: 'News', department: 'Library',
        summary: 'All branches now stay open until 6 p.m. on Saturdays and open at noon on Sundays.',
        image: { src: '/assets/demo/news-library.svg', alt: 'Illustration of library shelves full of books' }
    },
    {
        id: 'boil-advisory-lifted', title: 'Boil Advisory Lifted for Northside Customers',
        date: day(-13), category: 'Press release', department: 'Water and Sewer',
        summary: 'Test results confirm the water is safe to drink. No further action is needed.',
        image: { src: '/assets/demo/news-water.svg', alt: 'Illustration of a water tower beside a lake' },
        contact: { name: 'Water and Sewer Office', phone: '740-555-0150' }
    },
    {
        id: 'hydrant-flushing', title: 'Public Notice: Hydrant Flushing in the Northside Service Area',
        date: day(-14), category: 'Public notice', department: 'Water and Sewer',
        summary: 'Crews will flush hydrants weeknights from 8 p.m. to 5 a.m. Water may look cloudy for a short time but is safe to drink.',
        body: html(
            p('Flushing clears sediment from water mains and confirms hydrants work. If your water looks discolored, run the cold tap for a few minutes until it clears.'),
            p('Avoid doing laundry while crews are working on your street.')),
        contact: { heading: 'Questions about this notice', name: 'Water and Sewer Office', phone: '740-555-0150' }
    },
    {
        id: 'flu-clinics', title: 'Flu Shot Clinics Open to All Residents',
        date: day(-16), category: 'News', department: 'Health Department',
        summary: 'Walk-in clinics run Tuesdays and Thursdays at the Health Department. Most insurance is accepted.'
    },
    {
        id: 'offices-closed-veterans-day', title: 'County Offices Closed for Veterans Day',
        date: day(-20), category: 'Announcement', department: 'Administration'
    },
    {
        id: 'community-safety-day', title: 'Sheriff’s Office Hosts Community Safety Day',
        date: day(-24), category: 'News', department: 'Sheriff’s Office',
        summary: 'Free car seat checks, bike helmet fittings and a touch-a-truck event for kids.',
        image: { src: '/assets/demo/news-road.svg', alt: '' }
    },
    {
        id: 'hazard-plan-comment', title: 'Public Notice: Draft Hazard Mitigation Plan Open for Comment',
        date: day(-19), category: 'Public notice', department: 'Emergency Management',
        summary: 'Review the draft plan and send comments for 30 days from this notice.',
        body: p('The plan identifies the natural hazards most likely to affect the county and the projects that would reduce their impact. Comments can be sent by email or mail, or dropped off at the Emergency Management office.'),
        documents: [{ name: 'Draft hazard mitigation plan', href: '/documents/notices/hazard-mitigation-draft.pdf', size: 6800000 }]
    },
    {
        id: 'electronics-recycling', title: 'Recycling Drop-off Adds Electronics',
        date: day(-29), category: 'News', department: 'Public Works',
        summary: 'Old computers, TVs and phones are now accepted at the Main Street drop-off, free of charge.'
    },
    {
        id: 'poll-workers', title: 'Board of Elections Seeks Poll Workers',
        date: day(-33), category: 'Announcement', department: 'Board of Elections',
        summary: 'Poll workers are paid for training and Election Day. Sign up by the end of the month.',
        image: { src: '/assets/demo/news-building.svg', alt: '' }
    },
    {
        id: 'siren-test', title: 'Emergency Management Tests Outdoor Sirens',
        date: day(-38), category: 'Press release', department: 'Emergency Management',
        summary: 'Sirens sound for three minutes at noon on the first Wednesday of each month.'
    },
    {
        id: 'registration-deadline', title: 'Voter Registration Deadline Approaches',
        date: day(-45), category: 'Announcement', department: 'Board of Elections',
        summary: 'Register or update your address online, by mail, or at the Board of Elections office.'
    },
    {
        id: 'road-vacation', title: 'Legal Notice: Petition to Vacate Part of Old Mill Road',
        date: day(-27), category: 'Legal notice', department: 'County Engineer', author: 'Clerk of the Board',
        summary: 'A petition asks the county to vacate 0.3 miles of Old Mill Road east of Township Road 9. A view and hearing are scheduled.',
        body: p('The Board will view the road at 10:00 a.m. on the first Monday of next month and hold a final hearing two weeks later at 9:30 a.m. in the Commissioners’ Hearing Room. Property owners along the road have been notified by certified mail.'),
        documents: [{ name: 'Petition and survey', href: '/documents/notices/old-mill-road.pdf', size: 910000 }]
    },
    {
        id: 'senior-center-40', title: 'Senior Center Celebrates 40 Years',
        date: day(-52), category: 'News', department: 'Senior Services',
        summary: 'An open house with music, lunch and a photo history of the center.',
        image: { src: '/assets/demo/news-park.svg', alt: '' }
    },
    // The least an article can be: a title and a date.
    { id: 'minimal', title: 'Budget Hearings Scheduled', date: day(-60) }
];
