---
description: The Monday review: what needs a person, which products are not clear to certify, and who owes us an answer.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document.

Run:

```bash
npm run comply -- weekly-review
```

Write it as a short note: the three things to act on this week first (a customer due date, a failing part, an overdue supplier), then the detail. Offer `/draft-requests` if suppliers owe declarations.

Never send anything, never delete records, never change another system.
