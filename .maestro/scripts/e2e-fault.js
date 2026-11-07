// Arms one fault on the loopback mock (host side; the app never calls this).
const res = http.post('http://127.0.0.1:8080/__e2e/faults', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ method: METHOD, path: FAULT_PATH, mode: MODE, ms: Number(typeof MS === 'undefined' ? 0 : MS) }),
});
if (!res.ok) throw new Error('Could not arm fault: ' + res.status);
