const http = require('http');
const jwt = require('jsonwebtoken');

function request(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    };

    const req = http.request(options, (res) => {
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
    const secret = process.env.JWT_SECRET || 'devsecret';
    const bnsToken = jwt.sign({ user_id: 14, username: 'marie', role: 'bns', full_name: 'Marie' }, secret, { expiresIn: '1d' });
    const bhwToken = jwt.sign({ user_id: 16, username: 'bea', role: 'bhw', full_name: 'Bea' }, secret, { expiresIn: '1d' });
    const adminToken = jwt.sign({ user_id: 1, username: 'admin', role: 'admin', full_name: 'Admin' }, secret, { expiresIn: '1d' });

    console.log('Testing /api/bhw/dashboard/stats with BNS token...');
    const r1 = await request('/api/bhw/dashboard/stats', bnsToken);
    console.log('BNS ->', r1.status, r1.body.slice(0, 300));

    console.log('\nTesting /api/bhw/dashboard/stats with BHW token...');
    const r2 = await request('/api/bhw/dashboard/stats', bhwToken);
    console.log('BHW ->', r2.status, r2.body.slice(0, 300));

    console.log('\nTesting /api/admin/dashboard/stats with Admin token...');
    const r3 = await request('/api/dashboard/stats', adminToken);
    console.log('Admin ->', r3.status, r3.body.slice(0, 300));

    process.exit(0);
  } catch (err) {
    console.error('Error running checks:', err && (err.stack || err.message || err));
    process.exit(2);
  }
})();
