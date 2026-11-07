// PROTOTYPE: edit drawer over the content (D63) with discard confirmation.
import { Button, Drawer, Group, Modal, Select, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";
import type { Row } from "../data";

type Props = {
  rounded: boolean;
  row: Row | null;
  moduleLabel: string;
  onClose: () => void;
  onSave: (row: Row) => void;
};

export function EditDrawer({ rounded, row, moduleLabel, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Row | null>(row);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setDraft(row);
    setNotes("");
  }, [row]);

  const dirty =
    !!row && !!draft && (JSON.stringify(row) !== JSON.stringify(draft) || notes !== "");

  const requestClose = () => (dirty ? setConfirm(true) : onClose());

  return (
    <>
      <Drawer
        opened={!!row}
        onClose={requestClose}
        position="right"
        size={460}
        offset={rounded ? 8 : 0}
        radius={rounded ? 16 : 0}
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
        title={
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              {moduleLabel} bearbeiten
            </Text>
            <Text fw={600}>{row?.title}</Text>
          </Stack>
        }
        styles={{
          content: { background: "var(--se-surfaceRaised)", display: "flex", flexDirection: "column" },
          header: { background: "var(--se-surfaceRaised)", borderBottom: "1px solid var(--se-border)" },
          body: { flex: 1, display: "flex", flexDirection: "column", paddingTop: 16 },
        }}
      >
        {draft && (
          <Stack gap="md" style={{ flex: 1 }}>
            <TextInput
              label="Titel"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })}
              data-autofocus
            />
            <TextInput
              label="Zuordnung"
              value={draft.meta}
              onChange={(e) => setDraft({ ...draft, meta: e.currentTarget.value })}
            />
            <Select
              label="Status"
              value={draft.status}
              data={Array.from(new Set([draft.status, "Aktiv", "Pausiert", "Archiv"]))}
              onChange={(v) => v && setDraft({ ...draft, status: v })}
              comboboxProps={{ withinPortal: true }}
            />
            <Textarea
              label="Notizen"
              autosize
              minRows={4}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
            <div style={{ flex: 1 }} />
            <Group justify="space-between" pt="md" style={{ borderTop: "1px solid var(--se-border)" }}>
              <Text size="xs" c="dimmed">
                {dirty ? "Ungespeicherte Änderungen" : "Keine Änderungen"}
              </Text>
              <Group gap="xs">
                <Button variant="default" onClick={requestClose}>
                  Abbrechen
                </Button>
                <Button disabled={!dirty} onClick={() => onSave(draft)}>
                  Speichern
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Drawer>
      <Modal opened={confirm} onClose={() => setConfirm(false)} title="Änderungen verwerfen?" centered size="sm">
        <Text size="sm" mb="lg">
          Du hast Änderungen, die noch nicht gespeichert sind.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => setConfirm(false)}>
            Weiter bearbeiten
          </Button>
          <Button
            color="red"
            onClick={() => {
              setConfirm(false);
              onClose();
            }}
          >
            Verwerfen
          </Button>
        </Group>
      </Modal>
    </>
  );
}
