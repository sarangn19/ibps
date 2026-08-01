#!/usr/bin/env node
/**
 * Deterministic Computer Knowledge question generator.
 * Every answer is hard-curated fact or computed (number systems / unit math).
 * Emits computer_upload.csv / .xlsx / summary.json for the admin uploader.
 *
 * Usage: node tools/generate_computer.js [--count 500] [--seed 20260803]
 */
const { mulberry32, rand, pick, shuffle, buildQ, allValues, verify, emit, argValue, normText, loadExistingTexts } = require('./_genlib');

const MAINS = 'mains';

// ---------------------------------------------------------------------------
// Fact banks
// ---------------------------------------------------------------------------
const FULL_FORMS = [
  ['RAM', 'Random Access Memory'], ['ROM', 'Read Only Memory'], ['CPU', 'Central Processing Unit'],
  ['GPU', 'Graphics Processing Unit'], ['HTTP', 'HyperText Transfer Protocol'], ['HTTPS', 'HyperText Transfer Protocol Secure'],
  ['FTP', 'File Transfer Protocol'], ['SMTP', 'Simple Mail Transfer Protocol'], ['POP', 'Post Office Protocol'],
  ['IMAP', 'Internet Message Access Protocol'], ['TCP', 'Transmission Control Protocol'], ['IP', 'Internet Protocol'],
  ['DNS', 'Domain Name System'], ['URL', 'Uniform Resource Locator'], ['USB', 'Universal Serial Bus'],
  ['LAN', 'Local Area Network'], ['WAN', 'Wide Area Network'], ['WWW', 'World Wide Web'],
  ['PDF', 'Portable Document Format'], ['HTML', 'HyperText Markup Language'], ['SQL', 'Structured Query Language'],
  ['AI', 'Artificial Intelligence'], ['BIOS', 'Basic Input Output System'], ['GUI', 'Graphical User Interface'],
  ['OS', 'Operating System'], ['SSD', 'Solid State Drive'], ['HDD', 'Hard Disk Drive'],
  ['VPN', 'Virtual Private Network'], ['VDU', 'Visual Display Unit'], ['UPS', 'Uninterruptible Power Supply'],
  ['NIC', 'Network Interface Card'], ['ALU', 'Arithmetic Logic Unit'], ['ISP', 'Internet Service Provider'],
  ['URL', 'Uniform Resource Locator'], ['LAN', 'Local Area Network']
];

const INPUT_DEVICES = ['Keyboard', 'Mouse', 'Scanner', 'Microphone', 'Webcam', 'Joystick', 'Trackball', 'Touchpad', 'Light pen', 'Barcode reader', 'OMR reader', 'MICR reader', 'Digitizer tablet'];
const OUTPUT_DEVICES = ['Monitor', 'Printer', 'Projector', 'Speaker', 'Plotter', 'Headphones'];
const STORAGE_DEVICES = ['Hard Disk Drive', 'Solid State Drive', 'USB flash drive', 'Memory card', 'DVD', 'Blu-ray disc', 'Magnetic tape'];

const HARDWARE = [
  ['CPU', 'the '] // placeholder, removed below
];
const COMPONENT_FUNCTION = [
  ['CPU', 'known as the "brain" of the computer and performs all processing'],
  ['RAM', 'stores data and programs temporarily while the computer is running'],
  ['ROM', 'stores permanent instructions needed to start the computer (firmware)'],
  ['Hard Disk', 'provides permanent storage of data and programs'],
  ['Motherboard', 'main circuit board that connects all components of the computer'],
  ['ALU', 'performs arithmetic and logical operations inside the CPU'],
  ['Control Unit', 'directs and coordinates the operation of the computer'],
  ['Cache memory', 'small, very fast memory that holds frequently used data'],
  ['Video Card', 'renders images and graphics to the display'],
];

