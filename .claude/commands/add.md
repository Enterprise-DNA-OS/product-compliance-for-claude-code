---
description: Add a supplier, a part or a product.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- add --kind=supplier --code=<CODE> --name="<name>" [--email=] [--contact=] [--country=] [--3tg=yes]
npm run comply -- add --kind=part --code=<part no> --name="<description>" --supplier=<code> [--mpn=] [--mass=<grams>]
npm run comply -- add --kind=product --code=<code> --name="<name>" --markets=EU,UK,US-CA,AU --actor="<name>"
```

Then add its parts with `/bom`.

Never send anything, never delete records, never change another system.
