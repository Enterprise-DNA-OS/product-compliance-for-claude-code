---
description: Bring parts, suppliers and declarations across from an Assent part-level compliance report saved as CSV.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- import assent --file=imports/assent-parts.csv --dry-run --actor="<name>"
```

Always run with `--dry-run` first and show the counts, the statuses reported as unknown and anything not recognised. Run again without `--dry-run` only after the operator says yes. If the columns are named differently, write a map file (`{"part":"Item","rohs":"RoHS"}`) and pass `--map=`. See docs/replace-assent.md.

Never send anything, never delete records, never change another system.
