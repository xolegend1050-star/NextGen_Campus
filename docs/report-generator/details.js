/**
 * The report's identifying details and its section plan.
 *
 * Kept in one place so the cover, certificate, progress report and footer cannot
 * disagree with each other, which is how a name ended up spelled one way on the
 * cover and another in the acknowledgement.
 */
const D = {
  title: 'NextGen Campus',
  subtitle: 'A Unified Campus Platform for Gigs, Mentorship, Doubt Resolution and Payments',
  student: 'Sujal Borhade',
  rollNo: '26085',
  guide: 'Ms. Harshita Pandey',
  principal: 'Dr. (Mrs.) C.T. Chakraborty',
  hod: 'Mr. Ashish Trivedi',
  college: 'Thakur College of Science & Commerce',
  collegeAddr: 'Thakur Village, Kandivali (East), Mumbai - 400 101',
  university: 'University of Mumbai',
  degree: 'Bachelor of Science (Computer Science)',
  semester: 'Semester V',
  academicYear: '2026 - 2027',
  department: 'Department of Computer Science'
};

// Chapters, in order. Numbers must match the h2 section numbers in the content
// modules, because the index resolves sub-sections by that string.
const CHAPTERS = [
  { num: '1', title: 'Introduction', sections: ['1.1', '1.2', '1.3', '1.4', '1.5'] },
  { num: '2', title: 'Literature Survey', sections: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'] },
  { num: '3', title: 'System Analysis', sections: ['3.1', '3.2', '3.3', '3.4', '3.5'] },
  { num: '4', title: 'System Design', sections: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6'] },
  { num: '5', title: 'Technology and Methodology', sections: ['5.1', '5.2', '5.3'] },
  { num: '6', title: 'Implementation', sections: ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8', '6.9', '6.10', '6.11', '6.12'] },
  { num: '7', title: 'Testing', sections: ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8'] },
  { num: '8', title: 'Results', sections: ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6'] },
  { num: '9', title: 'Conclusion and Future Scope', sections: ['9.1', '9.2', '9.3', '9.4'] },
  { num: '10', title: 'References', sections: [] }
];

const APPENDICES = [
  { key: 'A', title: 'Project Structure' },
  { key: 'B', title: 'Module Map' },
  { key: 'C', title: 'Role and Permission Matrix' },
  { key: 'D', title: 'Test Results Summary' },
  { key: 'E', title: 'REST API Reference' },
  { key: 'F', title: 'Database Data Dictionary' },
  { key: 'G', title: 'Index and Trigger Catalogue' },
  { key: 'H', title: 'Key Source Code Extracts' },
  { key: 'I', title: 'Deployment Topology' },
  { key: 'J', title: 'Verification Commands' },
  { key: 'K', title: 'Defect Log' },
  { key: 'L', title: 'Glossary' },
  { key: 'M', title: 'Traceability Matrix' },
  { key: 'N', title: 'Database Migrations' }
];

// Section titles for the index labels. The index resolves each sub-section by
// number, so a missing entry here leaves a numbered section off the contents
// page even though it is present in the body.
const SECTION_TITLES = {
  '1.1': 'Project Overview', '1.2': 'Problem Statement', '1.3': 'Proposed Solution',
  '1.4': 'Objectives', '1.5': 'Scope and Limitations',

  '2.1': 'Existing Campus Platforms', '2.2': 'Doubt and Answer Systems',
  '2.3': 'Escrow and Trust-Based Payment', '2.4': 'Authentication and Token Management',
  '2.5': 'Real-Time Communication', '2.6': 'Role-Based Access Control',
  '2.7': 'Gap Identified', '2.8': 'Design Decisions Informed by the Survey',

  '3.1': 'Requirement Gathering', '3.2': 'Functional Requirements',
  '3.3': 'Non-Functional Requirements', '3.4': 'System Constraints',
  '3.5': 'Architecture Overview',

  '4.1': 'Architectural Design', '4.2': 'Parameter Validation Design',
  '4.3': 'Database Design', '4.4': 'State Machines', '4.5': 'Security Design',
  '4.6': 'Interface Design',

  '5.1': 'Technology Stack', '5.2': 'Development Methodology',
  '5.3': 'Alternative Technologies Considered',

  '6.1': 'Development Environment', '6.2': 'Authentication Module',
  '6.3': 'Doubts and Answers Module', '6.4': 'Mentorship Module',
  '6.5': 'Gigs and Applications Module', '6.6': 'Payments and Escrow Module',
  '6.7': 'Messaging Module', '6.8': 'Notifications Module',
  '6.9': 'AI Service', '6.10': 'Admin and Moderation Module',
  '6.11': 'Resources and Interview Preparation', '6.12': 'Background Scheduling',

  '7.1': 'Testing Strategy', '7.2': 'Static Analysis and Unit Tests',
  '7.3': 'Endpoint Sweep', '7.4': 'Defects Found and Resolved',
  '7.5': 'Verification Against the Deployed System',
  '7.6': 'Defects Found by Interface Verification',
  '7.7': 'Payment Lifecycle Verification', '7.8': 'User Acceptance',

  '8.1': 'Measured Results', '8.2': 'Interface',
  '8.3': 'Results Against the Project Objectives',
  '8.4': 'Results Against the Non-Functional Requirements',
  '8.5': 'Defect Resolution', '8.6': 'Discussion of Results',

  '9.1': 'Conclusion', '9.2': 'Summary of Achievements',
  '9.3': 'Limitations Encountered', '9.4': 'Future Enhancements',

  A: 'Project Structure', B: 'Module Map', C: 'Role and Permission Matrix',
  D: 'Test Results Summary', E: 'REST API Reference', F: 'Database Data Dictionary',
  G: 'Index and Trigger Catalogue', H: 'Key Source Code Extracts',
  I: 'Deployment Topology', J: 'Verification Commands', K: 'Defect Log',
  L: 'Glossary', M: 'Traceability Matrix', N: 'Database Migrations'
};

module.exports = { D, CHAPTERS, APPENDICES, SECTION_TITLES };