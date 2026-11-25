/** What can take the focus by Tab: a control that is not disabled. */
export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Whether `element` is drawn and outside an inert part of the page, so the focus can stay on it. */
const takesTheFocus = (element: HTMLElement) =>
  element.getClientRects().length > 0 && element.closest("[inert]") === null;

/** The first control in `root` that Tab would reach and that is on screen. */
export function firstControlIn(root: ParentNode): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(takesTheFocus);
}
