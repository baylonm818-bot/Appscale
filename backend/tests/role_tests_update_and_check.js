const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const http = require('http');

async function updatePasswords(userIds, newPass) {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Admin1234',
    database: process.env.DB_NAME || 'appscale_db',
    port: Number(process.env.DB_PORT) || 3306,
  });
  const hash = await bcrypt.hash(newPass, 10);
  const placeholders = userIds.map(()=>'?').join(',');
  await pool.query(`UPDATE users SET password_hash = ? WHERE user_id IN (${placeholders})`, [hash, ...userIds]);
  await pool.end();
  console.log('Passwords updated for', userIds);
}

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
    // 1) Set test password for BNS(user_id 14) and BHW(user_id 16)
    await updatePasswords([14,16], '12345678');

    // 2) Login as marie (username 'marie')
    const loginMarie = await postJson('/api/auth/login', { email: 'marie', password: '12345678' });
    console.log('marie login', loginMarie.status, loginMarie.body.substring(0,300));
    const marieToken = loginMarie.status === 200 ? JSON.parse(loginMarie.body).token : null;

    // 3) Login as bea (username 'bea')
    const loginBea = await postJson('/api/auth/login', { email: 'bea', password: '12345678' });
    console.log('bea login', loginBea.status, loginBea.body.substring(0,300));
    const beaToken = loginBea.status === 200 ? JSON.parse(loginBea.body).token : null;

    // 4) Login as admin
    const loginAdmin = await postJson('/api/auth/login', { email: 'admin@apscale.local', password: '12345678' });
    console.log('admin login', loginAdmin.status, loginAdmin.body.substring(0,300));
    const adminToken = loginAdmin.status === 200 ? JSON.parse(loginAdmin.body).token : null;

    // 5) Test BHW dashboard stats with marie (bns)
    const r1 = await getWithAuth('/api/bhw/dashboard/stats', marieToken);
    console.log('\n/api/bhw/dashboard/stats as marie ->', r1.status, r1.body.substring(0,400));

    // 6) Test BHW dashboard stats with bea (bhw)
    const r2 = await getWithAuth('/api/bhw/dashboard/stats', beaToken);
    console.log('/api/bhw/dashboard/stats as bea ->', r2.status, r2.body.substring(0,400));

    // 7) Test admin dashboard stats with admin
    const r3 = await getWithAuth('/api/dashboard/stats', adminToken);
    console.log('/api/dashboard/stats as admin ->', r3.status, r3.body.substring(0,400));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err && (err.stack || err.message || err));
    process.exit(2);
  }
})();
