# Registro Giornate

App installabile (PWA) del Registro Giornate di Simone, Papà e Lorenzo:
giornate di lavoro dalla Cronologia di Google Maps, clienti, agenda delle manutenzioni.

- `registro.html` — la pagina del Registro (la stessa usata su Claude).
- `src/` — collegamento a Firebase (`shim.js`), configurazione, icone, service worker.
- `build.py` — unisce tutto in `docs/`, la cartella pubblicata da GitHub Pages.
- `firestore.rules` — regole di sicurezza da incollare in Firebase → Firestore → Regole.
- `test/` — prova in locale con un Firebase finto (`node test/run.js owner FILE.json`).

I dati non stanno in questo repository: sono nel database Firestore, leggibile solo
dalle email abilitate in Impostazioni → Chi può entrare.

Per aggiornare: modificare `registro.html` o `src/`, poi `python3 build.py` e pubblicare.
