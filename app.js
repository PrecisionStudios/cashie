/* Cashie v0.2 core — keeps old look, adds profiles + recurring + i18n + GH widgets */
const APP_KEY = "cashie:data";
const APP_VER = 2; // bump for migrations

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const i18n = {
  en: {
    type:"Type", income:"Income", expense:"Expense", category:"Category", amount:"Amount",
    date:"Date", recurring:"Recurring", none:"None", daily:"Daily", weekly:"Weekly", monthly:"Monthly",
    add:"Add", export:"Export", import:"Import", merge:"Merge", balance:"Balance", note:"Note",
    changelog:"Changelog"
  },
  sr: {
    type:"Tip", income:"Prihod", expense:"Rashod", category:"Kategorija", amount:"Iznos",
    date:"Datum", recurring:"Ponavljanje", none:"Nema", daily:"Dnevno", weekly:"Nedeljno", monthly:"Mesečno",
    add:"Dodaj", export:"Izvoz", import:"Uvoz", merge:"Spoji", balance:"Bilans", note:"Napomena",
    changelog:"Izmene"
  }
};
let lang = (localStorage.getItem("cashie:lang") || "en");

function t() { $("[data-i18n='changelog']"); $("[data-i18n]"); $$
("[data-i18n]").forEach(el=>{ const k=el.getAttribute("data-i18n"); el.textContent=i18n[lang][k]||el.textContent; });
$$("option[data-i18n]").forEach(el=>{ const k=el.getAttribute("data-i18n"); el.textContent=i18n[lang][k]||el.textContent; });
}

function load() {
  const raw = localStorage.getItem(APP_KEY);
  if (!raw) return { ver: APP_VER, profiles: { Default: { tx: [], recurring: [] } }, active: "Default" };
  let data = JSON.parse(raw);
  if (!data.ver || data.ver < APP_VER) data = migrate(data);
  return data;
}
function save() { localStorage.setItem(APP_KEY, JSON.stringify(state)); $("#dataVersion").textContent = `v${state.ver}`; }

function migrate(d) {
  // simple migration example
  const v = d.ver || 1;
  if (v === 1) {
    // wrap single tx array into profiles.Default
    const wrapped = { ver: 2, profiles: { Default: { tx: d.tx || [], recurring: d.recurring || [] } }, active: "Default" };
    return wrapped;
  }
  d.ver = APP_VER;
  return d;
}

let state = load();

// UI binds
$("#addProfileBtn").addEventListener("click", () => {
  const name = prompt(lang==="sr" ? "Ime profila:" : "Profile name:");
  if (!name) return;
  if (!state.profiles[name]) state.profiles[name] = { tx: [], recurring: [] };
  state.active = name;
  refreshProfiles(); save(); render();
});
$("#profileSelect").addEventListener("change", e => { state.active = e.target.value; save(); render(); });

$$(".lang-btn").forEach(btn => btn.addEventListener("click", e=>{
  lang = e.target.dataset.lang; localStorage.setItem("cashie:lang", lang); t();
}));

// Controls
$("#addBtn").addEventListener("click", () => {
  const tx = readForm();
  if (!tx) return;
  active().tx.push(tx);
  if (tx.recurring !== "none") addOrUpdateRecurring(tx);
  save(); render(); clearForm();
});

$("#exportBtn").addEventListener("click", () => {
  const profile = state.active;
  const blob = new Blob([JSON.stringify(state.profiles[profile], null, 2)], {type:"application/json"});
  download(`cashie-${profile}.json`, blob);
});

$("#importBtn").addEventListener("click", async () => {
  const merge = $("#mergeImport").checked;
  const [file] = await pickFile(".json");
  if (!file) return;
  const json = JSON.parse(await file.text());
  if (merge) {
    active().tx.push(...(json.tx||[]));
    active().recurring.push(...(json.recurring||[]));
  } else {
    state.profiles[state.active] = { tx: (json.tx||[]), recurring: (json.recurring||[]) };
  }
  save(); render();
});

$("#search").addEventListener("input", render);
$("#monthFilter").addEventListener("change", render);

function active(){ return state.profiles[state.active]; }

function readForm(){
  const type = $("#type").value;
  const category = $("#category").value.trim();
  const amount = parseFloat($("#amount").value);
  const date = $("#date").value || new Date().toISOString().slice(0,10);
  const recurring = $("#recurring").value;
  const note = $("#note").value.trim();
  if (!category || isNaN(amount)) return null;
  return { id: crypto.randomUUID(), type, category, amount, date, note, recurring };
}

function clearForm(){ ["category","amount","note"].forEach(id=>$("#"+id).value=""); }