const UNIT_FACTS = [
  ['1 byte', '8 bits'], ['1 nibble', '4 bits'], ['1 KB (Kilobyte)', '1024 bytes'], ['1 MB (Megabyte)', '1024 KB'],
  ['1 GB (Gigabyte)', '1024 MB'], ['1 TB (Terabyte)', '1024 GB'], ['1 PB (Petabyte)', '1024 TB'],
];
const UNITS = ['Bit', 'Byte', 'KB', 'MB', 'GB', 'TB', 'PB'];

const SHORTCUTS = [
  ['Ctrl + C', 'copy'], ['Ctrl + V', 'paste'], ['Ctrl + X', 'cut'], ['Ctrl + Z', 'undo'],
  ['Ctrl + Y', 'redo'], ['Ctrl + S', 'save'], ['Ctrl + P', 'print'], ['Ctrl + B', 'bold'],
  ['Ctrl + I', 'italic'], ['Ctrl + U', 'underline'], ['Ctrl + F', 'find'], ['Ctrl + A', 'select all'],
  ['Ctrl + N', 'new document'], ['Ctrl + O', 'open file'], ['F7', 'spell check'], ['Ctrl + Z', 'undo last action'],
];

const OFFICE_APPS = [
  ['MS Word', 'word processing documents'], ['MS Excel', 'spreadsheets and calculations'],
  ['MS PowerPoint', 'presentations and slideshows'], ['MS Access', 'databases'],
  ['MS Outlook', 'email and calendar management'], ['MS OneNote', 'note taking'],
];

const PROTOCOLS = [
  ['HTTP', 'transferring web pages on the internet'],
  ['HTTPS', 'secure/encrypted transfer of web pages'],
  ['FTP', 'transferring files between computers'],
  ['SMTP', 'sending email messages'],
  ['POP3', 'receiving/downloading email messages'],
  ['IMAP', 'receiving and managing email on a mail server'],
  ['DNS', 'translating domain names into IP addresses'],
  ['DHCP', 'automatically assigning IP addresses to devices'],
  ['TCP/IP', 'the core protocol suite of the internet'],
  ['SSL/TLS', 'encrypting data for secure connections'],
];

const NET_DEVICES = [
  ['Router', 'connects multiple networks and routes data between them'],
  ['Switch', 'connects devices within a LAN and forwards data between them'],
  ['Modem', 'modulates and demodulates signals to connect a computer to the internet'],
  ['Hub', 'connects devices in a LAN by broadcasting data to all ports'],
  ['Gateway', 'connects two networks that use different protocols'],
  ['Repeater', 'amplifies a network signal to extend its range'],
];

const MALWARE = [
  ['Virus', 'malicious code that attaches to a program and replicates when it runs'],
  ['Worm', 'self-replicating malware that spreads across a network without user action'],
  ['Trojan horse', 'malware disguised as legitimate software'],
  ['Spyware', 'software that secretly collects information from a system'],
  ['Ransomware', 'malware that locks files and demands payment to release them'],
  ['Adware', 'software that displays unwanted advertisements'],
];

const SQL_CMDS = [
  ['SELECT', 'retrieves data from a database'], ['INSERT', 'adds a new row to a table'],
  ['UPDATE', 'modifies existing rows in a table'], ['DELETE', 'removes rows from a table'],
  ['CREATE', 'creates a new table or database object'], ['DROP', 'deletes a table entirely'],
  ['ALTER', 'changes the structure of an existing table'], ['WHERE', 'filters rows by a condition'],
];

const FILE_EXT = [
  ['.pdf', 'portable document format'], ['.docx', 'MS Word document'], ['.xlsx', 'MS Excel spreadsheet'],
  ['.pptx', 'MS PowerPoint presentation'], ['.txt', 'plain text file'], ['.zip', 'compressed archive'],
  ['.jpeg/.jpg', 'compressed image format'], ['.mp3', 'compressed audio format'], ['.mp4', 'video format'],
];

