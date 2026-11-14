---
description: Every product against every rule that applies in its markets: compliant, compliant with an exemption, contains a listed substance, unknown or non-compliant.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document.

Run:

```bash
npm run comply -- status
```

Lead with the products that are non-compliant or unknown and say why (run `show` for one product to name the parts).

Never send anything, never delete records, never change another system.
