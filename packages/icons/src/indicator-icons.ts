// Icons only Module Indicators draw. Their own module, apart from the start's catalog and from the
// Views' icons, so an indicator, which loads in an idle moment after every start, brings no more
// than the icons it draws.

import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { StopIcon } from "@phosphor-icons/react/dist/csr/Stop";
import { catalogIcon } from "./catalog-icon.ts";

/** Starts a timer. */
export const StartTimerIcon = catalogIcon(PlayIcon);
/** Stops the running timer. */
export const StopTimerIcon = catalogIcon(StopIcon);
