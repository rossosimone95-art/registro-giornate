// Registro Giornate — collegamento a Firebase.
// La pagina del Registro parla con window.claude.use("db" | "user" | "room" | "downloads"):
// qui quelle stesse funzioni sono fatte con Firebase (accesso Google + database Firestore).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, getDocs, setDoc,
  deleteDoc, onSnapshot, query, where, limit, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { FIREBASE_CONFIG, PROPRIETARIO } from "./config.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
auth.languageCode = "it";
let fs;
try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch { fs = initializeFirestore(app, {}); }

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const minuscolo = (e) => String(e || "").trim().toLowerCase();
const pulito = (d) => JSON.parse(JSON.stringify(d)); // Firestore non accetta valori "undefined"

/* ---------- schermata di accesso ---------- */
function mostraAccesso(html) {
  const box = $("accesso");
  box.hidden = false;
  box.querySelector(".acc-body").innerHTML = html;
}
function nascondiAccesso() { $("accesso").hidden = true; }
const errore = (e) => {
  const c = (e && e.code) || "";
  if (c.includes("wrong-password") || c.includes("invalid-credential")) return "Email o password sbagliate.";
  if (c.includes("user-not-found")) return "Nessun account con questa email: tocca \"Crea account\".";
  if (c.includes("email-already-in-use")) return "Esiste già un account con questa email: tocca \"Entra\".";
  if (c.includes("weak-password")) return "La password deve avere almeno 6 caratteri.";
  if (c.includes("invalid-email")) return "L'email non è scritta bene.";
  if (c.includes("network")) return "Manca la connessione a internet.";
  if (c.includes("popup-closed")) return "Accesso annullato.";
  return "Non è andata: " + (e && (e.message || e.code) || "errore sconosciuto");
};
function schermataEntra(msg = "") {
  mostraAccesso(`
    <p>Entra con il tuo account Google: è lo stesso del telefono.</p>
    <button class="btn acc-google" id="acc-google" type="button"><span class="g">G</span> Entra con Google</button>
    ${msg ? `<p class="acc-msg">${esc(msg)}</p>` : ""}
    <details class="acc-altro"><summary>Non hai Google? Entra con email e password</summary>
      <label class="field"><span class="label">Email</span><input id="acc-email" type="email" autocomplete="username" inputmode="email"></label>
      <label class="field"><span class="label">Password</span><input id="acc-pass" type="password" autocomplete="current-password"></label>
      <div class="row"><button class="btn" id="acc-entra" type="button">Entra</button><button class="btn ghost" id="acc-crea" type="button">Crea account</button><button class="linkish" id="acc-reset" type="button">Password dimenticata</button></div>
    </details>`);
}
async function entraGoogle() {
  const prov = new GoogleAuthProvider(); prov.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, prov); }
  catch (e) {
    if (/popup-blocked|operation-not-supported|web-storage/.test(e.code || "")) { try { await signInWithRedirect(auth, prov); return; } catch (e2) { schermataEntra(errore(e2)); return; } }
    schermataEntra(errore(e));
  }
}
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button"); if (!t) return;
  const email = () => minuscolo(($("acc-email") || {}).value), pass = () => ($("acc-pass") || {}).value || "";
  try {
    if (t.id === "acc-google") await entraGoogle();
    else if (t.id === "acc-entra") await signInWithEmailAndPassword(auth, email(), pass());
    else if (t.id === "acc-crea") { const c = await createUserWithEmailAndPassword(auth, email(), pass()); await sendEmailVerification(c.user); }
    else if (t.id === "acc-reset") { await sendPasswordResetEmail(auth, email()); schermataEntra("Ti ho mandato una mail per cambiare la password."); }
    else if (t.id === "acc-verificato") { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); avvia(auth.currentUser); }
    else if (t.id === "acc-rimanda") { await sendEmailVerification(auth.currentUser); t.textContent = "Mail mandata di nuovo"; }
    else if (t.id === "acc-esci" || t.dataset.appEsci) { await signOut(auth); location.reload(); }
  } catch (e) { if (t.id.startsWith("acc-")) schermataEntra(errore(e)); }
});
getRedirectResult(auth).catch((e) => schermataEntra(errore(e)));

