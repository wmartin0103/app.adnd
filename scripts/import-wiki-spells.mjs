// Imports spell stat blocks from the AD&D 2nd Edition wiki (adnd2e.fandom.com,
// text under CC BY-SA) into data/spell-catalog.json:
//
//   NODE_USE_ENV_PROXY=1 node scripts/import-wiki-spells.mjs
//
// Only the facts in each spell's infobox are kept (class, school or sphere,
// level, range, casting time, duration, area, save, source) plus a link to
// the wiki page. The description text is read only to guess two things the
// infobox lacks, marked for a player to check: whether the spell needs an
// attack roll, and its damage or healing dice. No description text is stored.
//
// Entries already in the catalog keep what the group entered; the import only
// fills fields that are empty.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

// Set SPELL_CACHE=<dir> to keep the downloaded pages and re-run without fetching
const CACHE = process.env.SPELL_CACHE || '';

const API = 'https://adnd2e.fandom.com/api.php';
const WIKI = 'https://adnd2e.fandom.com/wiki/';
const CATEGORIES = [
  ['Category:Wizard_Spells', 'wizard'],
  ['Category:Wizard_Cantrips', 'wizard'],
  ['Category:Priest_Spells', 'priest'],
  ['Category:Priest_Orisons', 'priest'],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(params) {
  const cacheFile = CACHE ? `${CACHE}/${Buffer.from(JSON.stringify(params)).toString('base64url').slice(0, 200)}.json` : '';
  if (cacheFile && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  const data = await apiFetch(params);
  if (cacheFile) { mkdirSync(CACHE, { recursive: true }); writeFileSync(cacheFile, JSON.stringify(data)); }
  return data;
}
async function apiFetch(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'app.adnd spell import (private campaign tool)' } });
      if (res.ok) return res.json();
      if (attempt >= 3) throw new Error(`${res.status} for ${url}`);
    } catch (e) {
      if (attempt >= 3) throw e;
    }
    await sleep(1000 * 2 ** attempt);
  }
}

async function categoryMembers(cat) {
  const titles = [];
  let cont = {};
  do {
    const d = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmlimit: '500', cmtype: 'page', ...cont });
    titles.push(...d.query.categorymembers.map(m => m.title));
    cont = d.continue || null;
    await sleep(300);
  } while (cont);
  return titles;
}

// The {{Infobox Spells ...}} template, with nested templates balanced
function infobox(text) {
  const start = text.indexOf('{{Infobox Spells');
  if (start < 0) return null;
  let depth = 0, i = start;
  for (; i < text.length - 1; i++) {
    if (text.startsWith('{{', i)) { depth++; i++; }
    else if (text.startsWith('}}', i)) { depth--; i++; if (depth === 0) break; }
  }
  const body = text.slice(start + 2, i - 1);
  const fields = {};
  // split on "|" at depth 0 (outside nested templates and links)
  let d = 0, cur = '';
  const parts = [];
  for (let k = 0; k < body.length; k++) {
    const two = body.slice(k, k + 2);
    if (two === '{{' || two === '[[') { d++; cur += two; k++; continue; }
    if (two === '}}' || two === ']]') { d--; cur += two; k++; continue; }
    if (body[k] === '|' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += body[k];
  }
  parts.push(cur);
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) fields[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  }
  return { fields, rest: text.slice(i + 1) };
}

