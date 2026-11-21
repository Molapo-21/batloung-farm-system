'use strict';
/* Batloung Farm admin interface - talks to the REST API under /api */

/* ---------- authentication guard ---------- */
const TOKEN = localStorage.getItem('bf_token');
if (!TOKEN) location.replace('login.html');
function logout() { localStorage.removeItem('bf_token'); localStorage.removeItem('bf_admin'); location.replace('login.html'); }

const SIZES = ['SMALL', 'MEDIUM', 'LARGE'];
const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'];
const EMOJI = { apples: '🍎', bananas: '🍌', oranges: '🍊', mangoes: '🥭', grapes: '🍇' };
const emoji = (n) => EMOJI[String(n || '').toLowerCase()] || '🍓';
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => 'M ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sizeLabel = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);
const tag = (s) => `<span class="tag ${esc(s)}">${esc(String(s).replace('_', ' '))}</span>`;

/* ---------- API helper ---------- */
async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('bf_token'), ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) {
    const err = new Error('Cannot reach the server. Check that it is running.'); err.status = 0; throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.error || 'Please log in again'); }
  if (!res.ok) { const err = new Error(data.error || `Request failed (${res.status})`); err.status = res.status; err.details = data.details; throw err; }
  return data;
}

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
}

function errBox(err) {
  let d = '';
  if (Array.isArray(err.details) && err.details.length) {
    d = '<ul>' + err.details.map((x) => `<li>${esc(typeof x === 'string' ? x : (x.reason || JSON.stringify(x)))}</li>`).join('') + '</ul>';
  }
  return `<div class="msg-err"><b>${esc(err.message)}</b>${d}</div>`;
}

/* ---------- modal ---------- */
function openModal(title, html, { narrow = false } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${narrow ? 'narrow' : ''}"><button class="x" aria-label="Close">✕</button><h3>${esc(title)}</h3><div class="mbody">${html}</div></div>`;
  const close = () => ov.remove();
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  $('.x', ov).onclick = close;
  document.body.appendChild(ov);
  return { el: $('.mbody', ov), close };
}

/* ---------- shared data cache ---------- */
const cache = { fruits: [], stock: [], suppliers: [], vendors: [] };
async function loadFruitsAndStock() {
  const [f, s] = await Promise.all([api('/fruits'), api('/stock')]);
  cache.fruits = f.data; cache.stock = s.data;
}
const stockFor = (fruitId, size) => cache.stock.find((s) => s.fruit_id === Number(fruitId) && s.packaging_size === size);

/* ---------- router ---------- */
const pages = {};
async function route() {
  const name = (location.hash.replace('#', '').split('?')[0] || 'dashboard');
  const page = pages[name] || pages.dashboard;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + (pages[name] ? name : 'dashboard')));
  view.className = (pages[name] ? name : 'dashboard') === 'dashboard' ? 'full' : 'inner';
  view.innerHTML = '<p class="sub">Loading…</p>';
  try { await page(); }
  catch (e) { view.innerHTML = `<h2 class="title">Something went wrong</h2>${errBox(e)}<button class="pill small" onclick="route()">Try again</button>`; }
}
window.addEventListener('hashchange', () => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); route(); });

async function checkHealth() {
  try {
    const r = await fetch('/api/health'); const d = await r.json();
    $('#dbDot').className = 'dot ' + (d.success ? 'ok' : 'bad');
    const who = (JSON.parse(localStorage.getItem('bf_admin') || '{}').name) || 'Administrator';
    $('#dbText').textContent = d.success ? `${who} ` : `${who} · DB offline`;
  } catch { $('#dbDot').className = 'dot bad'; $('#dbText').textContent = 'Server offline'; }
}

/* =====================================================================
   DASHBOARD  (split hero like the template + stock strip)
   ===================================================================== */
