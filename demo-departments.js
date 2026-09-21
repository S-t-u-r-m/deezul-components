/*
 * demo-departments.js — made-up county departments for the gallery's department card demos. In an
 * app the Deezul CMS supplies them. Names, 555 phone numbers and example.gov emails are fictional.
 *
 * Closures are a typical county holiday calendar, generated from 2026 through next year: the
 * live demo always has some ahead, and the demos previewed at a fixed moment in 2026 stay the same.
 */
const pad = n => String(n).padStart(2, '0');
const key = date => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());

// The nth weekday (0 = Sunday) of a month; n = -1 is the last one.
const nth = (year, month, weekday, n) => {
    if (n < 0) {
        const last = new Date(year, month + 1, 0);
        last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7));
        return last;
    }
    const first = new Date(year, month, 1);
    return new Date(year, month, 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7);
};

// A fixed-date holiday on a weekend is observed on the Friday before or the Monday after.
const observed = (year, month, day) => {
    const date = new Date(year, month, day);
    if (date.getDay() === 6) date.setDate(date.getDate() - 1);
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    return date;
};

const holidays = year => {
    const thanksgiving = nth(year, 10, 4, 4);
    const dayAfter = new Date(year, 10, thanksgiving.getDate() + 1);
    const christmasEve = new Date(year, 11, 24);
    const list = [
        { date: key(observed(year, 0, 1)), name: 'New Year’s Day' },
        { date: key(nth(year, 0, 1, 3)), name: 'Martin Luther King Jr. Day' },
        { date: key(nth(year, 1, 1, 3)), name: 'Presidents’ Day' },
        { date: key(nth(year, 4, 1, -1)), name: 'Memorial Day' },
        { date: key(observed(year, 5, 19)), name: 'Juneteenth' },
        { date: key(observed(year, 6, 4)), name: 'Independence Day' },
        { date: key(nth(year, 8, 1, 1)), name: 'Labor Day' },
        { date: key(observed(year, 10, 11)), name: 'Veterans Day' },
        { date: key(thanksgiving), endDate: key(dayAfter), name: 'Thanksgiving' },
        { date: key(observed(year, 11, 25)), name: 'Christmas Day' }
    ];
    // Offices close at noon on Christmas Eve when it falls on a working day before Christmas.
    if (christmasEve.getDay() >= 1 && christmasEve.getDay() <= 4) {
        list.push({ date: key(christmasEve), name: 'Christmas Eve', open: '08:00', close: '12:00' });
    }
    return list;
};

const years = [];
for (let year = 2026; year <= new Date().getFullYear() + 1; year++) years.push(year);
export const countyClosures = years.flatMap(holidays).sort((a, b) => (a.date < b.date ? -1 : 1));

const weekdays = [1, 2, 3, 4, 5];

