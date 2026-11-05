// Tiene in memoria l'app per aprirla anche con poca rete; i dati arrivano sempre da Firebase.
const VERSIONE = "rg-20261105110534";
const FILE = ["./", "./index.html", "./shim.js", "./config.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSIONE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const statico = u.origin === location.origin || u.hostname === "www.gstatic.com" || u.hostname.endsWith("fonts.googleapis.com") || u.hostname === "fonts.gstatic.com";
  if (!statico || u.pathname.includes("/__/")) return;
  // prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(VERSIONE).then((k) => k.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html"))));
});
