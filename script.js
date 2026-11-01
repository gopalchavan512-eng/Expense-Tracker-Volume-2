/* 1. DATA - lists and saved data. No sample data: the app starts empty */
const CATS = ["Grocery", "Shopping", "Clothing", "Fitness", "Investment", "Bill & Subscription", "Travelling", "Other"];
const COLORS = ["#2ee6a6", "#ffc857", "#ff7a7a", "#6ea8ff", "#c58bff", "#ff9f6e", "#f0abfc", "#94a3b8"];
const MODES = ["UPI", "Card", "Bank", "Cash"];
const PERIODS = ["Week", "Month", "6 Months", "Year"];

// localStorage keeps data after refresh (browsers only store text, so we use JSON)
let db = JSON.parse(localStorage.getItem("Dhanvix ")) || { salary: 0, limit: 0, expenses: [], bills: [], holds: [], goals: [] };
let page = "Dashboard", period = "Month", catFilter = -1, query = "";

function save() { localStorage.setItem("Dhanvix ", JSON.stringify(db)); }

/* 2. HELPERS - small functions used everywhere */
const $ = id => document.getElementById(id);
const money = n => "₹" + Number(n).toLocaleString("en-IN");          // en-IN = 1,00,000 style
const sum = (list, key = "amt") => list.reduce((t, x) => t + x[key], 0);
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const val = id => $(id).value.trim();                                 // read an input

function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function toDate(s) { return new Date(s + "T00:00:00"); }              // "2026-10-31" -> Date
function showDate(s) { return toDate(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); }

// first day of each period (week = 7 days, month = 30 days, others = calendar months)
function startOf(p) {
  const t = today();
  if (p === "Week") { t.setDate(t.getDate() - 6); return t; }
  if (p === "Month") { t.setDate(t.getDate() - 29); return t; }
  return new Date(t.getFullYear(), t.getMonth() - (p === "6 Months" ? 5 : 11), 1);
}
function inPeriod(list, p) { const a = startOf(p), b = today(); return list.filter(e => toDate(e.date) >= a && toDate(e.date) <= b); }

// one total per category (old/unknown categories count as "Other")
function catTotals(list) {
  const totals = CATS.map(() => 0);
  list.forEach(e => { let i = CATS.indexOf(e.cat); if (i < 0) i = CATS.length - 1; totals[i] += e.amt; });
  return totals;
}

// splits a period into chart bars: days, 5-day blocks or months -> [{label, v}]
function buckets(list, p) {
  const a = startOf(p), out = [];
  if (p === "Week" || p === "Month") {
    const size = p === "Week" ? 1 : 5, n = p === "Week" ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const d = new Date(a); d.setDate(d.getDate() + i * size);
      out.push({ label: d.toLocaleDateString("en-IN", p === "Week" ? { weekday: "short" } : { day: "numeric", month: "short" }), v: 0 });
    }
    list.forEach(e => { const i = Math.floor(Math.round((toDate(e.date) - a) / 864e5) / size); if (out[i]) out[i].v += e.amt; });
  } else {
    const n = p === "6 Months" ? 6 : 12;
    for (let i = 0; i < n; i++) out.push({ label: new Date(a.getFullYear(), a.getMonth() + i, 1).toLocaleDateString("en-IN", { month: "short" }), v: 0 });
    list.forEach(e => { const d = toDate(e.date), i = (d.getFullYear() - a.getFullYear()) * 12 + d.getMonth() - a.getMonth(); if (out[i]) out[i].v += e.amt; });
  }
  return out;
}

/* 3. BUILDING BLOCKS - functions that return HTML for cards, charts, tables */
const card = (html, cls = "") => `<div class="card ${cls}">${html}</div>`;
const progress = p => `<div class="prog"><i style="width:${Math.min(100, p)}%"></i></div>`;
const empty = text => `<p class="muted">${text}</p>`;

