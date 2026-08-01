// question_ids is stored as JSON text ("[1,2,3]"), but a Postgres array
// literal ("{1,2,3}") can end up there too (e.g. if a JS array was passed as
// a parameter). Tolerate both shapes.
function parseQuestionIds(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  const s = String(value).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try { return JSON.parse(s); } catch { return []; }
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    return s.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean).map(Number);
  }
  try { return JSON.parse(s); } catch { return []; }
}

module.exports = { parseQuestionIds };
