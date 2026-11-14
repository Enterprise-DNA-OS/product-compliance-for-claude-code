---
description: Record that ECHA has updated the REACH Candidate List. Every older REACH declaration becomes stale and needs a new one.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- candidate-update --date=YYYY-MM-DD --evidence="what was added" --actor="<name>"
```

Ask for the date and the substances added (from the ECHA Candidate List page). Add any new substance to the substances table with `/customise` first, then run this, then `/draft-requests`.

Never send anything, never delete records, never change another system.
