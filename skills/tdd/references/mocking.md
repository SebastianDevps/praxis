# When to mock

Reference for `tdd`. Mock at **system boundaries** only:

- External APIs (payment, email, ...)
- Databases (sometimes — prefer a test database or a local stand-in)
- Time and randomness
- The file system (sometimes)

Never mock:

- Your own classes and modules
- Internal collaborators
- Anything you control

## Designing for mockability

At a system boundary, shape the interface so the mock is trivial.

**1. Accept dependencies; do not create them.**

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over a generic fetcher.**

One specific function per external operation, instead of one generic function with conditional
logic:

```typescript
// GOOD: each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch("/orders", { method: "POST", body: data }),
};

// BAD: the mock needs conditional logic to answer
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK shape means each mock returns one specific value, test setup carries no branching, the
endpoints a test exercises are visible by name, and each operation is typed on its own.

Adapted from `tdd/mocking.md` in mattpocock/skills (3cca18b).
