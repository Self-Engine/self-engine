// PROTOTYPE: in-memory sample data, no persistence.
import {
  IconCalendar,
  IconChecklist,
  IconClockHour4,
  IconFolders,
  IconWallet,
  type Icon,
} from "@tabler/icons-react";
import type { ModuleId } from "./themes";

export type ModuleDef = {
  id: ModuleId;
  label: string;
  icon: Icon;
  primaryAction: string;
  sections: { label: string; items: string[] }[];
};

export const MODULES: ModuleDef[] = [
  {
    id: "projects",
    label: "Projekte",
    icon: IconFolders,
    primaryAction: "Neues Projekt",
    sections: [
      { label: "Ansichten", items: ["Alle", "Aktiv", "Pausiert", "Archiv"] },
      { label: "Kunden", items: ["Acme GmbH", "Nordlicht", "Studio Kiel"] },
    ],
  },
  {
    id: "time",
    label: "Zeit",
    icon: IconClockHour4,
    primaryAction: "Timer starten",
    sections: [
      { label: "Ansichten", items: ["Heute", "Woche", "Monat", "Nicht abgerechnet"] },
      { label: "Kategorien", items: ["Entwicklung", "Meetings", "Design"] },
    ],
  },
  {
    id: "finance",
    label: "Finanzen",
    icon: IconWallet,
    primaryAction: "Neue Buchung",
    sections: [
      { label: "Ansichten", items: ["Übersicht", "Buchungen", "Rechnungen"] },
      { label: "Konten", items: ["Girokonto", "Tagesgeld", "Kreditkarte"] },
    ],
  },
  {
    id: "calendar",
    label: "Kalender",
    icon: IconCalendar,
    primaryAction: "Neuer Termin",
    sections: [{ label: "Ansichten", items: ["Tag", "Woche", "Monat"] }],
  },
  {
    id: "habits",
    label: "Gewohnheiten",
    icon: IconChecklist,
    primaryAction: "Neue Gewohnheit",
    sections: [{ label: "Ansichten", items: ["Heute", "Verlauf", "Statistik"] }],
  },
];

export type Row = { id: number; title: string; meta: string; status: string; amount: string };

const ROWS: Record<ModuleId, Row[]> = {
  projects: [
    { id: 1, title: "Website-Relaunch", meta: "Acme GmbH", status: "Aktiv", amount: "42,5 h" },
    { id: 2, title: "App-Prototyp", meta: "Nordlicht", status: "Aktiv", amount: "18,0 h" },
    { id: 3, title: "Branding", meta: "Studio Kiel", status: "Pausiert", amount: "7,25 h" },
    { id: 4, title: "Wartungsvertrag", meta: "Acme GmbH", status: "Aktiv", amount: "3,0 h" },
    { id: 5, title: "Workshop Q1", meta: "Nordlicht", status: "Archiv", amount: "12,0 h" },
  ],
  time: [
    { id: 1, title: "API-Anbindung", meta: "Website-Relaunch", status: "09:00–11:30", amount: "2,5 h" },
    { id: 2, title: "Abstimmung", meta: "App-Prototyp", status: "11:45–12:15", amount: "0,5 h" },
    { id: 3, title: "Layout-Entwurf", meta: "Branding", status: "13:00–15:45", amount: "2,75 h" },
    { id: 4, title: "Code-Review", meta: "Wartungsvertrag", status: "16:00–16:30", amount: "0,5 h" },
  ],
  finance: [
    { id: 1, title: "Rechnung 2026-041", meta: "Acme GmbH", status: "Bezahlt", amount: "+3.400,00 €" },
    { id: 2, title: "Miete Büro", meta: "Girokonto", status: "Gebucht", amount: "−650,00 €" },
    { id: 3, title: "Software-Abos", meta: "Kreditkarte", status: "Gebucht", amount: "−84,90 €" },
  ],
  calendar: [
    { id: 1, title: "Kickoff Nordlicht", meta: "Mo 10:00", status: "Termin", amount: "1 h" },
    { id: 2, title: "Zahnarzt", meta: "Mi 08:30", status: "Privat", amount: "45 min" },
  ],
  habits: [
    { id: 1, title: "Laufen", meta: "3× pro Woche", status: "2/3", amount: "🔥 5" },
    { id: 2, title: "Lesen", meta: "täglich", status: "6/7", amount: "🔥 12" },
  ],
};

export function rowsFor(id: ModuleId): Row[] {
  return ROWS[id];
}
