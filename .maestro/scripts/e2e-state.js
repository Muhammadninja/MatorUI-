// Reads mock-side cart and order state. Synthetic account ids and part ids only.
// NOSETTLE reads mid-request state instead of waiting for open app requests.
const nosettle = typeof NOSETTLE !== 'undefined' && NOSETTLE === 'true';
const res = http.get('http://127.0.0.1:8080/__e2e/state' + (nosettle ? '?nosettle' : ''));
if (!res.ok) throw new Error('Could not read mock state: ' + res.status);
const state = json(res.body);
const qty = (account, part) => {
  const line = (state.carts[account] || []).find((l) => l.part_id === part);
  return line ? line.quantity : 0;
};
output.cart = {
  aCabin: qty('e2e_a', 'mann-cabin-filter'), aFuel: qty('e2e_a', 'mann-fuel-filter'),
  bCabin: qty('e2e_b', 'mann-cabin-filter'), bFuel: qty('e2e_b', 'mann-fuel-filter'),
  aLines: (state.carts.e2e_a || []).length, bLines: (state.carts.e2e_b || []).length,
};
output.orders = {
  a: (state.orders.e2e_a || []).length, b: (state.orders.e2e_b || []).length,
  aTotal: (state.orders.e2e_a || []).map((o) => o.total_uzs).join(','),
  requests: state.orderRequests, posts: state.orderPosts, keys: state.idempotencyKeys, unkeyed: state.unkeyedOrderPosts,
};
console.log('mock state ' + JSON.stringify({ cart: output.cart, orders: output.orders }));
