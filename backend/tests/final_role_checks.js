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
    // Login marie (BNS)
    const marieLogin = await postJson('/api/auth/login', { email: 'marie', password: '12345678' });
    const marieToken = marieLogin.status === 200 ? JSON.parse(marieLogin.body).token : null;
    console.log('marie login', marieLogin.status);

    // Login bea (BHW)
    const beaLogin = await postJson('/api/auth/login', { email: 'bea', password: '12345678' });
    const beaToken = beaLogin.status === 200 ? JSON.parse(beaLogin.body).token : null;
    console.log('bea login', beaLogin.status);

    // Login admin
    const adminLogin = await postJson('/api/auth/login', { email: 'admin@apscale.local', password: '12345678' });
    const adminToken = adminLogin.status === 200 ? JSON.parse(adminLogin.body).token : null;
    console.log('admin login', adminLogin.status);

    // Call BHW stats with barangay query
    const barangay = 'Antipolo';
    const bhwPath = `/api/bhw/stats?barangay=${encodeURIComponent(barangay)}`;

    const r1 = await getWithAuth(bhwPath, marieToken);
    console.log(`\nGET ${bhwPath} as marie ->`, r1.status, r1.body.substring(0,400));

    const r2 = await getWithAuth(bhwPath, beaToken);
    console.log(`GET ${bhwPath} as bea ->`, r2.status, r2.body.substring(0,400));

    const adminBhw = await getWithAuth(bhwPath, adminToken);
    console.log(`GET ${bhwPath} as admin ->`, adminBhw.status, adminBhw.body.substring(0,400));

    // Admin dashboard stats endpoint
    const adminPath = '/api/dashboard/admin/stats';
    const r3 = await getWithAuth(adminPath, adminToken);
    console.log(`\nGET ${adminPath} as admin ->`, r3.status, r3.body.substring(0,400));

    process.exit(0);
  } catch (err) {
    console.error('Error in final_role_checks:', err && (err.stack || err.message || err));
    process.exit(2);
  }
})();
