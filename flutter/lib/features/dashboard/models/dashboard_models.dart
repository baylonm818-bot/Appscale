import 'package:flutter/material.dart';

class StatCardData {
  final String label;
  final String value;
  final String subtitle;
  final Color accentColor;
  final IconData icon;

  const StatCardData({
    required this.label,
    required this.value,
    required this.subtitle,
    required this.accentColor,
    this.icon = Icons.bar_chart_rounded,
  });
}

class NutritionStatusItem {
  final String label;
  final int count;
  final double percent;
  final Color color;

  const NutritionStatusItem({
    required this.label,
    required this.count,
    required this.percent,
    required this.color,
  });
}

class UpcomingActivityData {
  final String month;
  final String day;
  final String title;
  final String subtitle;
  final String statusLabel;
  final Color statusColor;

  const UpcomingActivityData({
    required this.month,
    required this.day,
    required this.title,
    required this.subtitle,
    required this.statusLabel,
    required this.statusColor,
  });
}

class NutritionCounts {
  final int totalChildren;
  final int samCases;
  final int severeCount;
  final int atRiskCount;
  final int obeseCount;
  final int overweightCount;
  final int normalCount;
  final int notWeighedCount;

  const NutritionCounts({
    required this.totalChildren,
    required this.samCases,
    required this.severeCount,
    required this.atRiskCount,
    required this.obeseCount,
    required this.overweightCount,
    required this.normalCount,
    required this.notWeighedCount,
  });
}
