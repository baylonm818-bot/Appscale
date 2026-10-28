String timeAgo(DateTime date) {
  final now = DateTime.now().toUtc();
  final target = date.toUtc();
  final diff = now.difference(target);

  // If created just moments ago or clock skew slightly negative, show 'Just now'
  if (diff.isNegative || diff.inSeconds < 60) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  final local = date.toLocal();
  return '${local.month}/${local.day}/${local.year}';
}