const OS_LIST = ['Windows', 'Linux', 'macOS', 'Android', 'iOS', 'Ubuntu'];
const NOT_OS = ['MS Word', 'Google Chrome', 'Adobe Photoshop', 'Mozilla Firefox', 'VLC Media Player'];
const BROWSERS = ['Google Chrome', 'Mozilla Firefox', 'Microsoft Edge', 'Safari', 'Opera'];
const NOT_BROWSER = ['Windows 11', 'MS Excel', 'Android Studio', 'Intel', 'AVG Antivirus'];
const PROG_LANGS = ['Python', 'Java', 'C++', 'JavaScript', 'Ruby'];
const NOT_PROG = ['HTML', 'CSS', 'SQL (standard)'];
const DATABASES = ['MySQL', 'Oracle', 'SQL Server', 'PostgreSQL', 'MongoDB'];

const GENERATION_FACTS = [
  ['ENIAC (1946)', 'widely regarded as the first general-purpose electronic digital computer'],
  ['Charles Babbage', 'known as the "father of the computer"'],
  ['Tim Berners-Lee', 'invented the World Wide Web (WWW)'],
  ['Ray Tomlinson', 'invented email'],
  ['Binary', 'the only language understood directly by a computer'],
];

const MEMORY_FACTS = [
  ['Primary memory', 'RAM and ROM, directly accessed by the CPU'],
  ['Secondary memory', 'hard disk, SSD, pen drive — provides permanent storage'],
  ['Volatile memory', 'loses its contents when power is switched off (RAM)'],
  ['Non-volatile memory', 'retains data even without power (ROM, HDD)'],
];

// ---------------------------------------------------------------------------
// Fact-based templates
// ---------------------------------------------------------------------------
function genFullForms(rng) {
  const pool = FULL_FORMS.filter((v, i, a) => a.findIndex(x => x[0] === v[0]) === i);
  return pool.map(([abbr, full]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Fundamentals', subtopic: 'Full Forms',
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'fundamentals', 'abbr'],
    question_text: `What is the full form of ${abbr}?`,
    correct: full,
    distractors: shuffle(rng, pool.filter(x => x[0] !== abbr)).map(x => x[1]).slice(0, 4),
    explanation: `${abbr} stands for ${full}.`
  }));
}

function genDeviceTypeQ(rng) {
  const sub = { 'Input device': 'Input Devices', 'Output device': 'Output Devices', 'Storage device': 'Storage Devices' };
  const types = ['Input device', 'Output device', 'Storage device', 'Processing device'];
  const all = [
    ...INPUT_DEVICES.map(d => [d, 'Input device']),
    ...OUTPUT_DEVICES.map(d => [d, 'Output device']),
    ...STORAGE_DEVICES.map(d => [d, 'Storage device']),
  ];
  return all.map(([device, type]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Hardware', subtopic: sub[type],
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'hardware', 'devices'],
    question_text: `What type of device is a ${device}?`,
    correct: type,
    distractors: types.filter(t => t !== type),
    explanation: `A ${device} is ${type === 'Input device' ? 'an' : 'a'} ${type.toLowerCase()}.`
  }));
}

function genComponentQ(rng) {
  return COMPONENT_FUNCTION.map(([comp, role]) => {
    const others = shuffle(rng, COMPONENT_FUNCTION.filter(x => x[0] !== comp).map(x => x[0])).slice(0, 4);
    return buildQ(rng, {
      subject: 'Computer Knowledge', topic: 'Hardware', subtopic: 'Components & Functions',
      difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'hardware', 'components'],
      question_text: `Which component of a computer is ${role}?`,
      correct: comp,
      distractors: others,
      explanation: `The ${comp} ${role}.`
    });
  });
}

function genUnitFacts(rng) {
  return UNIT_FACTS.map(([q, a]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Memory & Storage', subtopic: 'Units of Memory',
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'memory', 'units'],
    question_text: `${q} equals?`,
    correct: a,
    distractors: UNIT_FACTS.filter(x => x[1] !== a).map(x => x[1]).slice(0, 4),
    explanation: `${q} = ${a}.`
  }));
}

