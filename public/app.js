const app = document.getElementById("app");
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k.startsWith("on") ? e.addEventListener(k.slice(2), v) : k === "class" ? (e.className = v) : e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const api = async (path, opts) => {
  const r = await fetch("/api/" + path, opts && { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erreur");
  return d;
};
const me = () => localStorage.getItem("sr_pseudo") || "";
const mount = (...n) => { app.replaceChildren(...n.filter(Boolean)); window.scrollTo(0, 0); };

function home() {
  const fmt = el("select", {}, ...["1v1", "2v2", "3v3", "4v4", "5v5"].map((f) => el("option", { value: f, ...(f === "5v5" ? { selected: "" } : {}) }, f)));
  const code = el("input", { placeholder: "CODE DU MATCH", maxlength: "6", autocapitalize: "characters" });
  const pseudo = el("input", { placeholder: "ton pseudo", value: me() });
  const err = el("div", { class: "err" });
  mount(
    el("h1", {}, "Ton match compte."),
    el("div", { class: "card" }, el("label", {}, "Format"), fmt,
      el("button", { onclick: async () => { try { const d = await api("match", { format: fmt.value }); location.hash = "#/m/" + d.code; } catch (e) { err.textContent = e.message; } } }, "Créer un match")),
    el("div", { class: "card" }, el("label", {}, "Rejoindre un match"), code,
      el("button", { class: "ghost", onclick: () => code.value.trim().length === 6 ? (location.hash = "#/m/" + code.value.trim().toUpperCase()) : (err.textContent = "Le code fait 6 caractères") }, "Rejoindre")),
    el("div", { class: "card" }, el("label", {}, "Ma carte"), pseudo,
      el("button", { class: "ghost", onclick: () => pseudo.value.trim().length >= 2 ? (localStorage.setItem("sr_pseudo", pseudo.value.trim()), location.hash = "#/p/" + encodeURIComponent(pseudo.value.trim())) : (err.textContent = "Pseudo trop court") }, "Voir ma carte")),
    err
  );
}

async function matchPage(code) {
  mount(el("p", { class: "mut" }, "Chargement…"));
  let d;
  try { d = await api("match/" + code); } catch (e) { return mount(el("h1", {}, "Match introuvable"), el("a", { class: "btn ghost", href: "#/" }, "Accueil")); }
  const link = location.origin + "/#/m/" + code;
  const f = {};
  const field = (id, label, attrs = {}) => (f[id] = el("input", attrs));
  const err = el("div", { class: "err" });
  const team = el("select", {}, el("option", { value: "" }, "—"), el("option", { value: "A" }, "Équipe A"), el("option", { value: "B" }, "Équipe B"));
  const status = d.validated
    ? el("div", { class: "card" }, el("span", { class: "badge ok" }, "VALIDÉ"), el("div", { class: "big" }, `${d.score_a} – ${d.score_b}`), el("p", { class: "mut" }, "Top 3 : " + (d.podium.join(", ") || "—")))
    : el("div", { class: "card" }, el("span", { class: "badge wait" }, d.declared < 2 ? "EN ATTENTE" : "SCORES DIFFÉRENTS"),
        el("p", { class: "mut" }, d.declared < 2 ? `${d.declared} déclaration. Il en faut au moins 2 avec le même score.` : `${d.declared} déclarations, pas assez d'accord sur le score. Vérifiez entre vous et redéclarez.`));
  mount(
    el("h1", {}, `Match ${d.match.format}`),
    el("div", { class: "card" }, el("div", { class: "code" }, code),
      el("button", { class: "ghost", onclick: async (ev) => { try { if (navigator.share) await navigator.share({ url: link, title: "StreetRank" }); else { await navigator.clipboard.writeText(link); ev.target.textContent = "Lien copié ✓"; } } catch {} } }, "Partager le lien")),
    status,
    el("h2", {}, "Déclarer le match"),
    el("div", { class: "card" },
      el("label", {}, "Ton pseudo"), field("pseudo", "", { value: me(), maxlength: "20" }),
      el("label", {}, "Ton équipe"), team,
      el("div", { class: "row" }, el("div", {}, el("label", {}, "Score A"), field("a", "", { type: "number", inputmode: "numeric", min: "0", max: "99" })), el("div", {}, el("label", {}, "Score B"), field("b", "", { type: "number", inputmode: "numeric", min: "0", max: "99" }))),
      el("label", {}, "Top 3 du match (optionnel)"), field("t1", "", { placeholder: "1er", maxlength: "20" }), el("div", { style: "height:8px" }), field("t2", "", { placeholder: "2e", maxlength: "20" }), el("div", { style: "height:8px" }), field("t3", "", { placeholder: "3e", maxlength: "20" }),
      el("button", { onclick: async () => {
        err.textContent = "";
        try {
          await api(`match/${code}/declare`, { pseudo: f.pseudo.value, team: team.value, score_a: f.a.value, score_b: f.b.value, top1: f.t1.value, top2: f.t2.value, top3: f.t3.value });
          localStorage.setItem("sr_pseudo", f.pseudo.value.trim());
          matchPage(code);
        } catch (e) { err.textContent = e.message; }
      } }, "Envoyer"), err),
    d.players.length ? el("p", { class: "mut" }, "Ont déclaré : " + d.players.join(", ")) : null,
    me() ? el("a", { class: "btn ghost", href: "#/p/" + encodeURIComponent(me()) }, "Voir ma carte") : null
  );
}

async function playerPage(pseudo) {
  mount(el("p", { class: "mut" }, "Chargement…"));
  const d = await api("player/" + encodeURIComponent(pseudo)).catch(() => null);
  if (!d) return mount(el("h1", {}, "Erreur"), el("a", { class: "btn ghost", href: "#/" }, "Accueil"));
  mount(
    el("h1", {}, d.pseudo.toUpperCase()),
    el("div", { class: "card stats" }, el("div", {}, el("b", {}, d.played), "MATCHS"), el("div", {}, el("b", {}, d.win_pct == null ? "–" : d.win_pct + "%"), "VICTOIRES"), el("div", {}, el("b", {}, d.mvp), "MVP")),
    d.pending ? el("p", { class: "mut" }, `${d.pending} match(s) en attente de validation.`) : null,
    el("h2", {}, "Matchs validés"),
    d.history.length ? el("ul", {}, ...d.history.map((h) => el("li", {}, el("a", { href: "#/m/" + h.code, style: "color:var(--fg)" }, `${h.code} · ${h.score_a}–${h.score_b} · ${h.won ? "Victoire" : "Défaite"}${h.mvp ? " · MVP" : ""}`)))) : el("p", { class: "mut" }, "Aucun match validé pour l'instant."),
    el("a", { class: "btn", href: "#/" }, "Nouveau match")
  );
}

function route() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  if (h[0] === "m" && h[1]) matchPage(h[1].toUpperCase());
  else if (h[0] === "p" && h[1]) playerPage(decodeURIComponent(h[1]));
  else home();
}
addEventListener("hashchange", route);
route();
