/* Cash to Dine MVP
   Static/PWA prototype with localStorage.
   For real multi-device trial, connect actions to Supabase using schema in /supabase-schema.sql.
*/
const APP_VERSION = "0.4.0";
const OUTLET = "Cacayo";
const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // avoids O, I, L, 0, 1
const STORAGE_KEY = "ctd_mvp_state_v4";

function money(n){
  const value = Number(n || 0);
  return "Rp" + value.toLocaleString("id-ID");
}
function parseMoney(v){
  if(typeof v === "number") return v;
  return Number(String(v || "").replace(/[^0-9]/g,"")) || 0;
}
function todayISO(){ return new Date().toISOString(); }
function byId(id){ return document.getElementById(id); }
function uid(prefix="id"){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}
function randomCode(len=8){
  let code = "";
  for(let i=0;i<len;i++) code += SAFE_ALPHABET[Math.floor(Math.random()*SAFE_ALPHABET.length)];
  return code;
}

function publicBaseUrl(){
  return `${location.origin}${location.pathname}`;
}
function qrImageUrl(data, size=260){
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}
function readState(){
  const existing = localStorage.getItem(STORAGE_KEY);
  if(existing) return JSON.parse(existing);
  const seed = {
    currentUser:null,
    staff:[
      {id:"staff_owner", name:"Owner Demo", username:"owner", password:"owner123", role:"owner"},
      {id:"staff_kasir", name:"Kasir Demo", username:"kasir", password:"kasir123", role:"kasir"}
    ],
    members:[
      {id:"mem_demo", memberCode:"CTD-000001", name:"Andrew Demo", phone:"628553007700", password:"123456", status:"active", createdAt: todayISO()}
    ],
    wallets:{ mem_demo: 250000 },
    giftCodes:[
      {id:"gift_demo", code:"A7K9P2QX", value:100000, status:"available", campaignName:"Demo Soft Opening", expiredAt:"2026-08-31", usedByMemberId:null, usedAt:null, createdAt:todayISO()}
    ],
    transactions:[],
    pendingApprovals:[]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}
function writeState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
let state = readState();

function memberSeq(){
  const seq = state.members.length + 1;
  return "CTD-" + String(seq).padStart(6,"0");
}
function currentUser(){ return state.currentUser ? state.staff.find(s=>s.id===state.currentUser) : null; }
function requireLogin(){
  const user = currentUser();
  if(!user){ renderLogin(); return false; }
  return user;
}
function setHash(name, params={}){
  const query = new URLSearchParams(params).toString();
  location.hash = query ? `${name}?${query}` : name;
}
function getRoute(){
  const raw = location.hash.replace(/^#/,"") || "login";
  const [name, query=""] = raw.split("?");
  return {name, params:Object.fromEntries(new URLSearchParams(query))};
}
function mountLayout(){
  const app = byId("app");
  app.innerHTML = byId("layout-template").innerHTML;
  byId("outlet-name").textContent = `${OUTLET} • v${APP_VERSION}`;
  byId("logout-btn").onclick = () => {
    state.currentUser = null; writeState(state); setHash("login");
  };
}
function screen(html){ byId("screen").innerHTML = html; }
function setNav(active){
  const user = currentUser();
  const nav = byId("bottom-nav");
  if(!nav || !user) return;
  if(user.role === "owner"){
    nav.innerHTML = `
      <button class="${active==='owner'?'active':''}" onclick="setHash('owner')">Dashboard</button>
      <button class="${active==='gift'?'active':''}" onclick="setHash('gift-generate')">Gift Code</button>
      <button class="${active==='report'?'active':''}" onclick="setHash('report')">Report</button>
      <button class="${active==='members'?'active':''}" onclick="setHash('members')">Members</button>
    `;
  } else {
    nav.innerHTML = `
      <button class="${active==='kasir'?'active':''}" onclick="setHash('kasir')">Kasir</button>
      <button class="${active==='register'?'active':''}" onclick="setHash('register')">Daftar</button>
      <button class="${active==='tx'?'active':''}" onclick="setHash('report')">Transaksi</button>
    `;
  }
}

function renderLogin(){
  byId("app").innerHTML = `
    <div class="login-wrap">
      <section class="login-card">
        <div class="logo-mark">CTD</div>
        <h1>Cash to Dine</h1>
        <p>Web app/PWA MVP untuk kasir, owner, dan customer registration.</p>
        <div class="notice">Demo login: <b>owner / owner123</b> atau <b>kasir / kasir123</b></div>
        <form id="login-form">
          <label>Username</label>
          <input id="username" autocomplete="username" placeholder="owner atau kasir" />
          <label>Password</label>
          <input id="password" type="password" autocomplete="current-password" placeholder="••••••••" />
          <button class="full" style="margin-top:14px">Login</button>
        </form>
        <div class="divider"></div>
        <button class="secondary full" onclick="setHash('join')">Customer Join Page</button>
        <button class="ghost full" style="margin-top:8px" onclick="setHash('balance')">Cek Saldo Customer</button>
      </section>
    </div>
  `;
  byId("login-form").onsubmit = (e) => {
    e.preventDefault();
    const username = byId("username").value.trim();
    const password = byId("password").value;
    const user = state.staff.find(s=>s.username===username && s.password===password);
    if(!user){ alert("Login salah."); return; }
    state.currentUser = user.id; writeState(state);
    setHash(user.role === "owner" ? "owner" : "kasir");
  };
}

function renderKasir(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("kasir");
  const txToday = state.transactions.filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString());
  const topup = txToday.filter(t=>t.type==="topup").reduce((a,t)=>a+Number(t.cashPaid||0),0);
  const used = txToday.filter(t=>t.type==="use_balance").reduce((a,t)=>a+Number(t.balanceUsed||0),0);
  screen(`
    <section class="card">
      <h1>Kasir Home</h1>
      <p>Mulai dari nomor HP customer format 62xxxxxxxxxx.</p>
      <form id="search-form">
        <label>Cari Member by Nomor HP</label>
        <input id="phone" inputmode="numeric" placeholder="628553007700" />
        <button class="full" style="margin-top:12px">Cari Member</button>
      </form>
    </section>
    <section class="grid three">
      <div class="stat"><div class="label">Top Up Hari Ini</div><div class="value">${money(topup)}</div></div>
      <div class="stat"><div class="label">Saldo Dipakai</div><div class="value">${money(used)}</div></div>
      <div class="stat"><div class="label">Transaksi</div><div class="value">${txToday.length}</div></div>
    </section>
    <section class="card">
      <h3>Quick Action</h3>
      <div class="grid two">
        <button onclick="setHash('register')">Daftar Member Baru</button>
        <button class="secondary" onclick="setHash('report')">Transaksi Hari Ini</button>
      </div>
    </section>
  `);
  byId("search-form").onsubmit = (e)=>{
    e.preventDefault();
    const phone = byId("phone").value.trim().replace(/^0/,"62");
    setHash("member", {phone});
  };
}

function findMemberByPhone(phone){
  return state.members.find(m=>m.phone===String(phone).trim());
}
function memberBalance(memberId){ return Number(state.wallets[memberId] || 0); }

function renderMember(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("kasir");
  const {params} = getRoute();
  const phone = params.phone || "";
  const member = findMemberByPhone(phone);
  if(!member){
    screen(`
      <section class="card">
        <h1>Member tidak ditemukan</h1>
        <p>No HP: <b>${phone || "-"}</b></p>
        <button class="full" onclick="setHash('register',{phone:'${phone}'})">Daftarkan Member</button>
        <button class="ghost full" style="margin-top:8px" onclick="setHash('kasir')">Kembali</button>
      </section>
    `); return;
  }
  const bal = memberBalance(member.id);
  const memberTx = state.transactions.filter(t=>t.memberId===member.id).slice(-5).reverse();
  screen(`
    <section class="card">
      <h1>${member.name}</h1>
      <div class="row">
        <span class="badge ok">${member.status.toUpperCase()}</span>
        <span class="badge">${member.memberCode}</span>
      </div>
      <div class="divider"></div>
      <div class="kpi">
        <div class="label">Saldo Dining</div>
        <div class="value">${money(bal)}</div>
      </div>
      <div class="grid two" style="margin-top:12px">
        <button onclick="setHash('topup',{phone:'${member.phone}'})">Top Up Saldo</button>
        <button class="secondary" onclick="setHash('use-balance',{phone:'${member.phone}'})">Gunakan Saldo</button>
      </div>
    </section>
    <section class="card">
      <h3>Detail</h3>
      <div class="item"><div class="title">HP</div><div class="meta">${member.phone}</div></div>
      <div class="item"><div class="title">Member ID</div><div class="meta">${member.memberCode}</div></div>
    </section>
    <section class="card">
      <h3>Histori Terakhir</h3>
      <div class="list">
        ${memberTx.length ? memberTx.map(t=>`
          <div class="item">
            <div class="title">${t.typeLabel || t.type} • ${money(t.balanceUsed || t.creditIssued || t.value || 0)}</div>
            <div class="meta">${t.posBillNumber || t.campaignName || t.paymentMethod || ""} • ${new Date(t.createdAt).toLocaleString("id-ID")}</div>
          </div>`).join("") : `<p>Belum ada transaksi.</p>`}
      </div>
    </section>
  `);
}

function renderRegister(){
  const user = currentUser();
  if(user){ mountLayout(); setNav("register"); }
  else {
    byId("app").innerHTML = `<main style="padding:16px;max-width:520px;margin:auto"></main>`;
  }
  const {params} = getRoute();
  const target = user ? byId("screen") : document.querySelector("main");
  target.innerHTML = `
    <section class="card">
      <h1 id="register-title">Daftar Member Baru</h1>
      <p>Masukkan Gift Code 8 digit. Setelah daftar berhasil, saldo gift otomatis masuk ke akun membership kamu.</p>
      <form id="register-form">
        <label>Nama Lengkap</label>
        <input id="name" placeholder="Nama customer" required />
        <label>No HP</label>
        <input id="phone" inputmode="numeric" placeholder="628xxxxxxxxxx" value="${params.phone || ""}" required />
        <label>Password Membership</label>
        <input id="pass" type="password" placeholder="Minimal 6 karakter" required />
        <label>Gift Code / Invite Code</label>
        <input id="gift" class="code-box" placeholder="A7K9P2QX" value="${params.code || ""}" />
        <button class="full" style="margin-top:14px">Daftar Sekarang</button>
      </form>
      <div id="register-result" style="margin-top:12px"></div>
    </section>
    ${!user ? `<button class="ghost full" onclick="setHash('login')">Ke Login</button>` : ""}
  `;
  byId("register-form").onsubmit = (e)=>{
    e.preventDefault();
    const name = byId("name").value.trim();
    const phone = byId("phone").value.trim().replace(/^0/,"62");
    const pass = byId("pass").value;
    const giftInput = byId("gift").value.trim().toUpperCase();
    if(pass.length < 6){ alert("Password minimal 6 karakter."); return; }
    if(findMemberByPhone(phone)){ alert("Nomor HP sudah terdaftar."); return; }

    let initialBalance = 0;
    let gift = null;
    if(giftInput){
      gift = state.giftCodes.find(g=>g.code===giftInput);
      if(!gift){ alert("Gift Code tidak ditemukan."); return; }
      if(gift.status !== "available"){ alert("Gift Code sudah tidak available."); return; }
      if(gift.expiredAt && new Date(gift.expiredAt + "T23:59:59") < new Date()){ alert("Gift Code expired."); return; }
      initialBalance = Number(gift.value || 0);
    }

    const member = {id:uid("mem"), memberCode:memberSeq(), name, phone, password:pass, status:"active", createdAt:todayISO()};
    state.members.push(member);
    state.wallets[member.id] = initialBalance;

    if(gift){
      gift.status = "used";
      gift.usedByMemberId = member.id;
      gift.usedAt = todayISO();
      state.transactions.push({
        id:uid("tx"), type:"gift_claim", typeLabel:"Gift Code Claim",
        memberId:member.id, value:gift.value, campaignName:gift.campaignName,
        giftCode:gift.code, status:"approved", createdAt:todayISO()
      });
    }
    writeState(state);
    byId("register-result").innerHTML = `
      <div class="success">
        <b>Membership Active ✅</b><br>
        Member ID: ${member.memberCode}<br>
        Saldo Awal: ${money(initialBalance)}
      </div>
      <button class="full" style="margin-top:10px" onclick="setHash('member',{phone:'${member.phone}'})">Lihat Member</button>
    `;
  };
}

function renderTopup(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("kasir");
  const {params} = getRoute();
  const member = findMemberByPhone(params.phone);
  if(!member){ setHash("kasir"); return; }
  screen(`
    <section class="card">
      <h1>Top Up Saldo</h1>
      <p>${member.name} • ${member.phone}</p>
      <div class="kpi"><div class="label">Saldo Sekarang</div><div class="value">${money(memberBalance(member.id))}</div></div>
      <form id="topup-form">
        <label>Paket Top Up</label>
        <select id="package">
          <option value="1000000|1500000">Bayar 1jt → Saldo 1.5jt</option>
          <option value="500000|700000">Bayar 500rb → Saldo 700rb</option>
          <option value="custom">Custom</option>
        </select>
        <div class="grid two">
          <div>
            <label>Cash Paid</label>
            <input id="cashPaid" inputmode="numeric" value="1000000" />
          </div>
          <div>
            <label>Dining Value</label>
            <input id="creditIssued" inputmode="numeric" value="1500000" />
          </div>
        </div>
        <label>Payment Method</label>
        <select id="paymentMethod"><option>QRIS</option><option>Cash</option><option>Transfer</option><option>Card</option></select>
        <label>Catatan</label>
        <input id="note" placeholder="Opsional" />
        <button class="full" style="margin-top:14px">Submit Top Up</button>
      </form>
    </section>
  `);
  byId("package").onchange = (e)=>{
    if(e.target.value==="custom") return;
    const [paid, credit] = e.target.value.split("|");
    byId("cashPaid").value = paid; byId("creditIssued").value = credit;
  };
  byId("topup-form").onsubmit = (e)=>{
    e.preventDefault();
    const cashPaid = parseMoney(byId("cashPaid").value);
    const creditIssued = parseMoney(byId("creditIssued").value);
    state.wallets[member.id] = memberBalance(member.id) + creditIssued;
    state.transactions.push({
      id:uid("tx"), type:"topup", typeLabel:"Top Up",
      memberId:member.id, cashPaid, creditIssued, paymentMethod:byId("paymentMethod").value,
      cashierId:user.id, note:byId("note").value, status:"approved", createdAt:todayISO()
    });
    writeState(state);
    setHash("member",{phone:member.phone});
  };
}

function renderUseBalance(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("kasir");
  const {params} = getRoute();
  const member = findMemberByPhone(params.phone);
  if(!member){ setHash("kasir"); return; }
  const bal = memberBalance(member.id);
  screen(`
    <section class="card">
      <h1>Gunakan Saldo</h1>
      <p>${member.name} • Saldo ${money(bal)}</p>
      <div class="notice">
        Kasir cukup input nominal saldo/voucher yang akan dipakai. Bill dan payment split tetap divalidasi manual di POS.
      </div>
      <form id="use-form">
        <label>Nominal Saldo / Voucher yang Dipakai</label>
        <input id="balanceUsed" inputmode="numeric" placeholder="100000" required />
        <div id="calc" class="notice" style="margin-top:12px">Nominal akan dikirim ke customer untuk approval.</div>
        <button class="full" style="margin-top:14px">Request Customer Approval</button>
      </form>
    </section>
  `);
  const updateCalc=()=>{
    const used=parseMoney(byId("balanceUsed").value);
    byId("calc").innerHTML = `Customer akan approve pemakaian saldo: <b>${money(used)}</b>`;
  };
  byId("balanceUsed").oninput=updateCalc;
  byId("use-form").onsubmit = (e)=>{
    e.preventDefault();
    const balanceUsed = parseMoney(byId("balanceUsed").value);
    if(balanceUsed <= 0){ alert("Nominal saldo tidak valid."); return; }
    if(balanceUsed > bal){ alert("Saldo member tidak cukup."); return; }
    const pending = {
      id:uid("pa"), token:randomCode(16), memberId:member.id, cashierId:user.id,
      balanceUsed,
      status:"waiting", createdAt:todayISO()
    };
    state.pendingApprovals.push(pending); writeState(state);
    setHash("waiting",{token:pending.token});
  };
}
function renderWaiting(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("kasir");
  const {params} = getRoute();
  const pending = state.pendingApprovals.find(p=>p.token===params.token);
  if(!pending){ screen(`<section class="card"><h1>Approval tidak ditemukan</h1></section>`); return; }
  const member = state.members.find(m=>m.id===pending.memberId);
  const approvalLink = `${publicBaseUrl()}#approve?token=${pending.token}`;
  screen(`
    <section class="card">
      <h1>Menunggu Approval Customer</h1>
      <p>Customer buka link ini di HP sendiri dan input password membership.</p>
      <div class="item"><div class="title">Member</div><div class="meta">${member.name} • ${member.phone}</div></div>
      <div class="item"><div class="title">Nominal Saldo Dipakai</div><div class="meta">${money(pending.balanceUsed)}</div></div>
      <div class="qr-wrap">
        <img class="qr-img" src="${qrImageUrl(approvalLink)}" alt="QR Approval" />
        <div class="meta">Customer scan QR ini dari HP masing-masing.</div>
      </div>
      <label>Approval Link</label>
      <textarea class="copy-area" readonly>${approvalLink}</textarea>
      <button class="secondary full" onclick="navigator.clipboard.writeText('${approvalLink}').then(()=>alert('Link copied'))">Copy Approval Link</button>
      <button class="ghost full" style="margin-top:8px" onclick="setHash('approve',{token:'${pending.token}'})">Simulasi Customer Approve di Browser Ini</button>
      <div id="waiting-status" class="notice" style="margin-top:12px">Status: Waiting...</div>
    </section>
  `);
  const interval = setInterval(()=>{
    state = readState();
    const p = state.pendingApprovals.find(x=>x.token===params.token);
    if(!p){ clearInterval(interval); return; }
    const box = byId("waiting-status");
    if(!box) { clearInterval(interval); return; }
    if(p.status==="approved"){
      box.className="success"; box.innerHTML="Status: Approved ✅";
      setTimeout(()=>setHash("success",{token:p.token}),800);
      clearInterval(interval);
    }
  },1500);
}
function renderApprove(){
  const {params} = getRoute();
  const pending = state.pendingApprovals.find(p=>p.token===params.token);
  byId("app").innerHTML = `<main style="padding:16px;max-width:520px;margin:auto"></main>`;
  const target = document.querySelector("main");
  if(!pending){ target.innerHTML = `<section class="card"><h1>Approval tidak ditemukan</h1></section>`; return; }
  const member = state.members.find(m=>m.id===pending.memberId);
  target.innerHTML = `
    <section class="card">
      <h1>Approve Pemakaian Saldo</h1>
      <p>${OUTLET} Dining Club</p>
      <div class="approval-alert">
        <div style="font-weight:900">⚠️ Permintaan Pemakaian Saldo</div>
        <div class="big-money">${money(pending.balanceUsed)}</div>
        <div>Pastikan nominal ini sesuai dengan instruksi kasir di POS sebelum memasukkan PIN.</div>
      </div>
      <div class="item"><div class="title">Member</div><div class="meta">${member.name} • ${member.phone}</div></div>
      <form id="approve-form">
        <label>Password Membership</label>
        <input id="pass" type="password" placeholder="Password customer" required />
        <button class="ok full" style="margin-top:14px">Approve Pemakaian Saldo</button>
      </form>
      <button class="ghost full" style="margin-top:8px" onclick="setHash('login')">Cancel</button>
      <div id="approve-result" style="margin-top:12px"></div>
    </section>
  `;
  byId("approve-form").onsubmit = (e)=>{
    e.preventDefault();
    if(pending.status !== "waiting"){ alert("Approval sudah diproses."); return; }
    if(byId("pass").value !== member.password){ alert("Password salah."); return; }
    if(memberBalance(member.id) < pending.balanceUsed){ alert("Saldo tidak cukup."); return; }
    state.wallets[member.id] = memberBalance(member.id) - pending.balanceUsed;
    pending.status = "approved";
    pending.approvedAt = todayISO();
    state.transactions.push({
      id:uid("tx"), type:"use_balance", typeLabel:"Use Balance",
      memberId:member.id,
      balanceUsed:pending.balanceUsed, cashierId:pending.cashierId,
      approvalMethod:"customer_phone", status:"approved", createdAt:todayISO(), approvedAt:todayISO()
    });
    writeState(state);
    byId("approve-result").innerHTML = `<div class="success"><b>Approved ✅</b><br>Saldo berhasil dipotong ${money(pending.balanceUsed)}.</div>`;
  };
}
function renderSuccess(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("kasir");
  const {params} = getRoute();
  const pending = state.pendingApprovals.find(p=>p.token===params.token);
  if(!pending){ screen(`<section class="card"><h1>Transaksi Berhasil</h1></section>`); return; }
  const member = state.members.find(m=>m.id===pending.memberId);
  screen(`
    <section class="card">
      <h1>Saldo Berhasil Dipakai ✅</h1>
      <div class="item"><div class="title">Member</div><div class="meta">${member.name} • ${member.phone}</div></div>
      <div class="item"><div class="title">Saldo Dipakai</div><div class="meta">${money(pending.balanceUsed)}</div></div>
      <div class="item"><div class="title">Saldo Sisa</div><div class="meta">${money(memberBalance(member.id))}</div></div>
      <div class="notice">Kasir tetap validasi manual di POS: masukkan payment Voucher/Cash to Dine sebesar ${money(pending.balanceUsed)}. Sisa bill, kalau ada, dibayar QRIS/Cash/Card di POS.</div>
      <button class="full" style="margin-top:12px" onclick="setHash('kasir')">Transaksi Baru</button>
    </section>
  `);
}
function renderOwner(){
  const user = requireLogin(); if(!user) return;
  if(user.role !== "owner"){ setHash("kasir"); return; }
  mountLayout(); setNav("owner");
  const topupCash = state.transactions.filter(t=>t.type==="topup").reduce((a,t)=>a+Number(t.cashPaid||0),0);
  const issued = state.transactions.filter(t=>t.type==="topup").reduce((a,t)=>a+Number(t.creditIssued||0),0)
    + state.transactions.filter(t=>t.type==="gift_claim").reduce((a,t)=>a+Number(t.value||0),0);
  const used = state.transactions.filter(t=>t.type==="use_balance").reduce((a,t)=>a+Number(t.balanceUsed||0),0);
  const outstanding = Object.values(state.wallets).reduce((a,b)=>a+Number(b||0),0);
  const giftAvail = state.giftCodes.filter(g=>g.status==="available").length;
  const giftUsed = state.giftCodes.filter(g=>g.status==="used").length;
  screen(`
    <section class="card">
      <h1>Owner Dashboard</h1>
      <p>${OUTLET} • overview saldo, voucher, dan transaksi.</p>
      <div class="grid two">
        <div class="kpi"><div class="label">Member Aktif</div><div class="value">${state.members.length}</div></div>
        <div class="kpi"><div class="label">Outstanding Saldo</div><div class="value">${money(outstanding)}</div></div>
      </div>
    </section>
    <section class="grid three">
      <div class="stat"><div class="label">Cash Top Up Masuk</div><div class="value">${money(topupCash)}</div></div>
      <div class="stat"><div class="label">Dining Credit Issued</div><div class="value">${money(issued)}</div></div>
      <div class="stat"><div class="label">Saldo Sudah Dipakai</div><div class="value">${money(used)}</div></div>
    </section>
    <section class="card">
      <h3>Gift Code</h3>
      <div class="grid two">
        <div class="stat"><div class="label">Available</div><div class="value">${giftAvail}</div></div>
        <div class="stat"><div class="label">Used</div><div class="value">${giftUsed}</div></div>
      </div>
      <button class="full" style="margin-top:12px" onclick="setHash('gift-generate')">Generate Gift Code</button>
    </section>
  `);
}

function renderGiftGenerate(){
  const user = requireLogin(); if(!user) return;
  if(user.role !== "owner"){ setHash("kasir"); return; }
  mountLayout(); setNav("gift");
  screen(`
    <section class="card">
      <h1>Generate Gift Code</h1>
      <p>Kode random 8 digit. Kode = uang saldo, hanya 1x pakai saat daftar member baru.</p>
      <form id="gift-form">
        <label>Campaign / Event Name</label>
        <input id="campaign" value="Soft Opening Cacayo" required />
        <div class="grid two">
          <div>
            <label>Jumlah Kode</label>
            <input id="qty" inputmode="numeric" value="10" required />
          </div>
          <div>
            <label>Value per Code</label>
            <input id="value" inputmode="numeric" value="100000" required />
          </div>
        </div>
        <label>Expired Date</label>
        <input id="expired" type="date" value="2026-08-31" required />
        <button class="full" style="margin-top:14px">Generate Codes</button>
      </form>
      <div id="gift-result" style="margin-top:12px"></div>
    </section>
  `);
  byId("gift-form").onsubmit = (e)=>{
    e.preventDefault();
    const qty = Math.min(parseMoney(byId("qty").value), 500);
    const value = parseMoney(byId("value").value);
    const campaignName = byId("campaign").value.trim();
    const expiredAt = byId("expired").value;
    const created = [];
    for(let i=0;i<qty;i++){
      let code;
      do { code = randomCode(8); } while(state.giftCodes.find(g=>g.code===code) || created.includes(code));
      created.push(code);
      state.giftCodes.push({id:uid("gift"), code, value, status:"available", campaignName, expiredAt, usedByMemberId:null, usedAt:null, createdAt:todayISO()});
    }
    writeState(state);
    const csv = created.join("\n");
    const joinBase = `${publicBaseUrl()}#join?code=`;
    const waMessages = created.map(code => 
`Halo Kak, kamu dapat Gift Dining Credit ${money(value)} dari ${OUTLET}.

Daftar member di link ini:
${joinBase}${code}

Gift Code: ${code}

Kode ini hanya bisa digunakan 1x saat daftar member baru.`
    ).join("\n\n-------------------------\n\n");

    const linkList = created.map(code => `${joinBase}${code}`).join("\n");

    byId("gift-result").innerHTML = `
      <div class="success"><b>${qty} Gift Codes Generated ✅</b><br>Total Liability: ${money(qty*value)}</div>

      <label>WA-ready Invite Messages</label>
      <textarea class="copy-area" id="waArea" readonly>${waMessages}</textarea>
      <button class="secondary full" onclick="navigator.clipboard.writeText(document.getElementById('waArea').value).then(()=>alert('WA messages copied'))">Copy WA Invite Messages</button>

      <label>Registration Links per Code</label>
      <textarea class="copy-area" id="linksArea" readonly>${linkList}</textarea>
      <button class="secondary full" onclick="navigator.clipboard.writeText(document.getElementById('linksArea').value).then(()=>alert('Links copied'))">Copy Registration Links</button>

      <label>Codes Only</label>
      <textarea class="copy-area" id="codesArea" readonly>${csv}</textarea>
      <button class="ghost full" onclick="navigator.clipboard.writeText(document.getElementById('codesArea').value).then(()=>alert('Codes copied'))">Copy Codes Only</button>
      <button class="ghost full" style="margin-top:8px" onclick="downloadCodes()">Download CSV</button>
    `;
  };
}
window.downloadCodes = function(){
  const data = "code\n" + byId("codesArea").value.split("\n").map(x=>`"${x}"`).join("\n");
  const blob = new Blob([data], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "gift-codes.csv"; a.click();
  URL.revokeObjectURL(url);
}

function renderReport(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("report");
  const rows = [...state.transactions].reverse().slice(0,50);
  const giftRows = [...state.giftCodes].reverse().slice(0,50);
  screen(`
    <section class="card">
      <h1>Report</h1>
      <h3>Transaksi Terakhir</h3>
      <div class="list">
        ${rows.length ? rows.map(t=>{
          const m = state.members.find(x=>x.id===t.memberId);
          return `<div class="item">
            <div class="title">${t.typeLabel || t.type} • ${money(t.balanceUsed || t.creditIssued || t.value || 0)}</div>
            <div class="meta">${m?.name || "-"} • ${m?.phone || "-"} • ${t.giftCode || t.paymentMethod || t.approvalMethod || ""}</div>
            <div class="meta">${new Date(t.createdAt).toLocaleString("id-ID")}</div>
          </div>`;
        }).join("") : `<p>Belum ada transaksi.</p>`}
      </div>
    </section>
    <section class="card">
      <h3>Gift Code Report</h3>
      <div class="list">
        ${giftRows.map(g=>{
          const m = state.members.find(x=>x.id===g.usedByMemberId);
          return `<div class="item">
            <div class="title code-box">${g.code} • ${money(g.value)} <span class="badge ${g.status==='used'?'ok':''}">${g.status}</span></div>
            <div class="meta">${g.campaignName} • exp ${g.expiredAt}</div>
            <div class="meta">${m ? `Used by ${m.phone} • ${m.memberCode}` : "Available"}</div>
          </div>`;
        }).join("")}
      </div>
    </section>
  `);
}

function renderMembers(){
  const user = requireLogin(); if(!user) return;
  mountLayout(); setNav("members");
  screen(`
    <section class="card">
      <h1>Member List</h1>
      <div class="list">
        ${state.members.map(m=>`
          <div class="item" onclick="setHash('member',{phone:'${m.phone}'})">
            <div class="title">${m.name} • ${money(memberBalance(m.id))}</div>
            <div class="meta">${m.phone} • ${m.memberCode}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `);
}

function renderBalance(){
  byId("app").innerHTML = `<main style="padding:16px;max-width:520px;margin:auto"></main>`;
  const target = document.querySelector("main");
  target.innerHTML = `
    <section class="card">
      <h1>Cek Saldo Dining</h1>
      <form id="balance-form">
        <label>No HP</label>
        <input id="phone" inputmode="numeric" placeholder="628xxxxxxxxxx" required />
        <label>Password Membership</label>
        <input id="pass" type="password" required />
        <button class="full" style="margin-top:14px">Cek Saldo</button>
      </form>
      <div id="balance-result" style="margin-top:12px"></div>
      <button class="ghost full" style="margin-top:12px" onclick="setHash('login')">Ke Login</button>
    </section>
  `;
  byId("balance-form").onsubmit = (e)=>{
    e.preventDefault();
    const member = findMemberByPhone(byId("phone").value.trim().replace(/^0/,"62"));
    if(!member || member.password !== byId("pass").value){ alert("Data tidak cocok."); return; }
    const tx = state.transactions.filter(t=>t.memberId===member.id).slice(-5).reverse();
    byId("balance-result").innerHTML = `
      <div class="kpi"><div class="label">Saldo Dining Kamu</div><div class="value">${money(memberBalance(member.id))}</div></div>
      <div class="item"><div class="title">Member ID</div><div class="meta">${member.memberCode}</div></div>
      <h3>Transaksi Terakhir</h3>
      <div class="list">${tx.map(t=>`<div class="item"><div class="title">${t.typeLabel} • ${money(t.balanceUsed || t.creditIssued || t.value || 0)}</div><div class="meta">${new Date(t.createdAt).toLocaleString("id-ID")}</div></div>`).join("") || "<p>Belum ada transaksi.</p>"}</div>
    `;
  };
}

function route(){
  state = readState();
  const {name} = getRoute();
  if(name==="login") return renderLogin();
  if(name==="kasir") return renderKasir();
  if(name==="member") return renderMember();
  if(name==="register" || name==="join") return renderRegister();
  if(name==="topup") return renderTopup();
  if(name==="use-balance") return renderUseBalance();
  if(name==="waiting") return renderWaiting();
  if(name==="approve") return renderApprove();
  if(name==="success") return renderSuccess();
  if(name==="owner") return renderOwner();
  if(name==="gift-generate") return renderGiftGenerate();
  if(name==="report") return renderReport();
  if(name==="members") return renderMembers();
  if(name==="balance") return renderBalance();
  setHash("login");
}
window.addEventListener("hashchange", route);
window.addEventListener("load", route);