function genLargestUnit(rng) {
  return [buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Memory & Storage', subtopic: 'Units of Memory',
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'memory', 'units'],
    question_text: 'Which of the following is the LARGEST unit of computer memory?',
    correct: 'PB',
    distractors: UNITS.filter(x => x !== 'PB'),
    explanation: 'Order (small to large): Bit < Byte < KB < MB < GB < TB < PB.'
  })];
}

function genUnitConvert(rng) {
  const facts = [
    ['1 KB', '1024 bytes', 'bytes'],
    ['1 MB', '1024 KB', 'KB'],
    ['1 GB', '1024 MB', 'MB'],
    ['1 TB', '1024 GB', 'GB'],
    ['1 PB', '1024 TB', 'TB'],
  ];
  return facts.map(([q, a, unit]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Memory & Storage', subtopic: 'Unit Conversion',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'memory', 'conversion'],
    question_text: `${q} equals how many ${unit}?`,
    correct: a,
    distractors: facts.filter(x => x[1] !== a).map(x => x[1]).slice(0, 4),
    explanation: `Memory follows the binary system where 1 unit = 1024 of the next smaller unit; ${q} = ${a}.`
  }));
}

function genByteMath(rng) {
  const rows = [];
  const pairs = [[1, 'KB', 1024], [1, 'MB', 1024 * 1024], [2, 'KB', 2048], [3, 'KB', 3072], [1, 'GB', 1024 * 1024 * 1024], [2, 'MB', 2 * 1024 * 1024], [4, 'KB', 4096], [5, 'MB', 5 * 1024 * 1024]];
  for (const [amt, unit, bytes] of pairs) {
    const distractors = [bytes / 2, bytes * 2, bytes + 100, bytes - 100, bytes + 1024, bytes - 1024].filter(v => v !== bytes).map(Math.round);
    rows.push(buildQ(rng, {
      subject: 'Computer Knowledge', topic: 'Memory & Storage', subtopic: 'Unit Conversion',
      difficulty: 'hard', exam_stage: MAINS, tags: ['computer', 'memory', 'conversion'],
      question_text: `How many bytes are there in ${amt} ${unit}?`,
      correct: bytes.toLocaleString('en-IN'),
      distractors: distractors.map(d => d.toLocaleString('en-IN')).slice(0, 4),
      explanation: `1 ${unit === 'KB' ? 'KB' : unit === 'MB' ? 'MB' : 'GB'} = ${unit === 'KB' ? '1024 bytes' : unit === 'MB' ? '1024 × 1024 bytes' : '1024 × 1024 × 1024 bytes'}; so ${amt} ${unit} = ${bytes.toLocaleString('en-IN')} bytes.`
    }));
  }
  return rows;
}

function genShortcuts(rng) {
  const pool = SHORTCUTS.filter((v, i, a) => a.findIndex(x => x[0] === v[0]) === i);
  return pool.map(([keys, action]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'MS Office', subtopic: 'Keyboard Shortcuts',
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'office', 'shortcuts'],
    question_text: `Which keyboard shortcut is used to ${action} in MS Office?`,
    correct: keys,
    distractors: pool.filter(x => x[0] !== keys).map(x => x[0]).slice(0, 4),
    explanation: `${keys} is the shortcut for ${action}.`
  }));
}

function genOfficeQ(rng) {
  return OFFICE_APPS.map(([app, use]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'MS Office', subtopic: 'Applications',
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'office', 'apps'],
    question_text: `Which MS Office application is used for ${use}?`,
    correct: app,
    distractors: OFFICE_APPS.filter(x => x[0] !== app).map(x => x[0]),
    explanation: `${app} is the MS Office tool for ${use}.`
  }));
}

function genProtocols(rng) {
  return PROTOCOLS.map(([proto, use]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Networking', subtopic: 'Protocols',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'network', 'protocol'],
    question_text: `Which protocol is used for ${use}?`,
    correct: proto,
    distractors: PROTOCOLS.filter(x => x[0] !== proto).map(x => x[0]).slice(0, 4),
    explanation: `${proto} is the protocol used for ${use}.`
  }));
}

