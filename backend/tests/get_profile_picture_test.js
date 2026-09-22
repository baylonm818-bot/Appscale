const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const opts = { hostname: 'localhost', port: 5000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getWithAuth(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 5000, path, method: 'GET', headers: { Authorization: token ? `Bearer ${token}` : undefined } };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    const login = await postJson('/api/auth/login', { email: 'admin@apscale.local', password: '12345678' });
    console.log('login status', login.status);
    if (login.status !== 200) return console.error('Login failed', login.body);
    const token = JSON.parse(login.body).token;
    const res = await getWithAuth('/api/profile/1/picture/data', token);
    console.log('GET picture data status', res.status);
    console.log(res.body ? res.body.substring(0, 500) : res.body);
  } catch (err) {
    console.error('Error:', err && (err.stack || err.message || err));
    process.exit(2);
  }
})();
