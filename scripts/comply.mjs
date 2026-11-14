#!/usr/bin/env node
// The one CLI for Product Compliance for Claude Code. Human tables by default, --json for machines.
//   npm run comply -- help
//   npm run comply -- status
//   npm run comply -- declare --part=P-2002 --rule=EU-ROHS --status=compliant --received=2026-11-14 --document="FD-RoHS-040-2026.pdf" --actor="Hana"
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';
import { esc, page, table as htmlTable, record as htmlRecord } from './lib/render.mjs';

export const commands = [
  'help', 'products', 'parts', 'suppliers', 'rules', 'status', 'show', 'part', 'gaps', 'svhc', 'exemptions',
  'conflict-minerals', 'requests', 'customer-requests', 'certificates', 'where-used', 'attention', 'compliance',
  'activity', 'weekly-review',
  'add', 'update', 'bom', 'declare', 'cmrt', 'request', 'remind', 'close-request', 'customer-request', 'certificate',
  'candidate-update', 'log', 'import', 'export', 'draft-requests',
];
const STATUSES = ['compliant', 'compliant_exemption', 'non_compliant', 'contains_listed'];
const CERTIFIABLE = ['compliant', 'compliant_exemption', 'contains_listed'];
const TABLES = ['settings', 'suppliers', 'parts', 'products', 'bom', 'regulations', 'substances', 'declarations', 'declaration_substances', 'cmrts', 'supplier_requests', 'customer_requests', 'certificates', 'activity', 'imports'];