pages.dashboard = async () => {
  const [sum, low, top] = await Promise.all([api('/reports/summary'), api('/stock/low'), api('/reports/top-vendor')]);
  await loadFruitsAndStock();
  const s = sum.data; const lowest = low.data[0]; const tv = top.data;
  const d = new Date(); const day = d.getDate();
  const ord = (day % 10 === 1 && day !== 11) ? 'st' : (day % 10 === 2 && day !== 12) ? 'nd' : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  const dateText = `${day}${ord} |  ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  const byFruit = cache.fruits.filter((f) => f.status === 'ACTIVE').map((f) => ({ f, rows: cache.stock.filter((x) => x.fruit_id === f.fruit_id) }));

  view.innerHTML = `
    <section class="hero2">
      <div class="hl">
        <img class="leaf" src="img/leaf1.png" alt="" style="left:34px;top:130px;width:84px;transform:rotate(-8deg)">
        <img class="leaf" src="img/leaf3.png" alt="" style="left:150px;top:205px;width:44px">
        <img class="leaf" src="img/leaf5.png" alt="" style="left:92px;bottom:92px;width:40px">
        <img class="leaf" src="img/leaf2.png" alt="" style="right:6px;bottom:150px;width:56px">
        <img class="logo" src="img/logo.png" alt="">
        <h1 class="display">Batloung Farm<br>Fresh fruit, every box counted</h1>
        <p class="kicker">Distribution Management System ${d.getFullYear()}</p>
        <p class="lead">Stock is tracked separately for small, medium and large boxes. Totals are calculated for you and every sale is all-or-nothing.</p>
        <div class="stats">
          <div class="stat"><small>Revenue</small><b>${money(s.revenue)}</b></div>
          <div class="stat"><small>Boxes in stock</small><b>${s.boxes_in_stock}</b></div>
          <div class="stat"><small>Outstanding</small><b>${money(s.outstanding_payments)}</b></div>
        </div>
        <a class="pill" href="#sales">New Sale</a>
        <p class="url">${s.sales_count} sales · ${s.vendors} vendors · ${s.suppliers} suppliers</p>
      </div>
      <div class="hr">
        <div class="clip"><div class="bgimg"></div></div><div class="photo"></div>
        <div class="datetag">${dateText}</div>
        <img class="leaf" src="img/leaf4.png" alt="" style="left:-30px;top:56%;width:70px;transform:rotate(14deg)">
        <img class="leaf" src="img/leaf2.png" alt="" style="left:18%;bottom:3%;width:64px">
        <div class="lowcard">
          <b>${lowest ? 'Low stock alert' : 'Stock is healthy'}</b><small>${low.count} line(s) at or below ${low.threshold} boxes</small>
          <p>${lowest ? `${emoji(lowest.fruit_name)} ${esc(lowest.fruit_name)} (${sizeLabel(lowest.packaging_size)}): only ${lowest.available_quantity} left.` : 'Every fruit and size is well stocked.'}</p>
          <p>${tv ? `🏆 Top vendor: <b style="display:inline">${esc(tv.vendor_name)}</b> (${tv.total_boxes} boxes)` : ''}</p>
        </div>
      </div>
    </section>
    <section class="strip">
      <h3>Stock by fruit</h3>
      <div class="fruits">${byFruit.map(({ f, rows }) => `
        <div class="fcard"><div class="disc">${emoji(f.fruit_name)}</div><div><h4>${esc(f.fruit_name)}</h4>
          <div class="sizes">${SIZES.map((z) => { const r = rows.find((x) => x.packaging_size === z); const q = r ? r.available_quantity : 0; return `<em class="${q <= 10 ? 'low' : ''}">${z[0]} ${q}</em>`; }).join('')}</div></div></div>`).join('') || '<div class="empty">No fruits registered</div>'}
      </div>
    </section>`;
};

/* =====================================================================
   SUPPLIERS
   ===================================================================== */
pages.suppliers = async () => {
  const { data } = await api('/suppliers'); cache.suppliers = data;
  view.innerHTML = `
    <h2 class="title">Suppliers</h2><p class="sub">Farms and traders we buy from across South Africa.</p>
    <div class="toolbar"><button class="pill small" id="add">+ Register supplier</button></div>
    <div class="card table-wrap"><table><thead><tr><th>ID</th><th>Business</th><th>Contact</th><th>Phone</th><th>Province</th><th>Address</th><th></th></tr></thead><tbody>
    ${data.map((s) => `<tr><td>${s.supplier_id}</td><td><b>${esc(s.business_name)}</b></td><td>${esc(s.contact_person)}</td><td>${esc(s.phone)}</td><td>${esc(s.province)}</td><td>${esc(s.address)}</td>
      <td class="actions"><button class="pill small ghost" data-edit="${s.supplier_id}">Edit</button> <button class="pill small danger" data-del="${s.supplier_id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No suppliers yet</td></tr>'}
    </tbody></table></div>`;
  $('#add').onclick = () => supplierForm();
  view.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => supplierForm(data.find((s) => s.supplier_id == b.dataset.edit)));
  view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const s = data.find((x) => x.supplier_id == b.dataset.del);
    if (!confirm(`Delete ${s.business_name}?`)) return;
    try { await api('/suppliers/' + s.supplier_id, { method: 'DELETE' }); toast('Supplier deleted'); route(); }
    catch (e) { toast(e.message, true); }
  });
};

