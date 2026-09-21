/*
 * demo-staff.js — a made-up county staff directory for the gallery's directory demos. In an app
 * the Deezul CMS supplies the people and their photos. Every name, email and phone number is
 * fictional (555 numbers, example.gov). A few have photos (simple illustrations in assets/demo);
 * the rest show initials. Most departments have divisions (sub-departments), so the directory
 * breaks them out; a department head usually has none and is listed first.
 */
const person = (name, title, department, phone, ext, extra) => ({
    id: name.toLowerCase().split(' ').join('-').split('.').join('').split(',').join(''),
    name, title, department, phone, ext,
    email: name.toLowerCase().split(' ').map(word => word.split('').filter(ch => ch >= 'a' && ch <= 'z').join(''))
        .filter(word => word && word !== 'jr').join('.') + '@example.gov',
    ...extra
});

// Biographies are HTML as rich_text_editor writes it.
const bio = (...paragraphs) => paragraphs.map(text => '<p>' + text + '</p>').join('');

export const demoStaff = [
    person('Maria Alvarez', 'County Administrator', 'Administration', '740-555-0100', '', { location: 'Courthouse, Room 201', photo: { src: '/assets/demo/staff-3.svg' },
        bio: bio('Maria Alvarez has served as County Administrator since 2021. She oversees daily operations, the annual budget and the county’s 600 employees.',
            'Before joining the county she was finance director for the City of Newark for eleven years. She holds a master’s degree in public administration from Ohio State.') }),
    person('James Whitaker', 'Deputy Administrator', 'Administration', '740-555-0100', '102', { location: 'Courthouse, Room 203' }),
    person('Priya Natarajan', 'Budget Analyst', 'Administration', '740-555-0100', '115', { division: 'Budget Office' }),
    person('Thomas O’Neill', 'Clerk of the Board', 'Board of Commissioners', '740-555-0110', '', { location: 'Courthouse, Room 101' }),
    person('Angela Brooks', 'Commissioner', 'Board of Commissioners', '740-555-0110', '1', {
        bio: bio('Commissioner Angela Brooks was elected in 2020 and re-elected in 2024. She chairs the board in 2026.',
            'A lifelong resident, she owned a small business in Granville for twenty years and served two terms on the village council.')
            + '<h2>Committees</h2><ul class="dz-list-disc"><li>Regional Planning Commission</li><li>Solid Waste District board</li></ul>' }),
    person('Robert Chen', 'Commissioner', 'Board of Commissioners', '740-555-0110', '2', { photo: { src: '/assets/demo/staff-1.svg' },
        bio: bio('Commissioner Robert Chen took office in January 2023. He previously served as the county’s emergency management director.',
            'He is a U.S. Air Force veteran and a graduate of Denison University.') }),
    person('Denise Harper', 'Commissioner', 'Board of Commissioners', '740-555-0110', '3', {
        bio: bio('Commissioner Denise Harper was elected in 2024 after sixteen years as a public school teacher and principal.') }),
    person('Samuel Greene', 'County Engineer', 'County Engineer', '740-555-0130', '', { location: 'Engineering Building' }),
    person('Kevin Lindqvist', 'Chief Deputy Engineer', 'County Engineer', '740-555-0130', '210', {}),
    person('Laura Moreno', 'Traffic Engineer', 'County Engineer', '740-555-0130', '225', { division: 'Traffic Safety' }),
    person('Marcus Bell', 'Road Superintendent', 'County Engineer', '740-555-0135', '', { division: 'Highway Maintenance', location: 'County Garage' }),
    person('Hannah Fischer', 'Bridge Inspector', 'County Engineer', '740-555-0130', '231', { division: 'Bridges' }),
    person('Jorge Silva', 'Equipment Operator', 'County Engineer', '740-555-0135', '', { division: 'Highway Maintenance', location: 'County Garage' }),
    person('Olivia Dunn', 'Health Commissioner', 'Health Department', '740-555-0140', '', { photo: { src: '/assets/demo/staff-2.svg' } }),
    person('Nathan Pierce', 'Director of Nursing', 'Health Department', '740-555-0140', '310', { division: 'Clinical Services' }),
    person('Grace Kim', 'Epidemiologist', 'Health Department', '740-555-0140', '322', { division: 'Clinical Services' }),
    person('Amy Castillo', 'Public Health Nurse', 'Health Department', '740-555-0140', '314', { division: 'Clinical Services' }),
    person('Derek Olsen', 'Sanitarian', 'Health Department', '740-555-0145', '', { division: 'Environmental Health' }),
    person('Victor Ramirez', 'Environmental Health Director', 'Health Department', '740-555-0145', '', { division: 'Environmental Health' }),
    person('Ellen Vasquez', 'Registrar', 'Health Department', '740-555-0140', '305', { division: 'Vital Statistics', location: 'Health Building, Window 2' }),
    person('Charles Ingram', 'Library Director', 'Library', '740-555-0160', '', { location: 'Main Library' }),
    person('Rebecca Fowler', 'Youth Services Librarian', 'Library', '740-555-0160', '412', {}),
    person('Daniel Jackson', 'Branch Manager', 'Library', '740-555-0165', '', { location: 'Eastside Branch' }),
    person('Sophie Laurent', 'Parks Director', 'Parks and Recreation', '740-555-0170', '', {}),
    person('Brian Novak', 'Park Ranger', 'Parks and Recreation', '740-555-0170', '520', { division: 'Riverside Park' }),
    person('Tiffany Evans', 'Recreation Coordinator', 'Parks and Recreation', '740-555-0170', '531', {}),
    person('Michael Kowalski', 'Public Works Director', 'Public Works', '740-555-0180', '', { location: 'Service Center' }),
    person('Aisha Mohammed', 'Recycling Coordinator', 'Public Works', '740-555-0180', '612', { division: 'Solid Waste' }),
    person('Walter Hughes', 'Fleet Manager', 'Public Works', '740-555-0185', '', { division: 'Fleet' }),
    person('Patricia Sullivan', 'Sheriff', 'Sheriff’s Office', '740-555-0190', '', { location: 'Justice Center' }),
    person('Eric Thornton', 'Chief Deputy', 'Sheriff’s Office', '740-555-0190', '702', {}),
    person('Carmen Ortiz', 'Records Supervisor', 'Sheriff’s Office', '740-555-0190', '715', { division: 'Records' }),
    person('Frank Adams Jr.', 'Director', 'Board of Elections', '740-555-0120', '', { location: 'Elections Office' }),
    person('Lisa Webb', 'Deputy Director', 'Board of Elections', '740-555-0120', '', {}),
    person('Mei Li', 'Voter Services Clerk', 'Board of Elections', '740-555-0120', '804', {}),
    person('Oscar Petrov', 'IT Director', 'Information Technology', '740-555-0115', '', {}),
    person('Julia Grant', 'Systems Administrator', 'Information Technology', '740-555-0115', '910', {}),
    person('Henry Carter', 'GIS Coordinator', 'Information Technology', '740-555-0115', '922', { division: 'GIS' }),
    // The least a person can be: a name (no title, department or contact details).
    { id: 'volunteer', name: 'Ruth Mendez' }
];
