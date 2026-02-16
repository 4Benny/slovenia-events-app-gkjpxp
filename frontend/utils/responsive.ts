export const CONTENT_MAX_WIDTH = 800;

export function getResponsiveHorizontalPadding(screenWidth: number): number {
  if (screenWidth >= 1024) return 32;
  if (screenWidth >= 768) return 24;
  return 16;
}

export function getCenteredContentStyle(screenWidth: number) {
  return {
    width: "100%" as const,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center" as const,
    paddingHorizontal: getResponsiveHorizontalPadding(screenWidth),
  };
}
