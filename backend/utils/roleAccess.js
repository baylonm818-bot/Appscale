function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function sameBarangay(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function canAccessProfile(requester, target) {
  if (!requester || !target) return false;

  const requesterRole = normalizeRole(requester.role);
  const targetRole = normalizeRole(target.role);
  const requesterId = Number(requester.user_id);
  const targetId = Number(target.user_id);

  if (requesterRole === 'admin') return true;
  if (requesterId === targetId) return true;

  if (requesterRole === 'bhw' && targetRole === 'bns') {
    return sameBarangay(requester.barangay, target.barangay);
  }

  if (requesterRole === 'bhw' && targetRole === 'bhw') {
    return sameBarangay(requester.barangay, target.barangay);
  }

  if (requesterRole === 'bns' && targetRole === 'bns') {
    return requesterId === targetId;
  }

  return false;
}

function canViewUserList(requester, targetUser) {
  if (!requester) return false;
  const requesterRole = normalizeRole(requester.role);
  if (requesterRole === 'admin') return true;
  if (requesterRole === 'bhw') {
    return sameBarangay(requester.barangay, targetUser?.barangay);
  }
  return false;
}

function canEditUser(requester, targetUser) {
  if (!requester || !targetUser) return false;
  const requesterRole = normalizeRole(requester.role);
  if (requesterRole === 'admin') return true;
  if (requesterRole === 'bhw') {
    return sameBarangay(requester.barangay, targetUser?.barangay) && normalizeRole(targetUser.role) !== 'admin';
  }
  return false;
}

function canAccessSchedule(requester, schedule) {
  if (!requester || !schedule) return false;
  const requesterRole = normalizeRole(requester.role);
  if (requesterRole === 'admin') return true;

  const targetRole = normalizeRole(schedule.target_role || schedule.assigned_to_role || schedule.role || '');
  const scheduleBarangay = String(schedule.barangay || '').trim();
  const isGlobalSchedule = scheduleBarangay === '' || scheduleBarangay.toLowerCase() === 'all barangays' || scheduleBarangay.toLowerCase() === 'all';
  const matchesBarangay = isGlobalSchedule || sameBarangay(requester.barangay, scheduleBarangay);

  if (requesterRole === 'bhw') {
    return matchesBarangay && (targetRole === 'bhw' || targetRole === 'all' || targetRole === '');
  }

  if (requesterRole === 'bns') {
    return matchesBarangay && (targetRole === 'bns' || targetRole === 'all' || targetRole === '');
  }

  return false;
}

function canAccessReferral(requester, referral) {
  if (!requester || !referral) return false;
  const requesterRole = normalizeRole(requester.role);
  if (requesterRole === 'admin') return true;

  const referralBarangay = referral.barangay || referral.beneficiary_barangay;
  if (requesterRole === 'bhw' || requesterRole === 'bns') {
    return sameBarangay(requester.barangay, referralBarangay);
  }

  return false;
}

function enforceScopedBarangay(requester, requestedBarangay) {
  if (!requester) return { allowed: false, reason: 'missing_requester' };

  const requesterRole = normalizeRole(requester.role);
  if (requesterRole === 'admin') {
    return { allowed: true, barangay: requestedBarangay || requester.barangay || null };
  }

  const assignedBarangay = requester.barangay;
  if (!assignedBarangay) {
    return { allowed: false, reason: 'missing_assigned_barangay' };
  }

  if (requestedBarangay && !sameBarangay(assignedBarangay, requestedBarangay)) {
    return { allowed: false, reason: 'barangay_mismatch' };
  }

  return { allowed: true, barangay: assignedBarangay };
}

module.exports = {
  normalizeRole,
  sameBarangay,
  canAccessProfile,
  canViewUserList,
  canEditUser,
  canAccessSchedule,
  canAccessReferral,
  enforceScopedBarangay,
};
