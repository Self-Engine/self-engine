import { loadAppCatalog } from "../../src/core/index.ts";

// A side effect, since an app build drops an entry's unused exports.
Object.assign(globalThis, { loadAppCatalog });
