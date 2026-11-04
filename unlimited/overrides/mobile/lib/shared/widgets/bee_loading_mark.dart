import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../theme/theme_extensions.dart';
import 'flapping_bee.dart';

/// Unlimited Agent loading mark: the infinity mark with a soft pulse (in place
/// of the Buzz bee morph). Same name and API as the upstream widget.
class BeeLoadingMark extends HookWidget {
  const BeeLoadingMark({super.key});

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    final controller = useAnimationController(
      duration: const Duration(milliseconds: 900),
    );
    useEffect(() {
      if (reduced) {
        controller
          ..stop()
          ..value = 1;
      } else {
        controller.repeat(reverse: true);
      }
      return controller.stop;
    }, [controller, reduced]);
    final color = context.colors.onSurface;
    return Semantics(
      label: 'Loading',
      liveRegion: true,
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: controller,
            builder: (context, _) => CustomPaint(
              size: const Size(64, 64 * 309 / 466),
              painter: InfinityMarkPainter(
                color: color.withValues(alpha: 0.35 + 0.45 * Curves.easeInOut.transform(controller.value)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
