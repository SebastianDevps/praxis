# invoices-fixture — project rules

- Node 20+, ESM, named exports only; no dependencies.
- Tests: `node --test` under `test/`; one test file per module in `src/`.
- Dates are ISO `YYYY-MM-DD` strings and are compared as strings; never build `Date` objects to compare them.