// bar chart: hover a bar to see amount, % of total and change vs previous bar
function barChart(data, title) {
  const total = sum(data, "v"), max = Math.max(...data.map(d => d.v), 1) * 1.3;
  const cols = data.map((d, i) => {
    const prev = data[i - 1], diff = prev && prev.v ? ((d.v - prev.v) / prev.v) * 100 : null;
    const change = diff === null ? "" : `<br><span class="${diff > 0 ? "bad" : ""}">${diff > 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}% vs ${prev.label}</span>`;
    return `<div class="col"><div class="bar" style="height:${(d.v / max) * 100}%">
      <div class="tt"><span class="muted">${d.label}</span><b>${money(d.v)}</b>${pct(d.v, total).toFixed(1)}% of this period${change}</div></div></div>`;
  }).join("");
  return card(`<h3>${title}</h3><div class="bars">${cols}</div><div class="axis">${data.map(d => `<span>${d.label}</span>`).join("")}</div>`);
}

// donut chart: each category is an SVG circle arc; hover handled in section 7
function donut(totals, title) {
  const items = CATS.map((name, i) => ({ name, v: totals[i], color: COLORS[i] })).filter(x => x.v > 0);
  const total = sum(items, "v");
  if (!total) return card(`<h3>${title}</h3>${empty("No expenses in this period yet.")}`);
  const C = 2 * Math.PI * 62; let offset = 0;
  const arcs = items.map(x => {
    const len = (x.v / total) * C;
    const svg = `<circle class="seg" data-name="${x.name}" data-v="${money(x.v)}" data-p="${pct(x.v, total).toFixed(1)}%" cx="85" cy="85" r="62" stroke="${x.color}" stroke-dasharray="${Math.max(len - 3, 1)} ${C}" stroke-dashoffset="${-offset}"/>`;
    offset += len; return svg;
  }).join("");
  const legend = items.map(x => `<div class="row"><span><i style="background:${x.color}"></i>${x.name}</span><span><b>${money(x.v)}</b> <small class="muted">${pct(x.v, total).toFixed(1)}%</small></span></div>`).join("");
  return card(`<h3>${title}</h3><div class="donut"><div class="dw"><svg width="170" height="170" viewBox="0 0 170 170">${arcs}</svg>
    <div class="dc" id="dc" data-total="${money(total)}"><span>Total</span><b>${money(total)}</b></div></div><div class="legend">${legend}</div></div>`);
}

// expenses table (search box filters it; showDelete adds the x button)
function table(list, title, limit, showDelete) {
  const rows = list.filter(e => (e.cat + e.where + e.mode).toLowerCase().includes(query.toLowerCase())).slice(0, limit);
  if (!rows.length) return card(`<h3>${title}</h3>${empty(list.length ? "No match. Try another search." : "Nothing saved yet. Press + Add expense.")}`);
  const body = rows.map((e, i) => `<tr><td>${i + 1}.</td><td><b>${money(e.amt)}</b></td><td>${e.cat}</td><td>${e.where}</td><td>${showDate(e.date)}</td><td>${e.mode}</td>
    ${showDelete ? `<td><button class="x" onclick="delItem('expenses',${e.id})">✕</button></td>` : ""}</tr>`).join("");
  return card(`<h3>${title}</h3><div class="scroll"><table><tr><th>S.N</th><th>Amount</th><th>Category</th><th>Where</th><th>Date</th><th>Mode</th>${showDelete ? "<th></th>" : ""}</tr>${body}</table></div>`);
}

