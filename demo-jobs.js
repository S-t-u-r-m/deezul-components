/*
 * demo-jobs.js — made-up job openings for the gallery's job demos. In an app these come from
 * the Deezul CMS. Dates sit relative to today so the "new", "closing soon" and "closed" states
 * always show. Names, emails and phone numbers are fictional.
 */
const pad = n => String(n).padStart(2, '0');
const day = offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

const hr = { name: 'Human Resources', email: 'careers@example.gov', phone: '740-555-0148', fax: '740-555-0138' };

export const demoJobs = [
    {
        id: 'dispatcher', title: '911 Dispatcher', division: 'Emergency Management', jobType: 'Full Time', payType: 'Hourly',
        pay: '$22.00 – $26.50 an hour', posted: day(-2), closes: '', location: '783 Irvingwick Drive SW, Heath, OH 43056',
        summary: 'Answers emergency and non-emergency calls and dispatches police, fire and EMS units across the county.',
        contact: hr,
        sections: [
            { title: 'Position description', items: [
                'Receives 911 and non-emergency calls, gathers information and determines the right response.',
                'Dispatches and coordinates police, fire and emergency medical units by radio.',
                'Monitors radio traffic and keeps track of unit status during incidents.',
                'Enters call details accurately into the computer-aided dispatch system.',
                'Completes required training and keeps certifications current.'
            ] },
            { title: 'Job prerequisites', subsections: [
                { title: 'Minimum qualifications', items: [
                    'High school diploma or GED.',
                    'One to three months of related experience or training.'
                ] },
                { title: 'Additional qualifications', items: [
                    'Clear, calm communication under pressure.',
                    'Comfortable working with several computer systems at once.',
                    'Types at least 45 words per minute.'
                ] }
            ] },
            { title: 'Compensation', text: '$22.00 – $26.50 an hour based on experience, rising to $29.10 an hour after 48 months under the current contract.',
              items: ['11 paid holidays', 'Medical, dental and vision insurance', 'Shift differential', 'State retirement system membership'] },
            { title: 'Application procedure',
              text: 'Apply online or bring a completed application to the Human Resources office, Monday to Friday, 8am to 4:30pm.' },
            { title: 'About the division',
              text: 'Emergency Management keeps the county ready for, and able to respond to, emergencies of every size.' }
        ]
    },
    {
        id: 'admin-specialist', title: 'Administrative Specialist', division: 'Board of Commissioners', jobType: 'Full Time',
        payType: 'Salary', pay: '$41,000 – $48,500 a year', posted: day(-9), closes: day(12), location: '20 S. Second Street, Newark, OH',
        summary: 'Supports the commissioners’ office with scheduling, records, public inquiries and meeting preparation.',
        contact: hr,
        sections: [
            { title: 'Position description', items: ['Schedules meetings and prepares agendas.', 'Maintains public records.', 'Answers questions from residents.'] },
            { title: 'Job prerequisites', text: 'Associate degree or two years of office experience.' }
        ]
    },
    {
        id: 'assessment-officer', title: 'Assessment Officer', division: 'Auditor', jobType: 'Full Time', payType: 'Hourly',
        pay: '$24.10 an hour', posted: day(-20), closes: day(4), location: '20 S. Second Street, Newark, OH',
        summary: 'Reviews property values and helps residents understand their assessments.',
        contact: { name: 'Auditor’s Office', email: 'auditor@example.gov', phone: '740-555-0120' }
    },
    {
        id: 'attorney', title: 'Assistant Prosecuting Attorney', division: 'Prosecutor', jobType: 'Full Time', payType: 'Salary',
        pay: 'From $72,000 a year', posted: day(-30), closes: '', location: '20 S. Second Street, Newark, OH',
        summary: 'Prosecutes criminal cases in municipal and common pleas courts.',
        contact: hr
    },
    {
        id: 'case-manager', title: 'Case Manager', division: 'Job and Family Services', jobType: 'Full Time', payType: 'Hourly',
        pay: '$21.75 – $25.00 an hour', posted: day(-1), closes: day(20), location: '74 S. Second Street, Newark, OH',
        summary: 'Works with families to connect them with benefits, services and support programs.',
        contact: hr
    },
    {
        id: 'park-aide', title: 'Seasonal Park Aide', division: 'Parks', jobType: 'Part Time', payType: 'Hourly',
        pay: '$15.00 an hour', posted: day(-5), closes: day(30), location: 'Various county parks',
        summary: 'Helps keep trails, shelters and grounds clean and welcoming during the busy season.',
        contact: hr
    },
    {
        id: 'highway-worker', title: 'Highway Maintenance Worker', division: 'Engineer', jobType: 'Full Time', payType: 'Hourly',
        pay: '$23.40 an hour', posted: day(-40), closes: day(-2), location: '1600 W. Main Street, Newark, OH',
        summary: 'Maintains county roads and bridges, including snow and ice removal.',
        contact: hr
    },
    {
        id: 'deputy-clerk', title: 'Deputy Clerk', division: 'Clerk of Courts', jobType: 'Part Time', payType: 'Hourly',
        pay: '$17.25 an hour', posted: day(-12), closes: '', location: '1 N. Park Place, Newark, OH',
        summary: 'Files court documents, processes payments and helps the public at the service counter.',
        contact: hr
    }
];
