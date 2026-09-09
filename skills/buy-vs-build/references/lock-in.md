# Lock-in mitigation, customization risk, and the alternatives landscape

Loaded when a verdict is heading toward a vendor, or when the answer needs a landscape of
alternatives rather than a single call.

---

## Bounded buy

Thoughtworks Technology Radar, **Trial**, November 2018 —
https://www.thoughtworks.com/radar/techniques/bounded-buy

> *"Only select vendor products that are modular and decoupled and can be contained within the
> Bounded Context of a single business capability."*

This is the technique behind the `bounded-buy` verdict. It is not "buy carefully" — it is a
structural constraint on which products are eligible at all. A product that cannot be contained
within one business capability's boundary fails the technique regardless of its feature list.

It exists to prevent the **Vendor King** anti-pattern: the product's data model, workflow and release
cadence become the organisation's, and every capability nearby gets pulled into its orbit.

> The name **Vendor King** is verified only from the e-book's own text. A standalone Radar blip page
> for it is **UNVERIFIED** — do not cite one.

## Mitigations, in the order they are worth doing

1. **Loosely couple.** *"put it behind an API to limit direct exposure."* This is the floor, not the
   ceiling: with the vendor behind your own interface, replacing it is a project; without it,
   replacing it is a rewrite.
2. **Flexible pricing options.** A contract whose cost scales with a dimension you do not control is
   its own kind of lock-in.
3. **Open networks and open architecture.** Prefer products that speak standards you could speak to
   something else.

---

## Two checks from Fowler's `PackageCustomization`

https://martinfowler.com/bliki/PackageCustomization.html

**Customization volume is a risk signal.** Fowler cites a case reaching roughly **300,000 lines** of
customization — at which point the package is a platform someone is writing an application on, and
the buy verdict has quietly become a build with a licence fee attached. Ask early what the expected
customization volume is; if nobody can bound it, that is a finding.

**The upgrade trap.** Customization is paid for again at every upgrade:

> *"a prohibitive amount of work involved in doing the upgrade because the customizations will
> break"*

And the reason it hurts more inside a package than in your own code: packages typically lack version
control, testing and deployment pipelines around the customized parts. So:

- Prefer **API-based extension** over modification inside the package.
- Treat "how do we upgrade this once we have customized it" as a criterion, answered before signing,
  not after.

---

## Alternatives landscape — Thoughtworks radar rings

https://www.thoughtworks.com/en-us/radar/faq

Use this vocabulary when the output is a landscape of options rather than one verdict. There is **no
scoring formula** — ring placement is deliberative, and inventing a numeric threshold for it would be
inventing a method the source does not have.

| Ring | Meaning |
|---|---|
| **Adopt** | *"seriously consider using"* — proven and mature |
| **Trial** | *"ready for use, but not as completely proven as those in the Adopt ring"* |
| **Assess** | *"look at closely, but not necessarily trial yet"* |
| **Caution** | *"even though they may be accepted in the industry, we haven't had a good experience with"* |

**Say Caution, not Hold.** The fourth ring was renamed in Vol 34 (April 2026). Verified twice: from
the FAQ, and from the BYOR README — *"The fourth ring name has been changed from Hold to Caution in
the recent release."*

Quadrants, when the landscape needs sorting by kind: **Techniques · Platforms · Tools · Languages and
Frameworks**.
