---
description: Check the records against the rules and record controls in docs/compliance.md and report what is failing, missing, stale or about to expire, with the rule cited.
---

1. Read `docs/compliance.md`. It lists every rule, the source it comes from, and what each check finds.
2. Run the record controls and the rule checks:

```bash
npm run comply -- compliance
npm run comply -- attention
```

3. Report as a table: rule, count, the worst example, the source. Order: failing first (non-compliant parts, non-conformant smelters, a certificate issued while not compliant), then missing, expired and stale, then expiring within 180 days, then clean.
4. For each finding, draft the fix the operator can approve: the declaration to record, the supplier to chase (`/draft-requests`, drafts only), the SCIP notification to file, the part to replace.
5. If a rule or a substance list in `docs/compliance.md` looks out of date, say so and stop. Do not guess at law. The operator confirms the live source, then you update the doc and the tables together with `/customise`.

Nothing here is legal advice. Never send anything, never delete records.
