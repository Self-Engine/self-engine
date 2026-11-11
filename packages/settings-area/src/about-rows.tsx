// The rows of the View About, which only display (D203): no update button, no channel switch and
// no link to the outside.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Button, CopyButton, Text } from "@mantine/core";
import type { SettingsRow, SettingsRowControlProps } from "./row.ts";
import { type VersionInfo, versionLine } from "./version.ts";
import { VIEW_IDS } from "./views.ts";

const CHANNEL_NAMES: Readonly<Record<NonNullable<VersionInfo["channel"]>, MessageDescriptor>> = {
  dev: msg({ message: "Dev", context: "Channel" }),
  nightly: msg({ message: "Nightly", context: "Channel" }),
  stable: msg({ message: "Stable", context: "Channel" }),
};

/** The app's license, as its `LICENSE` file and ADR 0002 state it. */
const LICENSE = "AGPL-3.0-only";

/** A row that shows a value which is the same in every language. */
function shownValue(value: string) {
  return function ShownValue() {
    return <Text>{value}</Text>;
  };
}

function shownMessage(value: MessageDescriptor) {
  return function ShownMessage() {
    const { i18n } = useLingui();
    return <Text>{i18n._(value)}</Text>;
  };
}

function copyLine(line: string) {
  return function CopyLine({ labelledBy }: SettingsRowControlProps) {
    return (
      <CopyButton value={line}>
        {({ copied, copy }) => (
          // The button keeps its place and says what happened, so the confirmation is where the
          // user is looking and is read out as the button's new name.
          <Button aria-describedby={labelledBy} onClick={copy} variant="default">
            {copied ? (
              <Trans context="Confirms that the version information is on the clipboard">
                Copied
              </Trans>
            ) : (
              <Trans context="Button that copies the version information">Copy</Trans>
            )}
          </Button>
        )}
      </CopyButton>
    );
  };
}

/** About's rows for the app that is running: only the desktop app has a channel. */
export function aboutRows(version: VersionInfo): readonly SettingsRow[] {
  const view = VIEW_IDS.about;
  const channel = version.channel && CHANNEL_NAMES[version.channel];
  return [
    {
      id: "version",
      view,
      title: msg`Version`,
      searchWords: [msg`Release`, msg`Build`],
      values: [],
      control:
        version.version === undefined
          ? shownMessage(msg({ message: "Unknown", context: "Version of the app" }))
          : shownValue(version.version),
    },
    ...(channel
      ? [
          {
            id: "channel",
            view,
            title: msg`Channel`,
            description: msg`The release line this app belongs to.`,
            searchWords: [],
            values: [channel],
            control: shownMessage(channel),
          },
        ]
      : []),
    {
      id: "operating-system",
      view,
      title: msg`Operating system`,
      searchWords: [msg`Platform`],
      values: [],
      control: shownValue(version.operatingSystem),
    },
    {
      id: "copy-version-information",
      view,
      title: msg`Version information`,
      description: channel
        ? msg`Version, channel and operating system as one line, for a bug report.`
        : msg`Version and operating system as one line, for a bug report.`,
      searchWords: [msg`Clipboard`, msg`Report a problem`],
      values: [],
      control: copyLine(versionLine(version)),
    },
    {
      id: "license",
      view,
      title: msg`License`,
      description: msg`Self-Engine is free software under the GNU Affero General Public License, version 3.`,
      searchWords: [msg`Open source`, msg`Rights`],
      values: [],
      control: shownValue(LICENSE),
    },
  ];
}
