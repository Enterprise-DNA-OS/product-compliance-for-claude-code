---
description: Render the branded documents: a compliance file per product, the REACH Article 33 sheet for products with a listed substance, and the request sheet for each supplier that owes declarations.
---

Run:

```bash
npm run docs [-- compliance-file|article-33|supplier-request]
```

Change `brand.json` once for the business name, logo and colours. Output is HTML in `docs-out/`; print to PDF from the browser. Say which files were written. Nothing is sent.
