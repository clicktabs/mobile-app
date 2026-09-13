type NavLike = {
  canGoBack?: () => boolean;
  goBack?: () => void;
  getParent?: () => NavLike | undefined;
  navigate?: (name: string, params?: unknown) => void;
};

export function canNavigateBack(navigation: NavLike | undefined): boolean {
  let current: NavLike | undefined = navigation;
  while (current) {
    if (current.canGoBack?.()) return true;
    current = current.getParent?.();
  }
  return false;
}

/**
 * Pop the nearest navigator that actually has history.
 * Nested tab → stack screens often have nothing to pop on the child stack
 * (opened via parent.navigate), so goBack() no-ops unless we walk parents.
 */
export function safeGoBack(
  navigation: NavLike,
  fallback?: { tab: string; screen?: string; params?: object },
) {
  let current: NavLike | undefined = navigation;
  while (current) {
    if (current.canGoBack?.()) {
      current.goBack?.();
      return;
    }
    current = current.getParent?.();
  }

  if (fallback) {
    const root = navigation.getParent?.() ?? navigation;
    if (fallback.screen) {
      root.navigate?.(fallback.tab, { screen: fallback.screen, params: fallback.params });
    } else {
      root.navigate?.(fallback.tab, fallback.params);
    }
    return;
  }

  const root = navigation.getParent?.() ?? navigation;
  root.navigate?.('Home');
}
