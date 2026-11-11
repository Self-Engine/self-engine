import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  CHANNELS,
  type Channel,
  bundleDirectory,
  channelIdentity,
  parseChannel,
  resolveDevServer,
  userDataPath,
  versionArgument,
  versionFromArguments,
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

  describe("with the old app's folder", () => {
    const appData = "/Users/me/Library/Application Support";
    const oldFolder = `${appData}/@self-engine/desktop`;
    const parent = `${appData}/@self-engine`;

    it.each([
      ["the folder itself", oldFolder],
      ["a trailing slash", `${oldFolder}/`],
      ["a nested folder", `${oldFolder}/Partitions/test`],
      ["another case", "/users/ME/library/application support/@Self-Engine/DESKTOP"],
      ["another case, nested", `${appData}/@SELF-ENGINE/Desktop/x`],
      ["a path with ..", `${appData}/Self-Engine Dev/../@self-engine/desktop`],
      ["a path that walks through it", `${oldFolder}/x/../y`],
    ])("refuses %s", (_case, override) => {
      expect(() => userDataPath(appData, "Self-Engine Nightly", override)).toThrow(
        /belongs to the installed old Self-Engine app/,
      );
    });

    it("refuses a relative path that lands on it", () => {
      const relative = path.relative(process.cwd(), oldFolder);
      expect(() => userDataPath(appData, "Self-Engine Nightly", relative)).toThrow(
        /old Self-Engine app/,
      );
    });

    it.each([
      ["an unrelated folder", "/tmp/run"],
      ["a sibling with the folder's name as a prefix", `${oldFolder}-old`],
      ["its parent", parent],
      ["the same name under another root", "/other/@self-engine/desktop"],
    ])("keeps %s", (_case, override) => {
      expect(userDataPath(appData, "Self-Engine Nightly", override)).toBe(path.resolve(override));
    });

    it.each(CHANNELS)("leaves the default folder of %s alone", (channel) => {
      const { dataFolder } = channelIdentity(channel);
      expect(userDataPath(appData, dataFolder, "")).toBe(path.join(appData, dataFolder));
    });
  });
});

describe("bundleDirectory", () => {
  it("keeps dist-electron for dev", () => {
    expect(bundleDirectory("dev")).toBe("dist-electron");
  });

  it("gives every channel its own output", () => {
    expect(new Set(CHANNELS.map(bundleDirectory)).size).toBe(CHANNELS.length);
  });

  it.each(["nightly", "stable"] as const)("keeps %s out of dist-electron", (channel) => {
    expect(bundleDirectory(channel)).not.toContain("dist-electron");
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

describe("the app's version on the way to the preload", () => {
  it("reaches the preload among the arguments the main process adds", () => {
    const argv = ["/app/electron", "--type=renderer", versionArgument("0.4.0"), "--enable-sandbox"];
    expect(versionFromArguments(argv)).toBe("0.4.0");
  });

  it("carries a nightly's exact version unchanged", () => {
    const nightly = "0.4.0-nightly.20261112.3+e9fbf50";
    expect(versionFromArguments([versionArgument(nightly)])).toBe(nightly);
  });

  it("is absent when the main process added none, so the rest of the bridge still arrives", () => {
    expect(versionFromArguments(["/app/electron", "--type=renderer"])).toBeUndefined();
  });

  it("is absent when the main process had no version to add, not an empty text", () => {
    expect(versionFromArguments([versionArgument("")])).toBeUndefined();
  });
});
