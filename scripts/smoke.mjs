// npm test: a throwaway database, migrate, seed, run every command, check the rules. PASS or a failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compliance-'));
process.env.DATA_DIR = path.join(tmp, 'db');
process.env.OUTPUT_DIR = tmp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { getDb, REPO_ROOT } = await import('./lib/db.mjs');
const { migrate } = await import('./migrate.mjs');
const { seed } = await import('./seed.mjs');
const { run, commands, parse, date, statusOf, parseSubstances } = await import('./comply.mjs');

const db = await getDb();
const covered = new Set();
const call = async (c, o = {}, args = []) => { covered.add(c); return run(db, c, o, args); };
const actor = 'Test officer';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const st = (rows, product, rule) => rows.find((r) => r.product === product && r.regulation === rule)?.status;
const cli = (args, expected = 0) => {
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(r.status, expected, r.stderr || r.stdout);
  return r;
};

try {
  if (db.mode === 'postgres') {
    const existing = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(existing.length, 0, 'TEST_DATABASE_URL must be empty and disposable');
  }
  await migrate(db);
  assert.equal((await migrate(db)).ran.length, 0, 'migrate is idempotent');
  await seed(db);
  await seed(db);

  // ---- reads on the demo data
  assert.equal((await call('help')).length, commands.length);
  assert.equal((await call('products')).length, 3);
  assert.equal((await call('parts')).length, 13);
  assert.equal((await call('suppliers')).length, 6);
  assert.equal((await call('rules')).length, 4);

  let status = await call('status');
  assert.equal(status.length, 11, 'rules apply only where a product is sold');
  assert.equal(st(status, 'FL-200', 'EU-ROHS'), 'non_compliant', 'one failing part fails the product');
  assert.equal(st(status, 'CTRL-1', 'EU-ROHS'), 'compliant_exemption');
  assert.equal(st(status, 'CTRL-1', 'REACH-SVHC'), 'contains_listed');
  assert.equal(st(status, 'CTRL-1', 'CONFLICT-MINERALS'), 'non_compliant', 'non-conformant smelters fail the product');
  assert.equal(st(status, 'BL-40', 'REACH-SVHC'), 'unknown', 'a stale declaration makes the product unknown');
  assert.equal(st(status, 'BL-40', 'PROP65'), undefined, 'BL-40 is not sold in California');

  const gaps = await call('gaps');
  assert.deepEqual(gaps.filter((g) => g.state === 'stale').map((g) => g.part_no).sort(), ['P-1001', 'P-1002']);
  assert.ok(gaps.some((g) => g.part_no === 'P-2002' && g.state === 'expired'));
  assert.equal(gaps.filter((g) => g.part_no === 'P-7001').length, 3, 'new part missing all three part rules');

  const svhc = await call('svhc');
  assert.equal(svhc.length, 2);
  assert.equal(svhc.find((s) => s.product === 'BL-40').scip, 'NOT NOTIFIED');
  const ex = await call('exemptions');
  assert.equal(ex[0].part_no, 'P-5001');
  assert.equal(Number(ex[0].days_left), 120);
  const cm = await call('conflict-minerals');
  assert.deepEqual(cm.map((c) => `${c.supplier}:${c.state}`).sort(), ['DRVR:expired', 'LUMA:compliant', 'PCBA:not_conformant_smelters']);

  const att = await call('attention');
  const issues = new Set(att.map((a) => a.issue));
  for (const want of ['non-compliant part', 'missing declaration', 'expired declaration', 'stale after Candidate List update', 'exemption expiring', 'conflict minerals template', 'supplier request overdue', 'customer request due', 'SCIP notification missing']) assert.ok(issues.has(want), `attention shows ${want}`);
  assert.equal(att.length, 14);
  const comp = await call('compliance');
  assert.equal(comp.length, 1);
  assert.equal(comp[0].rule, 'declaration has no document');

  const reqs = await call('requests');
  assert.equal(reqs.length, 3);
  assert.equal((await call('customer-requests')).length, 2);
  assert.equal((await call('certificates')).length, 1);
  assert.equal((await call('where-used', { substance: 'lead' })).length, 4, 'lead in P-6001 for REACH and Prop 65 across two products');
  assert.deepEqual((await call('where-used', { part: 'P-6001' })).map((r) => r.product), ['BL-40', 'CTRL-1']);
  assert.equal((await call('where-used', { supplier: 'DRVR' })).length, 3);
  const show = await call('show', {}, ['FL-200']);
  assert.equal(show.rules.length, 4);
  const part = await call('part', { part: 'P-4002' });
  assert.equal(part.substances.length, 2);
  const wk = await call('weekly-review');
  assert.equal(wk.attention.length, 14);
  assert.equal(wk.customer_requests[0].current_status, 'unknown');

  // ---- matching
  await assert.rejects(() => call('show', { product: 'light' }), /Ambiguous product/);
  assert.equal((await call('show', { product: 'bollard' })).product, 'BL-40');
  await assert.rejects(() => call('part', { part: 'driver' }), /Ambiguous part/);
  await assert.rejects(() => call('part', { part: 'nope' }), /No part/);

  // ---- certificates refuse what the records do not support
  await assert.rejects(() => call('certificate', { product: 'FL-200', rule: 'rohs', to: 'Anyone', actor }), /Cannot certify FL-200[\s\S]*P-4002: non_compliant/);
  await assert.rejects(() => call('certificate', { product: 'BL-40', rule: 'prop65', to: 'Anyone', actor }), /does not apply/);
  const cert = await call('certificate', { product: 'CTRL-1', rule: 'reach', to: 'Nordlicht Grosshandel GmbH', actor });
  assert.equal(cert.status_at_issue, 'contains_listed');
  assert.match(cert.substances, /Lead \(CAS 7439-92-1\) in P-6001 at 25000 ppm/);
  assert.match(fs.readFileSync(path.join(tmp, cert.draft), 'utf8'), /Article|substances listed/);

  // ---- declarations
  const writeErr = [
    [{ part: 'P-2002', rule: 'rohs', status: 'compliant', document: 'x.pdf' }, /actor/],
    [{ part: 'P-2002', rule: 'rohs', status: 'fine', document: 'x.pdf', actor }, /status must be/],
    [{ part: 'P-2002', rule: 'rohs', status: 'compliant_exemption', document: 'x.pdf', actor }, /exemption/],
    [{ part: 'P-2002', rule: 'reach', status: 'contains_listed', document: 'x.pdf', actor }, /substances/],
    [{ part: 'P-2002', rule: 'rohs', status: 'compliant', document: 'x.pdf', substances: 'Cadmium=150@solder', actor }, /over the 100 ppm limit/],
    [{ part: 'P-2002', rule: 'rohs', status: 'compliant', document: 'x.pdf', received: day(3), actor }, /future/],
    [{ part: 'P-2002', rule: 'cmrt', status: 'compliant', document: 'x.pdf', actor }, /use cmrt/],
    [{ part: 'P-2002', rule: 'rohs', status: 'compliant', actor }, /--document/],
  ];
  for (const [o, re] of writeErr) await assert.rejects(() => call('declare', o), re);
  let d = await call('declare', { part: 'P-2002', rule: 'rohs', status: 'compliant', document: 'FD-RoHS-040-v2.pdf', 'valid-until': day(700), actor });
  assert.equal(d.state_now, 'compliant');
  assert.equal(d.requests_closed, 'none', 'P-7001 is still owed on that request');
  d = await call('declare', { part: 'P-7001', rule: 'rohs', status: 'compliant', document: 'FD-SPD-RoHS.pdf', actor });
  assert.equal(d.requests_closed.length, 8, 'request closes when every part on it is answered');
  status = await call('status');
  assert.equal(st(status, 'BL-40', 'EU-ROHS'), 'compliant_exemption');
  d = await call('declare', { part: 'P-4002', rule: 'rohs', status: 'compliant', document: 'SCG-M20-new-seal.pdf', substances: 'DEHP=300@new TPE seal', evidence: 'Supplier changed the seal compound', actor });
  d = await call('declare', { part: 'P-7001', rule: 'reach', status: 'compliant', document: 'FD-SPD-REACH.pdf', actor });
  d = await call('declare', { part: 'P-7001', rule: 'prop65', status: 'compliant', document: 'FD-SPD-P65.pdf', actor });
  d = await call('declare', { part: 'P-1001', rule: 'reach', status: 'compliant', document: 'LUMA-REACH-now.pdf', actor });
  status = await call('status');
  assert.equal(st(status, 'FL-200', 'EU-ROHS'), 'compliant');
  assert.equal(st(status, 'FL-200', 'REACH-SVHC'), 'compliant');
  await call('declare', { part: 'P-1002', rule: 'reach', status: 'contains_listed', substances: 'Bisphenol A@lens coating', document: 'LUMA-REACH-40.pdf', actor });
  assert.ok((await call('svhc')).some((s) => s.part_no === 'P-1002' && s.concentration_ppm === null), 'present with no figure is still reported');

  // ---- conflict minerals
  await assert.rejects(() => call('cmrt', { supplier: 'DRVR', smelters: 10, conformant: 9, 'not-conformant': 2, document: 'x.xlsx', actor }), /more than/);
  const c = await call('cmrt', { supplier: 'DRVR', version: '6.5', smelters: 40, conformant: 40, document: 'FD-CMRT-2026.xlsx', actor });
  assert.equal(c.state, 'compliant');
  assert.equal(st(await call('status'), 'FL-200', 'CONFLICT-MINERALS'), 'compliant');
  assert.equal((await call('requests')).length, 1, 'the CMRT closed its request');

  // ---- requests and reminders
  await assert.rejects(() => call('request', { supplier: 'FAST', rule: 'rohs', parts: 'P-1001', evidence: 'emailed', actor }), /not supplied by FAST/);
  const r = await call('request', { supplier: 'LUMA', rule: 'reach', parts: 'P-1002', sent: day(-20), due: day(-6), evidence: 'Emailed Grace', actor });
  await call('remind', { request: r.id.slice(0, 8), evidence: 'Emailed again', actor });
  const r2 = await call('remind', { request: r.id.slice(0, 8), evidence: 'Called Grace', actor });
  assert.equal(r2.status, 'escalated');
  assert.equal(r2.reminders, 2);
  await call('close-request', { request: r.id.slice(0, 8), status: 'dropped', evidence: 'Part being replaced', actor });
  await assert.rejects(() => call('remind', { request: r.id.slice(0, 8), evidence: 'x', actor }), /dropped/);

  // ---- customer requests answered with a certificate
  const cr = await call('customer-request', { customer: 'Bay Area Site Lighting', product: 'CTRL-1', rule: 'prop65', due: day(10), actor });
  assert.equal(cr.current_status, 'contains_listed');
  const cert2 = await call('certificate', { product: 'CTRL-1', rule: 'prop65', 'customer-request': cr.id.slice(0, 8), actor });
  assert.equal(cert2.issued_to, 'Bay Area Site Lighting');
  assert.equal((await call('customer-requests')).find((x) => x.id === cr.id).status, 'answered');
  const nord = (await call('customer-requests')).find((x) => x.customer.startsWith('Nordlicht'));
  await call('close-request', { 'customer-request': nord.id.slice(0, 8), status: 'answered', evidence: 'Sent Article 33 sheet', actor });

  // ---- Candidate List update makes older REACH declarations stale
  const cu = await call('candidate-update', { date: day(0), evidence: 'ECHA added substances today', actor });
  assert.ok(cu.parts_now_stale >= 8);
  assert.equal(st(await call('status'), 'CTRL-1', 'REACH-SVHC'), 'unknown');
  const drafts = await call('draft-requests');
  assert.ok(drafts.length >= 4);
  const luma = fs.readFileSync(path.join(tmp, drafts.find((x) => x.supplier === 'FAST').draft), 'utf8');
  assert.match(luma, /dave@onehungafasteners\.example/);
  assert.match(luma, /REACH Article 33/);
  assert.doesNotMatch(luma, /\u2014/, 'no em dashes in drafts');

  // ---- add, update, bom, log
  await call('add', { kind: 'supplier', code: 'nova', name: 'Nova Optics', email: 'qa@nova.example', '3tg': 'yes', actor });
  await call('add', { kind: 'part', code: 'P-8001', name: 'Optic lens 60 degree', supplier: 'NOVA', mass: 12, actor });
  await call('add', { kind: 'product', code: 'WL-10', name: 'Wall light 10 W', markets: 'eu,nz', actor });
  await assert.rejects(() => call('add', { kind: 'widget', actor }), /kind/);
  await call('bom', { product: 'WL-10', part: 'P-8001', qty: 2, actor });
  await call('bom', { product: 'WL-10', part: 'P-6002', actor });
  status = await call('status');
  assert.equal(st(status, 'WL-10', 'EU-ROHS'), 'unknown');
  assert.equal(st(status, 'WL-10', 'CONFLICT-MINERALS'), 'unknown', 'a 3TG supplier with no template');
  await call('bom', { product: 'WL-10', part: 'P-6002', remove: true, evidence: 'Screws changed', actor });
  await assert.rejects(() => call('bom', { product: 'WL-10', part: 'P-6002', remove: true, evidence: 'x', actor }), /not in/);
  await call('update', { kind: 'product', code: 'BL-40', scip: 'demo-scip-2', evidence: 'Notified ECHA', actor });
  assert.equal((await call('svhc')).find((s) => s.product === 'BL-40').scip, 'demo-scip-2');
  await call('update', { kind: 'part', code: 'P-8001', mpn: 'NV-60', evidence: 'Datasheet', actor });
  await call('update', { kind: 'supplier', code: 'NOVA', contact: 'Ana', evidence: 'New contact', actor });
  await assert.rejects(() => call('update', { kind: 'part', code: 'P-8001', evidence: 'x', actor }), /Nothing to change/);
  await call('log', { ref: 'P-8001', note: 'Supplier says new lens resin from March', actor });

  // ---- the Assent import
  const csv = path.join(tmp, 'assent.csv');
  fs.writeFileSync(csv, [
    'Part Number,Part Description,Supplier Name,Manufacturer Part Number,RoHS Status,RoHS Exemption,REACH Status,SVHC,Prop 65 Status,Declaration Date,Document',
    `P-9001,Heatsink,Ranui Castings,RC-HS1,Compliant,,Compliant (no SVHC),,,${day(-5)},hs.pdf`,
    `P-9002,Gasket EPDM,New Seals Ltd,NS-G1,Compliant with Exemption,Annex III 6(c),Contains SVHC,DEHP=1500@gasket,Unknown,${day(-5)},g.pdf`,
    `P-9003,Label,New Seals Ltd,NS-L1,Pending,,,,,${day(-5)},`,
  ].join('\n'));
  const dry = await call('import', { file: csv, 'dry-run': true, actor }, ['assent']);
  assert.equal(dry.parts_created, 3);
  assert.equal(dry.declarations, 4);
  assert.equal(dry.unknown.length, 2, 'Pending and Unknown are reported, not saved');
  await assert.rejects(() => call('part', { part: 'P-9001' }), /No part/, 'dry run leaves nothing');
  const imp = await call('import', { file: csv, actor }, ['assent']);
  assert.equal(imp.suppliers_created, 1);
  assert.equal((await call('import', { file: csv, actor }, ['assent'])).unchanged, 4, 'second run changes nothing');
  assert.equal((await call('part', { part: 'P-9002' })).substances[0].concentration_ppm !== null, true);
  const bad = path.join(tmp, 'bad.csv');
  fs.writeFileSync(bad, `Part Number,RoHS Status,Declaration Date\nROLL-1,Compliant,${day(-1)}\nROLL-2,Sort of,${day(-1)}\n`);
  await assert.rejects(() => call('import', { file: bad, actor }, ['assent']), /not recognised/);
  await assert.rejects(() => call('part', { part: 'ROLL-1' }), /No part/, 'a failed import leaves nothing behind');
  const mapped = path.join(tmp, 'mapped.csv');
  fs.writeFileSync(mapped, `Our part,Our RoHS,When\nMAP-1,Compliant,${day(-2)}\n`);
  fs.writeFileSync(path.join(tmp, 'map.json'), JSON.stringify({ part: 'Our part', rohs: 'Our RoHS', date: 'When' }));
  assert.equal((await call('import', { file: mapped, map: path.join(tmp, 'map.json'), actor }, ['assent'])).declarations, 1);
  await assert.rejects(() => call('import', { file: csv, actor }, ['excel']), /supports/);
  assert.equal((await call('import', { file: path.join(REPO_ROOT, 'fixtures', 'assent-export.csv'), 'dry-run': true, actor }, ['assent'])).rows_read, 3, 'the shipped example imports');

  // ---- helpers
  assert.equal(date('14/11/2026', 'd'), '2026-11-14');
  assert.throws(() => date('31/02/2026', 'd'), /real date/);
  assert.equal(statusOf('Compliant with Exemption(s)'), 'compliant_exemption');
  assert.equal(statusOf('Non-Compliant'), 'non_compliant');
  assert.equal(statusOf('No Data'), null);
  assert.equal(statusOf('Maybe'), undefined);
  assert.deepEqual(parseSubstances('Lead=1,200@body; DEHP'), [{ name: 'Lead', ppm: 1200, location: 'body' }, { name: 'DEHP', ppm: null, location: null }]);
  assert.throws(() => parse(['status', '--oops']), /Unknown flag/);
  assert.throws(() => parse(['show', '--product']), /Missing/);

  const exported = await call('export', { out: path.join(tmp, 'exports') });
  assert.equal(exported.length, 15);
  assert.ok((await call('activity')).length > 20);
  assert.deepEqual(commands.filter((x) => !covered.has(x)), [], 'every command exercised');
  await db.close();

  cli(['scripts/view.mjs']);
  cli(['scripts/docs.mjs']);
  assert.equal(fs.readdirSync(path.join(tmp, 'views')).length, 3);
  assert.ok(fs.readdirSync(path.join(tmp, 'docs-out', 'compliance-file')).length >= 4);
  assert.ok(fs.readdirSync(path.join(tmp, 'docs-out', 'article-33')).length >= 1);
  const { page, table } = await import('./lib/render.mjs');
  assert.match(page({ title: '<x>', sections: [{ title: 'T', html: table([{ a: '<script>x</script>' }]) }] }), /&lt;script&gt;/);
  assert.equal(JSON.parse(cli(['scripts/comply.mjs', 'products', '--json']).stdout).length, 4);
  assert.match(cli(['scripts/comply.mjs', 'show', '--product=light'], 1).stderr, /Ambiguous/);
  console.log(`PASS: ${commands.length} CLI commands; product roll-ups, RoHS limits, REACH Candidate List staleness, SVHC and SCIP, exemptions, conflict minerals, supplier and customer requests, certificates, the Assent import, rollback, drafts, views and documents checked (${process.env.TEST_DATABASE_URL ? 'PostgreSQL' : 'PGlite'}).`);
} finally {
  try { await db.close(); } catch {}
  fs.rmSync(tmp, { recursive: true, force: true });
}
