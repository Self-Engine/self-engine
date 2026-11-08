import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  CHANNELS,
  type Channel,
  channelIdentity,
  parseChannel,
  resolveDevServer,
  userDataPath,
} from "./channel.ts";

describe("channelIdentity", () => {
  it.each([
    ["dev", "Self-Engine Dev", "app.selfengine.desktop.dev", "self-engine-dev"],
    ["nightly", "Self-Engine Nightly", "app.selfengine.desktop.nightly", "self-engine-nightly"],
    ["stable", "Self-Engine", "app.selfengine.desktop", "self-engine"],
  ] as const)("names the %s channel", (channel, productName, appId, scheme) => {
    expect(channelIdentity(channel)).toMatchObject({ channel, productName, appId, scheme });
  });

  it.each(["productName", "appId", "scheme", "dataFolder", "icon"] as const)(
    "gives every channel its own %s",
    (field) => {
      const values = CHANNELS.map((channel) => channelIdentity(channel)[field]);
      expect(new Set(values).size).toBe(CHANNELS.length);
    },
  );

  it.each(CHANNELS)("keeps %s clear of the old app's identity", (channel) => {
    const identity = channelIdentity(channel);
    expect(identity.appId).not.toBe("com.self-engine.desktop");
    expect(identity.dataFolder).not.toContain("@self-engine");
    expect(identity.productName).not.toContain("@self-engine");
  });
});

describe("parseChannel", () => {
  it("defaults to dev when the build names no channel", () => {
    expect(parseChannel(undefined)).toBe("dev");
  });

  it.each(CHANNELS)("accepts %s", (channel: Channel) => {
    expect(parseChannel(channel)).toBe(channel);
  });

  it.each(["", "Nightly", "production"])("refuses %j", (value) => {
    expect(() => parseChannel(value)).toThrow(/Unknown channel/);
  });
});

describe("userDataPath", () => {
  it("puts the channel's folder under the app-data directory", () => {
    expect(userDataPath("/data", "Self-Engine Nightly", "")).toBe(
      path.join("/data", "Self-Engine Nightly"),
    );
  });

  it("follows an explicit override", () => {
    expect(userDataPath("/data", "Self-Engine Nightly", "/tmp/run")).toBe(path.resolve("/tmp/run"));
  });
});

describe("resolveDevServer", () => {
  it("parses the dev server of a dev build", () => {
    expect(resolveDevServer("dev", " http://127.0.0.1:5733/ ")?.origin).toBe(
      "http://127.0.0.1:5733",
    );
  });

  it.each([undefined, "", "   "])("fails a dev build without a URL (%j)", (url) => {
    expect(() => resolveDevServer("dev", url)).toThrow(/pnpm dev/);
  });

  it("fails on a URL that does not parse", () => {
    expect(() => resolveDevServer("dev", "not a url")).toThrow();
  });

  it.each(["nightly", "stable"] as const)("makes %s ignore the variable", (channel) => {
    expect(resolveDevServer(channel, "http://127.0.0.1:5733/")).toBeUndefined();
    expect(resolveDevServer(channel, undefined)).toBeUndefined();
  });
});
