---
description: Where a part, a substance or a supplier is used across the products.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document.

Run:

```bash
npm run comply -- where-used --part=<part> | --substance=<name or CAS> | --supplier=<code>
```

Use this when a supplier says a part has changed, or a substance is added to a list.

Never send anything, never delete records, never change another system.