// ------------------------------------------------------------ input checks
function need(v, k) { if (v === undefined || v === null || v === true || String(v).trim() === '') throw Error(`Required: --${k}`); return String(v).trim(); }
function num(v, k, min = 0) { const n = Number(String(need(v, k)).replace(/,/g, '')); if (!Number.isFinite(n) || n < min) throw Error(`${k} must be a finite number >= ${min}`); return n; }
export function date(v, k) {
  const s = need(v, k);
  let iso = s;
  const nz = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // 14/11/2026, the way NZ and AU write dates
  if (nz) iso = `${nz[3]}-${nz[2].padStart(2, '0')}-${nz[1].padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso) throw Error(`${k} must be a real date, YYYY-MM-DD or DD/MM/YYYY (got "${s}")`);
  return iso;
}
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

async function tx(db, fn, dry = false) {
  await db.exec('BEGIN');
  try { const r = await fn(); await db.exec(dry ? 'ROLLBACK' : 'COMMIT'); return r; }
  catch (e) { await db.exec('ROLLBACK'); throw e; }
}
async function audit(db, entity, ref, action, actor, before, after, evidence) {
  await db.query('INSERT INTO activity(entity,ref,action,actor,before_data,after_data,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [entity, ref, action, actor, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, evidence || null]);
}

// Exact code first, then id prefix, then a case-insensitive name match. Ambiguous lists and stops.
async function match(db, tbl, codeCol, ref, label) {
  ref = need(ref, label);
  const exact = await db.query(`SELECT * FROM ${tbl} WHERE lower(${codeCol})=lower($1) OR id::text=$1`, [ref]);
  if (exact.length === 1) return exact[0];
  const nameCol = tbl === 'parts' ? 'description' : 'name';
  const rows = await db.query(`SELECT * FROM ${tbl} WHERE id::text LIKE $1 OR lower(${nameCol}) LIKE $2 OR lower(${codeCol}) LIKE $2 ORDER BY ${codeCol}`, [ref.toLowerCase() + '%', '%' + ref.toLowerCase() + '%']);
  if (rows.length !== 1) throw Error(rows.length ? `Ambiguous ${label} "${ref}"; use the code:\n${rows.map((r) => `${r[codeCol]}  ${r[nameCol]}`).join('\n')}` : `No ${label} matches "${ref}"`);
  return rows[0];
}
export const matchPart = (db, ref) => match(db, 'parts', 'part_no', ref, 'part');
export const matchProduct = (db, ref) => match(db, 'products', 'code', ref, 'product');
export const matchSupplier = (db, ref) => match(db, 'suppliers', 'code', ref, 'supplier');
async function matchRule(db, ref) {
  ref = need(ref, 'rule').toUpperCase().replace(/\s+/g, '-');
  const alias = { ROHS: 'EU-ROHS', REACH: 'REACH-SVHC', SVHC: 'REACH-SVHC', 'PROP-65': 'PROP65', CMRT: 'CONFLICT-MINERALS', '3TG': 'CONFLICT-MINERALS' }[ref] || ref;
  const r = (await db.query('SELECT * FROM regulations WHERE code=$1', [alias]))[0];
  if (!r) throw Error(`No rule "${ref}". Rules: ${(await db.query('SELECT code FROM regulations ORDER BY code')).map((x) => x.code).join(', ')}`);
  return r;
}
async function matchSubstance(db, ref) {
  const rows = await db.query('SELECT * FROM substances WHERE lower(name)=lower($1) OR cas=$1', [ref]);
  if (rows.length === 1) return rows[0];
  const like = await db.query('SELECT * FROM substances WHERE lower(name) LIKE $1 ORDER BY name', ['%' + ref.toLowerCase() + '%']);
  if (like.length !== 1) throw Error(like.length ? `Ambiguous substance "${ref}":\n${like.map((s) => s.name).join('\n')}` : `No substance "${ref}" on the list; add it to the substances table first (see /customise)`);
  return like[0];
}
async function byId(db, tbl, ref, label) {
  const rows = await db.query(`SELECT * FROM ${tbl} WHERE id::text LIKE $1`, [need(ref, label).toLowerCase() + '%']);
  if (rows.length !== 1) throw Error(rows.length ? `Ambiguous ${label} id ${ref}` : `No ${label} ${ref}`);
  return rows[0];
}
// "Lead=25000@brass body;DEHP=2500@PVC seal" or "Lead" (present, no figure given)
export function parseSubstances(v) {
  if (!v) return [];
  return String(v).split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^([^=@]+?)(?:\s*=\s*([\d.,]+)\s*(?:ppm)?)?(?:\s*@\s*(.+))?$/i);
    if (!m) throw Error(`Cannot read substance "${x}"; use Name=ppm@where`);
    return { name: m[1].trim(), ppm: m[2] === undefined ? null : num(m[2], 'concentration'), location: m[3]?.trim() || null };
  });
}

// ------------------------------------------------------------ reads
const reads = {
  products: "SELECT code, name, array_to_string(markets, ' ') AS markets, owner, scip_ref, active, (SELECT count(*)::int FROM bom b WHERE b.product_id=p.id) AS parts FROM products p ORDER BY code",
  parts: 'SELECT p.part_no, p.description, s.code AS supplier, p.mfr_part_no, p.category, p.mass_g, p.active FROM parts p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.part_no',
  suppliers: 'SELECT code, name, contact_name, contact_email, country, supplies_3tg, active FROM suppliers ORDER BY code',
  rules: "SELECT code, name, array_to_string(markets, ' ') AS markets, scope, validity_months, follows_candidate_list, source FROM regulations ORDER BY code",
  status: 'SELECT product, regulation, status, parts, unknown_parts, failing_parts, listed_parts, exemption_parts FROM v_product_rule ORDER BY product, regulation',
  gaps: "SELECT part_no, description, supplier, regulation, state, received_on, valid_until FROM v_part_rule WHERE state IN ('missing','expired','stale') ORDER BY supplier, part_no, regulation",
  svhc: "SELECT product, part_no, substance, cas, concentration_ppm, location, array_to_string(markets, ' ') AS markets, coalesce(scip_ref, 'NOT NOTIFIED') AS scip FROM v_svhc ORDER BY product, part_no",
  exemptions: 'SELECT part_no, supplier, exemption, exemption_expires, days_left, used_in FROM v_exemptions ORDER BY exemption_expires NULLS LAST',
  'conflict-minerals': 'SELECT supplier, name, template_version, received_on, valid_until, smelters_reported, smelters_conformant, smelters_not_conformant, state FROM v_supplier_cmrt ORDER BY state, supplier',
  requests: "SELECT id, supplier, regulation, array_to_string(part_nos, ' ') AS parts, sent_on, due_on, reminders, last_reminder, status, days_overdue FROM v_open_supplier_requests ORDER BY due_on",
  'customer-requests': 'SELECT c.id, c.customer, p.code AS product, c.regulation, c.received_on, c.due_on, c.status, c.outcome FROM customer_requests c JOIN products p ON p.id=c.product_id ORDER BY (c.status=\'open\') DESC, c.due_on',
  certificates: 'SELECT c.id, p.code AS product, c.regulation, c.issued_to, c.issued_on, c.status_at_issue, c.substances FROM certificates c JOIN products p ON p.id=c.product_id ORDER BY c.issued_on DESC',
  attention: 'SELECT issue, ref, rule, detail FROM v_attention ORDER BY issue, ref, rule',
  compliance: 'SELECT rule, ref, finding FROM v_compliance ORDER BY rule, ref',
  activity: 'SELECT created_at, entity, ref, action, actor, evidence FROM activity ORDER BY created_at DESC, id DESC LIMIT 100',
};

async function weeklyReview(db) {
  return {
    attention: await db.query(reads.attention),
    products_not_clear: await db.query("SELECT product, regulation, status, unknown_parts, failing_parts FROM v_product_rule WHERE status NOT IN ('compliant','compliant_exemption') ORDER BY product, regulation"),
    supplier_requests: await db.query(reads.requests),
    customer_requests: await db.query("SELECT c.customer, p.code AS product, c.regulation, c.due_on, v.status AS current_status FROM customer_requests c JOIN products p ON p.id=c.product_id LEFT JOIN v_product_rule v ON v.product_id=c.product_id AND v.regulation=c.regulation WHERE c.status='open' ORDER BY c.due_on"),
  };
}

// ------------------------------------------------------------ the Assent import
// Assent's part-level compliance report, saved as CSV. Columns are matched by name; --map=file.json renames others.
const ASSENT_COLUMNS = {
  part: ['Part Number', 'Part No', 'Internal Part Number', 'Part'],
  description: ['Part Description', 'Description'],
  supplier: ['Supplier Name', 'Supplier', 'Vendor'],
  mfr: ['Manufacturer Part Number', 'MPN', 'Supplier Part Number'],
  rohs: ['RoHS Status', 'RoHS', 'EU RoHS Status'],
  exemption: ['RoHS Exemption', 'RoHS Exemptions', 'Exemption'],
  reach: ['REACH Status', 'REACH SVHC Status', 'REACH'],
  svhc: ['SVHC', 'SVHCs', 'SVHC Substances', 'Substances'],
  prop65: ['Prop 65 Status', 'Prop65 Status', 'Proposition 65'],
  date: ['Declaration Date', 'Date', 'Response Date', 'Last Updated'],
  document: ['Document', 'Declaration Document', 'Attachment', 'Document Name'],
};
export function statusOf(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s || /unknown|pending|no data|not provided|n\/a|in progress|requested/.test(s)) return null;
  if (/exempt/.test(s)) return 'compliant_exemption';
  if (/non.?compliant|not compliant|fail/.test(s)) return 'non_compliant';
  if (/contain|svhc present|above|warning required|listed/.test(s)) return 'contains_listed';
  if (/compliant|pass|free|no svhc|none|not present|clean/.test(s)) return 'compliant';
  return undefined; // a value we do not recognise: reported, never guessed
}
async function importAssent(db, o, actor) {
  const file = need(o.file, 'file');
  const raw = fs.readFileSync(file, 'utf8');
  const rows = parseCsv(raw);
  if (!rows.length) throw Error('The file has no rows');
  const map = o.map ? JSON.parse(fs.readFileSync(o.map, 'utf8')) : {};
  const col = (row, key) => (map[key] ? pick(row, map[key]) : pick(row, ...ASSENT_COLUMNS[key]));
  const sum = { rows_read: rows.length, suppliers_created: 0, parts_created: 0, declarations: 0, unchanged: 0, unknown: [], unrecognised: [] };
  const RULES = [['rohs', 'EU-ROHS'], ['reach', 'REACH-SVHC'], ['prop65', 'PROP65']];
  return tx(db, async () => {
    for (const [i, row] of rows.entries()) {
      const line = i + 2;
      const partNo = col(row, 'part');
      if (!partNo) throw Error(`Row ${line}: no part number`);
      const supplierName = col(row, 'supplier');
      let supplier = null;
      if (supplierName) {
        supplier = (await db.query('SELECT * FROM suppliers WHERE lower(name)=lower($1) OR lower(code)=lower($1)', [supplierName]))[0];
        if (!supplier) {
          let code = supplierName.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'SUP';
          if ((await db.query('SELECT 1 FROM suppliers WHERE code=$1', [code])).length) code = code.slice(0, 6) + String(line).padStart(2, '0');
          supplier = (await db.query('INSERT INTO suppliers(code,name) VALUES($1,$2) RETURNING *', [code, supplierName]))[0];
          sum.suppliers_created++;
        }
      }
      let part = (await db.query('SELECT * FROM parts WHERE lower(part_no)=lower($1)', [partNo]))[0];
      if (!part) {
        part = (await db.query('INSERT INTO parts(part_no,description,supplier_id,mfr_part_no) VALUES($1,$2,$3,$4) RETURNING *', [partNo, col(row, 'description') || partNo, supplier?.id || null, col(row, 'mfr') || null]))[0];
        sum.parts_created++;
      }
      const when = col(row, 'date') ? date(col(row, 'date'), `row ${line} date`) : null;
      for (const [key, rule] of RULES) {
        const value = col(row, key);
        if (!value) continue;
        const status = statusOf(value);
        if (status === null) { sum.unknown.push(`${partNo} ${rule}: ${value}`); continue; }
        if (status === undefined) { sum.unrecognised.push(`row ${line} ${partNo} ${rule}: "${value}"`); continue; }
        if (!when) throw Error(`Row ${line}: ${partNo} has a ${rule} status but no declaration date`);
        const exemption = rule === 'EU-ROHS' && status === 'compliant_exemption' ? (col(row, 'exemption') || 'exemption not named in the export') : null;
        const same = await db.query('SELECT 1 FROM declarations WHERE part_id=$1 AND regulation=$2 AND received_on=$3 AND status=$4', [part.id, rule, when, status]);
        if (same.length) { sum.unchanged++; continue; }
        const d = (await db.query("INSERT INTO declarations(part_id,regulation,status,exemption,received_on,document_ref,source,actor) VALUES($1,$2,$3,$4,$5,$6,'import',$7) RETURNING *", [part.id, rule, status, exemption, when, col(row, 'document') || null, actor]))[0];
        if (status === 'contains_listed' && rule === 'REACH-SVHC') {
          for (const s of parseSubstances(col(row, 'svhc').replace(/\|/g, ';'))) {
            const sub = await matchSubstance(db, s.name);
            await db.query('INSERT INTO declaration_substances(declaration_id,substance_id,concentration_ppm,location) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [d.id, sub.id, s.ppm, s.location]);
          }
        }
        sum.declarations++;
      }
    }
    if (sum.unrecognised.length) throw Error(`Stopped: status values not recognised, nothing saved:\n${sum.unrecognised.join('\n')}\nAdd --map or fix the values, then run again.`);
    await db.query('INSERT INTO imports(source,file_sha256,rows_read,actor,summary) VALUES($1,$2,$3,$4,$5)', ['assent', createHash('sha256').update(raw).digest('hex'), rows.length, actor, JSON.stringify(sum)]);
    await audit(db, 'import', path.basename(file), o['dry-run'] ? 'import dry run' : 'import', actor, null, sum, `assent export ${path.basename(file)}`);
    return { ...sum, dry_run: Boolean(o['dry-run']) };
  }, Boolean(o['dry-run']));
}

// ------------------------------------------------------------ drafts
function draftPath(name) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}
async function draftRequests(db) {
  const gaps = await db.query("SELECT pr.supplier, s.name, s.contact_name, s.contact_email, pr.regulation, pr.part_no, pr.description, p.mfr_part_no, pr.state FROM v_part_rule pr JOIN suppliers s ON s.id=pr.supplier_id JOIN parts p ON p.id=pr.part_id WHERE pr.state IN ('missing','expired','stale') UNION ALL SELECT c.supplier, c.name, s.contact_name, s.contact_email, 'CONFLICT-MINERALS', '', 'Conflict Minerals Reporting Template, company level', '', c.state FROM v_supplier_cmrt c JOIN suppliers s ON s.id=c.supplier_id WHERE c.state IN ('missing','expired') ORDER BY 1, 5, 6");
  const open = await db.query('SELECT supplier, regulation, sent_on, reminders FROM v_open_supplier_requests');
  const cl = (await db.query("SELECT value FROM settings WHERE key='candidate_list_updated'"))[0]?.value;
  const company = (await db.query("SELECT value FROM settings WHERE key='company'"))[0]?.value || 'our company';
  const why = { missing: 'we have no declaration on file', expired: 'the declaration we hold has expired', stale: `the declaration we hold is older than the REACH Candidate List update of ${cl}`, };
  const asks = { 'EU-ROHS': 'a RoHS declaration against Directive 2011/65/EU Annex II (as amended by (EU) 2015/863), naming any Annex III or IV exemption relied on and its expiry', 'REACH-SVHC': 'a REACH Article 33 declaration against the current Candidate List, naming any listed substance above 0.1% weight by weight, its concentration and where it is in the part', PROP65: 'a statement of any California Proposition 65 listed chemical in the part', 'CONFLICT-MINERALS': 'a completed Conflict Minerals Reporting Template (current RMI version)' };
  const bySupplier = {};
  for (const g of gaps) (bySupplier[g.supplier] ??= { ...g, items: [] }).items.push(g);
  const written = [];
  for (const [code, s] of Object.entries(bySupplier)) {
    const already = open.filter((r) => r.supplier === code);
    const rules = [...new Set(s.items.map((i) => i.regulation))];
    const lines = [
      `To: ${s.contact_email || '(no email on file)'}`,
      `Subject: ${already.length ? 'Reminder: ' : ''}compliance declarations needed from ${s.name}`,
      '',
      `Hi ${s.contact_name || 'there'},`,
      '',
      `${already.length ? `Following up our request of ${already.map((r) => r.sent_on).join(', ')}. ` : ''}For our customer and regulatory files, please send the following for the parts you supply to ${company}:`,
      '',
      ...rules.map((r) => `- ${asks[r] || r}`),
      '',
      'Parts:',
      ...s.items.map((i) => `- ${i.part_no ? `${i.part_no} (${i.mfr_part_no || 'no manufacturer part number'}) ${i.description}` : i.description}: ${i.regulation}, ${why[i.state] || i.state}`),
      '',
      `Please reply within 14 days. Thank you.`,
    ];
    const file = draftPath(`request-${code.toLowerCase()}-${today()}.md`);
    fs.writeFileSync(file, lines.join('\n') + '\n');
    written.push({ supplier: code, parts: s.items.filter((i) => i.part_no).length, rules: rules.join(' '), draft: path.relative(process.env.OUTPUT_DIR || REPO_ROOT, file), already_requested: already.length > 0 });
  }
  return written;
}

async function certificate(db, o, actor) {
  const p = await matchProduct(db, o.product);
  const r = await matchRule(db, o.rule);
  const st = (await db.query('SELECT * FROM v_product_rule WHERE product_id=$1 AND regulation=$2', [p.id, r.code]))[0];
  if (!st) throw Error(`${r.code} does not apply to ${p.code} in its markets (${p.markets.join(', ')})`);
  if (!CERTIFIABLE.includes(st.status)) {
    const why = await db.query("SELECT part_no, state FROM v_part_rule WHERE regulation=$1 AND state NOT IN ('compliant','compliant_exemption','contains_listed') AND part_id IN (SELECT part_id FROM bom WHERE product_id=$2) ORDER BY part_no", [r.code, p.id]);
    throw Error(`Cannot certify ${p.code} for ${r.code}: status is ${st.status}.${why.length ? '\n' + why.map((w) => `${w.part_no}: ${w.state}`).join('\n') : ''}`);
  }
  const cr = o['customer-request'] ? await byId(db, 'customer_requests', o['customer-request'], 'customer request') : null;
  const subs = r.code === 'EU-ROHS' ? [] : await db.query("SELECT DISTINCT s.name, s.cas, pr.part_no, ds.concentration_ppm FROM v_part_rule pr JOIN declaration_substances ds ON ds.declaration_id=pr.declaration_id JOIN substances s ON s.id=ds.substance_id JOIN bom b ON b.part_id=pr.part_id WHERE b.product_id=$1 AND pr.regulation=$2 AND pr.state='contains_listed' ORDER BY s.name", [p.id, r.code]);
  const exemptions = await db.query('SELECT DISTINCT exemption, exemption_expires FROM v_part_rule pr JOIN bom b ON b.part_id=pr.part_id WHERE b.product_id=$1 AND pr.regulation=$2 AND pr.declared=\'compliant_exemption\'', [p.id, r.code]);
  const to = need(o.to || cr?.customer, 'to');
  const subText = subs.map((s) => `${s.name}${s.cas ? ` (CAS ${s.cas})` : ''} in ${s.part_no}${s.concentration_ppm ? ` at ${Number(s.concentration_ppm)} ppm` : ''}`).join('; ') || null;
  const row = (await db.query('INSERT INTO certificates(product_id,regulation,issued_to,status_at_issue,substances,customer_request_id,actor) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [p.id, r.code, to, st.status, subText, cr?.id || null, actor]))[0];
  if (cr) await db.query("UPDATE customer_requests SET status='answered', outcome=$1 WHERE id=$2", [`certificate ${row.id.slice(0, 8)} issued`, cr.id]);
  await audit(db, 'certificate', p.code, 'certificate issued', actor, null, row, need(o.evidence ?? `issued to ${to}`, 'evidence'));
  const company = (await db.query("SELECT value FROM settings WHERE key='company'"))[0]?.value || '';
  const statement = {
    compliant: `Based on declarations from our suppliers for every part in this product, ${p.name} (${p.code}) meets ${r.name}.`,
    compliant_exemption: `Based on declarations from our suppliers for every part in this product, ${p.name} (${p.code}) meets ${r.name}, relying on the exemptions listed below.`,
    contains_listed: `${p.name} (${p.code}) contains the substances listed below. This statement gives the information required to use the product safely.`,
  }[st.status];
  const html = page({ title: `Compliance statement: ${r.name}`, subtitle: `${p.code} ${p.name} for ${to}`, sections: [
    { title: 'Statement', html: `<p>${esc(statement)}</p><p>Issued by ${esc(company)} on ${esc(row.issued_on)}. Reference ${esc(row.id.slice(0, 8))}.</p>` },
    { title: 'Product', html: htmlRecord({ product: p.code, name: p.name, markets: p.markets.join(', '), rule: r.code, source: r.source, parts_checked: st.parts }) },
    ...(subs.length ? [{ title: 'Listed substances', html: htmlTable(subs) }] : []),
    ...(exemptions.length ? [{ title: 'Exemptions relied on', html: htmlTable(exemptions) }] : []),
  ] });
  const file = draftPath(`certificate-${p.code.toLowerCase()}-${r.code.toLowerCase()}-${row.id.slice(0, 8)}.html`);
  fs.writeFileSync(file, html);
  return { ...row, product: p.code, draft: path.relative(process.env.OUTPUT_DIR || REPO_ROOT, file) };
}

// ------------------------------------------------------------ run
export async function run(db, cmd, o = {}, args = []) {
  if (cmd === 'help') return commands.map((c) => ({ command: c }));
  if (reads[cmd]) return db.query(reads[cmd]);
  if (cmd === 'weekly-review') return weeklyReview(db);
  if (cmd === 'show') {
    const p = await matchProduct(db, o.product ?? args[0]);
    return {
      product: p.code, name: p.name, markets: p.markets.join(', '), owner: p.owner, scip_ref: p.scip_ref,
      rules: await db.query('SELECT regulation, status, parts, unknown_parts, failing_parts, listed_parts, exemption_parts FROM v_product_rule WHERE product_id=$1 ORDER BY regulation', [p.id]),
      parts: await db.query("SELECT pr.part_no, pr.supplier, pr.regulation, pr.state, pr.exemption, pr.received_on FROM v_part_rule pr JOIN bom b ON b.part_id=pr.part_id WHERE b.product_id=$1 ORDER BY pr.part_no, pr.regulation", [p.id]),
      certificates: await db.query('SELECT regulation, issued_to, issued_on, status_at_issue FROM certificates WHERE product_id=$1 ORDER BY issued_on DESC', [p.id]),
    };
  }
  if (cmd === 'part') {
    const p = await matchPart(db, o.part ?? args[0]);
    return {
      part: p.part_no, description: p.description, mfr_part_no: p.mfr_part_no, mass_g: p.mass_g,
      rules: await db.query('SELECT regulation, state, declared, exemption, exemption_expires, received_on, valid_until, document_ref FROM v_part_rule WHERE part_id=$1 ORDER BY regulation', [p.id]),
      substances: await db.query('SELECT d.regulation, s.name, s.cas, x.concentration_ppm, x.location, d.received_on FROM declaration_substances x JOIN declarations d ON d.id=x.declaration_id JOIN substances s ON s.id=x.substance_id WHERE d.part_id=$1 ORDER BY d.received_on DESC', [p.id]),
      history: await db.query('SELECT regulation, status, received_on, source, document_ref, actor FROM declarations WHERE part_id=$1 ORDER BY received_on DESC', [p.id]),
      used_in: await db.query('SELECT pd.code, pd.name, b.qty FROM bom b JOIN products pd ON pd.id=b.product_id WHERE b.part_id=$1 ORDER BY pd.code', [p.id]),
    };
  }
  if (cmd === 'where-used') {
    if (o.substance) {
      const s = await matchSubstance(db, o.substance);
      return db.query('SELECT DISTINCT pd.code AS product, p.part_no, d.regulation, x.concentration_ppm, x.location, d.received_on FROM declaration_substances x JOIN declarations d ON d.id=x.declaration_id JOIN parts p ON p.id=d.part_id JOIN bom b ON b.part_id=p.id JOIN products pd ON pd.id=b.product_id WHERE x.substance_id=$1 ORDER BY 1, 2', [s.id]);
    }
    if (o.supplier) {
      const s = await matchSupplier(db, o.supplier);
      return db.query('SELECT pd.code AS product, p.part_no, p.description FROM parts p JOIN bom b ON b.part_id=p.id JOIN products pd ON pd.id=b.product_id WHERE p.supplier_id=$1 ORDER BY 1, 2', [s.id]);
    }
    const p = await matchPart(db, o.part ?? args[0]);
    return db.query('SELECT pd.code AS product, pd.name, b.qty, array_to_string(pd.markets, \' \') AS markets FROM bom b JOIN products pd ON pd.id=b.product_id WHERE b.part_id=$1 ORDER BY 1', [p.id]);
  }
  if (cmd === 'export') {
    const out = path.resolve(o.out || path.join(REPO_ROOT, 'exports'));
    fs.mkdirSync(out, { recursive: true });
    const written = [];
    for (const t of TABLES) {
      const rows = await db.query(`SELECT * FROM ${t}`);
      fs.writeFileSync(path.join(out, `${t}.json`), JSON.stringify(rows, null, 2));
      written.push({ table: t, rows: rows.length });
    }
    return written;
  }
  if (cmd === 'draft-requests') return draftRequests(db);

  // ---- writes: every one names who did it and is recorded in activity
  const actor = need(o.actor, 'actor');
  if (cmd === 'import') {
    if ((args[0] || o.from || '').toLowerCase() !== 'assent') throw Error('import supports: assent (a part-level compliance report saved as CSV)');
    return importAssent(db, o, actor);
  }
  return tx(db, async () => {
    if (cmd === 'add') {
      const kind = need(o.kind, 'kind');
      let row;
      if (kind === 'supplier') row = (await db.query('INSERT INTO suppliers(code,name,contact_name,contact_email,country,supplies_3tg) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [need(o.code, 'code').toUpperCase(), need(o.name, 'name'), o.contact || null, o.email || null, o.country || null, o['3tg'] === 'yes']))[0];
      else if (kind === 'part') {
        const s = o.supplier ? await matchSupplier(db, o.supplier) : null;
        row = (await db.query('INSERT INTO parts(part_no,description,supplier_id,mfr_part_no,category,mass_g) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [need(o.code, 'code'), need(o.name, 'name'), s?.id || null, o.mpn || null, o.category || null, o.mass !== undefined ? num(o.mass, 'mass') : null]))[0];
      } else if (kind === 'product') row = (await db.query('INSERT INTO products(code,name,markets,owner) VALUES($1,$2,$3,$4) RETURNING *', [need(o.code, 'code'), need(o.name, 'name'), list(o.markets).map((m) => m.toUpperCase()), o.owner || null]))[0];
      else throw Error('--kind must be supplier, part or product');
      await audit(db, kind, row.code || row.part_no, 'add', actor, null, row, o.evidence);
      return row;
    }
    if (cmd === 'update') {
      const kind = need(o.kind, 'kind');
      const t = { supplier: ['suppliers', matchSupplier], part: ['parts', matchPart], product: ['products', matchProduct] }[kind];
      if (!t) throw Error('--kind must be supplier, part or product');
      const old = await t[1](db, o.code);
      const sets = [], vals = [];
      const put = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
      if (o.name !== undefined) put(kind === 'part' ? 'description' : 'name', need(o.name, 'name'));
      if (o.active !== undefined) put('active', o.active === 'yes');
      if (kind === 'supplier') { if (o.contact !== undefined) put('contact_name', o.contact); if (o.email !== undefined) put('contact_email', o.email); if (o.country !== undefined) put('country', o.country); if (o['3tg'] !== undefined) put('supplies_3tg', o['3tg'] === 'yes'); }
      if (kind === 'part') { if (o.supplier !== undefined) put('supplier_id', (await matchSupplier(db, o.supplier)).id); if (o.mpn !== undefined) put('mfr_part_no', o.mpn); if (o.mass !== undefined) put('mass_g', num(o.mass, 'mass')); if (o.category !== undefined) put('category', o.category); }
      if (kind === 'product') { if (o.markets !== undefined) put('markets', list(o.markets).map((m) => m.toUpperCase())); if (o.owner !== undefined) put('owner', o.owner); if (o.scip !== undefined) put('scip_ref', o.scip || null); }
      if (!sets.length) throw Error('Nothing to change');
      vals.push(old.id);
      const row = (await db.query(`UPDATE ${t[0]} SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals))[0];
      await audit(db, kind, row.code || row.part_no, 'update', actor, old, row, need(o.evidence, 'evidence'));
      return row;
    }
    if (cmd === 'bom') {
      const p = await matchProduct(db, o.product);
      const part = await matchPart(db, o.part);
      if (o.remove) {
        const gone = await db.query('DELETE FROM bom WHERE product_id=$1 AND part_id=$2 RETURNING *', [p.id, part.id]);
        if (!gone.length) throw Error(`${part.part_no} is not in ${p.code}`);
        await audit(db, 'bom', p.code, `remove ${part.part_no}`, actor, gone[0], null, need(o.evidence, 'evidence'));
        return { product: p.code, removed: part.part_no };
      }
      const row = (await db.query('INSERT INTO bom(product_id,part_id,qty) VALUES($1,$2,$3) ON CONFLICT(product_id,part_id) DO UPDATE SET qty=excluded.qty RETURNING *', [p.id, part.id, o.qty !== undefined ? num(o.qty, 'qty') : 1]))[0];
      await audit(db, 'bom', p.code, `add ${part.part_no}`, actor, null, row, o.evidence);
      return { product: p.code, part: part.part_no, qty: row.qty };
    }
    if (cmd === 'declare') {
      const part = await matchPart(db, o.part);
      const r = await matchRule(db, o.rule);
      if (r.scope !== 'part') throw Error(`${r.code} is answered per supplier: use cmrt`);
      const status = need(o.status, 'status').toLowerCase().replace(/[\s-]+/g, '_');
      if (!STATUSES.includes(status)) throw Error(`--status must be one of ${STATUSES.join(', ')}`);
      if (status === 'compliant_exemption' && !o.exemption) throw Error('Name the exemption relied on: --exemption="Annex III 6(c) ..."');
      const subs = parseSubstances(o.substances);
      if (status === 'contains_listed' && !subs.length) throw Error('Say which substances: --substances="Lead=25000@brass body"');
      const resolved = [];
      for (const s of subs) resolved.push({ ...s, sub: await matchSubstance(db, s.name) });
      if (r.code === 'EU-ROHS' && status === 'compliant') {
        const over = resolved.filter((s) => s.sub.rohs_limit_ppm !== null && s.ppm !== null && s.ppm > s.sub.rohs_limit_ppm);
        if (over.length) throw Error(`Not compliant as declared: ${over.map((s) => `${s.sub.name} ${s.ppm} ppm over the ${s.sub.rohs_limit_ppm} ppm limit`).join('; ')}. Use --status=non_compliant or name the exemption.`);
      }
      const received = o.received ? date(o.received, 'received') : today();
      if (received > today()) throw Error('A declaration cannot be received in the future');
      const row = (await db.query('INSERT INTO declarations(part_id,regulation,status,exemption,exemption_expires,received_on,valid_until,document_ref,source,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
        [part.id, r.code, status, o.exemption || null, o['exemption-expires'] ? date(o['exemption-expires'], 'exemption-expires') : null, received, o['valid-until'] ? date(o['valid-until'], 'valid-until') : null, need(o.document, 'document'), o.source || 'supplier', actor]))[0];
      for (const s of resolved) await db.query('INSERT INTO declaration_substances(declaration_id,substance_id,concentration_ppm,location) VALUES($1,$2,$3,$4)', [row.id, s.sub.id, s.ppm, s.location]);
      // Close a supplier request once every part it asked about has an answer received since it went out.
      const closed = [];
      for (const req of await db.query("SELECT * FROM supplier_requests WHERE supplier_id=$1 AND regulation=$2 AND status IN ('open','escalated') AND $3 = ANY(part_nos)", [part.supplier_id, r.code, part.part_no])) {
        const left = await db.query('SELECT x FROM unnest($1::text[]) x WHERE NOT EXISTS (SELECT 1 FROM declarations d JOIN parts p ON p.id=d.part_id WHERE p.part_no=x AND d.regulation=$2 AND d.received_on>=$3)', [req.part_nos, r.code, req.sent_on]);
        if (!left.length) { await db.query("UPDATE supplier_requests SET status='answered', outcome='All parts declared' WHERE id=$1", [req.id]); closed.push(req.id.slice(0, 8)); }
      }
      await audit(db, 'declaration', part.part_no, `declare ${r.code} ${status}`, actor, null, { ...row, substances: subs }, o.evidence || row.document_ref);
      const state = (await db.query('SELECT state FROM v_part_rule WHERE part_id=$1 AND regulation=$2', [part.id, r.code]))[0]?.state || 'not used in a product sold where this rule applies';
      return { part: part.part_no, rule: r.code, status, state_now: state, requests_closed: closed.join(' ') || 'none' };
    }
    if (cmd === 'cmrt') {
      const s = await matchSupplier(db, o.supplier);
      const reported = num(o.smelters, 'smelters'), conformant = num(o.conformant, 'conformant'), not = num(o['not-conformant'] ?? 0, 'not-conformant');
      if (conformant + not > reported) throw Error('Conformant plus not conformant cannot be more than the smelters reported');
      const received = o.received ? date(o.received, 'received') : today();
      const row = (await db.query('INSERT INTO cmrts(supplier_id,template_version,received_on,scope,smelters_reported,smelters_conformant,smelters_not_conformant,document_ref,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [s.id, o.version || null, received, o.scope || 'company', reported, conformant, not, need(o.document, 'document'), actor]))[0];
      if (!s.supplies_3tg) await db.query('UPDATE suppliers SET supplies_3tg=true WHERE id=$1', [s.id]);
      await db.query("UPDATE supplier_requests SET status='answered', outcome='Template received' WHERE supplier_id=$1 AND regulation='CONFLICT-MINERALS' AND status IN ('open','escalated') AND sent_on<=$2", [s.id, received]);
      await audit(db, 'cmrt', s.code, 'cmrt received', actor, null, row, o.evidence || row.document_ref);
      return (await db.query('SELECT supplier, received_on, valid_until, smelters_reported, smelters_not_conformant, state FROM v_supplier_cmrt WHERE supplier_id=$1', [s.id]))[0];
    }
    if (cmd === 'request') {
      const s = await matchSupplier(db, o.supplier);
      const r = await matchRule(db, o.rule);
      const parts = list(o.parts);
      for (const p of parts) { const found = await matchPart(db, p); if (found.supplier_id !== s.id) throw Error(`${found.part_no} is not supplied by ${s.code}`); }
      const sent = o.sent ? date(o.sent, 'sent') : today();
      const due = o.due ? date(o.due, 'due') : new Date(Date.parse(sent) + 14 * 86400000).toISOString().slice(0, 10);
      if (due < sent) throw Error('Due date is before the send date');
      const row = (await db.query('INSERT INTO supplier_requests(supplier_id,regulation,part_nos,sent_on,due_on,actor) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [s.id, r.code, parts.map((p) => p.toUpperCase()), sent, due, actor]))[0];
      await audit(db, 'supplier_request', s.code, `request ${r.code}`, actor, null, row, need(o.evidence, 'evidence'));
      return row;
    }
    if (cmd === 'remind') {
      const req = await byId(db, 'supplier_requests', o.request, 'request');
      if (!['open', 'escalated'].includes(req.status)) throw Error(`Request is ${req.status}`);
      const escalate = req.reminders + 1 >= 2;
      const row = (await db.query("UPDATE supplier_requests SET reminders=reminders+1, last_reminder=$1, status=$2, due_on=greatest(due_on,$3::date) WHERE id=$4 RETURNING *", [today(), escalate ? 'escalated' : req.status, o.due ? date(o.due, 'due') : plusDays(7), req.id]))[0];
      await audit(db, 'supplier_request', req.id.slice(0, 8), 'reminder', actor, req, row, need(o.evidence, 'evidence'));
      return row;
    }
    if (cmd === 'close-request') {
      const isCustomer = o['customer-request'] !== undefined;
      const t = isCustomer ? 'customer_requests' : 'supplier_requests';
      const req = await byId(db, t, isCustomer ? o['customer-request'] : o.request, isCustomer ? 'customer request' : 'request');
      const status = need(o.status, 'status');
      if (!['answered', 'dropped'].includes(status)) throw Error('--status must be answered or dropped');
      const row = (await db.query(`UPDATE ${t} SET status=$1, outcome=$2 WHERE id=$3 RETURNING *`, [status, need(o.evidence, 'evidence'), req.id]))[0];
      await audit(db, t.slice(0, -1), req.id.slice(0, 8), `close ${status}`, actor, req, row, o.evidence);
      return row;
    }
    if (cmd === 'customer-request') {
      const p = await matchProduct(db, o.product);
      const r = await matchRule(db, o.rule);
      const received = o.received ? date(o.received, 'received') : today();
      const row = (await db.query('INSERT INTO customer_requests(customer,product_id,regulation,received_on,due_on,actor) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [need(o.customer, 'customer'), p.id, r.code, received, date(o.due, 'due'), actor]))[0];
      await audit(db, 'customer_request', p.code, `customer request ${r.code}`, actor, null, row, o.evidence);
      const st = (await db.query('SELECT status FROM v_product_rule WHERE product_id=$1 AND regulation=$2', [p.id, r.code]))[0];
      return { ...row, product: p.code, current_status: st?.status || `${r.code} does not apply in ${p.code}'s markets` };
    }
    if (cmd === 'certificate') return certificate(db, o, actor);
    if (cmd === 'candidate-update') {
      const d = date(o.date, 'date');
      const old = (await db.query("SELECT * FROM settings WHERE key='candidate_list_updated'"))[0];
      await db.query("INSERT INTO settings(key,value,note) VALUES('candidate_list_updated',$1,'Date of the last ECHA Candidate List update') ON CONFLICT(key) DO UPDATE SET value=excluded.value", [d]);
      await audit(db, 'settings', 'candidate_list_updated', 'candidate list update', actor, old || null, { value: d }, need(o.evidence, 'evidence'));
      const stale = await db.query("SELECT supplier, count(*)::int AS parts FROM v_part_rule WHERE regulation='REACH-SVHC' AND state='stale' GROUP BY supplier ORDER BY supplier");
      return { candidate_list_updated: d, suppliers_to_resurvey: stale.length, parts_now_stale: stale.reduce((a, s) => a + s.parts, 0), by_supplier: stale };
    }
    if (cmd === 'log') {
      const ref = need(o.ref, 'ref');
      await audit(db, o.kind || 'note', ref, 'note', actor, null, { note: need(o.note, 'note') }, o.evidence || 'note');
      return (await db.query('SELECT * FROM activity ORDER BY id DESC LIMIT 1'))[0];
    }
    throw Error(`Unknown command "${cmd}". Run help.`);
  });
}

// ------------------------------------------------------------ command line
const FLAGS = new Set(['json', 'actor', 'evidence', 'kind', 'code', 'name', 'contact', 'email', 'country', '3tg', 'supplier', 'mpn', 'category', 'mass', 'markets', 'owner', 'scip', 'active', 'product', 'part', 'qty', 'remove', 'rule', 'status', 'exemption', 'exemption-expires', 'received', 'valid-until', 'document', 'source', 'substances', 'substance', 'version', 'scope', 'smelters', 'conformant', 'not-conformant', 'parts', 'sent', 'due', 'request', 'customer-request', 'customer', 'to', 'date', 'ref', 'note', 'file', 'map', 'dry-run', 'out', 'from']);
const BOOL = new Set(['json', 'remove', 'dry-run']);
export function parse(argv) {
  const args = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args.push(a); continue; }
    const [k, ...rest] = a.slice(2).split('=');
    if (!FLAGS.has(k)) throw Error(`Unknown flag --${k}`);
    if (BOOL.has(k)) { if (rest.length) throw Error(`--${k} takes no value`); o[k] = true; continue; }
    o[k] = rest.length ? rest.join('=') : argv[++i];
    if (o[k] === undefined || o[k].startsWith('--')) throw Error(`Missing value for --${k}`);
  }
  return { cmd: args.shift() || 'help', args, o };
}
function display(result) {
  if (Array.isArray(result) && result.length && typeof result[0] !== 'object') return result.map((x) => `  ${x}`).join('\n');
  if (Array.isArray(result)) return result.length ? table(result, Object.keys(result[0]).map((key) => ({ key, label: key, width: 70, format: (v) => (v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : Array.isArray(v) ? v.join(' ') : v && typeof v === 'object' ? JSON.stringify(v) : v) }))) : '  (none)';
  return Object.entries(result).map(([k, v]) => (v instanceof Date ? `${k}: ${v.toISOString()}` : Array.isArray(v) ? `\n${k}\n${display(v)}` : v && typeof v === 'object' ? `\n${k}\n${display(v)}` : `${k}: ${v}`)).join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    const { cmd, args, o } = parse(process.argv.slice(2));
    db = await getDb();
    const result = await run(db, cmd, o, args);
    console.log(o.json ? JSON.stringify(result, null, 2) : display(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
