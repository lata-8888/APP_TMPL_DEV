# App Template – Projektkontext für Claude Code

Fundament für zukünftige Apps (Vorlage). Die Familien-App `lata-family` ist eine Kopie davon mit zusätzlichen Bereichen.

## Was die App kann
- **Login** mit Handynummer + PIN (Standard-PIN = letzte 6 Ziffern der Nummer). Keine Selbstregistrierung. Nummernfeld mit Länderauswahl **CH +41 / DE +49 / Andere**, Live-Formatierung, `+49…`/`0041…` wählt das Land automatisch (wie FBRO-App). Gespeichert wird `+41791234567`.
- **Events:** kommend/vergangen; Datum und Zeit getrennt; pro Event «Teilnahme nötig» (`rsvp`); Antworten «Dabei / Nicht dabei» mit Teilnehmerliste. Anlegen/Bearbeiten mit **+** und **…** auf der Seite (Admin und Event Manager), Löschen im Admin.
- **Tasks:** jede Person kann jeder Person (auch sich selbst) eine Aufgabe mit Wunschtermin zuweisen. Abschnitte «Für mich», «Von mir», für Admins «Weitere». Abhaken mit Kästchen. Sichtbar nur für Ersteller, Zugewiesene und Admins; Zugewiesene dürfen nur «erledigt» setzen.
- **Admin:** Events; Personen (Gruppen User/Gäste, Rollen, PIN zurücksetzen); **Design**; **Standardsprache**.
- **Profil:** Name, Sprache, Hell/Dunkel/Automatisch, PIN ändern, App installieren, Abmelden. Banner, solange der Standard-PIN aktiv ist.
- **Rollen:** `User`, `Gast` (`is_guest`), `Admin` (`is_admin`), `Event Manager` (`is_event_manager`; darf Events verwalten, sieht im Admin nur Events). Gäste sind weder Admin noch Event Manager.
- **Designs** (Admin wählt, gilt für alle; `app_settings`): `standard`, `holland` (Anzeigename «Orange»), `light` (Anzeigename «Simple»).
- **Sprachen:** `de`, `en`, `nl`. Standardsprache vom Admin; jede Person kann im Profil überschreiben.
- **Default-Admin:** *System Administrator*, `+41 79 623 23 45`, Standard-PIN `232345`. Wird von `supabase/schema.sql` bei jedem Lauf angelegt/als Admin sichergestellt, per Trigger geschützt. **PIN beim ersten Login ändern!**

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
