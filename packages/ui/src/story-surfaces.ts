// For Stories only. The waits for a fading surface live in `@self-engine/theme`, the lowest package
// whose stories open one; this subpath keeps them where every other story helper is found.
export { closed, settled, type SettleOptions } from "@self-engine/theme/story-surfaces";
