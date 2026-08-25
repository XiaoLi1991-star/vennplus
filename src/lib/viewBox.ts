export type ViewBoxTuple = [number, number, number, number];

export function fitViewBoxToAspectRatio(
  viewBox: ViewBoxTuple,
  targetAspectRatio: number,
  anchor: 'center' | 'top-left' = 'center',
): ViewBoxTuple {
  const [x, y, width, height] = viewBox;
  if (
    !Number.isFinite(targetAspectRatio) ||
    targetAspectRatio <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return viewBox;
  }

  const currentAspectRatio = width / height;
  if (Math.abs(currentAspectRatio - targetAspectRatio) < 0.0001) return viewBox;

  if (currentAspectRatio > targetAspectRatio) {
    const fittedHeight = width / targetAspectRatio;
    const offset = anchor === 'center' ? (fittedHeight - height) / 2 : 0;
    return [x, y - offset, width, fittedHeight];
  }

  const fittedWidth = height * targetAspectRatio;
  const offset = anchor === 'center' ? (fittedWidth - width) / 2 : 0;
  return [x - offset, y, fittedWidth, height];
}