function supplierForm(s) {
  const m = openModal(s ? 'Edit supplier' : 'Register supplier', `
    <div id="err"></div>
    <div class="cols"><div class="field"><label>Business name</label><input id="bn" value="${esc(s?.business_name)}"></div>
    <div class="field"><label>Contact person</label><input id="cp" value="${esc(s?.contact_person)}"></div>
    <div class="field"><label>Phone</label><input id="ph" value="${esc(s?.phone)}" placeholder="+27 11 555 0100"></div>
    <div class="field"><label>Province</label><select id="pv">${PROVINCES.map((p) => `<option ${s?.province === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div></div>
    <div class="field"><label>Address</label><input id="ad" value="${esc(s?.address)}"></div>
    <div class="modal-actions"><button class="pill small" id="save">${s ? 'Save changes' : 'Register'}</button></div>`);
  $('#save', m.el).onclick = async () => {
    const body = { business_name: $('#bn', m.el).value, contact_person: $('#cp', m.el).value, phone: $('#ph', m.el).value, province: $('#pv', m.el).value, address: $('#ad', m.el).value };
    try { await api(s ? '/suppliers/' + s.supplier_id : '/suppliers', { method: s ? 'PUT' : 'POST', body }); m.close(); toast(s ? 'Supplier updated' : 'Supplier registered'); route(); }
    catch (e) { $('#err', m.el).innerHTML = errBox(e); }
  };
}

/* =====================================================================
   FRUITS & STOCK
   ===================================================================== */
pages.fruits = async () => {
  await loadFruitsAndStock();
  const low = (await api('/stock/low')).data;
  view.innerHTML = `
    <h2 class="title">Fruits &amp; Stock</h2><p class="sub">Boxes available for each fruit, tracked separately by packaging size. Red means 10 boxes or fewer.</p>
    <div class="toolbar"><button class="pill small" id="add">+ Register fruit</button><span class="hint">${low.length} stock line(s) running low</span></div>
    <div class="card table-wrap"><table><thead><tr><th>Fruit</th><th>Status</th>${SIZES.map((z) => `<th class="num">${sizeLabel(z)} boxes</th><th class="num">${sizeLabel(z)} price</th>`).join('')}<th></th></tr></thead><tbody>
    ${cache.fruits.map((f) => `<tr><td><b>${emoji(f.fruit_name)} ${esc(f.fruit_name)}</b><br><span class="hint">${esc(f.description || '')}</span></td><td>${tag(f.status)}</td>
      ${SIZES.map((z) => { const r = stockFor(f.fruit_id, z); const q = r ? r.available_quantity : 0; return `<td class="num"><span class="qty ${q === 0 ? 'zero' : q <= 10 ? 'low' : ''}">${q}</span></td><td class="num">${money(r?.selling_price)}</td>`; }).join('')}
      <td class="actions"><button class="pill small ghost" data-edit="${f.fruit_id}">Edit</button></td></tr>`).join('')}
    </tbody></table></div>`;
  $('#add').onclick = () => fruitForm();
  view.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => fruitForm(cache.fruits.find((f) => f.fruit_id == b.dataset.edit)));
};

function fruitForm(f) {
  const price = (z) => stockFor(f?.fruit_id, z)?.selling_price ?? '';
  const m = openModal(f ? `Edit ${f.fruit_name}` : 'Register fruit', `
    <div id="err"></div>
    <div class="cols"><div class="field"><label>Fruit name</label><input id="fn" value="${esc(f?.fruit_name)}"></div>
    <div class="field"><label>Status</label><select id="st"><option ${f?.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE</option><option ${f?.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option></select></div></div>
    <div class="field"><label>Description</label><input id="ds" value="${esc(f?.description)}"></div>
    <label>Selling price per box (each size must be different)</label>
    <div class="cols">${SIZES.map((z) => `<div class="field"><label>${sizeLabel(z)} (M)</label><input type="number" min="0" step="0.01" id="p${z}" value="${price(z)}"></div>`).join('')}</div>
    <div class="modal-actions"><button class="pill small" id="save">${f ? 'Save changes' : 'Register fruit'}</button></div>`, { narrow: true });
  $('#save', m.el).onclick = async () => {
    const body = { fruit_name: $('#fn', m.el).value, description: $('#ds', m.el).value, status: $('#st', m.el).value };
    const pr = {}; SIZES.forEach((z) => { pr[z] = $('#p' + z, m.el).value; });
    if (SIZES.some((z) => pr[z] !== '')) body.prices = pr;
    try { await api(f ? '/fruits/' + f.fruit_id : '/fruits', { method: f ? 'PUT' : 'POST', body }); m.close(); toast(f ? 'Fruit updated' : 'Fruit registered'); route(); }
    catch (e) { $('#err', m.el).innerHTML = errBox(e); }
  };
}

/* =====================================================================
   VENDORS
   ===================================================================== */
pages.vendors = async () => {
  view.innerHTML = `
    <h2 class="title">Vendors</h2><p class="sub">Street vendors and small retailers who buy from us. Outstanding balance = billed − paid.</p>
    <div class="toolbar"><button class="pill small" id="add">+ Register vendor</button><input class="search" id="q" placeholder="Search by name or phone…"></div>
    <div class="card table-wrap" id="list"></div>`;
  const draw = async (q) => {
    const { data } = await api(q ? '/vendors/search?q=' + encodeURIComponent(q) : '/vendors'); cache.vendors = data;
    $('#list').innerHTML = `<table><thead><tr><th>ID</th><th>Vendor</th><th>Phone</th><th>Location</th><th>Registered</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Outstanding</th><th></th></tr></thead><tbody>
      ${data.map((v) => `<tr><td>${v.vendor_id}</td><td><b>${esc(v.vendor_name)}</b></td><td>${esc(v.phone_number)}</td><td>${esc(v.location)}</td><td>${esc(v.registration_date)}</td>
        <td class="num">${money(v.total_billed)}</td><td class="num">${money(v.total_paid)}</td>
        <td class="num"><b style="color:${v.outstanding_balance > 0 ? 'var(--danger)' : 'inherit'}">${money(v.outstanding_balance)}</b></td>
        <td class="actions"><button class="pill small ghost" data-stm="${v.vendor_id}">Statement</button> <button class="pill small ghost" data-edit="${v.vendor_id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="9" class="empty">No vendors found</td></tr>'}</tbody></table>`;
    $('#list').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => vendorForm(data.find((v) => v.vendor_id == b.dataset.edit)));
    $('#list').querySelectorAll('[data-stm]').forEach((b) => b.onclick = () => vendorStatement(data.find((v) => v.vendor_id == b.dataset.stm)));
  };
  let timer; $('#q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => draw(e.target.value.trim()).catch((x) => toast(x.message, true)), 250); };
  $('#add').onclick = () => vendorForm();
  const hq = decodeURIComponent((location.hash.split('?q=')[1]) || '');
  $('#q').value = hq;
  await draw(hq);
};

function vendorForm(v) {
  const m = openModal(v ? 'Edit vendor' : 'Register vendor', `
    <div id="err"></div>
    <div class="cols"><div class="field"><label>Vendor name</label><input id="vn" value="${esc(v?.vendor_name)}"></div>
    <div class="field"><label>Phone number</label><input id="vp" value="${esc(v?.phone_number)}" placeholder="+266 5800 0000"></div></div>
    <div class="field"><label>Location</label><input id="vl" value="${esc(v?.location)}"></div>
    <div class="modal-actions"><button class="pill small" id="save">${v ? 'Save changes' : 'Register'}</button></div>`, { narrow: true });
  $('#save', m.el).onclick = async () => {
    const body = { vendor_name: $('#vn', m.el).value, phone_number: $('#vp', m.el).value, location: $('#vl', m.el).value };
    try { await api(v ? '/vendors/' + v.vendor_id : '/vendors', { method: v ? 'PUT' : 'POST', body }); m.close(); toast(v ? 'Vendor updated' : 'Vendor registered'); route(); }
    catch (e) { $('#err', m.el).innerHTML = errBox(e); }
  };
}

async function vendorStatement(v) {
  const { data } = await api('/sales?vendor_id=' + v.vendor_id);
  const m = openModal(v.vendor_name, `
    <p class="sub">${esc(v.phone_number)} · ${esc(v.location)}</p>
    <div class="kpis"><div class="kpi"><small>Billed</small><b>${money(v.total_billed)}</b></div><div class="kpi"><small>Paid</small><b>${money(v.total_paid)}</b></div><div class="kpi ${v.outstanding_balance > 0 ? 'alert' : ''}"><small>Outstanding</small><b>${money(v.outstanding_balance)}</b></div></div>
    <div class="table-wrap"><table><thead><tr><th>Sale</th><th>Date</th><th>Status</th><th class="num">Total</th><th class="num">Balance</th></tr></thead><tbody>
    ${data.map((s) => `<tr class="click" data-sale="${s.sale_id}"><td>#${s.sale_id}</td><td>${esc(s.sale_date)}</td><td>${tag(s.payment_status)}</td><td class="num">${money(s.total_amount)}</td><td class="num">${money(s.outstanding_balance)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No sales yet</td></tr>'}</tbody></table></div>`);
  m.el.querySelectorAll('[data-sale]').forEach((r) => r.onclick = () => { m.close(); saleDetail(r.dataset.sale); });
}

/* =====================================================================
   PURCHASES
   ===================================================================== */
pages.purchases = async () => {
  const { data } = await api('/purchases');
  view.innerHTML = `
    <h2 class="title">Purchases</h2><p class="sub">Fruit bought from suppliers. Recording a purchase adds boxes to the matching fruit and size.</p>
    <div class="toolbar"><button class="pill small" id="add">+ Record purchase</button></div>
    <div class="card table-wrap"><table><thead><tr><th>ID</th><th>Date</th><th>Supplier</th><th>Province</th><th class="num">Boxes</th><th class="num">Total</th></tr></thead><tbody>
    ${data.map((p) => `<tr class="click" data-id="${p.purchase_id}"><td>#${p.purchase_id}</td><td>${esc(p.purchase_date)}</td><td><b>${esc(p.business_name)}</b></td><td>${esc(p.province)}</td><td class="num">${p.total_boxes}</td><td class="num">${money(p.total_amount)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No purchases yet</td></tr>'}</tbody></table></div>`;
  $('#add').onclick = purchaseForm;
  view.querySelectorAll('[data-id]').forEach((r) => r.onclick = async () => {
    const p = (await api('/purchases/' + r.dataset.id)).data;
    openModal(`Purchase #${p.purchase_id}`, `<p class="sub">${esc(p.business_name)} (${esc(p.province)}) · ${esc(p.purchase_date)}</p>
      <div class="table-wrap"><table><thead><tr><th>Fruit</th><th>Size</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Line total</th></tr></thead><tbody>
      ${p.items.map((i) => `<tr><td>${emoji(i.fruit_name)} ${esc(i.fruit_name)}</td><td>${sizeLabel(i.packaging_size)}</td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_cost)}</td><td class="num">${money(i.line_total)}</td></tr>`).join('')}</tbody></table></div>
      <div class="total-box"><span>Total (calculated automatically)</span><b>${money(p.total_amount)}</b></div>`);
  });
};

async function purchaseForm() {
  await Promise.all([loadFruitsAndStock(), api('/suppliers').then((r) => { cache.suppliers = r.data; })]);
  const fruits = cache.fruits.filter((f) => f.status === 'ACTIVE');
  const m = openModal('Record purchase', `
    <div id="err"></div>
    <div class="cols"><div class="field"><label>Supplier</label><select id="sup">${cache.suppliers.map((s) => `<option value="${s.supplier_id}">${esc(s.business_name)} (${esc(s.province)})</option>`).join('')}</select></div>
    <div class="field"><label>Purchase date</label><input type="date" id="dt" value="${today()}"></div></div>
    <label>Items</label><div id="lines"></div>
    <button class="pill small ghost" id="addLine" type="button">+ Add fruit</button>
    <div class="total-box"><span>Total (calculated automatically)</span><b id="tot">M 0.00</b></div>
    <div class="modal-actions"><button class="pill small" id="save">Save purchase</button></div>`);
  const lines = $('#lines', m.el);
  const addLine = () => {
    const d = document.createElement('div'); d.className = 'line'; d.style.gridTemplateColumns = '1.4fr 1fr .8fr 1fr auto';
    d.innerHTML = `<div><label>Fruit</label><select class="f">${fruits.map((f) => `<option value="${f.fruit_id}">${esc(f.fruit_name)}</option>`).join('')}</select></div>
      <div><label>Size</label><select class="z">${SIZES.map((z) => `<option value="${z}">${sizeLabel(z)}</option>`).join('')}</select></div>
      <div><label>Boxes</label><input class="q" type="number" min="1" step="1" value="10"></div>
      <div><label>Unit cost (M)</label><input class="c" type="number" min="0" step="0.01" value="0"></div>
      <button class="rm" type="button" title="Remove">×</button>`;
    d.oninput = recalc; d.querySelector('.rm').onclick = () => { d.remove(); recalc(); }; lines.appendChild(d); recalc();
  };
  function recalc() {
    let t = 0; lines.querySelectorAll('.line').forEach((l) => { t += Math.round(Number($('.c', l).value || 0) * 100) * Number($('.q', l).value || 0); });
    $('#tot', m.el).textContent = money(t / 100);
  }
  $('#addLine', m.el).onclick = addLine; addLine();
  $('#save', m.el).onclick = async () => {
    const items = [...lines.querySelectorAll('.line')].map((l) => ({ fruit_id: Number($('.f', l).value), packaging_size: $('.z', l).value, quantity: Number($('.q', l).value), unit_cost: Number($('.c', l).value) }));
    try { await api('/purchases', { method: 'POST', body: { supplier_id: Number($('#sup', m.el).value), purchase_date: $('#dt', m.el).value, items } }); m.close(); toast('Purchase recorded, stock updated'); route(); }
    catch (e) { $('#err', m.el).innerHTML = errBox(e); }
  };
}

/* =====================================================================
   SALES
   ===================================================================== */
pages.sales = async () => {
  const status = (location.hash.split('?status=')[1]) || '';
  const { data } = await api('/sales' + (status ? '?status=' + status : ''));
  view.innerHTML = `
    <h2 class="title">Sales</h2><p class="sub">Sales to vendors. The server prices each box from the per-size price list and rejects the whole sale if any item is short of stock.</p>
    <div class="toolbar"><button class="pill small" id="add">+ New sale</button>
      <select id="flt" style="max-width:220px;border-radius:40px"><option value="">All payment statuses</option>${['PAID', 'PARTIALLY_PAID', 'UNPAID'].map((s) => `<option ${status === s ? 'selected' : ''} value="${s}">${s.replace('_', ' ')}</option>`).join('')}</select></div>
    <div class="card table-wrap"><table><thead><tr><th>Sale</th><th>Date</th><th>Vendor</th><th class="num">Boxes</th><th>Status</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>
    ${data.map((s) => `<tr class="click" data-id="${s.sale_id}"><td>#${s.sale_id}</td><td>${esc(s.sale_date)}</td><td><b>${esc(s.vendor_name)}</b></td><td class="num">${s.total_boxes}</td><td>${tag(s.payment_status)}</td><td class="num">${money(s.total_amount)}</td><td class="num">${money(s.amount_paid)}</td><td class="num">${money(s.outstanding_balance)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No sales found</td></tr>'}</tbody></table></div>`;
  $('#add').onclick = saleForm;
  $('#flt').onchange = (e) => { location.hash = e.target.value ? '#sales?status=' + e.target.value : '#sales'; };
  view.querySelectorAll('[data-id]').forEach((r) => r.onclick = () => saleDetail(r.dataset.id));
};

async function saleDetail(id) {
  const s = (await api('/sales/' + id)).data;
  const m = openModal(`Sale #${s.sale_id}`, `
    <p class="sub">${esc(s.vendor_name)} · ${esc(s.phone_number)} · ${esc(s.sale_date)} · ${tag(s.payment_status)}</p>
    <div class="table-wrap"><table><thead><tr><th>Fruit</th><th>Size</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Line total</th></tr></thead><tbody>
    ${s.items.map((i) => `<tr><td>${emoji(i.fruit_name)} ${esc(i.fruit_name)}</td><td>${sizeLabel(i.packaging_size)}</td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_price)}</td><td class="num">${money(i.line_total)}</td></tr>`).join('')}</tbody></table></div>
    <div class="kpis" style="margin-top:18px"><div class="kpi"><small>Total payable</small><b>${money(s.total_amount)}</b></div><div class="kpi"><small>Paid</small><b>${money(s.amount_paid)}</b></div><div class="kpi ${s.outstanding_balance > 0 ? 'alert' : ''}"><small>Outstanding</small><b>${money(s.outstanding_balance)}</b></div></div>
    <label>Payments</label>
    <div class="table-wrap"><table><tbody>${s.payments.map((p) => `<tr><td>${esc(p.payment_date)}</td><td><span class="tag ${p.payment_method === 'CREDIT' ? 'UNPAID' : 'PAID'}">${esc(p.payment_method.replace('_', ' '))}</span></td><td>${esc(p.reference || '')}</td><td class="num">${money(p.amount)}</td></tr>`).join('')}</tbody></table></div>
    ${s.outstanding_balance > 0 ? `<hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><div id="perr"></div>
      <div class="cols"><div class="field"><label>Method</label><select id="pm"><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option></select></div>
      <div class="field"><label>Amount (M)</label><input id="pa" type="number" min="0.01" step="0.01" value="${s.outstanding_balance}"></div>
      <div class="field"><label>Reference</label><input id="pr" placeholder="optional"></div></div>
      <div class="modal-actions"><button class="pill small" id="pay">Record payment</button></div>` : ''}`);
  const pay = $('#pay', m.el);
  if (pay) pay.onclick = async () => {
    try { await api(`/sales/${s.sale_id}/payments`, { method: 'POST', body: { payment_method: $('#pm', m.el).value, amount: Number($('#pa', m.el).value), reference: $('#pr', m.el).value } }); m.close(); toast('Payment recorded'); route(); }
    catch (e) { $('#perr', m.el).innerHTML = errBox(e); }
  };
}

async function saleForm() {
  await Promise.all([loadFruitsAndStock(), api('/vendors').then((r) => { cache.vendors = r.data; })]);
  const fruits = cache.fruits.filter((f) => f.status === 'ACTIVE');
  const m = openModal('New sale', `
    <div id="err"></div>
    <div class="cols"><div class="field"><label>Vendor</label><select id="vd">${cache.vendors.map((v) => `<option value="${v.vendor_id}">${esc(v.vendor_name)} — ${esc(v.phone_number)}</option>`).join('')}</select></div>
    <div class="field"><label>Sale date</label><input type="date" id="dt" value="${today()}"></div></div>
    <label>Items</label><div id="lines"></div>
    <button class="pill small ghost" id="addLine" type="button">+ Add fruit</button>
    <div class="total-box"><span>Total payable (calculated automatically)</span><b id="tot">M 0.00</b></div>
    <div class="cols"><div class="field"><label>Payment</label><select id="pm"><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="CREDIT">Credit (pay later)</option></select></div>
    <div class="field" id="paBox"><label>Amount paid now (M)</label><input id="pa" type="number" min="0" step="0.01" value="0"></div>
    <div class="field" id="prBox"><label>Reference</label><input id="pr" placeholder="optional"></div></div>
    <div class="modal-actions"><button class="pill small" id="save">Record sale</button></div>`);
  const lines = $('#lines', m.el); let total = 0; let paEdited = false;
  const addLine = () => {
    const d = document.createElement('div'); d.className = 'line'; d.style.gridTemplateColumns = '1.3fr 1fr .8fr 1.1fr auto';
    d.innerHTML = `<div><label>Fruit</label><select class="f">${fruits.map((f) => `<option value="${f.fruit_id}">${esc(f.fruit_name)}</option>`).join('')}</select></div>
      <div><label>Size</label><select class="z">${SIZES.map((z) => `<option value="${z}">${sizeLabel(z)}</option>`).join('')}</select></div>
      <div><label>Boxes</label><input class="q" type="number" min="1" step="1" value="1"></div>
      <div class="calc"></div><button class="rm" type="button" title="Remove">×</button>`;
    d.oninput = recalc; d.querySelector('.rm').onclick = () => { d.remove(); recalc(); }; lines.appendChild(d); recalc();
  };
  function recalc() {
    let t = 0;
    lines.querySelectorAll('.line').forEach((l) => {
      const st = stockFor($('.f', l).value, $('.z', l).value); const q = Number($('.q', l).value || 0);
      const price = st ? st.selling_price : 0; const lt = Math.round(price * 100) * q; t += lt;
      const short = st && q > st.available_quantity;
      $('.calc', l).innerHTML = `<b style="${short ? 'color:var(--danger)' : ''}">${money(lt / 100)}</b>${money(price)} × ${q} · ${st ? st.available_quantity : 0} in stock${short ? ' ⚠' : ''}`;
    });
    total = t / 100; $('#tot', m.el).textContent = money(total);
    if (!paEdited && $('#pm', m.el).value !== 'CREDIT') $('#pa', m.el).value = total;
  }
  const togglePay = () => { const credit = $('#pm', m.el).value === 'CREDIT'; $('#paBox', m.el).style.display = credit ? 'none' : ''; $('#prBox', m.el).style.display = credit ? 'none' : ''; if (!credit && !paEdited) $('#pa', m.el).value = total; };
  $('#pa', m.el).oninput = () => { paEdited = true; };
  $('#pm', m.el).onchange = togglePay;
  $('#addLine', m.el).onclick = addLine; addLine(); togglePay();
  $('#save', m.el).onclick = async () => {
    const items = [...lines.querySelectorAll('.line')].map((l) => ({ fruit_id: Number($('.f', l).value), packaging_size: $('.z', l).value, quantity: Number($('.q', l).value) }));
    const method = $('#pm', m.el).value;
    const body = { vendor_id: Number($('#vd', m.el).value), sale_date: $('#dt', m.el).value, items, payment_method: method, amount_paid: Number($('#pa', m.el).value), reference: $('#pr', m.el).value };
    try { const r = await api('/sales', { method: 'POST', body }); m.close(); toast(`Sale #${r.data.sale_id} recorded · ${money(r.data.total_amount)}`); route(); }
    catch (e) { $('#err', m.el).innerHTML = errBox(e); m.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
}

/* =====================================================================
   REPORTS (the four required SQL reports + outstanding balances)
   ===================================================================== */
pages.reports = async () => {
  const [tf, tv, sl, ob] = await Promise.all([api('/reports/top-fruits'), api('/reports/top-vendor'), api('/reports/stock-levels'), api('/reports/outstanding-balances')]);
  const max = Math.max(1, ...tf.data.map((r) => r.boxes_sold));
  const fruitNames = [...new Set(sl.data.map((r) => r.fruit_name))];
  view.innerHTML = `
    <h2 class="title">Reports</h2><p class="sub">Live results from the SQL reporting queries.</p>
    <div class="grid2">
      <div class="card"><h3>Five most frequently sold fruits</h3><p class="cap">By number of boxes sold</p><table><tbody>
        ${tf.data.map((r, i) => `<tr><td>${i + 1}</td><td><b>${emoji(r.fruit_name)} ${esc(r.fruit_name)}</b></td><td style="width:34%"><div class="bar"><i style="width:${(r.boxes_sold / max) * 100}%"></i></div></td><td class="num">${r.boxes_sold} boxes</td></tr>`).join('') || '<tr><td class="empty">No sales yet</td></tr>'}</tbody></table></div>
      <div class="card"><h3>Sales revenue by date range</h3><p class="cap">Inclusive of both dates</p>
        <div class="cols"><div class="field"><label>From</label><input type="date" id="from" value="2026-10-01"></div><div class="field"><label>To</label><input type="date" id="to" value="${today()}"></div></div>
        <div class="total-box"><span id="revInfo">—</span><b id="rev">M 0.00</b></div></div>
      <div class="card"><h3>Top vendor</h3><p class="cap">Vendor who has bought the most boxes</p>
        ${tv.data ? `<div class="stats" style="margin:0"><div class="stat"><small>Vendor</small><b>${esc(tv.data.vendor_name)}</b></div><div class="stat"><small>Boxes</small><b>${tv.data.total_boxes}</b></div></div>` : '<div class="empty">No sales yet</div>'}</div>
      <div class="card"><h3>Vendors with outstanding payments</h3><p class="cap">Total billed minus total paid</p><table><tbody>
        ${ob.data.map((r) => `<tr><td><b>${esc(r.vendor_name)}</b><br><span class="hint">${r.unpaid_sales} unpaid sale(s)</span></td><td class="num" style="color:var(--danger)"><b>${money(r.outstanding_balance)}</b></td></tr>`).join('') || '<tr><td class="empty">Nobody owes money 🎉</td></tr>'}</tbody></table></div>
    </div>
    <div class="card table-wrap"><h3>Current stock levels</h3><p class="cap">Each fruit by packaging size</p><table><thead><tr><th>Fruit</th>${SIZES.map((z) => `<th class="num">${sizeLabel(z)}</th>`).join('')}</tr></thead><tbody>
      ${fruitNames.map((n) => `<tr><td><b>${emoji(n)} ${esc(n)}</b></td>${SIZES.map((z) => { const r = sl.data.find((x) => x.fruit_name === n && x.packaging_size === z); const q = r ? r.available_quantity : 0; return `<td class="num"><span class="qty ${q === 0 ? 'zero' : q <= 10 ? 'low' : ''}">${q}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  const rev = async () => {
    try { const r = await api(`/reports/revenue?from=${$('#from').value}&to=${$('#to').value}`); $('#rev').textContent = money(r.data.total_revenue); $('#revInfo').textContent = `${r.data.number_of_sales} sale(s)`; }
    catch (e) { $('#rev').textContent = '—'; $('#revInfo').textContent = e.message; }
  };
  $('#from').onchange = rev; $('#to').onchange = rev; rev();
};

/* ---------- start ---------- */
$('#logout').onclick = logout;
const goSearch = () => { const v = $('#gsearch').value.trim(); if (v) { location.hash = '#vendors?q=' + encodeURIComponent(v); $('#gsearch').value = ''; } };
$('#gsearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') goSearch(); });
$('#gsearchBtn').onclick = goSearch;
checkHealth(); setInterval(checkHealth, 20000);
route();
