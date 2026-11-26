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

/**
 * Whether `element` opens something over the page as soon as it takes the focus: a field that
 * announces a popup, as a searchable Select does with its list. A button that announces one opens
 * it on a press, not on the focus.
 */
const opensOnFocus = (element: HTMLElement) => element.matches("input[aria-haspopup]");

/**
 * The first control in `root` that Tab would reach, that can take the focus now and that opens
 * nothing when it does: a focus set by code must not put a list over the page.
 */
export function firstControlIn(root: ParentNode): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (control) => takesTheFocus(control) && !opensOnFocus(control),
  );
}
