// Invoice helpers. One module, named exports, no dependencies.
export function invoiceTotal(invoice) {
  return invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}
