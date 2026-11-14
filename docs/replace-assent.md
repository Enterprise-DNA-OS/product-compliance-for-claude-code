# Moving off Assent

Assent holds your parts, your suppliers and what each supplier has declared. Product Compliance for Claude Code holds the same three things in a database you own. The move is a part-level report out of Assent, saved as CSV, and one import.

## 1. Export the part-level report

From Assent's reporting, export the list of your parts with their compliance status under each rule, their supplier and the date of the last declaration. Save it as CSV. One row per part:

```csv
Part Number,Part Description,Supplier Name,Manufacturer Part Number,RoHS Status,RoHS Exemption,REACH Status,SVHC,Prop 65 Status,Declaration Date,Document
P-6001,Brass cable fitting,Onehunga Fasteners,OF-BR-M20,Compliant with Exemption,Annex III 6(c),Contains SVHC,Lead=25000@brass body,Contains listed chemical,2026-09-12,OF-brass-decl.pdf
```

See `fixtures/assent-export.csv`. Report layouts differ between accounts and change over time, so the import matches columns by name and never assumes positions.

## 2. Map the columns

Common column names are matched case-insensitively (`Part Number`, `Part No`; `Supplier Name`, `Vendor`; `RoHS Status`; `REACH Status`; `Declaration Date`, `Response Date`). Anything else goes in a field map, as in `fixtures/field-map.json`, passed with `--map=`.

Statuses are read by meaning:

| Status says | Becomes |
|---|---|
| compliant, pass, no SVHC, not present | compliant |
| compliant with exemption | compliant with an exemption (the `RoHS Exemption` column names it) |
| non-compliant, not compliant, fail | non-compliant |
| contains, SVHC present, warning required | contains a listed substance (the `SVHC` column names them: `Lead=25000@brass body; DEHP`) |
| pending, unknown, no data, requested | not saved: reported as unknown, so it shows as missing and gets chased |

Any other value stops the import with the row named. Nothing is guessed.

## 3. Test, then import

```bash
npm run comply -- import assent --file=imports/assent-parts.csv --actor="Your name" --dry-run
npm run comply -- import assent --file=imports/assent-parts.csv --actor="Your name"
```

The dry run shows parts and suppliers it would create, declarations it would record and statuses it would leave as unknown, and saves nothing. A failed import leaves nothing behind. Running the same file twice records nothing new.

## 4. Products and bills of materials

Assent's part report does not carry your products. Add each product with its markets and its parts:

```bash
npm run comply -- add --kind=product --code=FL-200 --name="Floodlight 200 W" --markets=EU,UK,US-CA,AU --actor="Your name"
npm run comply -- bom --product=FL-200 --part=P-1001 --actor="Your name"
```

Or ask Claude Code to load your bill of materials from your ERP's CSV export.

## 5. Conflict minerals and the Candidate List date

Record each supplier's latest CMRT with `cmrt` (smelter counts from its Smelter List tab), and set the date of the last Candidate List update with `candidate-update`.

## What does not carry over

- The supplier portal and the automated chasing. Here `/draft-requests` writes the emails and a person sends them.
- Assent's regulatory content team and its substance database. You keep the rules and lists in `docs/compliance.md` and the `substances` table, and update them when ECHA, OEHHA or the EU change them.
- Full material declarations (every substance in every part). This build records the restricted and listed substances that answer customers and regulators.
- Attachments. Keep the documents where they are; the declaration records the file name or reference.
