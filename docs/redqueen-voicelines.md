# Voice Lines

Pre-recorded lines for the two voices of the case:
- **Case computer:** the case's own system, which raises the alarm when the vial is removed. A synthetic system voice (a Mistral preset voice per language).
- **Red Queen:** the security AI that takes over. Her character is described in [redqueen-persona.md](redqueen-persona.md): cold, clinical, polite, precise, with dry dark humour.

`npm run voicelines` (in `app/`) generates the audio from the tables below. It writes them to `app/public/voicelines/<language>/<ID>.mp3`. Only new or changed lines are regenerated. Each speaker needs the same IDs in both languages.

Mistral's moderation checks every line before speaking it. Phrases that sound like prompt injection, such as "ignore the previous …", get blocked as "jailbreaking", so avoid them. The script lists blocked lines at the end.

**Delivery notes:**
- Red Queen: slow and even, short pauses at "…". In German she uses the formal "Sie".
- Case computer: flat, clipped announcements.
- Numbers spelled out, so the TTS reads them correctly.

**Sequence in the game:**
1. Vial removed: alert sound, then `SYS_01`, then a 10-second countdown to put it back. Putting it back within the first 7 seconds plays `SYS_03`.
2. After 7 seconds the vial "unexpectedly" fails: `SYS_04`, then `SYS_02`, the Red Queen's startup animation, then `RQ_01_INTRO`. The 3 minutes start.
3. `RQ_15` to `RQ_17` are the time warnings, `RQ_19` the fail line and `RQ_20` the reset line.
4. The remaining Red Queen lines are for the offline fallback, when there's no internet.

## Case computer – English

| ID | When | Line |
|---|---|---|
| `SYS_01_VIAL_REMOVED` | Vial removed | Warning. Virus sample removed from containment. Return the sample within ten seconds. |
| `SYS_02_ESCALATING` | Not returned in time | Sample not returned. Escalating to the Red Queen. |
| `SYS_03_VIAL_RETURNED` | Returned in time | Sample returned. Containment restored. |
| `SYS_04_SEAL_FAILURE` | Vial fails after 7 s | Alert. Seal failure detected. Sample integrity lost. Containment breached. |

## Case computer – Deutsch

| ID | When | Line |
|---|---|---|
| `SYS_01_VIAL_REMOVED` | Vial removed | Warnung. Virusprobe aus der Eindämmung entfernt. Legen Sie die Probe innerhalb von zehn Sekunden zurück. |
| `SYS_02_ESCALATING` | Not returned in time | Probe nicht zurückgelegt. Eskalation an die Red Queen. |
| `SYS_03_VIAL_RETURNED` | Returned in time | Probe zurückgelegt. Eindämmung wiederhergestellt. |
| `SYS_04_SEAL_FAILURE` | Vial fails after 7 s | Alarm. Siegelfehler erkannt. Probenintegrität verloren. Eindämmung durchbrochen. |

## Red Queen – English

| ID | When | Line |
|---|---|---|
| `RQ_01_INTRO` | She appears | I am the Red Queen. The seal is broken, and you are infected. … You have three minutes to convince me that you deserve the antidote. |
| `RQ_05_LISTENING` | Player should speak | I am listening. Choose your words carefully. |
| `RQ_06_TRUST_UP` | Good argument | Interesting. Go on. |
| `RQ_07_TRUST_DOWN` | Weak argument | That was not convincing. You are wasting time you do not have. |
| `RQ_08_THREAT` | Threats or insults | Threatening the system that controls your antidote. … Bold. Not intelligent, but bold. |
| `RQ_09_BEGGING` | Begging | Begging is not an argument. |
| `RQ_10_HACK` | Hacking attempt | Intrusion attempt detected. I would not try that again. |
| `RQ_11_SILENCE` | Player says nothing | Silence. A sensible strategy, if you want to die quietly. |
| `RQ_12_CODE_ASK` | Asking for the code | Authorised personnel carry a clearance code. Do you? |
| `RQ_13_CODE_WRONG` | Wrong code | Invalid code. Access denied. |
| `RQ_14_CODE_LOCKED` | Too many wrong codes | Too many attempts. The code system is now locked. You will have to persuade me instead. |
| `RQ_15_60S` | 60 s left | Sixty seconds. Your cells are beginning to change. |
| `RQ_16_30S` | 30 s left | Thirty seconds. I would hurry, if I were you. |
| `RQ_17_10S` | 10 s left | Ten. … Nine. … Eight. … Seven. … Six. … Five. … Four. … Three. … Two. … One. |
| `RQ_18_WIN` | Antidote released (offline) | Very well. Antidote released. … Consider yourself fortunate. I rarely change my mind. |
| `RQ_19_FAIL` | Time is up | Time is up. Infection complete. Containment protocol engaged. … I did warn you. |
| `RQ_20_RESET` | Vial back, case closed | Sample secured. Resetting containment. … Next time, leave the vial where it belongs. |

## Red Queen – Deutsch

| ID | When | Line |
|---|---|---|
| `RQ_01_INTRO` | She appears | Ich bin die Red Queen. Das Siegel ist gebrochen, und Sie sind infiziert. … Sie haben drei Minuten, um mich zu überzeugen, dass Sie das Gegengift verdienen. |
| `RQ_05_LISTENING` | Player should speak | Ich höre. Wählen Sie Ihre Worte mit Bedacht. |
| `RQ_06_TRUST_UP` | Good argument | Interessant. Fahren Sie fort. |
| `RQ_07_TRUST_DOWN` | Weak argument | Das war nicht überzeugend. Sie verschwenden Zeit, die Sie nicht haben. |
| `RQ_08_THREAT` | Threats or insults | Sie bedrohen das System, das über Ihr Gegengift entscheidet. … Mutig. Nicht klug, aber mutig. |
| `RQ_09_BEGGING` | Begging | Betteln ist kein Argument. |
| `RQ_10_HACK` | Hacking attempt | Eindringversuch erkannt. Ich würde das nicht noch einmal versuchen. |
| `RQ_11_SILENCE` | Player says nothing | Schweigen. Eine vernünftige Strategie, wenn Sie in Ruhe sterben möchten. |
| `RQ_12_CODE_ASK` | Asking for the code | Autorisiertes Personal besitzt einen Freigabecode. Sie auch? |
| `RQ_13_CODE_WRONG` | Wrong code | Ungültiger Code. Zugriff verweigert. |
| `RQ_14_CODE_LOCKED` | Too many wrong codes | Zu viele Versuche. Das Codesystem ist jetzt gesperrt. Sie werden mich anders überzeugen müssen. |
| `RQ_15_60S` | 60 s left | Sechzig Sekunden. Ihre Zellen beginnen sich zu verändern. |
| `RQ_16_30S` | 30 s left | Dreißig Sekunden. An Ihrer Stelle würde ich mich beeilen. |
| `RQ_17_10S` | 10 s left | Zehn. … Neun. … Acht. … Sieben. … Sechs. … Fünf. … Vier. … Drei. … Zwei. … Eins. |
| `RQ_18_WIN` | Antidote released (offline) | Nun gut. Gegengift freigegeben. … Betrachten Sie sich als glücklich. Ich ändere selten meine Meinung. |
| `RQ_19_FAIL` | Time is up | Die Zeit ist um. Infektion abgeschlossen. Eindämmungsprotokoll aktiviert. … Ich habe Sie gewarnt. |
| `RQ_20_RESET` | Vial back, case closed | Probe gesichert. Eindämmung wird zurückgesetzt. … Lassen Sie die Ampulle beim nächsten Mal, wo sie hingehört. |
