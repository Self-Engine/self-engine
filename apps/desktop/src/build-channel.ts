import { type ChannelIdentity, channelIdentity, parseChannel } from "./channel.ts";

// Replaced when the bundle is built (`define` in vite.config.ts).
declare const __SELF_ENGINE_CHANNEL__: string;

/** The identity of the channel this bundle was built for. */
export const buildIdentity: ChannelIdentity = channelIdentity(
  parseChannel(__SELF_ENGINE_CHANNEL__),
);
