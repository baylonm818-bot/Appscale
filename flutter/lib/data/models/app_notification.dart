class AppNotification {
  final String id;
  final String title;
  final String message;
  final String type; // 'referral_completed', 'referral_update', 'general'
  final String? referralId;
  final DateTime timestamp;
  final bool isRead;

  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    this.referralId,
    required this.timestamp,
    this.isRead = false,
  });

  AppNotification copyWith({
    String? id,
    String? title,
    String? message,
    String? type,
    String? referralId,
    DateTime? timestamp,
    bool? isRead,
  }) {
    return AppNotification(
      id: id ?? this.id,
      title: title ?? this.title,
      message: message ?? this.message,
      type: type ?? this.type,
      referralId: referralId ?? this.referralId,
      timestamp: timestamp ?? this.timestamp,
      isRead: isRead ?? this.isRead,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'message': message,
    'type': type,
    'referralId': referralId,
    'timestamp': timestamp.toIso8601String(),
    'isRead': isRead,
  };

  factory AppNotification.fromMap(Map<dynamic, dynamic> map) {
    final rawTs = (map['timestamp'] ?? map['created_at'] ?? '').toString();
    DateTime parsed;
    try {
      if (rawTs.isEmpty) {
        parsed = DateTime.now().toUtc();
      } else if (!rawTs.endsWith('Z') && !rawTs.contains('+') && rawTs.contains('T')) {
        parsed = DateTime.parse('${rawTs}Z');
      } else if (!rawTs.endsWith('Z') && !rawTs.contains('+') && RegExp(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}').hasMatch(rawTs)) {
        parsed = DateTime.parse('${rawTs.replaceFirst(' ', 'T')}Z');
      } else {
        parsed = DateTime.parse(rawTs).toUtc();
      }
    } catch (_) {
      parsed = DateTime.now().toUtc();
    }
    return AppNotification(
      id: (map['id'] ?? map['notification_id'] ?? '').toString(),
      title: map['title'] as String? ?? 'Notification',
      message: map['message'] as String? ?? '',
      type: map['type'] as String? ?? 'general',
      referralId: map['referralId'] as String?,
      timestamp: parsed,
      isRead: map['isRead'] as bool? ?? false,
    );
  }
}
