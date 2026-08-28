---
name: prose-tells
description: Use when a written text is about to leave the session and must be audited against a named catalogue of AI tells — a README, a post, an email, a commit body, a PR description, docs, a landing page. Locates each tell by name and fixes it in place. NOT writing UI microcopy or CTAs from scratch (that is `copywriting`), NOT defining a reusable voice (that is `brand`).
kind: skill
od:
  category: creative-direction
  triggers:
    - sounds like AI
    - make this sound human
    - unslop
    - audit this text
    - "does this read as AI"
  craft:
    requires:
      - anti-slop
---

## The pass

1. **Scan against the tables below.** Every hit gets *located*, not sensed. If you cannot name the
   tell, it is not a finding.
2. **Rewrite in place.** Preserve meaning, facts, numbers, links, commitments and intended tone.
3. **Put the voice back** (next section). A text stripped of tells and nothing else reads sterile,
   which is its own tell.
4. **Self-audit once more.** Ask what still makes this obviously machine-written, and fix that too.
5. **Return the text.** On request, return the named hit list alongside it.

## Removing tells is half the job

- **Have an opinion.** React to the facts instead of listing balanced pros and cons.
- **Vary the rhythm.** Short sentence. Then a longer one that takes its time and earns the length.
- **Admit complexity.** "Impressive and slightly unsettling" beats "impressive".
- **Use "I" when it fits.** First person is not unprofessional.
- **Be specific.** Not "this is concerning" but "it churns for six hours at 3am and nobody is watching".

## Content tells

| Tell | Fix |
|---|---|
| Puffery: "pivotal moment", "testament to", "evolving landscape" | State what happened |
| Decorative `-ing` clauses: "highlighting…", "ensuring…", "showcasing…" | Delete, or expand into a real claim |
| Promotional adjectives: "vibrant", "breathtaking", "renowned", "must-visit" | Neutral description |
| Vague attribution: "experts believe", "reports suggest" | Name the source or cut the claim |
| The challenge arc: "despite challenges, X continues to thrive" | The specific facts instead |

## Language tells

| Tell | Fix |
|---|---|
| AI vocabulary: additionally, crucial, delve, foster, garner, interplay, intricate, landscape, pivotal, showcase, tapestry, testament, underscore | The plain word |
| Fancy ways to say "is": serves as, stands as, boasts, features | is, has |
| "Not just X, but Y" | State the point directly |
| Rule of three — forcing every list to three items | The number the facts have |
| Synonym cycling in one paragraph | Pick one word and repeat it |
| False ranges: "from X to Y" where X and Y share no scale | List the items |
| Abstract metaphor nouns: substrate, vector, locus, nexus, primitive, bedrock, scaffolding, flywheel, north star | The concrete word |

## Style and punctuation tells

| Tell | Fix |
|---|---|
| Em dashes as connectors | End the sentence, or use a comma. Parentheses trade one tell for another |
| Colons mid-sentence | Let the point be its own sentence. Colons are for lists and examples |
| Bold on every proper noun and acronym | Bold what the reader must not miss, nothing else |
| Inline-header lists whose bold label restates the line | Prose. A bold lead-in followed by genuinely new detail is fine |
| Title Case Headings | Sentence case |
| Decorative emoji in headings and bullets | Remove |

## Filler and hedging

| Tell | Fix |
|---|---|
| "In order to", "due to the fact that", "it is important to note that" | "To", "because", delete |
| Stacked hedges: "could potentially possibly be argued" | "may", or the claim itself |
| Generic conclusion: "the future looks bright" | A specific plan, date or number |
| Chatbot phrases: "I hope this helps", "certainly", "great question" | Remove |
| Sycophancy: "you're absolutely right" | Answer directly |
| Feeling instead of mechanism: "the database stays close at hand" | The mechanism or the number |
| A sentence that would fit unchanged in another project's docs | Cut it. It says nothing about this one |
| Passive with a hidden actor: "queries are validated" | Name the actor |
| Adverbs propping up weak verbs: "significantly improves" | A stronger verb or the measured number |
| Fancy synonyms: utilize, leverage, facilitate, numerous, in the event that | use, use, help, many, if |

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| "This feels AI-written" with no named tell | Unfalsifiable, so the author cannot act on it |
| Stripping every tell and stopping | Produces sterile text — a tell of its own |
| Rewriting the meaning while removing the tell | The audit is not a licence to change what was said |
| Swapping em dashes for parentheses | Same tell, different punctuation |
| Running this on code or on a spec | Those want precision, not voice |