// goals box (used on Dashboard and Goals page): add, top up, remove
function goalsBox() {
  const list = db.goals.map(g => `<div style="margin-bottom:18px"><div class="between"><b>🎯 ${g.name}</b>
    <span><button class="pill" onclick="topUp(${g.id},1000)">+₹1,000</button> <button class="pill" onclick="topUp(${g.id},5000)">+₹5,000</button>
    <button class="x" onclick="delItem('goals',${g.id})">✕</button></span></div>${progress(pct(g.have, g.need))}
    <small class="muted">${money(g.have)} of ${money(g.need)} · ${pct(g.have, g.need).toFixed(0)}%</small></div>`).join("");
  return card(`<h3>My Goals</h3><div class="form" style="margin-bottom:16px"><input class="field" id="g-name" placeholder="Goal name">
    <input class="field" id="g-need" type="number" placeholder="Target ₹"><input class="field" id="g-have" type="number" placeholder="Saved so far ₹ (optional)">
    <button class="btn" onclick="addGoal()">Add goal</button></div>${list || empty("No goals yet. Add your first one above.")}`);
}

// bills list (used on Dashboard and Bills page)
function billsBox(showDelete) {
  const list = db.bills.map(b => `<div class="item"><span>🧾</span><div class="grow"><b>${b.name}</b><br><small class="muted">Due ${b.due}</small></div><b>${money(b.amt)}</b>
    ${showDelete ? `<button class="x" onclick="delItem('bills',${b.id})">✕</button>` : ""}</div>`).join("");
  return card(`<h3>Bill &amp; Subscription</h3>${list || empty("No bills yet.")}`);
}

/* 4. PAGES - one function per sidebar option, each returns HTML */
const SUBTITLE = {
  "Dashboard": "Track all your expenses and transactions", "All Expenses": "Every transaction, filter by category",
  "Saved Expenses": "Your week, month, 6 months and year at a glance", "Bill & Subscription": "What you pay every month",
  "Investment": "Where your money is growing", "Card": "Your card and its limit", "Goals": "Save towards what matters",
  "Insight": "What your spending is telling you", "Analytics": "Trends across months and categories",
  "Setting": "Salary and card limit", "Help Center": "Quick answers", "Support": "Talk to us", "Logout": "See you soon"
};

