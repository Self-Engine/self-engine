# Runde 49 (2026-11-21): Der Typ markierter Werte im Entwurf eines Formulars (vor #275, ergänzt D319)

Grundlage: der Stand auf `main` nach #381.

- **Entwurf heute:** Sein Typ leitet sich aus der Eingabe des Vertrags ab, und jeder Text wird zu
  `string` geweitet, damit der Entwurf auch einen gespeicherten Wert zeigen kann, den ein neuerer
  Vertrag nicht mehr annimmt, etwa ein Icon.
- **Marken heute:** Die Schemas von `time` und die Ids markieren ihren Wert nur auf der Ausgabe.
  Die Eingabe eines Vertrags ist einfacher Text.
- **Folge:** Ein Datumsfeld, an ein Titelfeld gebunden, kompilierte; das Feld prüfte den Wert erst
  zur Laufzeit. Dasselbe galt für die Uhrzeit, die zwei Zeitpunkte von „Datum, Beginn, Ende“ und
  die Projektauswahl.
- **Zod 4.6.7** kann eine Marke auch auf der Eingabe verlangen (`brand<"X", "inout">()`).

- **D365 Der Entwurf behält die Marke eines Werts, den das Eingabe-Schema markiert; die Eingabe
  des Vertrags bleibt unmarkiert.** `forms` liest den Typ eines Felds aus dem, was das
  Eingabe-Schema nach der Prüfung weiterreicht: Ist der Wert dort markiert, hält der Entwurf den
  markierten Typ, sonst wie bisher einfachen Text. Ein Feld für einen markierten Wert lässt sich
  nur an ein Feld binden, das genau diesen Wert hält. _Gründe:_ Der Compiler fängt die falsche
  Bindung, und kein Vertrag und kein Aufrufer ändert sich. Der Owner: Typsicherheit hat Vorrang.
  _Beispiel:_ Ein Entwurf mit `title` und `day` hält `string | null` und `CalendarDay | null`.
  `<CalendarDayField name="title" />` ist ein Typfehler, ebenso `<TextField name="day" />`.
  _Preis:_ Ein Wert außerhalb eines Formulars, etwa ein Aufruf einer Operation mit falschem Text,
  wird weiter erst vom Port abgelehnt. Wer einen Entwurf von Hand schreibt, braucht für ein
  markiertes Feld einen markierten Wert; aus einer Abfrage kommt er schon so. _Laufzeit:_ keine;
  es ändern sich nur Typen. Die Prüfung im Feld bleibt, weil die Bindung den Wert ohne Typ
  weiterreicht. _Verworfen:_ so lassen (Prüfung nur zur Laufzeit); die Marke auf der Eingabe des
  Vertrags (jeder Aufrufer, jeder Test und jede Fixture müsste markierte Werte übergeben, und der
  Entwurf müsste die Marke trotzdem eigens behalten).
