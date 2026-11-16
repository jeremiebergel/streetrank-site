// API minimale : matchs, déclarations, consensus, page joueur. Pas de comptes (pseudo seul).
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const FORMATS = ["1v1", "2v2", "3v3", "4v4", "5v5"];
const clean = (s, n = 20) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, n);
const norm = (s) => clean(s).toLowerCase();
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHA[b % ALPHA.length]).join("");

// Règle de consensus : >=2 déclarations ET un même score chez plus de la moitié des déclarants.
function consensus(decls) {
  const n = decls.length;
  const counts = {};
  for (const d of decls) { const k = d.score_a + "-" + d.score_b; counts[k] = (counts[k] || 0) + 1; }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const validated = !!best && n >= 2 && best[1] > n / 2;
  const [sa, sb] = validated ? best[0].split("-").map(Number) : [null, null];
  const ranks = {};
  for (const d of decls) [d.top1, d.top2, d.top3].forEach((p, i) => { if (p) (ranks[p] ||= []).push(i + 1); });
  const podium = Object.keys(ranks).sort((a, b) => avg(ranks[a]) - avg(ranks[b]) || a.localeCompare(b)).slice(0, 3);
  return { validated, declared: n, score_a: sa, score_b: sb, podium };
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export async function onRequest({ request, env, params }) {
  const seg = [].concat(params.path || []);
  const m = request.method;
  try {
    if (m === "POST" && seg[0] === "match" && seg.length === 1) {
      const body = await request.json().catch(() => ({}));
      const format = FORMATS.includes(body.format) ? body.format : "5v5";
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const r = await env.DB.prepare("INSERT OR IGNORE INTO matches(code,format,created_at) VALUES(?,?,?)").bind(code, format, Date.now()).run();
        if (r.meta.changes) return json({ code, format });
      }
      return json({ error: "reessaie" }, 500);
    }
    if (seg[0] === "match" && seg.length >= 2) {
      const code = seg[1].toUpperCase();
      const match = await env.DB.prepare("SELECT * FROM matches WHERE code=?").bind(code).first();
      if (!match) return json({ error: "Match introuvable" }, 404);
      if (m === "POST" && seg[2] === "declare") {
        const b = await request.json().catch(() => ({}));
        const pseudo = norm(b.pseudo);
        const sa = Number(b.score_a), sb = Number(b.score_b);
        if (pseudo.length < 2) return json({ error: "Pseudo trop court" }, 400);
        if (!["A", "B"].includes(b.team)) return json({ error: "Choisis ton équipe" }, 400);
        if (![sa, sb].every((x) => Number.isInteger(x) && x >= 0 && x <= 99)) return json({ error: "Score invalide" }, 400);
        const top = [b.top1, b.top2, b.top3].map(norm).map((x) => x || null);
        const named = top.filter(Boolean);
        if (new Set(named).size !== named.length) return json({ error: "Le même joueur apparaît deux fois dans le top 3" }, 400);
        await env.DB.prepare(
          "INSERT INTO declarations(code,pseudo,team,score_a,score_b,top1,top2,top3,created_at) VALUES(?,?,?,?,?,?,?,?,?) " +
          "ON CONFLICT(code,pseudo) DO UPDATE SET team=excluded.team,score_a=excluded.score_a,score_b=excluded.score_b,top1=excluded.top1,top2=excluded.top2,top3=excluded.top3"
        ).bind(code, pseudo, b.team, sa, sb, top[0], top[1], top[2], Date.now()).run();
        return json({ ok: true });
      }
      if (m === "GET" && seg.length === 2) {
        const { results } = await env.DB.prepare("SELECT pseudo,team,score_a,score_b,top1,top2,top3 FROM declarations WHERE code=?").bind(code).all();
        return json({ match, ...consensus(results), players: results.map((r) => r.pseudo) });
      }
    }
    if (m === "GET" && seg[0] === "player" && seg[1]) {
      const pseudo = norm(decodeURIComponent(seg[1]));
      const { results: mine } = await env.DB.prepare("SELECT code,team FROM declarations WHERE pseudo=?").bind(pseudo).all();
      let played = 0, wins = 0, mvp = 0; const history = [];
      for (const r of mine) {
        const { results } = await env.DB.prepare("SELECT * FROM declarations WHERE code=?").bind(r.code).all();
        const c = consensus(results);
        if (!c.validated) continue;
        played++;
        const won = (r.team === "A" ? c.score_a > c.score_b : c.score_b > c.score_a);
        if (won) wins++;
        if (c.podium[0] === pseudo) mvp++;
        history.push({ code: r.code, team: r.team, score_a: c.score_a, score_b: c.score_b, won, mvp: c.podium[0] === pseudo });
      }
      return json({ pseudo, played, wins, win_pct: played ? Math.round((wins / played) * 100) : null, mvp, pending: mine.length - played, history });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: "Erreur serveur" }, 500);
  }
}