const pages = {
  Dashboard() {
    const month = inPeriod(db.expenses, "Month"), spent = sum(month), left = db.salary - spent, used = pct(spent, db.salary);
    // salary box shows only until the salary is added once
    const salaryBox = db.salary ? "" : card(`<b>Add your monthly salary</b><p class="muted" style="margin:6px 0 14px">You do this once. Change it later in Setting.</p>
      <div class="form"><input class="field" id="salary" type="number" placeholder="Monthly salary ₹"><button class="btn" onclick="saveSalary()">Save salary</button></div>`);
    return salaryBox + `<div class="grid4">
      ${card(`<h3>Monthly Salary</h3><div class="big">${money(db.salary)}</div><small class="muted">Added once. Change it in Setting</small>`)}
      ${card(`<h3>Monthly Expenses</h3><div class="big">${money(spent)}</div><small class="muted">Last 30 days</small>`)}
      ${card(`<h3>Left this month</h3><div class="big ${left < 0 ? "bad" : ""}">${money(left)}</div>${progress(used)}<small class="muted">${used.toFixed(0)}% of salary spent</small>`)}
      ${card(`<h3>Total Investment</h3><div class="big">${money(sum(db.holds, "v"))}</div><small class="muted">${db.holds.length} holdings</small>`)}
    </div>
    <div class="grid2">${barChart(buckets(inPeriod(db.expenses, "6 Months"), "6 Months"), "Monthly Expenses (6 months)")}${donut(catTotals(month), "Top Category (30 days)")}</div>
    <div class="grid2">${table(db.expenses, "Recent Expenses", 5, false)}<div class="stack">${goalsBox()}${billsBox(false)}</div></div>`;
  },

  "All Expenses"() {
    const chips = ["All", ...CATS].map((c, i) => `<button class="pill ${catFilter === i - 1 ? "on" : ""}" onclick="setCat(${i - 1})">${c}</button>`).join("");
    const list = catFilter < 0 ? db.expenses : db.expenses.filter(e => e.cat === CATS[catFilter]);
    return `<div class="chips">${chips}</div>${table(list, "All Expenses", 999, true)}`;
  },

  "Saved Expenses"() {
    const list = inPeriod(db.expenses, period), total = sum(list), days = Math.round((today() - startOf(period)) / 864e5) + 1;
    const chips = PERIODS.map(p => `<button class="pill ${period === p ? "on" : ""}" onclick="setPeriod('${p}')">${p}</button>`).join("");
    const long = { Week: "the last 7 days", Month: "the last 30 days", "6 Months": "the last 6 months", Year: "the last 12 months" }[period];
    return `<div class="chips">${chips}</div>
      <div class="grid4 g3">${card(`<h3>Total spent</h3><div class="big">${money(total)}</div>`)}${card(`<h3>Expenses saved</h3><div class="big">${list.length}</div>`)}${card(`<h3>Average a day</h3><div class="big">${money(Math.round(total / days))}</div>`)}</div>
      <div class="grid2" style="margin-top:0">${barChart(buckets(list, period), "Spending in " + long)}${donut(catTotals(list), "By category")}</div>
      ${table(list, "Expenses for " + long, 999, true)}`;
  },

  "Bill & Subscription"() {
    const due = sum(db.bills);
    return card(`<div class="form"><input class="field" id="b-name" placeholder="Bill name"><input class="field" id="b-amt" type="number" placeholder="Amount ₹">
      <input class="field" id="b-due" placeholder="Due date (e.g. 5 Nov)"><button class="btn" onclick="addBill()">Add bill</button></div>`) +
      `<div class="grid2">${billsBox(true)}${card(`<h3>Due soon</h3><div class="big">${money(due)}</div><p class="muted">About ${money(due * 12)} a year</p>`)}</div>`;
  },

  Investment() {
    const total = sum(db.holds, "v");
    const list = db.holds.map(h => `<div><div class="row"><span>${h.name}</span><span><b>${money(h.v)}</b> <small class="muted">${pct(h.v, total).toFixed(1)}%</small>
      <button class="x" onclick="delItem('holds',${h.id})">✕</button></span></div>${progress(pct(h.v, total))}</div>`).join("");
    return card(`<div class="form"><input class="field" id="h-name" placeholder="Holding (e.g. Mutual Funds)"><input class="field" id="h-amt" type="number" placeholder="Amount ₹">
      <button class="btn" onclick="addHold()">Add holding</button></div>`) +
      `<div class="grid2">${card(`<h3>Holdings</h3>${list || empty("No holdings yet.")}`)}${card(`<h3>Total Investment</h3><div class="big">${money(total)}</div>`)}</div>`;
  },

  Card() {
    const used = sum(inPeriod(db.expenses, "Month").filter(e => e.mode === "Card"));
    const limitBox = db.limit ? `<div class="big">${money(db.limit - used)} <small class="muted">left</small></div>${progress(pct(used, db.limit))}<small class="muted">${money(used)} used of ${money(db.limit)} (last 30 days)</small>` : empty("Set your card limit in Setting.");
    return `<div class="grid2">${card(`<div class="between"><b>Dhanvix </b><b>VISA</b></div><div class="num">•••• •••• •••• ••••</div><div class="between"><span>YOUR NAME</span><span>MM/YY</span></div>`, "credit")}
      ${card(`<h3>Credit limit</h3>${limitBox}`)}</div>`;
  },

  Goals() { return goalsBox(); },

  Insight() {
    const list = inPeriod(db.expenses, "Month");
    if (!list.length) return card(empty("Save a few expenses and your insights will show up here."));
    const t = catTotals(list), top = t.indexOf(Math.max(...t)), big = list.reduce((a, b) => (b.amt > a.amt ? b : a)), total = sum(list);
    const last = db.salary ? ["Savings rate", Math.max(0, Math.round(100 - pct(total, db.salary))) + "%", "of your " + money(db.salary) + " salary"] : ["Expenses saved", list.length, "in the last 30 days"];
    const tiles = [["Top category", CATS[top], money(t[top]) + " · " + pct(t[top], total).toFixed(1) + "%"], ["Biggest expense", big.where, money(big.amt) + " · " + big.cat], ["Average a day", money(Math.round(total / 30)), "over the last 30 days"], last];
    return `<div class="grid4">${tiles.map(([h, v, s]) => card(`<h3>${h}</h3><div class="big" style="font-size:22px">${v}</div><p class="muted">${s}</p>`)).join("")}</div>`;
  },

  Analytics() {
    const list = inPeriod(db.expenses, "6 Months"), b = buckets(list, "6 Months");
    const hi = b.reduce((x, y) => (y.v > x.v ? y : x)), lo = b.reduce((x, y) => (y.v < x.v ? y : x));
    return `<div class="grid2" style="margin-top:0">${barChart(b, "Last 6 months")}${donut(catTotals(list), "By category (6 months)")}</div>
      <div class="grid4 g3">${card(`<h3>Average a month</h3><div class="big">${money(Math.round(sum(b, "v") / b.length))}</div>`)}
      ${card(`<h3>Highest</h3><div class="big">${money(hi.v)}</div><small class="muted">${hi.label}</small>`)}${card(`<h3>Lowest</h3><div class="big">${money(lo.v)}</div><small class="muted">${lo.label}</small>`)}</div>`;
  },

  Setting() {
    return card(`<h3>Monthly salary ₹</h3><input class="field" id="set-salary" type="number" value="${db.salary || ""}" style="width:100%;margin-bottom:20px">
      <h3>Card limit ₹</h3><input class="field" id="set-limit" type="number" value="${db.limit || ""}" style="width:100%;margin-bottom:20px">
      <button class="btn" onclick="saveSettings()">Save settings</button> <button class="pill" onclick="clearAll()">Clear all saved data</button>`);
  },

  "Help Center"() {
    const faq = [["How do I save an expense?", "Press + Add expense, fill the form and press Save expense."],
    ["Do I need to add my salary every month?", "No. Add it once on the dashboard. Change it in Setting if it changes."],
    ["Where do I see week, month, 6 months and year?", "After your first save, Saved Expenses appears in the sidebar."],
    ["Will my data stay after I close the page?", "Yes, it is saved in this browser on this device."]];
    return card(faq.map(([q, a]) => `<details><summary>${q}</summary><p class="muted">${a}</p></details>`).join(""));
  },

  Support() {
    return card(`<h3>How can we help?</h3><textarea class="field" id="msg" style="width:100%;height:120px;margin-bottom:14px" placeholder="Describe the problem"></textarea>
      <button class="btn" onclick="sendMessage()">Send message</button>`);
  },

  Logout() { return card(`<h3>You are logged out</h3><p class="muted" style="margin-bottom:16px">Your saved expenses stay on this device.</p><button class="btn" onclick="go('Dashboard')">Log back in</button>`); }
};