/* ---------- chi può entrare ---------- */
let utente = null, membri = null, admin = false, pronto = false;
const refMembri = () => doc(fs, "config", "membri");
async function leggiMembri(u) {
  const mail = minuscolo(u.email);
  let snap;
  try { snap = await getDoc(refMembri()); }
  catch (e) { if ((e.code || "").includes("permission")) return null; throw e; }
  if (!snap.exists()) {
    if (mail !== minuscolo(PROPRIETARIO)) return null;
    const primo = { emails: [mail], admins: [mail], persone: { [mail]: "simone" } };
    await setDoc(refMembri(), primo); return primo;
  }
  const m = snap.data();
  return (m.emails || []).includes(mail) || mail === minuscolo(PROPRIETARIO) ? m : null;
}
async function avvia(u) {
  if (pronto) return;
  if (!u) { schermataEntra(); return; }
  const isGoogle = u.providerData.some((p) => p.providerId === "google.com");
  if (!isGoogle && !u.emailVerified) {
    mostraAccesso(`<p>Ti ho mandato una mail a <b>${esc(u.email)}</b>: apri il link per confermare l'indirizzo, poi torna qui.</p>
      <div class="row"><button class="btn" id="acc-verificato" type="button">Ho confermato</button><button class="btn ghost" id="acc-rimanda" type="button">Rimanda la mail</button><button class="linkish" id="acc-esci" type="button">Esci</button></div>`);
    return;
  }
  mostraAccesso(`<p>Controllo l'accesso…</p>`);
  try { membri = await leggiMembri(u); }
  catch (e) { mostraAccesso(`<p>Non riesco a raggiungere il Registro: ${esc(errore(e))}</p><button class="btn" type="button" onclick="location.reload()">Riprova</button>`); return; }
  if (!membri) {
    mostraAccesso(`<p>Sei entrato come <b>${esc(u.email)}</b>, ma questo account non è ancora abilitato.</p>
      <p>Chiedi a Simone di aggiungerlo in <b>Impostazioni → Chi può entrare</b>, poi riapri l'app.</p>
      <button class="btn ghost" id="acc-esci" type="button">Entra con un altro account</button>`);
    return;
  }
  utente = u; pronto = true;
  const mail = minuscolo(u.email);
  admin = mail === minuscolo(PROPRIETARIO) || (membri.admins || []).includes(mail);
  const R = window.__registro;
  const p = (membri.persone || {})[mail];
  if (R && p && !localStorage.getItem("rg-io-scelto")) { R.S.io = p; try { localStorage.setItem("rg-io", p); } catch {} }
  onSnapshot(refMembri(), (s) => { if (s.exists()) { membri = s.data(); window.__registro && window.__registro.render(); } }, () => {});
  nascondiAccesso();
  window.__fb.resolve({ use });
}
onAuthStateChanged(auth, (u) => { if (!pronto) avvia(u); });

/* ---------- database: stessa forma usata dalla pagina ---------- */
const parti = (p) => String(p).split("/").filter(Boolean);
const docSnap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data() });
const qSnap = (s) => ({ docs: s.docs.map((d) => ({ id: d.id, data: () => d.data() })) });
function coll(path, vincoli = []) {
  const q = () => query(collection(fs, ...parti(path)), ...vincoli);
  return {
    where: (f, op, v) => coll(path, [...vincoli, where(f, op === "=" ? "==" : op, v)]),
    limit: (n) => coll(path, [...vincoli, limit(n)]),
    get: async () => qSnap(await getDocs(q())),
    onSnapshot: (cb, err) => onSnapshot(q(), (s) => cb(qSnap(s)), err || (() => {})),
  };
}
function documento(path) {
  const r = () => doc(fs, ...parti(path));
  return {
    get: async () => docSnap(await getDoc(r())),
    set: (d) => setDoc(r(), pulito(d)),
    delete: () => deleteDoc(r()),
    onSnapshot: (cb, err) => onSnapshot(r(), (s) => cb(docSnap(s)), err || (() => {})),
  };
}
const db = { collection: coll, doc: documento };

