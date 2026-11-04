import json, sys, time
from pathlib import Path
src = Path(sys.argv[1]); out = Path(sys.argv[2])
col = {}
for name in ["giorni","manuali","correzioni","luoghi","clienti","richieste","lavori","meteo","impostazioni","data/users/me"]:
    d = src / name
    col[name] = {f.stem: json.loads(f.read_text()) for f in sorted(d.glob("*.json"))} if d.exists() else {}
def nested(x, inarr=False):
    if isinstance(x, list):
        return inarr or any(nested(v, True) for v in x)
    if isinstance(x, dict): return any(nested(v, False) for v in x.values())
    return False
bad = [(c,i) for c,ds in col.items() for i,v in ds.items() if nested(v)]
json.dump({"creato": time.strftime("%Y-%m-%dT%H:%M:%S"), "conteggi": {k: len(v) for k,v in col.items()}, "collezioni": col}, out.open("w"), ensure_ascii=False)
print({k: len(v) for k,v in col.items()}, "nested:", bad[:5], out.stat().st_size)
