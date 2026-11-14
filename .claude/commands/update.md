---
description: Change a supplier, part or product: name, contact, supplier, markets, owner, SCIP reference, active.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- update --kind=supplier|part|product --code=<code> [--name=] [--markets=] [--scip=] [--supplier=] [--active=yes|no] --evidence="why" --actor="<name>"
```

Never send anything, never delete records, never change another system.
