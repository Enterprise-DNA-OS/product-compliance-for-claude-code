---
description: Record a Conflict Minerals Reporting Template received from a supplier.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- cmrt --supplier=<code> --version=6.5 --smelters=<n> --conformant=<n> [--not-conformant=<n>] --document="<file>" [--received=YYYY-MM-DD] --actor="<name>"
```

Take the smelter counts from the template's Smelter List tab, checked against the RMI conformant list.

Never send anything, never delete records, never change another system.