// Wiki markup to plain text
function clean(v) {
  return String(v || '')
    .replace(/\{\{frac\|(\d+)\|(\d+)\}\}/gi, (_, a, b) => (a === '1' && b === '2' ? '½' : `${a}/${b}`))
    .replace(/\{\{br\}\}/gi, '; ')
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<ref[^>]*>.*?<\/ref>|<ref[^>]*\/>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s*;\s*(;\s*)*/g, '; ')
    .replace(/^[;\s]+|[;\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Guesses from the description (never stored): attack roll and dice
function guess(fields, rest) {
  const text = clean(rest).toLowerCase();
  const range = clean(fields.range).toLowerCase();
  const save = clean(fields.save).toLowerCase();
  const name = clean(fields.name).toLowerCase();
  // The first dice roll that is damage or hit points ("2d4 Hit Dice" and
  // "1d4 persons" are not): "1d4+1", "1d6 points of damage per level",
  // "1d8 points of damage, plus 1 point per level", "1d6 for every two levels"
  let dice = '';
  for (const m of text.matchAll(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/g)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 90).split('.')[0];
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (!/^\s*(?:points?\s+)?(?:of\s+)?(?:[a-z]+\s+){0,2}?(?:damage|hit points?)\b/.test(after) && !/(damage|heal|cure|restore|inflict|suffer|lose|loses)s?\W*(?:\w+\W+){0,3}$/.test(before)) continue;
    const plus = after.match(/(?:\+|plus)\s*(\d+)\s*(?:points?\s*)?(?:of\s+\w+\s+)?(?:per|for each)\s+(?:experience\s+)?level/);
    const every = after.match(/for every (two|three|four|2|3|4) (?:caster |experience )?levels/);
    const perLevel = !plus && !every && /^\s*(?:points?\s+)?(?:of\s+)?(?:[a-z]+\s+){0,2}?(?:damage\s+|hit points?\s+)?(?:per|for each)\s+(?:experience\s+)?level/.test(after);
    const n = every ? ({ two: 2, three: 3, four: 4 }[every[1]] || every[1]) : 0;
    dice = m[1].replace(/\s+/g, '') + (plus ? `+${plus[1]}/level` : every ? ` per ${n} levels` : perLevel ? '/level' : '');
    break;
  }
  const heal = /\b(cure|heal|regenerat|restor)/.test(name) || /\b(heals|restores|cures)\b[^.]{0,60}\bhit points?\b/.test(text);
  let attack = 'none';
  const touchy = range.includes('touch') || /successful touch|melee attack|touch attack|touches an? (opponent|creature|target)/.test(text);
  // The caster rolls to hit ("makes a successful attack roll"), not a spell
  // that changes other people's attack rolls ("+1 to attack rolls")
  const rolls = /\b(?:make|makes|making|require|requires|need|needs|with) an? (?:successful )?(?:normal |ranged |missile |melee |touch )?attack roll\b(?!s)|\bsuccessful (?:melee |touch |ranged )?attack\b(?! rolls)|\broll to hit\b|\btouch attack\b|\bsuccessful touch\b/.test(text);
  if (heal) attack = 'none';
  else if (rolls) attack = touchy ? 'touch' : 'ranged';
  else if (range.includes('touch') && dice && (save === 'none' || save === '')) attack = 'touch';
  return { dice, diceKind: dice ? (heal ? 'heal' : 'damage') : '', attack };
}

const slug = s => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const catalog = JSON.parse(readFileSync('data/spell-catalog.json', 'utf8'));
  const byKey = new Map(catalog.spells.map(e => [`${e.class}|${slug(e.name)}|${e.level}`, e]));
  const ids = new Set(catalog.spells.map(e => e.id));
  let added = 0, filled = 0, skipped = 0;

  for (const [cat, cls] of CATEGORIES) {
    const titles = await categoryMembers(cat);
    console.log(`${cat}: ${titles.length} pages`);
    for (let i = 0; i < titles.length; i += 50) {
      const batch = titles.slice(i, i + 50);
      const d = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: batch.join('|') });
      for (const page of Object.values(d.query.pages || {})) {
        const text = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'] || '';
        const box = infobox(text);
        if (!box) { skipped++; continue; }
        const f = box.fields;
        const raw = clean(f.name) || page.title.replace(/\s*\((Wizard|Priest)[^)]*\)$/i, '');
        const reversible = /reversible/i.test(raw);
        const name = raw.replace(/[;,]?\s*\(?reversible\)?.*$/i, '').replace(/[;,\s]+$/, '').trim();
        const level = parseInt(clean(f.level), 10);
        const klass = /priest/i.test(f.class || '') ? 'priest' : /wizard/i.test(f.class || '') ? 'wizard' : cls;
        const g = guess(f, box.rest);
        const entry = {
          id: '', name, class: klass, level: Number.isNaN(level) ? 0 : level,
          school: [clean(f.school), clean(f.sphere) && `Sphere: ${clean(f.sphere)}`].filter(Boolean).join(' · '),
          castTime: clean(f.castingTime), range: clean(f.range), duration: clean(f.duration),
          area: clean(f.aoe), save: clean(f.save), attack: g.attack, dice: g.dice, diceKind: g.diceKind,
          summary: reversible ? 'Reversible' : '', source: clean(f.source), status: 'imported', check: ['attack', 'dice'],
          link: WIKI + encodeURIComponent(page.title.replace(/ /g, '_')).replace(/%2F/g, '/'),
        };
        if (!entry.dice) delete entry.diceKind;
        const key = `${entry.class}|${slug(entry.name)}|${entry.level}`;
        const existing = byKey.get(key);
        if (existing) {
          for (const k of ['school', 'castTime', 'range', 'duration', 'area', 'save', 'dice', 'diceKind', 'source', 'link']) {
            if ((existing[k] === undefined || existing[k] === '') && entry[k]) { existing[k] = entry[k]; filled++; }
          }
          continue;
        }
        let id = slug(`${entry.name}-${entry.class}`);
        if (ids.has(id)) id = slug(`${entry.name}-${entry.class}-${entry.level}`);
        for (let n = 2; ids.has(id); n++) id = slug(`${entry.name}-${entry.class}-${entry.level}-${n}`);
        entry.id = id;
        ids.add(id);
        byKey.set(key, entry);
        catalog.spells.push(entry);
        added++;
      }
      await sleep(400);
    }
  }
  catalog.about = "The campaign's shared spell catalog: short stat blocks only, never a book's description text (link to it instead). Anyone in the group can add or edit entries. Hand-entered PHB entries are marked 'check' until compared with the book. Entries marked 'imported' come from the AD&D 2nd Edition wiki (adnd2e.fandom.com, CC BY-SA): their infobox facts, with the attack roll and dice guessed from the description and listed under 'check' for a player to confirm.";
  catalog.spells.sort((a, b) => a.class.localeCompare(b.class) || a.level - b.level || a.name.localeCompare(b.name));
  writeFileSync('data/spell-catalog.json', JSON.stringify(catalog, null, 1) + '\n');
  console.log(`added ${added}, filled ${filled} empty fields on existing entries, ${skipped} pages without an infobox`);
}

main().catch(e => { console.error(e); process.exit(1); });
