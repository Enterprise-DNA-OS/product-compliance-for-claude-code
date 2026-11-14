---
description: Record a compliance request from a customer for one product and rule, with its due date.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- customer-request --customer="<name>" --product=<code> --rule=<rule> --due=YYYY-MM-DD --actor="<name>"
```

The result shows whether the product can be certified today. If not, run `show` and say what is missing.

Never send anything, never delete records, never change another system.
