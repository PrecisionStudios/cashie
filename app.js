/* Cashie — Budget Planner (vanilla JS)
   Data stored in localStorage. No dependencies. MIT License. */
(function(){
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const els = {
    currencySelect: $('#currencySelect'),
    monthPicker: $('#monthPicker'),
    themeToggle: $('#themeToggle'),
    incomeTotal: $('#incomeTotal'),
    expenseTotal: $('#expenseTotal'),
    balanceTotal: $('#balanceTotal'),
    cashflowChart: $('#cashflowChart'),
    pieChart: $('#pieChart'),
    txForm: $('#txForm'),
    txType: $('#txType'),
    txAmount: $('#txAmount'),
    txDesc: $('#txDesc'),
    txDate: $('#txDate'),
    txCategory: $('#txCategory'),
    txMethod: $('#txMethod'),
    txRecurring: $('#txRecurring'),
    txTableBody: $('#txTable tbody'),
    txSearch: $('#txSearch'),
    addCategoryBtn: $('#addCategoryBtn'),
    categoriesList: $('#categoriesList'),
    categoryDialog: $('#categoryDialog'),
    catName: $('#catName'),
    catBudget: $('#catBudget'),
    catColor: $('#catColor'),
    catSaveBtn: $('#catSaveBtn'),
    goalsList: $('#goalsList'),
    addGoalBtn: $('#addGoalBtn'),
    goalDialog: $('#goalDialog'),
    goalName: $('#goalName'),
    goalTarget: $('#goalTarget'),
    goalSaved: $('#goalSaved'),
    goalSaveBtn: $('#goalSaveBtn'),
    exportJsonBtn: $('#exportJsonBtn'),
    exportCsvBtn: $('#exportCsvBtn'),
    importJsonInput: $('#importJsonInput'),
    seedDemoBtn: $('#seedDemoBtn'),
    clearDataBtn: $('#clearDataBtn'),
    footerYear: $('#footerYear')
  };

  // Utils
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const today = () => new Date().toISOString().slice(0,10);
  const monthKey = d => d.slice(0,7); // YYYY-MM
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  // Data
  const KEY = 'cashie_data_v1';
  const initial = () => ({
    currency: '€',
    categories: [
      { id: uid(), name: 'Food', color: '#34c759', budget: 250 },
      { id: uid(), name: 'Transport', color: '#ff9f0a', budget: 80 },
      { id: uid(), name: 'Rent', color: '#0a84ff', budget: 400 },
      { id: uid(), name: 'Entertainment', color: '#ff3b30', budget: 120 },
      { id: uid(), name: 'Utilities', color: '#af52de', budget: 150 },
      { id: uid(), name: 'Other', color: '#8e8e93', budget: 100 },
    ],
    transactions: [],
    goals: [],
  });

  const load = () => {
    try{
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : initial();
    }catch(e){
      console.error('Failed to parse storage, resetting.', e);
      return initial();
    }
  };
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  let state = load();

  // Initialization
  const init = () => {
    els.footerYear.textContent = new Date().getFullYear();
    // Theme
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

    // Month picker default to this month
    const nowMonth = new Date().toISOString().slice(0,7);
    els.monthPicker.value = nowMonth;

    // Currency
    els.currencySelect.value = state.currency;

    // Date for form
    els.txDate.value = today();

    renderAll();
    bindEvents();
  };

  const monthFilter = () => els.monthPicker.value || new Date().toISOString().slice(0,7);

  // Formatting
  const fmt = (n) => {
    const currency = state.currency || '€';
    try {
      // Handle common 1-3 letter currency "symbols"
      const intl = ['€','$','£','¥','₺','₽','₹'].includes(currency) ? currency : '';
      return (intl
        ? new Intl.NumberFormat(undefined, { style:'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol' }).format(n).replace('€', intl)
        : new Intl.NumberFormat(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 }).format(n) + ' ' + currency
      );
    } catch {
      return (Number(n).toFixed(2) + ' ' + currency);
    }
  };

  // Computations
  const txInMonth = () => state.transactions.filter(t => monthKey(t.date) === monthFilter());
  const sumBy = (arr, pred) => arr.reduce((acc, t) => acc + pred(t), 0);
  const totals = () => {
    const list = txInMonth();
    const income = sumBy(list, t => t.type === 'income' ? t.amount : 0);
    const expense = sumBy(list, t => t.type === 'expense' ? t.amount : 0);
    return {income, expense, balance: income - expense};
  };
  const categorySpend = () => {
    const list = txInMonth();
    const byCat = {};
    for(const t of list){
      if(t.type !== 'expense') continue;
      byCat[t.categoryId] ??= 0;
      byCat[t.categoryId] += t.amount;
    }
    return byCat;
  };

  // Renderers
  const renderTotals = () => {
    const {income, expense, balance} = totals();
    els.incomeTotal.textContent = fmt(income);
    els.expenseTotal.textContent = fmt(expense);
    els.balanceTotal.textContent = fmt(balance);
  };

  const renderCategories = () => {
    // Fill category select
    els.txCategory.innerHTML = '';
    state.categories.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      els.txCategory.appendChild(o);
    });

    // List with budgets
    els.categoriesList.innerHTML = '';
    const template = document.getElementById('categoryTemplate');
    const spendMap = categorySpend();
    state.categories.forEach(cat => {
      const node = template.content.cloneNode(true);
      const el = node.querySelector('.category');
      el.dataset.id = cat.id;
      el.querySelector('.name').textContent = cat.name;
      el.querySelector('.budget').textContent = fmt(cat.budget ?? 0);
      const dot = el.querySelector('.color-dot');
      dot.style.background = cat.color || '#ccc';

      const spent = spendMap[cat.id] || 0;
      const budget = Number(cat.budget || 0);
      const pct = budget > 0 ? clamp((spent / budget) * 100, 0, 100) : 0;
      const progress = el.querySelector('.progress');
      const progressText = el.querySelector('.progress-text');
      progress.style.width = pct + '%';
      progressText.textContent = `${fmt(spent)}${budget?` / ${fmt(budget)}`:''}`;

      el.querySelector('.edit').addEventListener('click', () => editCategory(cat));
      el.querySelector('.delete').addEventListener('click', () => deleteCategory(cat.id));

      els.categoriesList.appendChild(node);
    });
  };

  const renderTxTable = () => {
    const q = els.txSearch.value.trim().toLowerCase();
    const catsById = Object.fromEntries(state.categories.map(c => [c.id, c]));
    const list = txInMonth()
      .filter(t =>
        !q || [t.description, catsById[t.categoryId]?.name, t.method, t.type, t.amount].join(' ').toLowerCase().includes(q)
      )
      .sort((a,b) => a.date.localeCompare(b.date) || b.createdAt - a.createdAt);

    els.txTableBody.innerHTML='';
    for(const t of list){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.date}</td>
        <td><span class="pill ${t.type}">${t.type}</span></td>
        <td>${escapeHtml(t.description || '')}</td>
        <td>${escapeHtml(catsById[t.categoryId]?.name || '—')}</td>
        <td>${escapeHtml(t.method || '')}</td>
        <td class="right">${fmt(t.amount)}</td>
        <td class="actions">
          <button class="btn small secondary" data-act="edit">Edit</button>
          <button class="btn small danger" data-act="del">Delete</button>
        </td>
      `;
      tr.querySelector('[data-act="edit"]').addEventListener('click', () => editTransaction(t));
      tr.querySelector('[data-act="del"]').addEventListener('click', () => deleteTransaction(t.id));
      els.txTableBody.appendChild(tr);
    }
  };

  const renderGoals = () => {
    els.goalsList.innerHTML = '';
    const template = document.getElementById('goalTemplate');
    for(const g of state.goals){
      const node = template.content.cloneNode(true);
      const el = node.querySelector('.goal');
      el.dataset.id = g.id;
      el.querySelector('.name').textContent = g.name;
      el.querySelector('.target').textContent = `Target: ${fmt(g.target)}`;
      const pct = g.target > 0 ? clamp((g.saved / g.target) * 100, 0, 100) : 0;
      el.querySelector('.progress').style.width = pct + '%';
      el.querySelector('.progress-text').textContent = `${fmt(g.saved)} / ${fmt(g.target)} (${Math.round(pct)}%)`;
      el.querySelector('.add').addEventListener('click', () => {
        const add = prompt('Add amount to this goal:', '0');
        if(add == null) return;
        const n = Number(add);
        if(!isFinite(n)) return alert('Please enter a valid number.');
        g.saved = Math.max(0, (Number(g.saved)||0) + n);
        save(); renderGoals();
      });
      el.querySelector('.delete').addEventListener('click', () => {
        if(!confirm('Delete this goal?')) return;
        state.goals = state.goals.filter(x => x.id !== g.id);
        save(); renderGoals();
      });
      els.goalsList.appendChild(node);
    }
  };

  const renderCharts = () => {
    drawCashflow(els.cashflowChart, txInMonth());
    const map = categorySpend();
    const items = state.categories
      .map(c => ({name:c.name, color:c.color, value: map[c.id]||0}))
      .filter(i => i.value > 0);
    drawPie(els.pieChart, items);
  };

  const renderAll = () => {
    renderTotals();
    renderCategories();
    renderTxTable();
    renderGoals();
    renderCharts();
  };

  // CRUD: Transactions
  els.txForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = {
      id: uid(),
      type: els.txType.value,
      amount: Number(els.txAmount.value || 0),
      description: els.txDesc.value.trim(),
      date: els.txDate.value || today(),
      categoryId: els.txCategory.value,
      method: els.txMethod.value.trim(),
      recurring: !!els.txRecurring.checked,
      createdAt: Date.now(),
    };
    if(!t.amount || t.amount <= 0) return alert('Enter a valid amount.');
    if(!t.date) t.date = today();
    state.transactions.push(t);
    save();
    els.txForm.reset();
    els.txDate.value = today();
    renderAll();
  });

  function editTransaction(t){
    const newAmount = prompt('Amount', String(t.amount));
    if(newAmount == null) return;
    const n = Number(newAmount);
    if(!isFinite(n) || n <= 0) return alert('Invalid amount.');
    const newDesc = prompt('Description', t.description || '') ?? t.description;
    const newDate = prompt('Date (YYYY-MM-DD)', t.date) ?? t.date;
    const newMethod = prompt('Method', t.method || '') ?? t.method;
    const catName = prompt('Category (type exact name)', categoryById(t.categoryId)?.name || '') ?? '';
    const cat = state.categories.find(c => c.name.toLowerCase() === catName.toLowerCase()) || categoryById(t.categoryId);
    Object.assign(t, { amount:n, description:newDesc, date:newDate, method:newMethod, categoryId: cat?.id || t.categoryId });
    save(); renderAll();
  }

  function deleteTransaction(id){
    if(!confirm('Delete this transaction?')) return;
    state.transactions = state.transactions.filter(t => t.id !== id);
    save(); renderAll();
  }

  // CRUD: Categories
  els.addCategoryBtn.addEventListener('click', () => {
    els.catName.value = '';
    els.catBudget.value = '';
    els.catColor.value = '#34c759';
    els.categoryDialog.showModal();
  });

  els.catSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const name = els.catName.value.trim();
    if(!name) return;
    const cat = { id: uid(), name, color: els.catColor.value, budget: Number(els.catBudget.value||0) };
    state.categories.push(cat);
    save(); renderCategories(); renderCharts();
    els.categoryDialog.close();
  });

  function editCategory(cat){
    els.catName.value = cat.name;
    els.catBudget.value = cat.budget || 0;
    els.catColor.value = cat.color || '#34c759';
    els.categoryDialog.showModal();
    const onSave = (e) => {
      e.preventDefault();
      cat.name = els.catName.value.trim();
      cat.budget = Number(els.catBudget.value||0);
      cat.color = els.catColor.value;
      save(); renderCategories(); renderCharts();
      els.categoryDialog.close();
      els.catSaveBtn.removeEventListener('click', onSave);
    };
    els.catSaveBtn.addEventListener('click', onSave);
  }

  function deleteCategory(id){
    if(!confirm('Delete this category? Transactions will remain but might show "—".')) return;
    state.categories = state.categories.filter(c => c.id !== id);
    save(); renderCategories(); renderCharts(); renderTxTable();
  }

  // Goals
  els.addGoalBtn.addEventListener('click', () => {
    els.goalName.value = '';
    els.goalTarget.value = '';
    els.goalSaved.value = '0';
    els.goalDialog.showModal();
  });

  els.goalSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const g = {
      id: uid(),
      name: els.goalName.value.trim(),
      target: Number(els.goalTarget.value||0),
      saved: Number(els.goalSaved.value||0)
    };
    if(!g.name || !g.target) return;
    state.goals.push(g);
    save(); renderGoals();
    els.goalDialog.close();
  });

  // Charts
  function drawCashflow(canvas, list){
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Dimensions
    const W = canvas.width, H = canvas.height, P = 28;
    ctx.font = '12px system-ui';
    ctx.fillStyle = getCss('--muted'); ctx.strokeStyle = getCss('--border');
    ctx.lineWidth = 1;

    // Group by day
    const days = daysInMonth(monthFilter());
    const income = new Array(days).fill(0);
    const expense = new Array(days).fill(0);
    for(const t of list){
      const d = new Date(t.date);
      if(isNaN(d)) continue;
      const i = d.getDate()-1;
      if(t.type === 'income') income[i] += t.amount; else expense[i] += t.amount;
    }

    // Y scale
    const maxVal = Math.max(10, ...income, ...expense);
    const scaleY = (H-2*P)/maxVal;
    const stepX = (W-2*P)/days;

    // Axes
    ctx.beginPath();
    ctx.moveTo(P, H-P); ctx.lineTo(W-P, H-P); // x
    ctx.moveTo(P, P); ctx.lineTo(P, H-P); // y
    ctx.stroke();

    // Grid + labels
    ctx.fillStyle = getCss('--muted');
    for(let i=0;i<=4;i++){
      const y = H-P - (i*(H-2*P)/4);
      ctx.globalAlpha = .35;
      ctx.beginPath(); ctx.moveTo(P, y); ctx.lineTo(W-P, y); ctx.stroke();
      ctx.globalAlpha = 1;
      const label = (maxVal*i/4).toFixed(0);
      ctx.fillText(label, 4, y+4);
    }

    // Bars/lines
    // Expense bars
    ctx.fillStyle = '#ff3b30';
    for(let d=0; d<days; d++){
      const x = P + d*stepX + stepX*0.1;
      const h = expense[d]*scaleY;
      ctx.fillRect(x, H-P-h, stepX*0.35, h);
    }
    // Income bars
    ctx.fillStyle = '#34c759';
    for(let d=0; d<days; d++){
      const x = P + d*stepX + stepX*0.55;
      const h = income[d]*scaleY;
      ctx.fillRect(x, H-P-h, stepX*0.35, h);
    }

    // Legend
    const legend = [
      {label:'Income', color:'#34c759'},
      {label:'Expenses', color:'#ff3b30'}
    ];
    let lx = W - P - 150, ly = P - 6;
    legend.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, ly, 12, 12);
      ctx.fillStyle = getCss('--text');
      ctx.fillText(item.label, lx+18, ly+11);
      lx += 80;
    });
  }

  function drawPie(canvas, items){
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 20;
    const sum = items.reduce((a,b) => a + b.value, 0) || 1;
    let start = -Math.PI/2;
    items.forEach(item => {
      const ang = (item.value / sum) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start+ang);
      ctx.closePath();
      ctx.fillStyle = item.color || '#888';
      ctx.fill();
      start += ang;
    });
    // Labels
    ctx.font = '12px system-ui'; ctx.fillStyle = getCss('--text');
    start = -Math.PI/2;
    items.forEach(item => {
      const ang = (item.value / sum) * Math.PI * 2;
      const mid = start + ang/2;
      const rx = cx + Math.cos(mid)*(r*0.65);
      const ry = cy + Math.sin(mid)*(r*0.65);
      const pct = Math.round((item.value/sum)*100);
      ctx.textAlign = 'center';
      ctx.fillText(`${item.name} (${pct}%)`, rx, ry);
      start += ang;
    });
  }

  function getCss(varName){
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#999';
  }

  function daysInMonth(yyyy_mm){
    const [y,m] = yyyy_mm.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  // Helpers
  function categoryById(id){ return state.categories.find(c => c.id === id); }
  function escapeHtml(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // Export/Import
  els.exportJsonBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    downloadBlob(blob, `cashie-${monthFilter()}.json`);
  });
  els.exportCsvBtn.addEventListener('click', () => {
    const rows = [['date','type','description','category','method','amount']];
    const catsById = Object.fromEntries(state.categories.map(c => [c.id, c.name]));
    for(const t of state.transactions){
      rows.push([t.date, t.type, (t.description||'').replaceAll(',', ' '), catsById[t.categoryId]||'', t.method||'', String(t.amount)]);
    }
    const csv = rows.map(r => r.map(x => '"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    downloadBlob(blob, `cashie-transactions.csv`);
  });
  els.importJsonInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(!data || !data.categories || !Array.isArray(data.transactions)) throw new Error('Invalid file');
      state = data;
      save(); renderAll();
      alert('Data imported successfully.');
    }catch(err){
      console.error(err);
      alert('Failed to import JSON file.');
    }finally{
      e.target.value = '';
    }
  });

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  // Theme & general events
  function bindEvents(){
    els.currencySelect.addEventListener('change', () => {
      state.currency = els.currencySelect.value; save(); renderAll();
    });
    els.monthPicker.addEventListener('change', () => renderAll());
    els.themeToggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
    });
    els.txSearch.addEventListener('input', renderTxTable);
    els.clearDataBtn.addEventListener('click', () => {
      if(!confirm('This will delete ALL your data in this app. Continue?')) return;
      localStorage.removeItem(KEY);
      state = initial();
      save(); renderAll();
    });
    els.seedDemoBtn.addEventListener('click', seedDemo);
    window.addEventListener('resize', renderCharts);
  }

  function seedDemo(){
    if(!confirm('Add demo data (won\'t delete your existing data)?')) return;
    const m = monthFilter();
    const [y,mo] = m.split('-').map(Number);
    const cats = state.categories;
    const pick = arr => arr[Math.floor(Math.random()*arr.length)];
    // Add random expenses & income
    for(let i=0;i<50;i++){
      const day = String(1 + Math.floor(Math.random()*28)).padStart(2,'0');
      const type = Math.random() < .75 ? 'expense' : 'income';
      const amount = Number((type==='expense' ? (5 + Math.random()*80) : (50 + Math.random()*600)).toFixed(2));
      const cat = type==='expense' ? pick(cats) : pick(cats.filter(c => c.name==='Other') || cats);
      state.transactions.push({
        id: uid(),
        type, amount,
        description: type==='expense' ? pick(['Groceries','Fuel','Coffee','Movie','Dinner','Taxi','Snacks']) : pick(['Salary','Gift','Bonus','Refund']),
        date: `${y}-${String(mo).padStart(2,'0')}-${day}`,
        categoryId: cat?.id,
        method: pick(['Card','Cash','IBAN','PayPal']),
        recurring: false,
        createdAt: Date.now() + i
      });
    }
    save(); renderAll();
  }

  // Edit helpers (basic prompts used to keep code compact)
  // ... already included inside editTransaction/editCategory

  // Kick off
  init();

})();