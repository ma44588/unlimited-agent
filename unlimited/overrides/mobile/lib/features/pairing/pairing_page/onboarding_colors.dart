part of '../pairing_page.dart';

// Unlimited Agent: onboarding always uses the deep night look of the landing
// page, whatever the phone's light or dark setting.
extension _OnboardingColors on BuildContext {
  bool get _onboardingIsDark => true;
  Color get _onboardingInk => const Color(0xFFF4F0FA);
  Color get _onboardingMutedInk => const Color(0xFFB4A9C7);
  Color get _onboardingCtaLabel => const Color(0xFFFFFFFF);
  Color get _onboardingErrorInk => colors.error;
  Color get _onboardingInputSurface => const Color(0x0FFFFFFF);

  OutlineInputBorder get _inputBorder => OutlineInputBorder(
    borderRadius: BorderRadius.circular(16),
    borderSide: const BorderSide(color: Color(0x24FFFFFF)),
  );

  // Primary call to action: the brand purple to magenta gradient with a glow.
  ButtonStyle get _onboardingButtonStyle =>
      FilledButton.styleFrom(
        minimumSize: const Size(0, 54),
        padding: const EdgeInsets.symmetric(
          horizontal: Grid.lg,
          vertical: Grid.twelve,
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: _onboardingCtaLabel,
        disabledBackgroundColor: Colors.transparent,
        disabledForegroundColor: _onboardingCtaLabel.withValues(alpha: 0.6),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 15.5,
          fontWeight: FontWeight.w700,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ).copyWith(
        backgroundBuilder: (context, states, child) {
          final disabled = states.contains(WidgetState.disabled);
          final pressed = states.contains(WidgetState.pressed);
          return Opacity(
            opacity: disabled ? 0.45 : 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: pressed
                      ? const [Color(0xFF6A3B82), Color(0xFF862B59)]
                      : const [Color(0xFF7A4793), Color(0xFF9A3367)],
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x8CE06AA4),
                    blurRadius: 26,
                    offset: Offset(0, 8),
                    spreadRadius: -12,
                  ),
                ],
              ),
              child: child,
            ),
          );
        },
      );

  ButtonStyle get _onboardingSecondaryButtonStyle => TextButton.styleFrom(
    minimumSize: const Size(0, 52),
    padding: const EdgeInsets.symmetric(
      horizontal: Grid.md,
      vertical: Grid.xxs,
    ),
    backgroundColor: const Color(0x0AFFFFFF),
    foregroundColor: _onboardingInk,
    disabledBackgroundColor: const Color(0x05FFFFFF),
    disabledForegroundColor: _onboardingInk.withValues(alpha: 0.45),
    textStyle: const TextStyle(
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: FontWeight.w600,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: const BorderSide(color: Color(0x24FFFFFF)),
    ),
  );
}

/// Two short promises under the welcome buttons.
class _UnlimitedTrustRow extends StatelessWidget {
  const _UnlimitedTrustRow();

  @override
  Widget build(BuildContext context) {
    Widget item(String label) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_rounded, size: 14, color: Color(0xFF3DDC97)),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            color: Color(0xFF7D7290),
          ),
        ),
      ],
    );
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 16,
      runSpacing: 4,
      children: [item('Approval first'), item('Production untouched')],
    );
  }
}
