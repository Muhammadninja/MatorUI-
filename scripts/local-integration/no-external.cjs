// Loaded only by the isolated backend process, never bundled into the app.
// Fail closed if a disabled provider is invoked with synthetic test data.
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');

function allow(host) {
  const value = String(host || 'localhost').replace(/^\[|\]$/g, '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(value)) {
    const error = new Error('External networking is disabled in local integration');
    error.code = 'LOCAL_EXTERNAL_NETWORK_DISABLED';
    throw error;
  }
}
function requestHost(args) {
  const first = args[0];
  if (typeof first === 'string' || first instanceof URL) return new URL(first).hostname;
  return first?.hostname || first?.host || 'localhost';
}
for (const module of [http, https]) {
  for (const method of ['request', 'get']) {
    const original = module[method];
    module[method] = function (...args) {
      allow(requestHost(args));
      return original.apply(this, args);
    };
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, ...rest) {
  allow(new URL(input instanceof Request ? input.url : input).hostname);
  return originalFetch.call(this, input, ...rest);
};
function socketHost(args) {
  if (Array.isArray(args[0])) return socketHost(args[0]);
  if (typeof args[0] === 'object') return args[0]?.host || 'localhost';
  // A string first argument is a Unix-domain socket path, not a remote host.
  if (typeof args[0] === 'string') return 'localhost';
  return typeof args[1] === 'string' ? args[1] : 'localhost';
}
const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  allow(socketHost(args));
  return originalSocketConnect.apply(this, args);
};
for (const [module, methods] of [[net, ['connect', 'createConnection']], [tls, ['connect']]]) {
  for (const method of methods) {
    const original = module[method];
    module[method] = function (...args) {
      allow(socketHost(args));
      return original.apply(this, args);
    };
  }
}
