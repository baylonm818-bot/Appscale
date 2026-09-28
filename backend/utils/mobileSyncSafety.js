function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isDuplicateNutritionRecord(existingRows = [], childId, recordDate) {
  if (!Array.isArray(existingRows) || !childId || !recordDate) return false;

  const normalizedChildId = Number(childId);
  const normalizedDate = normalizeDate(recordDate);
  if (!normalizedChildId || !normalizedDate) return false;

  return existingRows.some((row) => {
    if (!row || Number(row.child_id) !== normalizedChildId) return false;
    const rowDate = normalizeDate(row.record_date || row.date || row.created_at);
    return rowDate === normalizedDate;
  });
}

module.exports = {
  normalizeDate,
  isDuplicateNutritionRecord,
};
