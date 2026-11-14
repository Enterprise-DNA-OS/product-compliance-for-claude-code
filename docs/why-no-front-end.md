# Why there is no front end

Assent is a database of your parts, your suppliers and what each supplier has said, with a portal and dashboards on top. The records underneath are ordinary: parts, suppliers, products, declarations, a few lists of restricted substances. The questions are ordinary too: can we certify this product, who has not answered, what changes now that ECHA has added a substance.

That layer used to be the whole product, because getting at the records took a specialist. It does not any more. Open this folder in Claude Code, ask, and it runs the query and explains the answer, including the questions the dashboard never had a chart for.

## What you gain

- **Answers per product, not per part.** A customer asks about a product. The roll-up from parts to product is a view, and the certificate is refused when the records do not support it.
- **No seats and no per-supplier fees.** Everyone who needs to look can look.
- **Your records in your Postgres.** Plain tables. Back them up, query them from anything, leave any time.
- **Rules you can read.** Every rule and its source is in `docs/compliance.md`, and every limit is a row you can see.

## What you give up

- **A supplier portal.** Suppliers answer by email; a person records the answer. `/draft-requests` writes the chasers.
- **A regulatory content team.** You update the rules and substance lists when they change. `/customise` does the database side.
- **A phone app and drag-and-drop screens.** It runs where Claude Code runs.

## Who this fits

Manufacturers and importers who answer RoHS, REACH, Proposition 65 and conflict minerals questions from customers, and who run it today from spreadsheets or pay for more platform than they use. If you need thousands of suppliers answering through a portal, keep a portal. If you need the answers, this is yours.

Installed and run for you: https://enterprisedna.co/omni/instead-of/assent