/* 5. ACTIONS - run when the user clicks buttons (all of them save data, then redraw) */
const newId = () => Date.now() + Math.floor(Math.random() * 1000);

function saveSalary() { const n = Number(val("salary")); if (n > 0) { db.salary = n; save(); render(); } }

function saveExpense() {
  const amt = Number(val("m-amt")), where = val("m-where"), date = val("m-date");
  if (!where || amt <= 0 || !date) return alert("Please fill where, amount and date.");
  db.expenses.push({ id: newId(), where, amt, cat: val("m-cat"), mode: val("m-mode"), date });
  db.expenses.sort((a, b) => b.date.localeCompare(a.date));          // newest first
  save(); closeModal(); render();
  showToast("Expense saved", true);
}
function addBill() { const amt = Number(val("b-amt")); if (val("b-name") && amt > 0) { db.bills.push({ id: newId(), name: val("b-name"), amt, due: val("b-due") || "-" }); save(); render(); } }
function addHold() { const v = Number(val("h-amt")); if (val("h-name") && v > 0) { db.holds.push({ id: newId(), name: val("h-name"), v }); save(); render(); } }
function addGoal() {
  const need = Number(val("g-need"));
  if (val("g-name") && need > 0) { db.goals.push({ id: newId(), name: val("g-name"), need, have: Math.min(Number(val("g-have")) || 0, need) }); save(); render(); }
}
function topUp(id, n) { const g = db.goals.find(x => x.id === id); g.have = Math.min(g.need, g.have + n); save(); render(); }
function delItem(list, id) { db[list] = db[list].filter(x => x.id !== id); save(); render(); }   // one delete for all lists
function saveSettings() { db.salary = Number(val("set-salary")) || 0; db.limit = Number(val("set-limit")) || 0; save(); showToast("Settings saved"); render(); }
function clearAll() { db = { salary: 0, limit: 0, expenses: [], bills: [], holds: [], goals: [] }; save(); render(); }
function sendMessage() { if (val("msg")) { $("msg").value = ""; showToast("Message sent. We will reply within a day."); } }
function setCat(i) { catFilter = i; render(); }
function setPeriod(p) { period = p; render(); }

