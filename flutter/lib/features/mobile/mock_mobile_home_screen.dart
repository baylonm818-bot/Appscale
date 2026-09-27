import 'package:flutter/material.dart';

class MockMobileHomeScreen extends StatelessWidget {
  const MockMobileHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFD8D8D8),
      body: SafeArea(
        child: Column(
          children: [
            const _StatusBar(),
            Expanded(
              child: Container(
                color: const Color(0xFFD8D8D8),
              ),
            ),
            const _BottomNav(),
          ],
        ),
      ),
    );
  }
}

class _StatusBar extends StatelessWidget {
  const _StatusBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      color: const Color(0xFFD8D8D8),
      child: Row(
        children: [
          const Text(
            '5:54 PM',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1B1B1B),
              letterSpacing: -0.4,
            ),
          ),
          const Spacer(),
          Row(
            children: [
              const Icon(Icons.signal_cellular_4_bar_rounded, size: 15, color: Color(0xFF1B1B1B)),
              const SizedBox(width: 6),
              const Icon(Icons.wifi_rounded, size: 15, color: Color(0xFF1B1B1B)),
              const SizedBox(width: 8),
              Container(
                width: 28,
                height: 15,
                padding: const EdgeInsets.only(left: 2, right: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3.5),
                  border: Border.all(color: const Color(0xFF1B1B1B), width: 1.5),
                ),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    width: 18,
                    height: 8,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1B1B1B),
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
  const _BottomNav();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF1F1F1),
      child: Column(
        children: [
          SizedBox(
            height: 104,
            child: Stack(
              alignment: Alignment.bottomCenter,
              children: [
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const SizedBox(width: 56, child: _NavItem(icon: Icons.home_rounded, label: 'Home', active: true)),
                        const SizedBox(width: 56, child: _NavItem(icon: Icons.format_list_bulleted_rounded, label: 'List', active: false)),
                        const SizedBox(width: 64),
                        const SizedBox(width: 56, child: _NavItem(icon: Icons.grid_view_rounded, label: 'Program', active: false)),
                        const SizedBox(width: 56, child: _NavItem(icon: Icons.bar_chart_rounded, label: 'Reports', active: false)),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  child: Container(
                    width: 82,
                    height: 82,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF9AE18E),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 14,
                          offset: const Offset(0, 7),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.add_rounded,
                      size: 46,
                      color: Color(0xFF1B1B1B),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(
            height: 1,
            width: double.infinity,
            color: const Color(0xFFDFDFDF),
          ),
          Container(
            height: 62,
            color: const Color(0xFFF8F8F8),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(Icons.menu_rounded, size: 28, color: Color(0xFF1D1D1D)),
                Icon(Icons.circle_outlined, size: 30, color: Color(0xFF1D1D1D)),
                Icon(Icons.arrow_back_ios_new_rounded, size: 24, color: Color(0xFF1D1D1D)),
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
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Icon(
          icon,
          size: 28,
          color: active ? const Color(0xFF1B1B1B) : const Color(0xFF5B646D),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: active ? const Color(0xFF1B1B1B) : const Color(0xFF5E6972),
          ),
        ),
      ],
    );
  }
}