/* ---------- utente ---------- */
const nomiVisti = {};
const user = {
  id: async () => utente.uid,
  canEdit: async () => admin,
  profiles: async (ids) => Object.fromEntries(ids.map((id) => [id, { name: nomiVisti[id] || "" }])),
};

/* ---------- chi è online (solo per chi ha i permessi) ---------- */
let ultimaPresenza = null;
const refPres = () => doc(fs, "presenza", utente.uid);
const scriviPresenza = (p) => setDoc(refPres(), pulito({ ...p, nome: utente.displayName || utente.email, ts: Date.now() })).catch(() => {});
setInterval(() => { if (ultimaPresenza && document.visibilityState === "visible") scriviPresenza(ultimaPresenza); }, 30000);
document.addEventListener("visibilitychange", () => { if (!ultimaPresenza) return; if (document.visibilityState === "visible") scriviPresenza(ultimaPresenza); else setDoc(refPres(), { ...ultimaPresenza, nome: utente.displayName || utente.email, ts: 0 }).catch(() => {}); });
const room = {
  presence: async (p) => { ultimaPresenza = p; await scriviPresenza(p); },
  onPeers: (cb, err) => {
    let ultimi = [];
    const emetti = () => {
      const ora = Date.now();
      cb({ peers: ultimi.filter((d) => ora - (d.ts || 0) < 75000).map((d) => ({ kind: "viewer", by: d.id, peer: d.id, presence: { io: d.io, tab: d.tab }, isMe: d.id === utente.uid, sameTab: d.id === utente.uid })) });
    };
    setInterval(emetti, 20000);
    return onSnapshot(collection(fs, "presenza"), (s) => { ultimi = s.docs.map((d) => ({ id: d.id, ...d.data() })); ultimi.forEach((d) => { nomiVisti[d.id] = d.nome; }); emetti(); }, err || (() => {}));
  },
};

