---
description: Record a supplier declaration, lab test or own assessment for a part under one rule.
---

Read CLAUDE.md first. Add `--json` when you need to work with the result. Resolve product, part and supplier names with `products`, `parts` and `suppliers`; if a name matches more than one, show the candidates and ask. Never invent a declaration, a figure, a date, an actor or a document. Every change needs `--actor` (the person asking) and is recorded in the activity trail. Say back what you are about to record in one line before you run it.

Run:

```bash
npm run comply -- declare --part=<part> --rule=rohs|reach|prop65 --status=compliant|compliant_exemption|non_compliant|contains_listed --document="<file or reference>" [--received=YYYY-MM-DD] [--valid-until=YYYY-MM-DD] [--exemption="Annex III 6(c) ..." --exemption-expires=YYYY-MM-DD] [--substances="Lead=25000@brass body;DEHP=2500@seal"] [--source=supplier|lab_test|own_assessment] --actor="<name>"
```

Read the supplier document first and take every figure from it. A RoHS "compliant" with a substance over its limit is refused: the declaration is wrong or an exemption applies. The command closes a supplier request once every part on it is answered.

Never send anything, never delete records, never change another system.
