# Product Compliance for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| "What needs me this week?", the Monday review | `/weekly-review` |
| "What is overdue, stale or failing?" | `/attention` |
| Can we certify a product, under which rules | `/status` |
| Everything about one product | `/show` |
| Everything about one part | `/part` |
| Who owes us a declaration | `/gaps` |
| Candidate List substances, SCIP | `/svhc` |
| RoHS exemptions and their expiry | `/exemptions` |
| Conflict minerals templates and smelters | `/conflict-minerals` |
| Open supplier requests | `/requests` |
| Customer requests | `/customer-requests` |
| Statements already issued | `/certificates` |
| Where a part, substance or supplier is used | `/where-used` |
| Which rules apply where | `/rules` |
| Lists of products, parts, suppliers | `/products`, `/parts`, `/suppliers` |
| A supplier sent a declaration, or a lab test came back | `/declare` |
| A supplier sent a CMRT | `/cmrt` |
| A person sent a supplier a request | `/request` |
| A person chased a supplier | `/remind` |
| Close a supplier or customer request | `/close-request` |
| A customer asked for a statement | `/customer-request` |
| Give a customer a compliance statement | `/certificate` |
| ECHA updated the Candidate List | `/candidate-update` |
| A new supplier, part or product | `/add` |
| Change a supplier, part or product | `/update` |
| Add or remove a part on a product | `/bom` |
| A note on a part, product or supplier | `/log` |
| Who changed what | `/activity` |
| Record controls | `/compliance` |
| Bring data across from Assent | `/import` |
| Take every record out | `/export` |
| Write the supplier chasers | `/draft-requests` |
| Branded documents | `/docs` |
| Read-only dashboards | `/view` |
| Add a field, market, rule or substance | `/customise` |
| A new dashboard page | `/new-view` |
| Every CLI command | `/help` |

If an ask fits nothing here, run the CLI directly (`npm run comply -- help`) and then propose a new command for it.

## Hard rules

- Never tell anyone a product is compliant unless `status` says so. A certificate comes from `/certificate`, which refuses when the records do not support it.
- Every figure in a declaration comes from the supplier's document or a lab report. Never fill a concentration, a date or an exemption from memory.
- Rules and substance lists change. If an ask depends on the current Candidate List, an exemption's expiry or a new rule, say what the records hold and ask the operator to confirm the live source. Nothing here is legal advice.

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Assent.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/assent