function genNetDevices(rng) {
  return NET_DEVICES.map(([dev, role]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Networking', subtopic: 'Network Devices',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'network', 'devices'],
    question_text: `Which network device ${role}?`,
    correct: dev,
    distractors: NET_DEVICES.filter(x => x[0] !== dev).map(x => x[0]).slice(0, 4),
    explanation: `A ${dev} ${role}.`
  }));
}

function genMalware(rng) {
  return MALWARE.map(([type, desc]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Security', subtopic: 'Malware',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'security', 'malware'],
    question_text: `Which type of malware is ${desc}?`,
    correct: type,
    distractors: MALWARE.filter(x => x[0] !== type).map(x => x[0]).slice(0, 4),
    explanation: `${type} ${desc}.`
  }));
}

function genSecurityFacts(rng) {
  const rows = [];
  rows.push(buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Security', subtopic: 'Safety & Protection',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'security'],
    question_text: 'What is "phishing"?',
    correct: 'Fraudulent attempt to obtain sensitive data by impersonating a trusted entity',
    distractors: ['A computer virus that deletes files', 'Sending large amounts of unwanted email', 'Hacking a computer to use its processing power'],
    explanation: 'Phishing is a social-engineering attack that tricks users into revealing credentials or sensitive data.'
  }));
  rows.push(buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Security', subtopic: 'Safety & Protection',
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'security'],
    question_text: 'Which software protects a computer from viruses and malware?',
    correct: 'Antivirus software',
    distractors: ['Word processor', 'Web browser', 'Spreadsheet'],
    explanation: 'Antivirus software detects, blocks, and removes malicious programs.'
  }));
  rows.push(buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Security', subtopic: 'Safety & Protection',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'security'],
    question_text: 'What is the primary purpose of a firewall?',
    correct: 'To block unauthorized access while allowing permitted traffic',
    distractors: ['To speed up the internet connection', 'To store backup copies of files', 'To print documents securely'],
    explanation: 'A firewall monitors and controls incoming and outgoing network traffic based on security rules.'
  }));
  rows.push(buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Security', subtopic: 'Safety & Protection',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'security'],
    question_text: 'Which of the following is the most secure password practice?',
    correct: 'Use a long passphrase with mixed characters and never reuse it',
    distractors: ['Use your name and birth year', 'Use "password123" for convenience', 'Write passwords on a sticky note on the monitor'],
    explanation: 'Long, unique passphrases with mixed characters resist brute-force and credential-stuffing attacks.'
  }));
  return rows;
}

function genSQL(rng) {
  return SQL_CMDS.map(([cmd, use]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Database & SQL', subtopic: 'SQL Commands',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'database', 'sql'],
    question_text: `Which SQL command is used to ${use}?`,
    correct: cmd,
    distractors: SQL_CMDS.filter(x => x[0] !== cmd).map(x => x[0]).slice(0, 4),
    explanation: `The ${cmd} command ${use}.`
  }));
}

function genDBFacts(rng) {
  const rows = [];
  rows.push(buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Database & SQL', subtopic: 'DBMS Basics',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'database'],
    question_text: 'Which of the following is a database management system?',
    correct: 'MySQL',
    distractors: ['Google Chrome', 'MS Paint', 'Photoshop'],
    explanation: 'MySQL, Oracle, SQL Server, and PostgreSQL are DBMS; the others are application software.'
  }));
  rows.push(buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Database & SQL', subtopic: 'DBMS Basics',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'database'],
    question_text: 'What is a primary key in a database table?',
    correct: 'A field that uniquely identifies each row',
    distractors: ['A field that stores images', 'The first field in the table', 'A field that can be left empty'],
    explanation: 'A primary key uniquely identifies each record and cannot contain NULL or duplicate values.'
  }));
  rows.push(buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Database & SQL', subtopic: 'DBMS Basics',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'database'],
    question_text: 'In a database, a collection of related records is called a?',
    correct: 'Table',
    distractors: ['Cell', 'Formula', 'Slide'],
    explanation: 'Data in a relational database is organized into tables of records (rows) and fields (columns).'
  }));
  return rows;
}

