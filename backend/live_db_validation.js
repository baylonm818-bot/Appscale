const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE = 'http://127.0.0.1:4011';

async function api(path, init = {}) {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  const results = {};
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    connectTimeout: 15000,
  });

  const [users] = await db.query(
    "SELECT user_id, first_name, last_name, role, barangay, status, email FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10"
  );
  console.log('DB_USERS', users.map((r) => ({ user_id: r.user_id, role: r.role, barangay: r.barangay, status: r.status, email: r.email })));

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@apscale.local';
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'AppScaleAdmin123!';

  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  results.adminLogin = adminLogin;
  console.log('ADMIN_LOGIN', adminLogin.status, adminLogin.data);

  if (!adminLogin.ok || !adminLogin.data || !adminLogin.data.token) {
    throw new Error('Admin login failed.');
  }

  const adminToken = adminLogin.data.token;

  const usersList = await api('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  results.usersList = usersList;
  console.log('GET_USERS', usersList.status, Array.isArray(usersList.data) ? usersList.data.length : usersList.data);

  const bnsUser = Array.isArray(usersList.data)
    ? usersList.data.find((u) => u.role === 'bns' && u.status === 'active')
    : null;
  const targetBarangay = bnsUser ? bnsUser.barangay : 'Barangay 1';
  console.log('TARGET_BARANGAY', targetBarangay);

  const uniqueUser = `qa_live_${Date.now()}`;
  const createPayload = {
    first_name: 'QA',
    middle_initial: 'L',
    last_name: 'Live',
    email: `${uniqueUser}@example.com`,
    username: uniqueUser,
    password: 'Pass123!@',
    role: 'bhw',
    municipality: 'Gasan',
    barangay: targetBarangay,
    purok: 'Purok 1',
    contact_number: '09171234567'
  };

  const createUser = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload)
  });
  results.createUser = createUser;
  console.log('CREATE_USER', createUser.status, createUser.data);

  let createdUser = null;
  if (createUser.ok) {
    const [newUserRows] = await db.query(
      'SELECT user_id, email, username, role FROM users WHERE email = ? OR username = ? ORDER BY user_id DESC LIMIT 1',
      [createPayload.email, createPayload.username]
    );
    createdUser = newUserRows[0] || null;
  }

  if (createdUser) {
    const updateUser = await api(`/api/users/${createdUser.user_id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createPayload,
        first_name: 'QA Updated',
        middle_initial: 'M',
        contact_number: '09999888777'
      })
    });
    results.updateUser = updateUser;
    console.log('UPDATE_USER', updateUser.status, updateUser.data);

    const bhwLogin = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: createPayload.email, password: 'Pass123!@' })
    });
    results.bhwLogin = bhwLogin;
    console.log('CREATED_USER_LOGIN', bhwLogin.status, bhwLogin.data && { token: !!bhwLogin.data.token, role: bhwLogin.data.user && bhwLogin.data.user.role });

    if (bhwLogin.ok && bhwLogin.data && bhwLogin.data.token) {
      const bhwStats = await api(`/api/bhw/stats?barangay=${encodeURIComponent(targetBarangay)}`, {
        headers: { Authorization: `Bearer ${bhwLogin.data.token}` }
      });
      results.bhwStatsWithBhwToken = bhwStats;
      console.log('BHW_STATS_WITH_BHW_TOKEN', bhwStats.status, bhwStats.data);

      const forbidden = await api('/api/users', { headers: { Authorization: `Bearer ${bhwLogin.data.token}` } });
      results.nonAdminAccess = forbidden;
      console.log('NON_ADMIN_ACCESS', forbidden.status, forbidden.data);
    }
  }

  const childExt = `qa_child_${Date.now()}`;
  const childSync = await api('/api/mobile/children', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_id: childExt,
      full_name: 'QA Child Live',
      birth_date: '2022-02-15',
      barangay: targetBarangay,
      purok: 'Purok 2',
      guardian_name: 'QA Guardian',
      guardian_contact: '09112223344',
      encoded_by: createdUser ? createdUser.user_id : 1
    })
  });
  results.childSync = childSync;
  console.log('UPSERT_CHILD', childSync.status, childSync.data);

  const [childRows] = await db.query('SELECT child_id FROM children WHERE external_id = ? LIMIT 1', [childExt]);
  const childId = childRows[0] ? childRows[0].child_id : null;

  if (childId) {
    const nutritionSync = await api('/api/mobile/nutrition-records', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child_id: childId,
        record_date: '2026-09-25',
        weight_kg: 10.8,
        height_cm: 78,
        muac_cm: 12,
        overall_status: 'MAM',
        recorded_by: createdUser ? createdUser.user_id : 1
      })
    });
    results.nutritionSync = nutritionSync;
    console.log('NUTRITION_SYNC', nutritionSync.status, nutritionSync.data);

    const childList = await api(`/api/mobile/children?barangay=${encodeURIComponent(targetBarangay)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    results.mobileChildren = childList;
    console.log('MOBILE_CHILDREN', childList.status, Array.isArray(childList.data) ? childList.data.length : childList.data);

    const bhwStats = await api(`/api/bhw/stats?barangay=${encodeURIComponent(targetBarangay)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    results.bhwStats = bhwStats;
    console.log('BHW_STATS', bhwStats.status, bhwStats.data);
  }

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'wrong-password' })
  });
  results.badLogin = badLogin;
  console.log('INVALID_LOGIN', badLogin.status, badLogin.data);

  const staleToken = await api('/api/dashboard/admin/stats', {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdGFsZSIsImV4cCI6MTYwMDAwMDAwMH0.signature' }
  });
  results.staleToken = staleToken;
  console.log('STALE_TOKEN', staleToken.status, staleToken.data);

  const concurrent = await Promise.all(
    Array.from({ length: 5 }, () =>
      api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      })
    )
  );
  results.concurrent = concurrent;
  console.log('CONCURRENT_LOGINS', concurrent.map((r) => r.status));

  const summary = {
    adminLogin: results.adminLogin && results.adminLogin.ok,
    userCreate: !!results.createUser && results.createUser.ok,
    userUpdate: !!results.updateUser && results.updateUser.ok,
    bhwLogin: !!results.bhwLogin && results.bhwLogin.ok,
    bhwStats: !!results.bhwStats && results.bhwStats.ok,
    childSync: !!results.childSync && results.childSync.ok,
    invalidLoginRejected: !!results.badLogin && results.badLogin.status === 401,
    staleTokenRejected: !!results.staleToken && results.staleToken.status === 401,
    concurrentLoginsStable: concurrent.every((r) => r.status === 200 || r.status === 401 || r.status === 403)
  };

  console.log('VALIDATION_SUMMARY', summary);
  await db.end();
})();
