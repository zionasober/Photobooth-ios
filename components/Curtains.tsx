"use client";

export type CurtainState = "closed" | "opening" | "open" | "closing";

/**
 * Two heavy velvet panels fixed over the whole page.
 * Opening gathers the fabric toward each outer edge (scaleX from the outer edge), so the folds
 * bunch up like a real drawn curtain instead of sliding as a flat sheet.
 */
export default function Curtains({ state }: { state: CurtainState }) {
  return (
    <div className="curtains" data-s={state} aria-hidden="true">
      <div className="cpanel l"><div className="vel" /></div>
      <div className="cpanel r"><div className="vel" /></div>
      <div className="edge-shadow l" />
      <div className="edge-shadow r" />
      <div className="spot" />
    </div>
  );
}
