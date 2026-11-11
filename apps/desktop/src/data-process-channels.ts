// The IPC channels between the page's preload and the main process about the data process. Free
// of `electron` and of any schema, so the sandboxed preload stays small.

/** Page (through the preload) → main process: asks for a port to the data process. */
export const PORT_REQUEST_CHANNEL = "data-process:request-port";

// The preload passes what arrives on the next four channels on to the page as window messages
// (`PageMessage` in @self-engine/desktop-bridge).

/** Main process → preload: the port in this message's `ports` reaches the data process. */
export const PORT_CHANNEL = "data-process:port";

/** Main process → preload: the data process exited unexpectedly; a fresh port follows. */
export const GONE_CHANNEL = "data-process:gone";

/** Main process → preload: the data process kept crashing and stays down until a retry. */
export const STOPPED_CHANNEL = "data-process:stopped";

/**
 * Main process → preload: the data process exited in the failure state this message carries.
 * It is not restarted (spec #29), so the page keeps showing that failure.
 */
export const FAILED_CHANNEL = "data-process:failed";

/** Page (through the preload) → main process: start the stopped data process again. */
export const RETRY_CHANNEL = "data-process:retry";