function genFileExt(rng) {
  return FILE_EXT.map(([ext, desc]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Internet & File Formats', subtopic: 'File Extensions',
    difficulty: 'easy', exam_stage: MAINS, tags: ['computer', 'files', 'formats'],
    question_text: `Which file extension is used for ${desc}?`,
    correct: ext,
    distractors: FILE_EXT.filter(x => x[0] !== ext).map(x => x[0]).slice(0, 4),
    explanation: `The ${ext} extension denotes ${desc}.`
  }));
}

function genCategory(type, rng) {
  const cfg = {
    os: {
      items: OS_LIST, cat: 'Operating System', topic: 'Fundamentals', subtopic: 'Software Categories',
      tags: ['computer', 'software', 'os'], others: ['Web Browser', 'Programming Language', 'Application Software']
    },
    browser: {
      items: BROWSERS, cat: 'Web Browser', topic: 'Internet & File Formats', subtopic: 'Web Browsers',
      tags: ['computer', 'internet'], others: ['Operating System', 'Programming Language', 'Application Software']
    },
    lang: {
      items: PROG_LANGS, cat: 'Programming Language', topic: 'Fundamentals', subtopic: 'Programming Languages',
      tags: ['computer', 'programming'], others: ['Operating System', 'Web Browser', 'Markup Language']
    },
  };
  const c = cfg[type];
  if (!c) return [];
  const cats = [c.cat, ...c.others];
  return c.items.map(item => buildQ(rng, {
    subject: 'Computer Knowledge', topic: c.topic, subtopic: c.subtopic,
    difficulty: 'easy', exam_stage: MAINS, tags: c.tags,
    question_text: `${item} is an example of which of the following?`,
    correct: c.cat,
    distractors: cats.filter(x => x !== c.cat),
    explanation: `${item} is ${['Operating System', 'Application Software'].includes(c.cat) ? 'an' : 'a'} ${c.cat.toLowerCase()}.`
  }));
}

function genGenFacts(rng) {
  return GENERATION_FACTS.map(([name, role]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Fundamentals', subtopic: 'History & Pioneers',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'history'],
    question_text: `Who/what ${role}?`,
    correct: name,
    distractors: shuffle(rng, GENERATION_FACTS.filter(x => x[0] !== name).map(x => x[0])).slice(0, 4),
    explanation: `${name} ${role}.`
  }));
}

function genMemoryFacts(rng) {
  return MEMORY_FACTS.map(([type, desc]) => buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Memory & Storage', subtopic: 'Types of Memory',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'memory'],
    question_text: `What is ${type}?`,
    correct: desc.split('—')[0],
    distractors: MEMORY_FACTS.filter(x => x[0] !== type).map(x => x[1].split('—')[0]).slice(0, 4),
    explanation: `${type} ${desc.split('—')[1] || ''}`
  }));
}

// ---------------------------------------------------------------------------
// Computed: number systems (verifiable by construction)
// ---------------------------------------------------------------------------
function decToBin(rng, n) {
  const bin = n.toString(2);
  const distractors = [n + 1, n - 1, n + 2, n - 2, n + 4].filter(v => v >= 0 && v !== n)
    .map(v => v.toString(2)).filter(v => v !== bin).slice(0, 4);
  return buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Number Systems', subtopic: 'Binary Conversion',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'numbers', 'binary'],
    question_text: `What is the binary representation of the decimal number ${n}?`,
    correct: bin,
    distractors,
    explanation: `Decimal ${n} = binary ${bin} (divide by 2 and read remainders from bottom up).`
  });
}

function binToDec(rng, bits) {
  const dec = parseInt(bits, 2);
  const distractors = [dec + 1, dec - 1, dec + 2, dec - 2, dec + 4].filter(v => v >= 0 && v !== dec).slice(0, 4);
  return buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Number Systems', subtopic: 'Binary Conversion',
    difficulty: 'medium', exam_stage: MAINS, tags: ['computer', 'numbers', 'binary'],
    question_text: `What is the decimal value of the binary number ${bits}?`,
    correct: String(dec),
    distractors: distractors.map(String),
    explanation: `Binary ${bits} = ${dec} decimal.`
  });
}

