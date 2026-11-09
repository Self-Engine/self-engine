// Throwaway page to judge translation before the language Setting exists. #23 removes it.

import { Plural, Trans } from "@lingui/react/macro";
import { Alert, Button, Group, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { LANGUAGES, LANGUAGE_TAGS, type Language } from "@self-engine/i18n";
import { useState } from "react";
import { usePreviewLanguage } from "./preview-language.tsx";

const LANGUAGE_OPTIONS = LANGUAGE_TAGS.map((tag) => ({ label: LANGUAGES[tag].name, value: tag }));

export default function LanguageSamplePage() {
  const [language, switchLanguage] = usePreviewLanguage();
  const [switching, setSwitching] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Typed or counted here, so that a switch visibly keeps the state of the page.
  const [name, setName] = useState("Ada");
  const [count, setCount] = useState(1);

  async function changeLanguage(next: Language): Promise<void> {
    setSwitching(true);
    setLoadFailed(false);
    try {
      await switchLanguage(next);
    } catch {
      // Reported by the alert below. The switch changed nothing, and the next attempt loads again.
      setLoadFailed(true);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Stack align="flex-start">
      {/* Disabled during a load, so that a slower earlier load cannot overwrite a later switch. */}
      <SegmentedControl
        data={LANGUAGE_OPTIONS}
        disabled={switching}
        onChange={(next) => {
          void changeLanguage(next as Language);
        }}
        value={language}
      />
      {loadFailed && (
        <Alert color="red">
          <Trans>The language could not be loaded. Please try again.</Trans>
        </Alert>
      )}
      <Text>
        <Trans>This sentence is translated.</Trans>
      </Text>
      <TextInput
        label={<Trans>Your name</Trans>}
        onChange={(event) => {
          setName(event.currentTarget.value);
        }}
        value={name}
      />
      <Text>
        <Trans>Hello {name}, nice to see you.</Trans>
      </Text>
      <Group>
        <Text>
          <Plural value={count} one="# entry" other="# entries" />
        </Text>
        <Button
          onClick={() => {
            setCount(count + 1);
          }}
          variant="light"
        >
          <Trans>Add an entry</Trans>
        </Button>
      </Group>
    </Stack>
  );
}
