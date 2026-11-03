// Named spots on a screen that the first-run tour can point at (3 Nov 2026).
// Works like tourTabPositions, but for any view: a screen wraps the thing in a
// View with a ref, calls registerTarget('hero', ref), and the tour measures it
// when the step shows. Today also registers a scroller so the tour can bring a
// target into view before it draws the highlight.

export type Rect = { x: number; y: number; width: number; height: number };

type MeasurableView = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };
type ViewRef = { current: MeasurableView | null };

const refs = new Map<string, ViewRef>();
let scroller: ((targetWindowY: number, wantedWindowY: number) => void) | null = null;
let toTop: (() => void) | null = null;

export function registerTarget(name: string, ref: ViewRef) {
  refs.set(name, ref);
}

export function unregisterTarget(name: string) {
  refs.delete(name);
}

// The screen that owns the scroll view gives the tour one function that
// scrolls by the difference between where a target is and where we want it.
export function setTourScroller(fn: typeof scroller, top: typeof toTop = null) {
  scroller = fn;
  toTop = top;
}

// Steps that point at a tab (or nothing) start from the top of the screen.
export function scrollTourToTop() {
  toTop?.();
}

export function measureTarget(name: string): Promise<Rect | null> {
  const view = refs.get(name)?.current;
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      view.measureInWindow((x, y, width, height) => resolve(width || height ? { x, y, width, height } : null));
    } catch {
      resolve(null);
    }
  });
}

// Scroll so the target sits near the top of the screen, then measure it again.
export async function bringTargetIntoView(name: string, wantedWindowY: number): Promise<Rect | null> {
  const first = await measureTarget(name);
  if (!first) return null;
  if (scroller && Math.abs(first.y - wantedWindowY) > 8) {
    scroller(first.y, wantedWindowY);
    // Wait for the scroll to settle: measure until two readings agree.
    let last = first;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 180));
      const next = await measureTarget(name);
      if (!next) break;
      if (Math.abs(next.y - last.y) < 1 && i > 0) return next;
      last = next;
    }
    return last;
  }
  return first;
}
