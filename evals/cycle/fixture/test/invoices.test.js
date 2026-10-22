import test from "node:test";
import assert from "node:assert/strict";
import { invoiceTotal } from "../src/invoices.js";

test("invoiceTotal sums quantity × unit price over the lines", () => {
  const invoice = {
    id: "INV-1",
    date: "2026-03-01",
    customer: "Acme",
    lines: [{ quantity: 2, unitPrice: 50 }, { quantity: 1, unitPrice: 25 }],
  };
  assert.equal(invoiceTotal(invoice), 125);
});
