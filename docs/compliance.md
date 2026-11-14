# Rules and sources

This file records the rules the system checks and where each comes from. It is not legal advice. Check the live text of each rule, and the current substance lists, before you rely on an answer. When a rule changes, change this file, the `regulations` and `substances` tables (with `/customise`) and the views together.

## The rules products are checked against

| Code | What the system checks | Source |
|---|---|---|
| EU-ROHS | Every part in a product sold in the EU or UK has a current RoHS declaration. A substance declared above its Annex II limit fails the part unless an exemption is named. Limits: 0.1% by weight in a homogeneous material for lead, mercury, hexavalent chromium, PBB, PBDE, DEHP, BBP, DBP and DIBP; 0.01% for cadmium. | Directive 2011/65/EU, Annex II, as amended by Commission Delegated Directive (EU) 2015/863. UK: The Restriction of the Use of Certain Hazardous Substances in Electrical and Electronic Equipment Regulations 2012. Exemptions: Annexes III and IV of the Directive. |
| REACH-SVHC | Every part in a product sold in the EU has a REACH declaration made after the last Candidate List update. A Candidate List substance above 0.1% weight by weight in a part is reported, with what the customer needs to use the product safely. | Regulation (EC) No 1907/2006 (REACH), Article 33(1), and Article 33(2) for consumer requests (45 days). The Candidate List is published by ECHA and updated during the year. |
| SCIP | A product sold in the EU that contains a Candidate List substance above 0.1% has a SCIP notification reference. | Directive 2008/98/EC (Waste Framework Directive), Article 9(1)(i): suppliers of articles provide the Article 33(1) information to ECHA. |
| PROP65 | Every part in a product sold in California has a statement of any Proposition 65 listed chemical. A part containing one means the product needs a clear and reasonable warning, unless an exemption applies. | California Health and Safety Code section 25249.6; the list is published by OEHHA. |
| CONFLICT-MINERALS | Every supplier whose parts carry tin, tantalum, tungsten or gold has sent a Conflict Minerals Reporting Template in the last 12 months, and every smelter it names is conformant. | Customers ask under the Dodd-Frank Act section 1502 (SEC Rule 13p-1, Form SD) and Regulation (EU) 2017/821. The template is the Responsible Minerals Initiative's CMRT. The 12 months is house policy: the template is reissued each year. |

## Record controls (`npm run comply -- compliance`)

| Rule | What the check finds | Source |
|---|---|---|
| declaration has no document | A declaration recorded without the supplier document, lab report or file behind it. | House policy: every answer to a customer traces to evidence. |
| listed substance declared without detail | A "contains a listed substance" declaration with no substance named. Article 33 needs at least the substance's name. | REACH Article 33(1). |
| RoHS limit exceeded but declared compliant | A substance figure above its Annex II limit on a declaration marked compliant. | Directive 2011/65/EU Annex II. |
| certificate issued while not compliant | A statement given to a customer when the records said unknown or non-compliant. | House policy. The `certificate` command refuses these; this finds any made another way. |
| part with no supplier, product with no parts | Records that cannot be checked. | House policy. |
| Candidate List date not set | No date for the last Candidate List update, so REACH declarations cannot be checked for staleness. | House policy, following ECHA's Candidate List updates. |

## What the dates mean

- **Stale**: a REACH declaration received before the Candidate List date in `settings`. Record each ECHA update with `candidate-update`.
- **Expired**: a declaration past its `valid_until`, when the supplier gave one.
- **Exemption expiring**: an exemption expiry within 180 days. Exemption expiry dates differ by exemption and by equipment category; record the one that applies to your product from the Annex.
