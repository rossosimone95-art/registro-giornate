#!/usr/bin/env python3
"""Costruisce l'app installabile (dist/) dalla pagina del Registro.

La pagina è la stessa dell'artifact su Claude: qui le si aggiunge l'intestazione da app
(manifest, icone), la schermata di accesso e il collegamento a Firebase (shim.js).
Uso: python3 build.py  (legge registro.html, scrive docs/ per GitHub Pages)
"""
import re
import shutil
import sys
import time
from pathlib import Path

QUI = Path(__file__).resolve().parent
SRC, DIST = QUI / "src", QUI / "docs"

pagina = Path(sys.argv[1] if len(sys.argv) > 1 else QUI / "registro.html").read_text(encoding="utf8")

# testi che parlavano di Claude
pagina = pagina.replace(
    "Apri il Registro dall'app Claude, entrando con il tuo account, e ricarica lì la Cronologia.",
    "Controlla la connessione e riapri l'app.",
)
pagina = re.sub(r'<meta name="claude:[^>]*>\n?', "", pagina)
pagina = re.sub(r"<title>.*?</title>\n?", "", pagina, count=1)

TESTA = """<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Registro Giornate</title>
<meta name="theme-color" content="#2E6A3E">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Registro">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>
body { background: var(--bg, #F2F4EF); padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom) }
#accesso { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; background: var(--bg, #F2F4EF) }
#accesso[hidden] { display: none }
.acc-card { width: min(420px, 100%); background: var(--surface, #fff); border: 1px solid var(--line, #DAE0D6); border-radius: 16px; padding: 24px 20px; display: grid; gap: 12px }
.acc-card img { width: 64px; height: 64px; border-radius: 14px }
.acc-card h1 { margin: 0 }
.acc-body { display: grid; gap: 12px }
.acc-body p { margin: 0 }
.acc-google { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 12px 16px; font-size: 1rem }
.acc-google .g { font-weight: 700; background: #fff; color: #2E6A3E; border-radius: 50%; width: 24px; height: 24px; display: grid; place-items: center }
.acc-msg { color: var(--crit, #B3261E) }
.acc-altro summary { cursor: pointer; color: var(--muted, #5D6A60); font-size: .9rem }
.acc-altro { display: grid; gap: 10px }
.acc-altro[open] > *:not(summary) { margin-top: 10px }
.acc-altro input { width: 100%; padding: 9px 10px; border: 1px solid var(--line, #DAE0D6); border-radius: 8px; font: inherit; background: var(--surface, #fff); color: inherit }
.app-membro { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 0; border-top: 1px solid var(--line, #DAE0D6) }
.app-mail { flex: 1 1 14rem; font-weight: 600; overflow-wrap: anywhere }
.app-membro input[type=email] { flex: 1 1 14rem; padding: 7px 10px; border: 1px solid var(--line, #DAE0D6); border-radius: 8px; font: inherit; background: var(--surface, #fff); color: inherit }
.app-membro select { padding: 6px 8px; border: 1px solid var(--line, #DAE0D6); border-radius: 8px; background: var(--surface, #fff); color: inherit; font: inherit }
</style>
<script>
/* la pagina chiede window.claude.use(...): qui risponde Firebase, appena si è entrati */
window.__fb = {};
window.__fbReady = new Promise(function (ok, ko) { window.__fb.resolve = ok; window.__fb.reject = ko; });
window.claude = { use: function (nome) { return window.__fbReady.then(function (api) { return api.use(nome); }); } };
</script>
<script type="module" src="shim.js?v=__VERSIONE__"></script>
</head>
<body>
<div id="accesso"><div class="acc-card">
  <img src="icon-192.png" alt="" width="64" height="64">
  <h1>Registro Giornate</h1>
  <div class="acc-body"><p>Carico…</p></div>
</div></div>
"""

versione = time.strftime("%Y%m%d%H%M%S")
if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir()
for f in SRC.iterdir():
    shutil.copy(f, DIST / f.name)
(DIST / "sw.js").write_text((SRC / "sw.js").read_text().replace("__VERSIONE__", versione))
(DIST / "index.html").write_text(TESTA.replace("__VERSIONE__", versione) + pagina + "\n</body>\n</html>\n", encoding="utf8")
(DIST / ".nojekyll").write_text("")
print("docs/ pronta, versione", versione)