function addOrUpdateRecurring(tx){
  const r = active().recurring;
  const existing = r.find(x => x.category===tx.category && x.type===tx.type && x.amount===tx.amount && x.recurring===tx.recurring);
  if (!existing) r.push({ ...tx, lastApplied: tx.date });
  else existing.lastApplied = tx.date;
}

function applyRecurringUpToToday(){
  const today = new Date().toISOString().slice(0,10);
  active().recurring.forEach(r=>{
    let last = new Date(r.lastApplied);
    const end = new Date(today);
    while (true){
      const next = nextDate(last, r.recurring);
      if (!next || next > end) break;
      active().tx.push({ id: crypto.randomUUID(), type:r.type, category:r.category, amount:r.amount, date:next.toISOString().slice(0,10), note:r.note||"", recurring:"none" });
      r.lastApplied = next.toISOString().slice(0,10);
      last = next;
    }
  });
}

function nextDate(d, kind){
  const n = new Date(d);
  if (kind==="daily") n.setDate(n.getDate()+1);
  else if (kind==="weekly") n.setDate(n.getDate()+7);
  else if (kind==="monthly") n.setMonth(n.getMonth()+1);
  else return null;
  return n;
}

function render(){
  applyRecurringUpToToday();
  // month filter build
  const months = [...new Set(active().tx.map(tx=>tx.date.slice(0,7)))].sort().reverse();
  $("#monthFilter").innerHTML = `<option value="">All months</option>` + months.map(m=>`<option value="${m}">${m}</option>`).join("");

  const q = $("#search").value.toLowerCase();
  const mf = $("#monthFilter").value;

  const tbody = $("#txTable tbody");
  tbody.innerHTML = "";
  let inc=0, exp=0;
  active().tx
    .filter(tx => (!mf || tx.date.startsWith(mf)))
    .filter(tx => !q || JSON.stringify(tx).toLowerCase().includes(q))
    .sort((a,b)=> (a.date>b.date? -1: 1))
    .forEach(tx=>{
      if (tx.type==="income") inc += tx.amount; else exp += tx.amount;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${tx.date}</td>
        <td>${tx.type}</td>
        <td>${escapeHtml(tx.category)}</td>
        <td>${tx.amount.toFixed(2)}</td>
        <td>${escapeHtml(tx.note||"")}</td>
        <td><button data-id="${tx.id}" class="del">✕</button></td>`;
      tbody.appendChild(tr);
    });

  $("#sumIncome").textContent = inc.toFixed(2);
  $("#sumExpense").textContent = exp.toFixed(2);
  $("#sumBalance").textContent = (inc-exp).toFixed(2);

  // delete binds
  $$("#txTable .del").forEach(btn=>btn.addEventListener("click", e=>{
    const id = e.target.getAttribute("data-id");
    const i = active().tx.findIndex(x=>x.id===id);
    if (i>=0) { active().tx.splice(i,1); save(); render(); }
  }));

  // i18n apply
  t();
}

function refreshProfiles(){
  const sel = $("#profileSelect");
  sel.innerHTML = Object.keys(state.profiles).map(n=>`<option value="${n}" ${state.active===n?"selected":""}>${n}</option>`).join("");
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

// Releases
if (Array.isArray(releases) && releases.length){
  releases.forEach(r=>{
    const li = document.createElement("li");
    const released = r.published_at ? new Date(r.published_at).toISOString().slice(0,10) : "";
    const url = r.html_url || `https://github.com/PrecisionStudios/cashie/releases/tag/${encodeURIComponent(r.tag_name)}`;
    li.innerHTML = `<a href="${url}" target="_blank" rel="noopener">
      <strong>${r.tag_name}</strong> — ${released} — ${r.name||""}
    </a>`;
    list.appendChild(li);
  });
} else {
  // Fallback to commits
  const commits = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=3`).then(r=>r.json());
  commits.forEach(c=>{
    const li = document.createElement("li");
    const url = c.html_url || `https://github.com/${repo}/commit/${c.sha}`;
    li.innerHTML = `<a href="${url}" target="_blank" rel="noopener">
      ${c.sha.slice(0,7)} — ${new Date(c.commit.author.date).toISOString().slice(0,10)} — ${c.commit.message.split("\n")[0]}
    </a>`;
    list.appendChild(li);
  });
}

// Also set the "View all" link explicitly
const viewAll = document.getElementById("ghReleaseLink");
<a id="ghReleaseLink" class="view-all" data-i18n="viewOnGitHub" href="https://github.com/PrecisionStudios/cashie/releases" target="_blank" rel="noopener">View all on GitHub →</a>

// init
refreshProfiles();
$("#ghLink").href = "https://github.com/PrecisionStudios/cashie";
$("#dataVersion").textContent = `v${state.ver}`;
fetchGitHub();
render();