function openModal() {
  $("m-where").value = ""; $("m-amt").value = ""; $("m-date").value = today().toLocaleDateString("en-CA");
  $("m-date").max = $("m-date").value;                                // no future dates
  $("modal").classList.add("show");
}
function closeModal(e) { if (!e || e.target.id === "modal") $("modal").classList.remove("show"); }   // click outside = close

function showToast(text, withLink) {
  $("toast").innerHTML = text + (withLink ? ` <button class="btn" onclick="go('Saved Expenses');$('toast').classList.remove('show')">View saved expenses</button>` : "");
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 5000);
}

/* 6. MENU + RENDER - draw the sidebar and the selected page */
function go(name) { page = name; render(); }

function render() {
  // "Saved Expenses" is added to the menu only after the first expense is saved
  const general = ["📊 Dashboard", "🧾 All Expenses", ...(db.expenses.length ? ["🗂️ Saved Expenses"] : []), "🔁 Bill & Subscription", "📈 Investment", "💳 Card", "🎯 Goals"];
  const groups = { General: general, Tools: ["💡 Insight", "📉 Analytics"], Other: ["⚙️ Setting", "❓ Help Center", "🎧 Support", "🚪 Logout"] };
  let html = `<div class="logo"><i>S</i><span>Dhanvix </span></div>`;
  for (const g in groups) {
    html += `<div class="grp">${g}</div>`;
    groups[g].forEach(item => {
      const name = item.slice(item.indexOf(" ") + 1);
      html += `<button class="nav ${name === page ? "on" : ""}" onclick="go('${name}')">${item}</button>`;
    });
  }
  $("menu").innerHTML = html;
  $("subtitle").textContent = SUBTITLE[page];
  $("page").innerHTML = pages[page]();
}

/* 7. EFFECTS - 3D tilt on cards and donut hover (event delegation = one listener for all cards) */
let tilted = null;
document.addEventListener("mousemove", e => {
  const c = e.target.closest(".card");
  if (tilted && tilted !== c) tilted.style.transform = "";            // reset the card we left
  tilted = c;
  if (!c) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  c.style.transform = `perspective(900px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg) translateZ(6px)`;
});

document.addEventListener("mouseover", e => {                         // show category info in the donut centre
  const s = e.target.closest(".seg");
  if (s) $("dc").innerHTML = `<span>${s.dataset.name}</span><b>${s.dataset.v}</b><span>${s.dataset.p} of spend</span>`;
});
document.addEventListener("mouseout", e => {
  if (e.target.closest(".seg")) $("dc").innerHTML = `<span>Total</span><b>${$("dc").dataset.total}</b>`;   // back to the total
});

$("search").addEventListener("input", e => { query = e.target.value; render(); });   // search filters tables

/* 8. START - fill the popup dropdowns and draw the first page */
$("m-cat").innerHTML = CATS.map(c => `<option>${c}</option>`).join("");
$("m-mode").innerHTML = MODES.map(m => `<option>${m}</option>`).join("");
render();
