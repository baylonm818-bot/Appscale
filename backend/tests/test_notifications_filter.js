const { getNotifications } = require('../controllers/notificationControllers');

async function testNotifications() {
  console.log('Testing Admin notifications...');
  let adminResult = null;
  const adminReq = { user: { role: 'admin', user_id: 1 } };
  const adminRes = {
    status: (code) => ({
      json: (data) => {
        adminResult = { code, data };
        return data;
      }
    })
  };

  await getNotifications(adminReq, adminRes);
  console.log('Admin notifications count:', adminResult?.data?.notifications?.length);
  console.log('Admin unread count:', adminResult?.data?.unreadCount);

  // Assert NO referral or alert notifications exist in admin results
  const invalidForAdmin = (adminResult?.data?.notifications || []).filter(
    (n) => n.type === 'referral' || n.type === 'alert' || n.type === 'system'
  );
  console.log('Invalid notifications found for Admin (should be 0):', invalidForAdmin.length);
  if (invalidForAdmin.length > 0) {
    console.error('Found invalid notifications for admin:', invalidForAdmin);
    process.exit(1);
  }

  console.log('\nTesting BHW notifications (Antipolo)...');
  let bhwResult = null;
  const bhwReq = { user: { role: 'bhw', user_id: 2, barangay: 'Antipolo' } };
  const bhwRes = {
    status: (code) => ({
      json: (data) => {
        bhwResult = { code, data };
        return data;
      }
    })
  };

  await getNotifications(bhwReq, bhwRes);
  console.log('BHW notifications count:', bhwResult?.data?.notifications?.length);
  console.log('BHW unread count:', bhwResult?.data?.unreadCount);

  // Check if BHW sees referral notifications
  const bhwReferrals = (bhwResult?.data?.notifications || []).filter(
    (n) => n.type === 'referral'
  );
  console.log('BHW referral notifications found:', bhwReferrals.length);

  console.log('\nNotifications filter test passed successfully!');
  process.exit(0);
}

testNotifications().catch(err => {
  console.error('Notifications test error:', err);
  process.exit(1);
});
