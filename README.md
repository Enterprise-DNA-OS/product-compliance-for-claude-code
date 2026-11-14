<h1 align="center">Product Compliance for Claude Code</h1>

<p align="center">
  <strong>The open-source product compliance system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Assent data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=assent">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/assent?utm_source=github&utm_medium=readme&utm_campaign=assent">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-assent">Instead of Assent</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Product Compliance for Claude Code does the job you pay Assent for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Assent dashboard cannot.

Assent publishes no price: it is sold by quote after a demo, and its product compliance page lists no figures ([assent.com](https://www.assent.com/solutions/product-compliance/), checked 14 November 2026). Your renewal is the number that counts.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=assent).

It holds your products, their bills of materials, your parts and suppliers, and what every supplier has declared about every part. From those it works out, for each product and each market it sells into, whether you can certify it under RoHS, REACH (Candidate List substances and SCIP), California Proposition 65 and conflict minerals reporting, and which part and which supplier is holding it back. It is for the quality or compliance manager at a manufacturer or importer in New Zealand or Australia who answers customer compliance requests and exports into Europe or the US.

## The compliance year as commands

| When | Ask Claude Code | What it runs |
|---|---|---|
| A customer asks | "Can we give Nordlicht a REACH statement for the bollard?" | `/customer-request`, `/status`, `/certificate` |
| A supplier answers | "Formosa sent the RoHS declaration for the 40 W driver" | `/declare`, `/cmrt` |
| Every Monday | "What needs me this week?" | `/weekly-review` |
| ECHA updates the Candidate List | "ECHA added substances today; who do we resurvey?" | `/candidate-update`, `/gaps`, `/draft-requests` |
| A supplier changes a part | "Where is the brass fitting used, and what changes?" | `/where-used`, `/part`, `/log` |
| Each quarter | "Which exemptions run out, and which products need a new part?" | `/exemptions`, `/conflict-minerals` |

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/product-compliance-for-claude-code.git
cd product-compliance-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/weekly-review`. The demo is a fictional Auckland maker of outdoor lighting selling into Europe, the UK, California and home: one floodlight held back by a cable gland with DEHP over the RoHS limit, a bollard with lead in a brass fitting and no SCIP notification, two LED modules declared before the last Candidate List update, an exemption running out in four months, a supplier whose conflict minerals template is a year old, and a German customer waiting on an answer this week.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/weekly-review` | The Monday review: what needs a person, which products are not clear to certify, and who owes us an answer. |
| `/attention` | Everything in product compliance that needs a person now. |
| `/status` | Every product against every rule that applies in its markets: compliant, compliant with an exemption, contains a listed substance, unknown or non-compliant. |
| `/show` | One product in full: its status under each rule, every part and the state of its declaration, and the certificates issued. |
| `/part` | One part in full: its state under each rule, the substances declared, the declaration history and where it is used. |
| `/gaps` | Declarations missing, expired, or older than the last REACH Candidate List update, by supplier. |
| `/svhc` | Candidate List substances above 0.1% weight by weight in any part of an active product, with the SCIP notification status. |
| `/exemptions` | RoHS exemptions relied on, when each expires and which products use the part. |
| `/conflict-minerals` | Conflict Minerals Reporting Templates from every supplier whose parts carry tin, tantalum, tungsten or gold: current, out of date, or naming smelters that are not conformant. |
| `/requests` | Open requests out to suppliers, oldest due date first, with reminders sent. |
| `/customer-requests` | Compliance requests from customers, open ones first, with their due dates. |
| `/certificates` | Every compliance statement issued, to whom and on what status. |
| `/where-used` | Where a part, a substance or a supplier is used across the products. |
| `/rules` | The rules this system checks, the markets they apply in and their sources. |
| `/products` | List every product with its markets, owner, SCIP reference and part count. |
| `/parts` | List every part with its supplier and manufacturer part number. |
| `/suppliers` | List every supplier with its contact and whether its parts carry 3TG metals. |
| `/activity` | The last 100 changes: who recorded what, and the evidence they gave. |
| `/declare` | Record a supplier declaration, lab test or own assessment for a part under one rule. |
| `/cmrt` | Record a Conflict Minerals Reporting Template received from a supplier. |
| `/request` | Record that a person sent a supplier a request for declarations. |
| `/remind` | Record a reminder sent to a supplier. The second reminder marks the request escalated. |
| `/close-request` | Close a supplier request or a customer request as answered or dropped. |
| `/customer-request` | Record a compliance request from a customer for one product and rule, with its due date. |
| `/certificate` | Issue a compliance statement for one product and rule, written to drafts/ as a branded page. Refused when the records do not support it. |
| `/candidate-update` | Record that ECHA has updated the REACH Candidate List. Every older REACH declaration becomes stale and needs a new one. |
| `/add` | Add a supplier, a part or a product. |
| `/update` | Change a supplier, part or product: name, contact, supplier, markets, owner, SCIP reference, active. |
| `/bom` | Add a part to a product, change its quantity, or take it out. |
| `/log` | Add a note against a part, product or supplier (a supplier call, a change notice, a test booked). |
| `/import` | Bring parts, suppliers and declarations across from an Assent part-level compliance report saved as CSV. |
| `/export` | Export every record to JSON files the business keeps. |
| `/draft-requests` | Write one request email per supplier that owes a declaration or a conflict minerals template, into drafts/. Nothing is sent. |
| `/help` | Every CLI command. |
| `/docs` | Render the branded documents: a compliance file per product, the REACH Article 33 sheet for products with a listed substance, and the request sheet for each supplier that owes declarations. |
| `/view` | Render the read-only dashboards: this week, product status by rule, and suppliers. |
| `/compliance` | Check the records against the record controls in docs/compliance.md. |
| `/customise` | Add a field, a market, a rule or a substance in plain language; writes and tests the migration. |
| `/new-view` | Add a read-only dashboard page from a plain-language description. |

## Instead of Assent

Export your part-level compliance report from Assent to CSV (one row per part, with its supplier, its status under each rule and the declaration date), then:

```bash
npm run comply -- import assent --file=imports/assent-parts.csv --actor="Your name" --dry-run
npm run comply -- import assent --file=imports/assent-parts.csv --actor="Your name"
```

Columns are matched by name and statuses by meaning. Pending or unknown statuses are reported, not saved, so those parts show as missing and get chased. A value the import does not recognise stops it with the row named, a failed import leaves nothing behind, and the same file twice records nothing new. Full steps and what does not carry over: [docs/replace-assent.md](docs/replace-assent.md).

## Ten questions this build answers

Each is a real command on the demo data.

1. Which of our products can we certify for RoHS today, and which parts stop the rest? `status`, then `show`
2. Which parts went stale when ECHA last updated the Candidate List, and which suppliers do we chase? `gaps`
3. Which products contain a Candidate List substance above 0.1%, and do we have a SCIP number for each? `svhc`
4. Which RoHS exemptions expire in the next six months, and which products use those parts? `exemptions`
5. If the rules on lead tighten, which products and parts are affected? `where-used --substance=lead`
6. If one supplier stops answering, which of our products does it touch? `where-used --supplier=DRVR`
7. Which suppliers carry tin, tantalum, tungsten or gold and have no current conflict minerals template? `conflict-minerals`
8. Which customer requests are due this week, and can we answer each one today? `weekly-review`
9. Which supplier requests are overdue, and how many times have we chased each one? `requests`
10. Which declarations have no document behind them? `compliance`

## Your first hour: ten things to ask for

1. Put our company name, logo and colours on the compliance file and the certificates.
2. Add our products, the markets each one sells into, and their bills of materials from our ERP export.
3. Test our Assent export without saving it, then load it.
4. Set the date of the last REACH Candidate List update.
5. Which products can we certify for RoHS today?
6. Write the request emails for every supplier that owes us a declaration.
7. Add PFAS as a rule for products sold in the EU.
8. Add the substances ECHA added in the last update to the list.
9. Nordlicht wants a REACH statement for the bollard by Friday: can we give it?
10. Write the Monday note for the quality team.

`/customise` writes, tests and applies the database change for any of these. `/new-view` adds a read-only dashboard page. There is no application front end.

## Documents, views and record checks

Change `brand.json` once. `npm run docs` renders a compliance file for every product, the REACH Article 33 sheet for every product with a listed substance, and a request sheet for every supplier that owes declarations, as branded HTML. `npm run view` renders this week, product status by rule, and suppliers as read-only pages. Print to PDF from the browser. `/certificate` writes a compliance statement to `drafts/` and refuses when the records do not support it. The rules and their sources: [docs/compliance.md](docs/compliance.md). Nothing here is legal advice.

## Verification

`npm test` runs every one of the 35 CLI commands on a throwaway database: the roll-up from parts to products, RoHS limits, Candidate List staleness, SVHC and SCIP, exemptions, conflict minerals, supplier and customer requests, certificates that refuse, the Assent import (dry run, mapping, unknown statuses, rollback, repeat runs), drafts, documents, views and escaped HTML. It passes on the embedded database and on PostgreSQL 17 (`TEST_DATABASE_URL` must name an empty, disposable database). CI defines Node 20 and 22 on Linux and Windows.

## Architecture

```
product-compliance-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Product Compliance for Claude Code for your business, migrates your Assent data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=assent)
- Read more: [enterprisedna.co/omni/instead-of/assent](https://enterprisedna.co/omni/instead-of/assent?utm_source=github&utm_medium=readme&utm_campaign=assent)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
