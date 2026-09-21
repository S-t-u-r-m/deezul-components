/*
 * demo-documents.js — made-up county documents for the gallery's document list demos. In an app
 * these come from the Deezul CMS, which stores the files and serves them by id; the links here
 * go nowhere. Most give the type as the CMS would (a type, a MIME type or the uploaded file's
 * name) and rely on the list's documentHref; a few carry their own href.
 */
const pad = n => String(n).padStart(2, '0');
const day = offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

export const demoDocuments = [
    { id: '101', name: 'Building Permit Application', category: 'Permits', type: 'PDF', size: 412000, updated: day(-12),
      description: 'Required for new construction, additions and structural alterations.' },
    { id: '102', name: 'Electrical Permit Application', category: 'Permits', type: 'application/pdf', size: 268000, updated: day(-40) },
    { id: '103', name: 'Fence and Driveway Permit', category: 'Permits', fileName: 'fence-driveway-permit.docx', size: 58000, updated: day(-95) },
    { id: '104', name: 'Sign Permit Checklist', category: 'Permits', type: 'PDF', size: 131000, updated: day(-200) },
    { id: '105', name: 'Zoning Variance Request', category: 'Permits', type: 'PDF', size: 305000, updated: day(-3),
      description: 'For setbacks, lot coverage or use exceptions. Submit with the site plan and fee.' },
    { id: '201', name: '2026 Adopted Budget', category: 'Budget and finance', type: 'PDF', size: 8400000, updated: day(-150),
      description: 'The full operating and capital budget as adopted by the Board of Commissioners.' },
    { id: '202', name: '2026 Budget Summary', category: 'Budget and finance', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 94000, updated: day(-148) },
    { id: '203', name: 'Annual Financial Report 2025', category: 'Budget and finance', type: 'PDF', size: 5100000, updated: day(-60) },
    { id: '204', name: 'Vendor Payments, Q2', category: 'Budget and finance', fileName: 'vendor-payments-q2.csv', size: 212000, updated: day(-20) },
    { id: '205', name: 'Capital Improvement Plan 2026–2030', category: 'Budget and finance', type: 'PPTX', size: 3600000, updated: day(-110) },
    { id: '301', name: 'Board of Commissioners Minutes, August', category: 'Minutes', type: 'PDF', size: 186000, updated: day(-9) },
    { id: '302', name: 'Board of Commissioners Minutes, July', category: 'Minutes', type: 'PDF', size: 201000, updated: day(-41) },
    { id: '303', name: 'Planning Commission Minutes, August', category: 'Minutes', type: 'DOCX', size: 47000, updated: day(-15) },
    { id: '304', name: 'Parks Advisory Board Minutes, Summer', category: 'Minutes', type: 'text/plain', size: 9000, updated: day(-30) },
    { id: '401', name: 'County Road Map', category: 'Maps', type: 'PDF', size: 12600000, updated: day(-300),
      description: 'Every county, township and state route with mile markers.' },
    { id: '402', name: 'Zoning Map', category: 'Maps', type: 'image/png', size: 2900000, updated: day(-75) },
    { id: '403', name: 'Floodplain Map Data', category: 'Maps', fileName: 'floodplain-2026.zip', size: 48000000, updated: day(-180) },
    { id: '501', name: 'Dog License Application', category: 'Forms', type: 'PDF', size: 96000, updated: day(-5) },
    { id: '502', name: 'Public Records Request', category: 'Forms', type: 'PDF', size: 88000, updated: day(-250),
      description: 'Ask for copies of county records. Requests can also be emailed to the records office.' },
    { id: '503', name: 'Employment Application', category: 'Forms', type: 'DOCX', size: 72000, updated: day(-33) },
    { id: '504', name: 'Facility Rental Agreement', category: 'Forms', type: 'PDF', size: 154000, updated: day(-66) },
    { id: '505', name: 'W-9 Request for Taxpayer Identification', category: 'Forms', href: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf', type: 'PDF', size: 140000 },
    { id: '601', name: 'Storm Water Management Ordinance', category: 'Ordinances', type: 'PDF', size: 640000, updated: day(-400) },
    { id: '602', name: 'Noise Ordinance', category: 'Ordinances', type: 'PDF', size: 120000, updated: day(-520) },
    { id: '603', name: 'Public Hearing Recording, Zoning Amendments', category: 'Ordinances', type: 'MP3', size: 34000000, updated: day(-26) },
    { id: '701', name: 'Emergency Preparedness Guide', type: 'PDF', size: '1.8 MB', updated: day(-14),
      description: 'Build a kit, make a plan and sign up for alerts.' },
    // Left out of the list: no name, and no id or href to link with.
    { id: '801', type: 'PDF' },
    { name: 'Draft Agenda (no link yet)', type: 'PDF' }
];

// ---- An archive: the Board's agendas and minutes for the last four years, one meeting a month
// on the second Tuesday, for the year filter and a date that reads "Meeting <date>".
const secondTuesday = (year, month) => {
    const first = new Date(year, month, 1);
    const day = 1 + ((2 - first.getDay() + 7) % 7) + 7;
    return year + '-' + pad(month + 1) + '-' + pad(day);
};

const thisYear = new Date().getFullYear();
const thisMonth = new Date().getMonth();
export const demoMinutes = [];
for (let year = thisYear; year > thisYear - 4; year--) {
    for (let month = 11; month >= 0; month--) {
        if (year === thisYear && month > thisMonth) continue;
        const date = secondTuesday(year, month);
        const month_ = new Date(year, month, 1).toLocaleString('en-US', { month: 'long' });
        demoMinutes.push(
            { id: 'min-' + date, name: 'Minutes, ' + month_ + ' ' + year, category: 'Minutes', type: 'PDF',
              size: 150000 + month * 4000, updated: date },
            { id: 'agn-' + date, name: 'Agenda, ' + month_ + ' ' + year, category: 'Agendas', type: 'PDF',
              size: 60000 + month * 1500, updated: date });
    }
}
