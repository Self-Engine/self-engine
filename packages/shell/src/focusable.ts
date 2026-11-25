/** What Tab can reach: a control, before asking whether it can take the focus now. */
export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Whether `element` can take the focus now: on the page, drawn, not disabled, whatever its
 * `tabindex` says, and outside an inert part of the page.
 */
export const takesTheFocus = (element: HTMLElement) =>
  element.isConnected &&
  !element.matches(":disabled") &&
  element.getClientRects().length > 0 &&
  element.closest("[inert]") === null;

/** The first control in `root` that Tab would reach and that can take the focus now. */
export function firstControlIn(root: ParentNode): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(takesTheFocus);
}