export const demoDepartments = {
    health: {
        name: 'Health Department',
        href: '/departments/health',
        description: 'Clinics, vaccinations, restaurant and septic inspections, and birth and death certificates for everyone in the county.',
        head: { name: 'Dr. Olivia Dunn', title: 'Health Commissioner' },
        phone: '740-555-0140',
        fax: '740-555-0149',
        email: 'health@example.gov',
        address: { street: '410 Hospital Drive', street2: 'Suite 100', city: 'Riverton', state: 'OH', zip: '43000' },
        mailingAddress: ['PO Box 450', 'Riverton, OH 43000'],
        locationNote: 'Free parking in the front lot. The accessible entrance is on the north side.',
        hours: [
            { days: [1, 2, 3, 5], open: '08:00', close: '16:30' },
            { days: ['thu'], open: '08:00', close: '18:00' }
        ],
        hoursNote: 'Birth and death certificates are issued until 4:00 PM.',
        closures: countyClosures,
        links: [
            { label: 'Birth and death certificates', href: '/departments/health/vital-statistics' },
            { label: 'Clinic appointments', href: '/departments/health/clinic' },
            { label: 'Restaurant inspections', href: '/departments/health/inspections' },
            { label: 'Septic permits', href: '/departments/health/septic' }
        ]
    },

    recorder: {
        name: 'County Recorder',
        href: '/departments/recorder',
        head: { name: 'Thomas Reyes', title: 'County Recorder' },
        phone: '740-555-0180',
        email: 'recorder@example.gov',
        address: 'County Courthouse, Room 104' + String.fromCharCode(10) + '1 Court Square' + String.fromCharCode(10) + 'Riverton, OH 43000',
        hours: [
            { days: weekdays, open: '08:00', close: '12:00' },
            { days: weekdays, open: '13:00', close: '16:30' }
        ],
        closures: countyClosures
    },

    sheriff: {
        name: 'Sheriff’s Office',
        href: '/departments/sheriff',
        phone: '740-555-0100',
        address: { street: '200 Justice Way', city: 'Riverton', state: 'OH', zip: '43000' },
        hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: '00:00', close: '24:00' }]
    },

    shelter: {
        name: 'Animal Shelter',
        href: '/departments/animal-shelter',
        phone: '740-555-0170',
        email: 'shelter@example.gov',
        address: { street: '85 County Farm Road', city: 'Riverton', state: 'OH', zip: '43000' },
        hours: [
            { days: [2, 3, 4, 5], open: '11:00', close: '18:00' },
            { days: ['sat'], open: '10:00', close: '15:00' }
        ],
        closedMessage: 'Closed through Friday for flooring repairs. Adoptions resume Saturday at 10:00 AM.',
        closures: countyClosures
    },

    soil: {
        name: 'Soil and Water Conservation District',
        phone: '740-555-0195'
    }
};

// ---- The departments A–Z page (department_list). The five above, with a service area and search
// keywords added, plus the rest of a county's departments with the basics: what they do, how to
// reach them, and the usual weekday hours.
const office = (street, room) => ({ street: room ? street + ', ' + room : street, city: 'Riverton', state: 'OH', zip: '43000' });
const courthouse = room => office('1 Court Square', room);
const nineToFive = [{ days: weekdays, open: '08:00', close: '16:30' }];

const basic = (name, group, description, phone, email, address, extra) => ({
    name,
    href: '/departments/' + email.split('@')[0],
    description,
    phone,
    email,
    address,
    hours: nineToFive,
    closures: countyClosures,
    group,
    ...extra
});

