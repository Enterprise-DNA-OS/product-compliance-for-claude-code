---
description: Compliance requests from customers, open ones first, with their due dates.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document.

Run:

```bash
npm run comply -- customer-requests
```

For each open one, run `status` for that product and rule and say whether a certificate can be issued today.

Never send anything, never delete records, never change another system.
