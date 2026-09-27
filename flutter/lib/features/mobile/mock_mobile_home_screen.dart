import 'package:flutter/material.dart';

class MockMobileHomeScreen extends StatelessWidget {
  const MockMobileHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFD9D9D9),
      body: SafeArea(
        child: Column(
          children: [
            _StatusBar(),
            const Expanded(
              child: SizedBox(),
            ),
            _BottomNav(),
          ],
        ),
      ),
    );
  }
}

class _StatusBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      color: const Color(0xFFD9D9D9),
      child: Row(
        children: [
          const Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '5:45 PM',
                style: TextStyle(
                  color: Color(0xFF1E1E1E),
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
            ),
          ),
          Row(
            children: [
              const Icon(Icons.signal_cellular_4_bar_rounded, size: 16, color: Color(0xFF1E1E1E)),
              const SizedBox(width: 4),
              const Icon(Icons.wifi_rounded, size: 16, color: Color(0xFF1E1E1E)),
              const SizedBox(width: 6),
              Container(
                width: 26,
                height: 14,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: const Color(0xFF1E1E1E), width: 1.5),
                ),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    width: 18,
                    height: 8,
                    margin: const EdgeInsets.only(right: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF4F4F4),
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 0),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _NavItem(icon: Icons.home_rounded, label: 'Home', active: true),
                _NavItem(icon: Icons.format_list_bulleted_rounded, label: 'List', active: false),
                _CenterAddButton(),
                _NavItem(icon: Icons.add_box_rounded, label: 'Program', active: false),
                _NavItem(icon: Icons.bar_chart_rounded, label: 'Reports', active: false),
              ],
            ),
          ),
          Container(
            height: 1,
            width: double.infinity,
            color: const Color(0xFFDEDEDE),
          ),
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                Icon(Icons.menu_rounded, size: 30, color: Color(0xFF1F1F1F)),
                Icon(Icons.circle_outlined, size: 30, color: Color(0xFF1F1F1F)),
                Icon(Icons.arrow_back_ios_new_rounded, size: 22, color: Color(0xFF1F1F1F)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 68,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 28,
            color: active ? const Color(0xFF1E1E1E) : const Color(0xFF59626C),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: active ? const Color(0xFF1E1E1E) : const Color(0xFF636C73),
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _CenterAddButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 74,
      height: 74,
      margin: const EdgeInsets.only(top: 0, bottom: 12),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xFF99DF7A),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: const Icon(
        Icons.add_rounded,
        size: 42,
        color: Color(0xFF1F1F1F),
      ),
    );
  }
}