/* ---------- download ---------- */
const downloads = {
  save: async ({ filename, data }) => {
    const file = new File([data], filename, { type: data.type || "application/octet-stream" });
    if (navigator.canShare && /iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(data), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};

function use(name) {
  if (name === "db") return db;
  if (name === "user") return user;
  if (name === "room") return room;
  if (name === "downloads") return downloads;
  return null;
}

/* ---------- Impostazioni dell'app: chi può entrare, importazione, uscita ---------- */
let statoImport = "";
window.appImpostazioni = () => {
  if (!utente) return "";
  const R = window.__registro, pers = R ? R.persone() : [];
  const righe = (membri && membri.emails || []).map((m) => {
    const p = (membri.persone || {})[m] || "", ad = (membri.admins || []).includes(m), io = m === minuscolo(utente.email), prop = m === minuscolo(PROPRIETARIO);
    return `<div class="app-membro"><span class="app-mail">${esc(m)}${io ? " <small>(tu)</small>" : ""}</span>
      <select data-app-persona="${esc(m)}" aria-label="Chi è" ${admin ? "" : "disabled"}><option value="">—</option>${pers.map((x) => `<option value="${x.id}" ${x.id === p ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>
      <label class="check"><input type="checkbox" data-app-admin="${esc(m)}" ${ad || prop ? "checked" : ""} ${admin && !prop ? "" : "disabled"}>Permessi completi</label>
      ${admin && !prop && !io ? `<button class="linkish" type="button" data-app-togli="${esc(m)}">Togli</button>` : ""}</div>`;
  }).join("");
  return `
    <div class="card">
      <h2>Il tuo accesso</h2>
      <p class="muted" style="margin:0">Sei entrato come <b>${esc(utente.email)}</b>${admin ? " con permessi completi" : ""}.</p>
      <div><button class="btn ghost" type="button" data-app-esci="1">Esci</button></div>
    </div>
    ${admin ? `<div class="card">
      <h2>Chi può entrare</h2>
      <p class="muted" style="margin:0">Solo queste email possono aprire il Registro. Con <b>permessi completi</b> si vedono anche gli accessi, chi è online e si possono fare le correzioni.</p>
      ${righe}
      <div class="app-membro"><input id="app-nuova-mail" type="email" inputmode="email" placeholder="Email Google della persona">
        <select id="app-nuova-persona" aria-label="Chi è"><option value="">Chi è?</option>${pers.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join("")}</select>
        <button class="btn sm" type="button" data-app-aggiungi="1">Aggiungi</button></div>
    </div>
    <div class="card">
      <h2>Importa dal vecchio Registro</h2>
      <p class="muted" style="margin:0">Scegli il file <b>registro-migrazione.json</b> che ti ha preparato Claude: copia qui giornate, clienti, lavori, richieste e impostazioni. Si fa una volta sola.</p>
      <div><input type="file" id="app-import" accept=".json,application/json"> <span class="status muted">${esc(statoImport)}</span></div>
    </div>` : ""}`;
};
const salvaMembri = async (m) => { membri = m; window.__registro && window.__registro.render(); await setDoc(refMembri(), pulito(m)); };
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button"); if (!t || !admin) return;
  if (t.dataset.appAggiungi) {
    const mail = minuscolo(($("app-nuova-mail") || {}).value), per = ($("app-nuova-persona") || {}).value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { window.__registro.flash("Scrivi un'email valida."); return; }
    if (!per) { window.__registro.flash("Scegli chi è questa persona."); return; }
    const m = { ...membri, emails: [...new Set([...(membri.emails || []), mail])], persone: { ...(membri.persone || {}), [mail]: per } };
    try { const i = $("app-nuova-mail"); if (i) { i.value = ""; i.defaultValue = ""; } await salvaMembri(m); window.__registro.flash(`${mail} può entrare.`); } catch (e) { window.__registro.flash(errore(e)); }
  } else if (t.dataset.appTogli) {
    const mail = t.dataset.appTogli, pers = { ...(membri.persone || {}) }; delete pers[mail];
    await salvaMembri({ ...membri, emails: (membri.emails || []).filter((x) => x !== mail), admins: (membri.admins || []).filter((x) => x !== mail), persone: pers });
  }
});
document.addEventListener("change", async (ev) => {
  const t = ev.target;
  if (t.dataset && t.dataset.io) { try { localStorage.setItem("rg-io-scelto", "1"); } catch {} }
  if (!admin) return;
  if (t.dataset && t.dataset.appPersona) await salvaMembri({ ...membri, persone: { ...(membri.persone || {}), [t.dataset.appPersona]: t.value } });
  else if (t.dataset && t.dataset.appAdmin) { const m = t.dataset.appAdmin, a = new Set(membri.admins || []); t.checked ? a.add(m) : a.delete(m); await salvaMembri({ ...membri, admins: [...a] }); }
  else if (t.id === "app-import" && t.files[0]) importaMigrazione(t.files[0]);
});
async function importaMigrazione(file) {
  const R = window.__registro;
  const stato = (s) => { statoImport = s; R.render(); };
  let dati;
  try { dati = JSON.parse(await file.text()); } catch { stato("Il file non è un JSON valido."); return; }
  if (!dati || !dati.collezioni) { stato("Questo non è il file di migrazione del Registro."); return; }
  const scritture = [];
  for (const [nome, docs] of Object.entries(dati.collezioni)) {
    if (["accessi", "presenza", "config"].includes(nome)) continue;
    const base = nome === "data/users/me" ? "data/users/" + utente.uid : nome;
    for (const [id, d] of Object.entries(docs)) scritture.push([base, id, d]);
  }
  if (!confirm(`Copio ${scritture.length} documenti nel nuovo Registro. Quelli con lo stesso nome vengono sostituiti. Procedo?`)) return;
  let fatti = 0;
  try {
    for (let i = 0; i < scritture.length; i += 400) {
      const b = writeBatch(fs);
      for (const [base, id, d] of scritture.slice(i, i + 400)) b.set(doc(fs, ...parti(base), id), pulito(d));
      await b.commit(); fatti += Math.min(400, scritture.length - i); stato(`Copio… ${fatti}/${scritture.length}`);
    }
    stato(`Fatto: ${fatti} documenti copiati.`); R.flash("Importazione completata: il Registro nuovo ha tutti i dati.");
  } catch (e) { stato(`Interrotto dopo ${fatti} documenti: ${errore(e)}. Riprova, non crea doppioni.`); }
}

/* ---------- aggiornamenti dell'app ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
