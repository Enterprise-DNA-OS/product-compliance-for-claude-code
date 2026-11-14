---
description: Record a reminder sent to a supplier. The second reminder marks the request escalated.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- remind --request=<id prefix> [--due=YYYY-MM-DD] --evidence="how it was sent" --actor="<name>"
```

Never send anything, never delete records, never change another system.
