---
description: Add a part to a product, change its quantity, or take it out.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- bom --product=<code> --part=<part> [--qty=<n>] [--remove --evidence="why"] --actor="<name>"
```

Never send anything, never delete records, never change another system.
