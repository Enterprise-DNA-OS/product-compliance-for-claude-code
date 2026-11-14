---
description: Write one request email per supplier that owes a declaration or a conflict minerals template, into drafts/. Nothing is sent.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document.

Run:

```bash
npm run comply -- draft-requests
```

Show the operator each draft. After a person sends one, record it with `/request`.

Never send anything, never delete records, never change another system.
