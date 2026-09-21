/*
 * demo-bids.js — made-up bids, RFQs and RFPs for the gallery's bid demos. In an app these come
 * from the Deezul CMS, which also stores the documents; the document links here go nowhere.
 * Dates sit relative to today so the due-soon, past-due and closed states always show. Names,
 * emails and phone numbers are fictional.
 */
const pad = n => String(n).padStart(2, '0');
const day = (offset, time) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + (time ? 'T' + time : '');
};
const NL = String.fromCharCode(10);

const purchasing = { name: 'Purchasing Office', phone: '740-555-0170', email: 'purchasing@example.gov' };
const docs = slug => '/documents/bids/' + slug + '/';

export const demoBids = [
    {
        id: 'road-resurfacing', title: '2027 Road Resurfacing Program', type: 'Bid', status: 'Open',
        posted: day(-3), due: day(16, '14:00'), closes: day(16),
        description: ['Sealed bids for resurfacing about 14 miles of county roads, including milling, paving, striping and berm work.',
                      '', 'Bids are opened publicly at the due time in the Commissioners’ hearing room.'].join(NL),
        location: 'County Engineer’s Office, 1600 W. Main Street, Newark, OH',
        contact: purchasing,
        meetings: [
            { title: 'Site walk-through', start: day(8, '09:00'), location: 'Meet at the Maintenance Garage, 1600 W. Main Street' },
            { title: 'Pre-bid meeting', start: day(6, '10:00'), end: '11:00', location: 'Engineer’s Office, Conference Room B' }
        ],
        documents: [
            { name: 'Invitation to Bid', href: docs('road-resurfacing') + 'invitation.pdf', size: 184000 },
            { name: 'Specifications', href: docs('road-resurfacing') + 'specifications.pdf', size: 2400000 },
            { name: 'Bid Form', href: docs('road-resurfacing') + 'bid-form.docx', size: 54000 },
            { name: 'Addendum 1', href: docs('road-resurfacing') + 'addendum-1.pdf', size: 41000 }
        ]
    },
    {
        id: 'it-consulting', title: 'IT Consulting Services', type: 'RFP', status: 'Open',
        posted: day(-10), due: day(4, '16:00'), closes: day(4),
        description: 'Proposals for network assessment and cybersecurity consulting over a three-year term.',
        contact: { name: 'Information Technology', email: 'it-rfp@example.gov' },
        meetings: [{ title: 'Proposer conference', start: day(1, '13:00'), end: '14:30', location: 'Online (link in the RFP)' }],
        documents: [
            { name: 'Request for Proposals', href: docs('it-consulting') + 'rfp.pdf', size: 912000 },
            { name: 'Pricing Sheet', href: docs('it-consulting') + 'pricing.xlsx', size: 23000 }
        ]
    },
    {
        id: 'office-supplies', title: 'Office Supplies', type: 'RFQ', status: 'Open',
        posted: day(-1), due: day(9), closes: day(9),
        description: 'Quotes for general office supplies for all county offices through the end of next year.',
        contact: { email: 'purchasing@example.gov' },
        documents: [{ name: 'Request for Quotes', href: docs('office-supplies') + 'rfq.pdf', size: 150000 }]
    },
    {
        id: 'salt-supply', title: 'Road Salt Supply', type: 'RFQ',
        posted: day(-2), due: day(12, '12:00')
    },
    {
        id: 'janitorial', title: 'Janitorial Services', type: 'RFP', status: 'Awarded',
        posted: day(-60), due: day(-30, '14:00'), closes: day(20),
        description: 'Cleaning services for the county administration building and courthouse.',
        contact: purchasing,
        documents: [
            { name: 'Request for Proposals', href: docs('janitorial') + 'rfp.pdf', size: 640000 },
            { name: 'Notice of Award', href: docs('janitorial') + 'award.pdf', size: 96000 }
        ]
    },
    {
        id: 'fleet-vehicles', title: 'Fleet Vehicle Purchase', type: 'Bid', status: 'Closed',
        posted: day(-45), due: day(-15, '14:00'), closes: day(-1),
        description: 'Six half-ton pickup trucks for the Engineer’s Office.',
        contact: purchasing,
        documents: [{ name: 'Invitation to Bid', href: docs('fleet-vehicles') + 'invitation.pdf', size: 120000 }]
    }
];
