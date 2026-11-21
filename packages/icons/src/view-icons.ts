// Icons only Views and Module Indicators draw, apart from the catalog's module, which the start loads for the Navbar.
// The bundler places a module whole in one chunk: an icon here lands in the chunk of the View
// that draws it, and never in the start.

import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { IntersectSquareIcon } from "@phosphor-icons/react/dist/csr/IntersectSquare";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { StopIcon } from "@phosphor-icons/react/dist/csr/Stop";
import { catalogIcon } from "./catalog-icon.ts";

export const PreviousIcon = catalogIcon(CaretLeftIcon);
export const NextIcon = catalogIcon(CaretRightIcon);
/** An entry that runs past midnight into another day. */
export const CrossesMidnightIcon = catalogIcon(MoonIcon);
/** A time entry that overlaps another entry. */
export const OverlapsEntryIcon = catalogIcon(IntersectSquareIcon);
/** Starts a timer. */
export const StartTimerIcon = catalogIcon(PlayIcon);
/** Stops the running timer. */
export const StopTimerIcon = catalogIcon(StopIcon);