function decToHex(rng, n) {
  const hex = n.toString(16).toUpperCase();
  const distractors = [n + 1, n - 1, n + 2, n - 2, n + 16].filter(v => v >= 0 && v !== n)
    .map(v => v.toString(16).toUpperCase()).filter(v => v !== hex).slice(0, 4);
  return buildQ(rng, {
    subject: 'Computer Knowledge', topic: 'Number Systems', subtopic: 'Hexadecimal Conversion',
    difficulty: 'hard', exam_stage: MAINS, tags: ['computer', 'numbers', 'hex'],
    question_text: `What is the hexadecimal representation of the decimal number ${n}?`,
    correct: hex,
    distractors,
    explanation: `Decimal ${n} = 0x${hex} in hexadecimal.`
  });
}

function genNumberSystems(rng) {
  const rows = [];
  const usedN = new Set();
  while (usedN.size < 12) usedN.add(rand(rng, 8, 200));
  for (const n of usedN) rows.push(decToBin(rng, n));
  const usedBits = new Set();
  while (usedBits.size < 10) {
    const len = rand(rng, 3, 8);
    let bits = '';
    for (let b = 0; b < len; b++) bits += rng() < 0.5 ? '0' : '1';
    if (/^0/.test(bits)) bits = '1' + bits.slice(1);
    usedBits.add(bits);
  }
  for (const bits of usedBits) rows.push(binToDec(rng, bits));
  const usedH = new Set();
  while (usedH.size < 8) usedH.add(rand(rng, 32, 1000));
  for (const n of usedH) rows.push(decToHex(rng, n));
  return rows;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const ALL = [
  genFullForms, genDeviceTypeQ,
  genComponentQ, genUnitFacts, genLargestUnit, genUnitConvert, genByteMath,
  genShortcuts, genOfficeQ, genProtocols, genNetDevices, genMalware, genSecurityFacts,
  genSQL, genDBFacts, genFileExt, genCategory.bind(null, 'os'), genCategory.bind(null, 'browser'),
  genCategory.bind(null, 'lang'), genGenFacts, genMemoryFacts, genNumberSystems
];

function generate(args) {
  const count = args.count || 600;
  const seed = args.seed || 20260803;
  const rng = mulberry32(seed);
  const existing = loadExistingTexts('Computer Knowledge');
  const seen = new Set();
  const rows = [];
  const stats = {};

  const batches = ALL.map(fn => {
    const items = Array.isArray(fn) ? fn : fn(rng);
    return Array.isArray(items) ? items : [items];
  });

  // Interleave for variety
  const maxLen = Math.max(...batches.map(b => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const batch of batches) {
      if (i >= batch.length) continue;
      const item = batch[i];
      const base = normText(item.question_text);
      if (existing.has(base)) continue;
      const norm = `${base} | ${[item.option_a, item.option_b, item.option_c, item.option_d].map(o => normText(o)).join('|')}`;
      if (seen.has(norm)) continue;
      seen.add(norm);
      rows.push(item);
      stats[`${item.topic}/${item.subtopic}`] = (stats[`${item.topic}/${item.subtopic}`] || 0) + 1;
      if (rows.length >= count) break;
    }
    if (rows.length >= count) break;
  }

  const summary = { requested: count, generated: rows.length, by_topic: stats, skipped_existing: existing.size };
  console.log(`Generated ${rows.length} Computer Knowledge questions (seed ${seed}, skipped ${existing.size} existing texts)`);
  return { rows, summary };
}

module.exports = { generate, buildQ };

if (require.main === module) {
  const args = {
    count: parseInt(argValue('count', '600'), 10) || 600,
    seed: parseInt(argValue('seed', '20260803'), 10) || 20260803
  };
  const { rows, summary } = generate(args);
  verify(rows);
  emit(rows, summary, 'computer');
}
