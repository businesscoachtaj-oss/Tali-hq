// Where each bottom tab icon sits on screen, for the first-run tour's ring.
// Same pattern as Totality and Totality Nutrition: the tab layout registers
// each icon's view, and the tour measures it again when each step shows,
// because a position saved at first layout can go stale.

export type TabPos = { x: number; y: number; width: number; height: number };

// One slot per visible tab, in (app)/_layout.tsx order:
// 0 Today, 1 Talk, 2 Her brain, 3 Your world, 4 Me
export const tabPositions: (TabPos | null)[] = [null, null, null, null, null];

type MeasurableView = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };
type ViewRef = { current: MeasurableView | null };

const refs: (ViewRef | null)[] = [];

export function registerTab(index: number, ref: ViewRef) {
  refs[index] = ref;
  requestAnimationFrame(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width || height) tabPositions[index] = { x, y, width, height };
    });
  });
}

export function measureTabNow(index: number): Promise<TabPos | null> {
  const view = refs[index]?.current;
  if (!view) return Promise.resolve(tabPositions[index] ?? null);
  return new Promise((resolve) => {
    try {
      view.measureInWindow((x, y, width, height) => {
        if (!width && !height) return resolve(tabPositions[index] ?? null);
        const pos = { x, y, width, height };
        tabPositions[index] = pos;
        resolve(pos);
      });
    } catch {
      resolve(tabPositions[index] ?? null);
    }
  });
}
