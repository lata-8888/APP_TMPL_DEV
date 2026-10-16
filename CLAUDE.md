# App Template – Projektkontext für Claude Code

Fundament für zukünftige Apps (Vorlage). Die Familien-App `lata-family` ist eine Kopie davon mit zusätzlichen Bereichen.

## Was die App kann
- **Login** mit Handynummer + PIN (Standard-PIN = letzte 6 Ziffern der Nummer). Keine Selbstregistrierung. Länderauswahl CH/DE/Andere, Live-Formatierung.
- **Agenda** (Tabs Event Liste | Kalender): Events mit optionaler Zeit/Ort/Kommentar, Teilnahme nötig (`rsvp`, Standard aus), Zuteilung an Personen, Wiederholung (unbegrenzt, bis 1 Jahr voraus), Antworten «Dabei / Nicht dabei».
- **Tasks:** Tabs «Für mich | Von mir | Weitere (Admin)»; jede Person kann jeder Person eine Aufgabe zuweisen.
- **Admin:** (alle Bereiche beim Öffnen zu) Agenda, Personen, Tasks (alle), Standard Design, Standard Sprache.
- **Profil:** Name und Handynummer antippen, Sprache, Hell/Dunkel/Automatisch, Design pro Person (White, Blue, Petrol, Orange), PIN, Installieren.
- **Rollen:** `User`, `Gast`, `Admin`, `Event Manager`. **Sprachen:** de, en, nl.
- **Default-Admin:** *System Administrator*, `+41 79 623 23 45`, Standard-PIN `232345`. PIN beim ersten Login ändern!
## Mehrere Apps in einem Supabase-Projekt
Die Vorlage nutzt Tabellen ohne Präfix (`profiles`, `events`, `tasks` …). Eine Kopie im selben Projekt (z. B. `lata-family`) setzt in `config.js` `TABLE_PREFIX` / `FUNCTION_PREFIX` / `STORAGE_SUFFIX` und hat eigene Tabellen und Funktionen mit diesem Präfix; die Logins (`auth.users`) sind gemeinsam. Im Code immer `T('tabelle')` und `F('funktion')` verwenden. Die Tabellen anderer Apps nie anfassen.

## Stack
Vanilla-JS-PWA ohne Build, GitHub Pages + Supabase (Auth, Postgres, RLS, Realtime). Library: supabase-js 2.45.4 via `cdn.jsdelivr.net` (fixe Version). Schriften über Google Fonts (Barlow, Fredoka, Nunito, Inter).

## Dateien
`index.html` · `app.js` (alles in einer Datei) · `i18n.js` (de/en/nl) · `styles.css` (Tokens + Designs über `data-design`) · `sw.js` · `manifest.webmanifest` · `config.js` (einzige Datei, die DEV/PRD unterscheidet) · `supabase/schema.sql` · `tools/check.js` (Prüfung) · `tools/init.js` (Platzhalter ersetzen).

## Harte Regeln
1. **DEV vor PRD.** Vor jedem Deploy `config.js` prüfen: richtige Supabase-URL?
2. **Nie den `service_role`-Key** irgendwo ablegen (Code, Doku, Chat). Nur den Anon-Key; Schutz kommt von RLS.
3. **RLS auf jeder Tabelle.** Jede `security definer`-Funktion mit `set search_path`; Admin-RPCs prüfen serverseitig `is_admin()` und sind `revoke … from public, anon`. Client-Guards ersetzen das nie. `profiles`: Clients dürfen nur `name, language, theme, pin_changed` ändern; Rollen nur per RPC.
4. **Keine Personendaten im Repo** (nur der Default-Admin steht bewusst im Schema). Die Repos sind öffentlich.
5. Alles Sichtbare durch `esc()`; Fehler in `catch` mit `console.error`; nie still schlucken.
6. **`EMAIL_DOMAIN`** steht in `config.js` **und** in `app_settings` (`email_domain`) – gleich, nachträglich nie ändern (Logins heissen `<ziffern>@<EMAIL_DOMAIN>`).
7. Auth-Benutzer aus SQL: die 8 Token-Spalten in `auth.users` müssen `''` sein, nie `NULL` (`_create_user` macht das).
8. Supabase → Authentication: **«Confirm email» aus** und **«Allow new users to sign up» aus**.
9. Ein SQL-`UPDATE` hat nicht automatisch gewirkt – mit einer Abfrage verifizieren.
10. **Texte immer in allen drei Sprachen** (`de`, `en`, `nl`) mit gleichen Schlüsseln; kein Text fest im Code.
11. **Service Worker:** nur Antworten mit Status 200 zwischenspeichern; bei jeder Änderung einer SHELL-Datei `CACHE` um 1 erhöhen (`app-template-vN`).
12. Der Webschutz mancher VPNs/Virenscanner (z. B. NordVPN «Blocker für schädliche Websites») kann Skripte neuer Seiten blockieren (leere Seite am Desktop, Status 204) – nicht ein App-Fehler.

## Arbeitsweise
- Neue Tabelle ⇒ RLS + Policies + Realtime in `schema.sql` (idempotent) **und** auf dem Projekt per Migration anwenden.
- Nach jeder Änderung Klammerprüfung/Syntaxtest; wenn `node` verfügbar: `node tools/check.js`. Vor jedem Deploy Skill **app-deploy**.
- Hochladen per GitHub-Web-Upload ins Repo-Root (keine Unterordner möglich).

## Umgebungen
| | DEV | PRD |
|---|---|---|
| GitHub | `APP_TMPL_DEV` (Pages: https://lata-8888.github.io/APP_TMPL_DEV/) | _TODO_ |
| Supabase | `APP_TMPL_DEV` (`eieeqwzekquvvngaauwp`) | _TODO_ |
| EMAIL_DOMAIN | app-template-dev.example | _TODO (anders)_ |

## Auslieferung
Geänderte Dateien ins Repo hochladen (Commit direkt auf `main`), danach Pages-Deploy abwarten (3–4 Min.) und Seite hart neu laden bzw. App am Handy schliessen und neu öffnen. Bei DB-Änderungen zuerst die Migration, dann die App.
