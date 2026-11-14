---
description: Record that a person sent a supplier a request for declarations.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- request --supplier=<code> --rule=<rule> [--parts=P-1,P-2] [--sent=YYYY-MM-DD] [--due=YYYY-MM-DD] --evidence="how it was sent" --actor="<name>"
```

Record a request only after a person has sent it. Default due date is 14 days after sending.

Never send anything, never delete records, never change another system.
