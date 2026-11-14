---
description: Issue a compliance statement for one product and rule, written to drafts/ as a branded page. Refused when the records do not support it.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- certificate --product=<code> --rule=<rule> --to="<customer>" [--customer-request=<id>] --actor="<name>"
```

If it is refused, say which parts block it and offer to chase them. The statement is a draft for a person to check and send; never send it.

Never send anything, never delete records, never change another system.
