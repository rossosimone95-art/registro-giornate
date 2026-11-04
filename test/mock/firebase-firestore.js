// archivio in memoria che imita Firestore (con regole minime per il test)
const store = window.__mockStore = window.__mockStore || new Map(JSON.parse(localStorage.getItem("mockStore") || "[]"));
const subs = new Set();
const persist = () => localStorage.setItem("mockStore", JSON.stringify([...store]));
export const initializeFirestore = () => ({}), persistentLocalCache = () => ({}), persistentMultipleTabManager = () => ({});
export const collection = (fs, ...p) => ({ kind: "c", path: p.join("/") });
export const doc = (fs, ...p) => ({ kind: "d", path: p.join("/"), id: p[p.length - 1] });
export const where = (f, op, v) => ({ t: "w", f, op, v }), limit = (n) => ({ t: "l", n });
export const query = (c, ...v) => ({ ...c, v });
const deny = (path) => window.__mockDeny && window.__mockDeny(path);
const ds = (r) => { const d = store.get(r.path); return { id: r.id, exists: () => d !== undefined, data: () => d && JSON.parse(JSON.stringify(d)) }; };
const run = (q) => {
  const pre = q.path + "/"; let docs = [...store].filter(([k]) => k.startsWith(pre) && !k.slice(pre.length).includes("/"));
  for (const c of q.v || []) if (c.t === "w") docs = docs.filter(([, d]) => { const x = d[c.f]; return c.op === ">=" ? x >= c.v : c.op === "<" ? x < c.v : c.op === "==" ? x === c.v : true; });
  const l = (q.v || []).find((c) => c.t === "l"); if (l) docs = docs.slice(0, l.n);
  return { docs: docs.map(([k, d]) => ({ id: k.slice(pre.length), data: () => JSON.parse(JSON.stringify(d)) })) };
};
const fire = () => { persist(); for (const s of subs) s(); };
export async function getDoc(r) { if (deny(r.path)) { const e = new Error("perm"); e.code = "permission-denied"; throw e; } return ds(r); }
export async function getDocs(q) { return run(q); }
export async function setDoc(r, d) { if (JSON.stringify(d).includes("undefined")) throw new Error("undef"); store.set(r.path, JSON.parse(JSON.stringify(d))); fire(); }
export async function deleteDoc(r) { store.delete(r.path); fire(); }
export function onSnapshot(r, cb, err) {
  const f = () => { try { if (deny(r.path)) throw Object.assign(new Error("perm"), { code: "permission-denied" }); cb(r.kind === "d" ? ds(r) : run(r)); } catch (e) { err && err(e); } };
  subs.add(f); setTimeout(f, 0); return () => subs.delete(f);
}
export function writeBatch() { const ops = []; return { set: (r, d) => ops.push([r, d]), commit: async () => { for (const [r, d] of ops) store.set(r.path, d); fire(); } }; }