export const demoDepartmentList = [
    { ...demoDepartments.health, group: 'Health and family',
      keywords: 'immunizations, food safety, septic, birth certificate, death certificate, WIC' },
    { ...demoDepartments.recorder, group: 'Land and property',
      description: 'Deeds, mortgages, liens, plats and military discharge records for the county.',
      keywords: 'deed, title, mortgage, lien, plat, DD214' },
    { ...demoDepartments.sheriff, group: 'Public safety',
      description: 'Patrol, the county jail, civil process, concealed carry permits and sex offender registration.',
      keywords: 'jail, inmate, concealed carry, CCW, police report, 911' },
    { ...demoDepartments.shelter, group: 'Health and family',
      description: 'Adoptions, lost and found pets, dog licences and animal complaints.',
      keywords: 'dog, cat, adoption, kennel, stray, licence, license' },
    { ...demoDepartments.soil, group: 'Land and property',
      description: 'Drainage, erosion and pond advice, stream projects, and the annual tree and fish sale.',
      email: 'soil@example.gov',
      address: office('85 County Farm Road'),
      hours: nineToFive,
      keywords: 'drainage, ditch, erosion, pond, conservation, tree sale' },

    basic('Board of Elections', 'Records and elections',
        'Voter registration, absentee and early voting, polling places and poll worker jobs.',
        '740-555-0120', 'elections@example.gov', office('310 Main Street', 'Lower level'),
        { keywords: 'vote, voting, ballot, absentee, precinct, poll worker',
          hours: [{ days: weekdays, open: '08:00', close: '16:30' }],
          hoursNote: 'Open longer in the four weeks before an election.' }),

    basic('Building and Zoning', 'Land and property',
        'Building permits, inspections, zoning approvals and flood plain questions.',
        '740-555-0150', 'building@example.gov', office('310 Main Street', 'Room 210'),
        { keywords: 'permit, inspection, setback, variance, flood plain, contractor' }),

    basic('Clerk of Courts', 'Records and elections',
        'Court records, case filings, passports and vehicle titles.',
        '740-555-0110', 'clerk@example.gov', courthouse('Room 201'),
        { keywords: 'court records, case, filing, passport, title, notary' }),

    basic('County Auditor', 'Finance',
        'Property values and tax rates, the county payroll, dog licences and weights and measures.',
        '740-555-0130', 'auditor@example.gov', courthouse('Room 102'),
        { keywords: 'property value, appraisal, tax rate, homestead, CAUV, dog licence, scales' }),

    basic('County Commissioners', 'Finance',
        'The county budget, contracts, appointments and the board’s meetings and minutes.',
        '740-555-0105', 'commissioners@example.gov', courthouse('Room 300'),
        { head: { name: 'Marcus Webb', title: 'Board President' },
          keywords: 'board, budget, meeting, agenda, minutes, resolution, contract' }),

    basic('County Engineer', 'Roads and utilities',
        'County roads and bridges, culverts, right of way permits and snow routes.',
        '740-555-0160', 'engineer@example.gov', office('1200 Garage Road'),
        { keywords: 'road, bridge, culvert, pothole, snow, right of way, driveway permit',
          hours: [{ days: weekdays, open: '07:00', close: '15:30' }] }),

    basic('County Treasurer', 'Finance',
        'Property tax bills and payments, payment plans and delinquent taxes.',
        '740-555-0135', 'treasurer@example.gov', courthouse('Room 103'),
        { keywords: 'tax bill, pay taxes, escrow, delinquent, payment plan, manufactured home' }),

    basic('Emergency Management Agency', 'Public safety',
        'Storm and flood preparedness, the county hazard plan, warning sirens and damage reports.',
        '740-555-0190', 'ema@example.gov', office('200 Justice Way', 'Building B'),
        { keywords: 'storm, flood, tornado, siren, shelter, preparedness, hazard plan' }),

    basic('Job and Family Services', 'Health and family',
        'Food and cash assistance, Medicaid, child support and child protective services.',
        '740-555-0145', 'jfs@example.gov', office('520 Commerce Parkway'),
        { keywords: 'food stamps, SNAP, medicaid, child support, foster, cash assistance, day care' }),

    basic('Parks and Recreation', 'Parks and recreation',
        'County parks and trails, shelter reservations, boat ramps and summer programs.',
        '740-555-0175', 'parks@example.gov', office('60 Riverside Drive'),
        { keywords: 'park, trail, shelter, pavilion, campground, boat ramp, pool, camp',
          hours: [{ days: weekdays, open: '08:00', close: '16:30' }],
          hoursNote: 'Parks are open dawn to dusk every day.' }),

    basic('Prosecuting Attorney', 'Public safety',
        'Criminal prosecution, victim services and legal advice to county offices.',
        '740-555-0115', 'prosecutor@example.gov', courthouse('Room 250'),
        { keywords: 'prosecutor, criminal, victim, restitution, grand jury' }),

    basic('Veterans Service Commission', 'Health and family',
        'Help with VA claims, emergency financial assistance and rides to VA appointments.',
        '740-555-0185', 'veterans@example.gov', office('310 Main Street', 'Room 118'),
        { keywords: 'veteran, VA, claim, DD214, burial, transportation' }),

    basic('Water and Sewer', 'Roads and utilities',
        'Water and sewer service, billing, meter reading, hydrant flushing and new connections.',
        '740-555-0165', 'water@example.gov', office('1200 Garage Road', 'Building C'),
        { keywords: 'water bill, sewer, tap, meter, leak, hydrant, boil advisory' })
];
