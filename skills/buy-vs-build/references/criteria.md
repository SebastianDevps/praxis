# Criteria sets — Thoughtworks build-vs-buy

All four sets and the TCO rules below are reproduced from Thoughtworks, *"Build vs. buy: A strategic
framework for evaluating third-party solutions"* (2022) —
https://www.thoughtworks.com/content/dam/thoughtworks/documents/e-book/tw_ebook_build_vs_buy_2022.pdf

Thoughtworks sells build-side consulting. The e-book's "shift toward build" thesis is advocacy; these
criteria tables are product-neutral, which is why they are the part that got imported.

**Use them as checklists.** Every criterion resolves to `PASS` · `FAIL` · `SKIP` (with the reason it
could not be checked) · `GAP` (it ran and had nothing to fail against). Nothing is averaged. A
criterion nobody could answer stays visible as `SKIP` — that is the whole reason these are lists and
not a scoring sheet.

---

## Seven stakeholder groups

Who has to answer before the verdict is written. A verdict signed by engineering alone is missing
six of these.

- Finance
- Product managers
- End users (or a proxy)
- Engineers
- Infrastructure and IT operations
- Back-office operations
- Compliance and security

---

## 18 developer-experience criteria

How much it costs a team to live with the thing after it is chosen.

| | |
|---|---|
| Web API | Push/streaming API |
| Data accessibility | Batch API |
| Technical documentation | Querying |
| Versioning | Backwards compatibility |
| Command line interface | Client library |
| Experiment support | Integration |
| Upgrade strategy | Environment options |
| Multitenancy | Open standards |
| Community | Optionality |

---

## 7 technical-needs criteria

- Availability
- Performance
- Accessibility
- Compliance
- User experience
- Disaster recovery
- Support availability

Two rules travel with this set and are the reason it is not decorative:

> *"Ideally, you'll want to assign metrics and service levels to each one"*

and the consistency requirement — SaaS, on-prem and custom builds are evaluated

> *"over a consistent set of criteria including (but not limited to) availability, resiliency,
> recoverability, service-level agreements (SLAs) and cost."*

A criterion without a number attached is `SKIP`, not a soft pass.

---

## 5 operability criteria

What running it in an organisation actually requires.

- User account management
- Teams and groups
- Settings management
- Audit
- Reporting

---

## 9 vendor criteria

Buying a product is buying the company behind it for as long as you depend on it.

- Trajectory
- Influence
- Financial stability
- Size
- Technology culture alignment
- Culture
- Transparency
- Access
- Quality of support

---

## 4 TCO / ROI rules

1. **Own the process.** The evaluation is yours, not the vendor's; a vendor-run comparison is a
   sales artefact.
2. **Consider how strategy may shift** — *"plan for strategic obsolescence and reduce the expected
   lifetime."* A ten-year TCO on a capability whose strategy turns over in three is a fiction.
3. **Get a complete view of acquisition costs.** Licence, integration, migration, training, the
   internal team the rollout consumes.
4. **Factor in ongoing support and maintenance.** The cost that outlives the decision.
