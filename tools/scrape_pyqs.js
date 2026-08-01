// Scrapes IBPS memory-based paper pages (bankersadda format) for question text.
// Usage: node tools/scrape_pyqs.js [url...]  (defaults to a known IBPS PO 2024 page)
// Output: tools/pyqs_draft.csv and tools/pyqs_draft.json (answers left blank for review)
const fs = require('fs');
const path = require('path');

const DEFAULT_URLS = [
  'https://www.bankersadda.com/ibps-po-memory-based-paper-2024/'
];

const SUBJECT_RULES = [
  { pattern: /grammatically|sentence|paragraph|passage|spell|fill in|error|vocab|antonym|synonym|cloze/i, subject: 'English Language', topic: 'Grammar' },
  { pattern: /sits|sitting|arrangement|faces|face the centre|circular table|\bdirection\b|puzzle|blood relation|syllogism|coding|inequality|\border\b|classification|analogy/i, subject: 'Reasoning', topic: 'Puzzle & Arrangement' },
  { pattern: /number series|percentage|ratio|profit|loss|interest|speed|average|work|pipe|mixture|alligation|time and|distance|read the following table|diagram|probability|permutation|number system/i, subject: 'Quantitative Aptitude', topic: 'Arithmetic' }
];

function decodeEntities(text) {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '--')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

function extractTables(html) {
  const blocks = [];
  let out = html;
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  out = out.replace(tableRe, m => {
    const rows = [];
    const trRe = /<tr[\s\S]*?<\/tr>/gi;
    let tr;
    while ((tr = trRe.exec(m)) !== null) {
      const cells = [];
      const cellRe = /<t[hd][\s\S]*?<\/t[hd]>/gi;
      let c;
      while ((c = cellRe.exec(tr[0])) !== null) {
        cells.push(c[0].replace(/<[^>]+>/g, '').trim());
      }
      if (cells.length > 0) rows.push(cells.join(' | '));
    }
    const block = 'TABLE_START\n' + rows.join('\n') + '\nTABLE_END';
    blocks.push(block);
    return block;
  });
  return { html: out, blocks };
}

function htmlToText(html) {
  return html
    .replace(/<(br|\/p|\/li|\/h\d|\/div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n');
}

function extractRegion(text) {
  const markers = [/memory\s*based\s*questions/i, /direction\s*\(/i];
  for (const m of markers) {
    const idx = text.search(m);
    if (idx !== -1) return text.slice(idx);
  }
  return text;
}

function classify(questionText) {
  const withoutInstruction = questionText.replace(/^directions?\s*\(\d+\s*-\s*\d+\)[:\s]*/i, '');
  for (const rule of SUBJECT_RULES) {
    if (rule.pattern.test(withoutInstruction)) {
      return { subject: rule.subject, topic: rule.topic };
    }
  }
  return { subject: 'General Awareness', topic: 'General' };
}

function parsePage(html) {
  const { html: tableAware, blocks } = extractTables(html);
  const region = extractRegion(htmlToText(tableAware));
  const lines = decodeEntities(region).split('\n');
  const questions = [];
  let currentQ = null;
  let activeContext = null;
  let currentRange = null;
  let stashedTable = null;
  let inTable = false;
  let tableLines = [];

  const dedupe = (arr) => {
    const out = [];
    for (const l of arr) {
      if (out.length > 0 && out[out.length - 1] === l) continue;
      out.push(l);
    }
    return out;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line === 'TABLE_START') { inTable = true; tableLines = []; continue; }
    if (line === 'TABLE_END') { inTable = false; stashedTable = 'Table: ' + tableLines.join(' ; '); continue; }
    if (inTable) { tableLines.push(line); continue; }

    const dirMatch = line.match(/^directions?\s*\((\d+)\s*-\s*(\d+)\)/i);
    if (dirMatch) {
      currentRange = { from: +dirMatch[1], to: +dirMatch[2] };
      activeContext = [line];
      if (stashedTable) {
        activeContext.unshift(stashedTable);
        stashedTable = null;
      }
      continue;
    }

    const qMatch = line.match(/^Q(\d+)\.?\s*(.*)$/i);
    if (qMatch) {
      if (currentQ) questions.push(currentQ);
      const num = +qMatch[1];
      const inRange = currentRange && num >= currentRange.from && num <= currentRange.to;
      if (currentRange && num > currentRange.to) {
        currentRange = null;
        activeContext = null;
      }
      currentQ = {
        num,
        text: [qMatch[2]],
        options: [],
        context: inRange && activeContext ? [...activeContext] : []
      };
      continue;
    }

    const optMatch = line.match(/^\(([a-e]|[1-5])\)\s*(.*)$/i);
    if (currentQ && optMatch) {
      currentQ.options.push({ key: optMatch[1].toLowerCase(), text: optMatch[2] });
      continue;
    }

    if (currentQ && currentQ.options.length >= 5) {
      continue;
    }

    if (currentQ) {
      if (currentQ.options.length > 0) {
        currentQ.options[currentQ.options.length - 1].text += ' ' + line;
      } else {
        currentQ.text.push(line);
      }
    } else if (activeContext) {
      activeContext.push(line);
    }
  }
  if (currentQ) questions.push(currentQ);

  const stage = /mains/i.test(region) && !/prelims/i.test(region) ? 'mains' : 'prelims';

  return questions.map(q => {
    const opts = {};
    let optIndex = 0;
    for (const o of q.options.slice(0, 5)) {
      const key = String.fromCharCode(97 + optIndex);
      opts[`option_${key}`] = o.text;
      optIndex++;
    }
    const fullText = dedupe([...q.context, ...q.text]).join(' ').trim();
    const { subject, topic } = classify(fullText);
    return {
      subject,
      topic,
      subtopic: '',
      difficulty: 'medium',
      question_text: fullText,
      option_a: opts.option_a || '',
      option_b: opts.option_b || '',
      option_c: opts.option_c || '',
      option_d: opts.option_d || '',
      option_e: opts.option_e || '',
      correct_option: '',
      explanation: '',
      exam_stage: stage,
      tags: 'pyq'
    };
  });
}

function toCsv(rows) {
  const headers = ['subject', 'topic', 'subtopic', 'difficulty', 'question_text',
    'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
    'correct_option', 'explanation', 'exam_stage', 'tags'];
  const esc = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

async function main() {
  const urls = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_URLS;
  const outDir = path.join(__dirname);
  const all = [];
  for (const url of urls) {
    console.log(`Fetching ${url} ...`);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) { console.log(`  HTTP ${res.status} - skipping`); continue; }
      const html = await res.text();
      const questions = parsePage(html);
      console.log(`  Extracted ${questions.length} questions`);
      all.push(...questions);
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(outDir, 'pyqs_draft.json'), JSON.stringify(all, null, 2));
  fs.writeFileSync(path.join(outDir, 'pyqs_draft.csv'), toCsv(all));
  console.log(`\nWrote ${all.length} questions to tools/pyqs_draft.csv and pyqs_draft.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
