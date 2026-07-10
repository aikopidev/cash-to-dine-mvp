/* Cash to Dine MVP v0.6 - Supabase Connected */
const APP_VERSION = "1.2.0";
const OUTLET = "Cacayo";
const OUTLET_SLUG = "cacayo";
const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SESSION_KEY = "ctd_v06_session";
const SUPABASE_URL = "https://xkxbmiwnufyfacviquza.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreGJtaXdudWZ5ZmFjdmlxdXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MzU5NDUsImV4cCI6MjA5OTIxMTk0NX0.GoABCsKHjeutb144Ora6Wob-_M7DfeHoRB-Dmiunag8";

function money(n){ return "Rp" + Number(n || 0).toLocaleString("id-ID"); }
function parseMoney(v){ return typeof v === "number" ? v : (Number(String(v||"").replace(/[^0-9]/g,"")) || 0); }
function byId(id){ return document.getElementById(id); }
function randomCode(len=8){ let c=""; for(let i=0;i<len;i++) c += SAFE_ALPHABET[Math.floor(Math.random()*SAFE_ALPHABET.length)]; return c; }
function memberSeq(){ return "CTD-" + Date.now().toString().slice(-6); }
function publicBaseUrl(){ return `${location.origin}${location.pathname}`; }
function qrImageUrl(data, size=260){ return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`; }
function normalizePhone(phone){ const raw=String(phone||"").trim().replace(/[^0-9]/g,""); return raw.startsWith("0") ? "62"+raw.slice(1) : raw; }
function saveSession(u){ localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
function getSession(){ try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null");}catch(e){return null;} }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }
function currentUser(){ return getSession(); }
function setHash(name, params={}){ const q=new URLSearchParams(params).toString(); location.hash = q ? `${name}?${q}` : name; }
function getRoute(){ const raw=location.hash.replace(/^#/,"") || "login"; const [name,q=""] = raw.split("?"); return {name, params:Object.fromEntries(new URLSearchParams(q))}; }
function requireLogin(){ const u=currentUser(); if(!u){ renderLogin(); return false; } return u; }

async function rpc(fn, body={}){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method:"POST",
    headers:{"Content-Type":"application/json", "apikey":SUPABASE_ANON_KEY, "Authorization":`Bearer ${SUPABASE_ANON_KEY}`},
    body: JSON.stringify(body)
  });
  const txt = await res.text();
  let data=null; try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
  if(!res.ok){ throw new Error(data?.message || data?.error || txt || `Supabase error ${res.status}`); }
  return data;
}

function mountLayout(){
  byId("app").innerHTML = byId("layout-template").innerHTML;
  byId("outlet-name").textContent = `${OUTLET} • Supabase v${APP_VERSION}`;
  byId("logout-btn").onclick = ()=>{ clearSession(); setHash("login"); };
}
function screen(html){ byId("screen").innerHTML = html; }
function setNav(active){
  const u=currentUser(); const nav=byId("bottom-nav"); if(!nav||!u) return;
  if(u.role==="owner"){
    nav.innerHTML = `<button class="${active==='owner'?'active':''}" onclick="setHash('owner')">Dashboard</button><button class="${active==='gift'?'active':''}" onclick="setHash('gift-generate')">Gift Code</button><button class="${active==='report'?'active':''}" onclick="setHash('report')">Report</button><button class="${active==='kasir'?'active':''}" onclick="setHash('kasir')">Kasir</button>`;
  } else {
    nav.innerHTML = `<button class="${active==='kasir'?'active':''}" onclick="setHash('kasir')">Kasir</button><button class="${active==='register'?'active':''}" onclick="setHash('join')">Daftar</button><button class="${active==='report'?'active':''}" onclick="setHash('report')">Report</button>`;
  }
}

function renderLogin(){
  byId("app").innerHTML = `<div class="login-wrap"><section class="login-card"><div class="logo-mark">CTD</div><h1>Cash to Dine</h1><p>Supabase Connected MVP. Data gift code, member, saldo, dan approval tersimpan di cloud.</p><div class="notice">Demo login: <b>owner / owner123</b> atau <b>kasir / kasir123</b></div><form id="login-form"><label>Username</label><input id="username" autocomplete="username" placeholder="owner atau kasir"/><label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="••••••••"/><button class="full" style="margin-top:14px">Login</button></form><div id="login-result" style="margin-top:12px"></div><div class="divider"></div><button class="secondary full" onclick="setHash('join')">Customer Join Page</button></section></div>`;
  byId("login-form").onsubmit = async (e)=>{ e.preventDefault(); const box=byId("login-result"); box.innerHTML=`<div class="notice">Logging in...</div>`; try{ const rows=await rpc("mvp_staff_login",{p_username:byId("username").value.trim(), p_password:byId("password").value}); if(!rows||!rows.length) throw new Error("Login salah."); saveSession(rows[0]); setHash(rows[0].role==="owner"?"owner":"kasir"); }catch(err){ box.innerHTML=`<div class="error">${err.message}</div>`; } };
}

async function renderKasir(){
  const user=requireLogin(); if(!user) return; mountLayout(); setNav("kasir");
  screen(`
    <section class="card">
      <h1>Kasir Home</h1>
      <p>Ketik nomor HP customer. Setelah minimal 7 digit, hasil yang match akan langsung muncul.</p>
      <form id="search-form">
        <label>Cari Member by Nomor HP</label>
        <input id="phone" inputmode="numeric" placeholder="Contoh: 6285530..." autocomplete="off"/>
        <div class="search-hint">Minimal 7 digit. Bisa ketik 08 atau 62, sistem akan normalisasi ke 62.</div>
        <div id="live-search-result" class="list" style="margin-top:12px"></div>
        <button class="full" style="margin-top:12px">Cari Exact / Lanjut</button>
      </form>
      <div id="search-result" style="margin-top:12px"></div>
    </section>
    <section class="card">
      <h3>Quick Action</h3>
      <div class="grid two">
        <button onclick="setHash('join')">Daftar Member Baru</button>
        <button class="secondary" onclick="setHash('report')">Transaksi Report</button>
      </div>
    </section>
  `);

  const phoneInput = byId("phone");
  const liveBox = byId("live-search-result");
  let searchTimer = null;
  let lastQuery = "";

  async function runLiveSearch(){
    const normalized = normalizePhone(phoneInput.value);
    if(normalized.length < 7){
      liveBox.innerHTML = `<div class="notice">Ketik minimal 7 digit untuk menampilkan kandidat member.</div>`;
      return;
    }
    if(normalized === lastQuery) return;
    lastQuery = normalized;
    liveBox.innerHTML = `<div class="notice">Mencari member...</div>`;
    try{
      const rows = await rpc("mvp_search_members", {p_staff_id:user.id, p_query:normalized});
      if(!rows || !rows.length){
        liveBox.innerHTML = `
          <div class="notice">
            Tidak ada member yang match <b>${normalized}</b>.<br>
            <button class="ghost full" style="margin-top:8px" type="button" onclick="setHash('join',{phone:'${normalized}'})">Daftarkan Nomor Ini</button>
          </div>`;
        return;
      }
      liveBox.innerHTML = rows.map(m => `
        <button type="button" class="search-suggestion" onclick="setHash('member',{phone:'${m.phone}'})">
          <div>
            <div class="title">${m.name}</div>
            <div class="meta">${m.phone} • ${m.member_code} • ${m.status}</div>
          </div>
          <div class="balance">${money(m.balance)}</div>
        </button>
      `).join("");
    }catch(err){
      liveBox.innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  phoneInput.addEventListener("input",()=>{
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runLiveSearch, 350);
  });

  byId("search-form").onsubmit=(e)=>{
    e.preventDefault();
    const phone = normalizePhone(phoneInput.value);
    if(!phone){
      byId("search-result").innerHTML = `<div class="error">Masukkan nomor HP dulu.</div>`;
      return;
    }
    setHash("member",{phone});
  };

  liveBox.innerHTML = `<div class="notice">Ketik nomor HP customer untuk mulai search.</div>`;
}
async function fetchMemberByPhone(phone){ const u=currentUser(); const rows=await rpc("mvp_search_member",{p_staff_id:u.id, p_phone:normalizePhone(phone)}); return rows&&rows.length?rows[0]:null; }
async function renderMember(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); const phone=normalizePhone(params.phone||""); screen(`<section class="card"><h1>Loading member...</h1></section>`);
  try{ const m=await fetchMemberByPhone(phone); if(!m){ screen(`<section class="card"><h1>Member tidak ditemukan</h1><p>No HP: <b>${phone||"-"}</b></p><button class="full" onclick="setHash('join',{phone:'${phone}'})">Daftarkan Member</button><button class="ghost full" style="margin-top:8px" onclick="setHash('kasir')">Kembali</button></section>`); return; }
    screen(`<section class="card"><h1>${m.name}</h1><div class="row"><span class="badge ok">${m.status.toUpperCase()}</span><span class="badge">${m.member_code}</span></div><div class="divider"></div><div class="kpi"><div class="label">Saldo Dining</div><div class="value">${money(m.balance)}</div></div><div class="grid two" style="margin-top:12px"><button onclick="setHash('topup',{phone:'${m.phone}'})">Top Up Saldo</button><button class="secondary" onclick="setHash('use-balance',{phone:'${m.phone}'})">Gunakan Saldo</button></div></section><section class="card"><h3>Detail</h3><div class="item"><div class="title">HP</div><div class="meta">${m.phone}</div></div><div class="item"><div class="title">Member ID</div><div class="meta">${m.member_code}</div></div></section>`);
  }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`); }
}

function renderJoin(){
  const session=currentUser(); if(session){ mountLayout(); setNav("register"); } else { byId("app").innerHTML=`<main style="padding:16px;max-width:520px;margin:auto"></main>`; }
  const {params}=getRoute(); const target=session?byId("screen"):document.querySelector("main");
  target.innerHTML = `<section class="card"><h1>Daftar Member Baru</h1><p>Masukkan Gift Code 8 digit. Setelah daftar berhasil, saldo gift otomatis masuk ke akun membership kamu.</p><form id="register-form"><label>Nama Lengkap</label><input id="name" placeholder="Nama customer" required/><label>No HP</label><input id="phone" inputmode="numeric" placeholder="628xxxxxxxxxx" value="${params.phone||""}" required/><label>Password / PIN Membership</label><input id="pass" type="password" placeholder="Minimal 6 karakter" required/><label>Gift Code / Invite Code</label><input id="gift" class="code-box" placeholder="A7K9P2QX" value="${params.code||""}" required/><button class="full" style="margin-top:14px">Daftar Sekarang</button></form><div id="register-result" style="margin-top:12px"></div>${!session?`<button class="ghost full" style="margin-top:12px" onclick="setHash('login')">Ke Login</button>`:""}</section>`;
  byId("register-form").onsubmit = async (e)=>{ e.preventDefault(); const box=byId("register-result"); const pass=byId("pass").value; if(pass.length<6){ box.innerHTML=`<div class="error">Password/PIN minimal 6 karakter.</div>`; return; } box.innerHTML=`<div class="notice">Mendaftarkan member...</div>`; try{ const memberCode=memberSeq(); const rows=await rpc("mvp_claim_gift_code",{p_outlet_slug:OUTLET_SLUG,p_member_code:memberCode,p_name:byId("name").value.trim(),p_phone:normalizePhone(byId("phone").value),p_password:pass,p_gift_code:byId("gift").value.trim().toUpperCase()}); const d=rows&&rows[0]?rows[0]:{}; box.innerHTML=`<div class="success"><b>Membership Active ✅</b><br>Member ID: ${d.member_code||memberCode}<br>Saldo Awal: ${money(d.initial_balance||0)}<br>Gift Code: USED</div><button class="full" style="margin-top:10px" onclick="setHash('login')">Selesai</button>`; }catch(err){ box.innerHTML=`<div class="error">${err.message}</div>`; } };
}

async function renderTopup(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); screen(`<section class="card"><h1>Loading top up...</h1></section>`);
  try{ const m=await fetchMemberByPhone(params.phone); if(!m){setHash("kasir");return;} screen(`<section class="card"><h1>Top Up Saldo</h1><p>${m.name} • ${m.phone}</p><div class="kpi"><div class="label">Saldo Sekarang</div><div class="value">${money(m.balance)}</div></div><form id="topup-form"><label>Paket Top Up</label><select id="package"><option value="1000000|1500000">Bayar 1jt → Saldo 1.5jt</option><option value="500000|700000">Bayar 500rb → Saldo 700rb</option><option value="custom">Custom</option></select><div class="grid two"><div><label>Cash Paid</label><input id="cashPaid" inputmode="numeric" value="1000000"/></div><div><label>Dining Value</label><input id="creditIssued" inputmode="numeric" value="1500000"/></div></div><label>Payment Method</label><select id="paymentMethod"><option>QRIS</option><option>Cash</option><option>Transfer</option><option>Card</option></select><button class="full" style="margin-top:14px">Submit Top Up</button></form><div id="topup-result" style="margin-top:12px"></div></section>`);
    byId("package").onchange=(e)=>{ if(e.target.value==="custom")return; const [paid,credit]=e.target.value.split("|"); byId("cashPaid").value=paid; byId("creditIssued").value=credit; };
    byId("topup-form").onsubmit=async(e)=>{ e.preventDefault(); const box=byId("topup-result"); box.innerHTML=`<div class="notice">Submitting top up...</div>`; try{ const newBal=await rpc("mvp_topup_member",{p_staff_id:u.id,p_member_id:m.member_id,p_cash_paid:parseMoney(byId("cashPaid").value),p_credit_issued:parseMoney(byId("creditIssued").value),p_payment_method:byId("paymentMethod").value}); box.innerHTML=`<div class="success">Top up sukses. Saldo baru: ${money(newBal)}</div>`; setTimeout(()=>setHash("member",{phone:m.phone}),900); }catch(err){ box.innerHTML=`<div class="error">${err.message}</div>`; } };
  }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`); }
}

async function renderUseBalance(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); screen(`<section class="card"><h1>Loading saldo...</h1></section>`);
  try{ const m=await fetchMemberByPhone(params.phone); if(!m){setHash("kasir");return;} const bal=Number(m.balance||0); const dis=bal<=0?"disabled":""; screen(`<section class="card"><h1>Gunakan Saldo</h1><p>${m.name} • Saldo ${money(bal)}</p>${bal<=0?`<div class="error"><b>Saldo customer Rp0.</b><br>Request pemakaian saldo tidak bisa dibuat sampai customer top up / mendapat saldo baru.</div>`:`<div class="notice">Kasir cukup input nominal saldo/voucher yang akan dipakai. Bill dan payment split tetap divalidasi manual di POS.</div>`}<form id="use-form"><label>Nominal Saldo / Voucher yang Dipakai</label><input id="balanceUsed" inputmode="numeric" placeholder="100000" ${dis} required/><div id="calc" class="notice" style="margin-top:12px">Nominal akan dikirim ke customer untuk approval.</div><button id="requestBtn" class="full" style="margin-top:14px" ${dis}>Request Customer Approval</button></form><div id="use-result" style="margin-top:12px"></div></section>`);
    const update=()=>{ const used=parseMoney(byId("balanceUsed").value); const btn=byId("requestBtn"), box=byId("calc"); if(used<=0){box.className="notice";box.innerHTML="Masukkan nominal saldo yang akan dipakai.";btn.disabled=true;return;} if(used>bal){box.className="error";box.innerHTML=`<b>Saldo tidak cukup.</b><br>Saldo customer: ${money(bal)}. Request: ${money(used)}. Saldo tidak boleh minus.`;btn.disabled=true;return;} box.className="success"; box.innerHTML = used===bal ? `Request valid. Customer akan approve ${money(used)}. Saldo setelah approval menjadi <b>Rp0</b>.` : `Request valid. Customer akan approve ${money(used)}. Saldo setelah approval: <b>${money(bal-used)}</b>.`; btn.disabled=false; };
    if(bal>0){ byId("balanceUsed").oninput=update; update(); }
    byId("use-form").onsubmit=async(e)=>{ e.preventDefault(); const used=parseMoney(byId("balanceUsed").value); const box=byId("use-result"); if(used<=0||used>bal){ box.innerHTML=`<div class="error">Saldo tidak cukup / nominal tidak valid. Saldo tidak boleh minus.</div>`; return; } box.innerHTML=`<div class="notice">Creating approval request...</div>`; try{ const token=randomCode(20); await rpc("mvp_create_approval_request",{p_staff_id:u.id,p_member_id:m.member_id,p_balance_used:used,p_token:token}); setHash("waiting",{token}); }catch(err){ box.innerHTML=`<div class="error">${err.message}</div>`; } };
  }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`); }
}

async function renderWaiting(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); const token=params.token; const link=`${publicBaseUrl()}#approve?token=${token}`; screen(`<section class="card"><h1>Loading approval...</h1></section>`);
  const draw=(p)=>screen(`<section class="card"><h1>Menunggu Approval Customer</h1><p>Customer scan QR ini di HP sendiri dan input PIN/password membership.</p><div class="item"><div class="title">Member</div><div class="meta">${p.member_name} • ${p.member_phone}</div></div><div class="item"><div class="title">Nominal Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div><div class="item"><div class="title">Saldo Setelah Approval</div><div class="meta">${money(p.balance_after)}</div></div><div class="qr-wrap"><img class="qr-img" src="${qrImageUrl(link)}" alt="QR Approval"/><div class="meta">Customer scan QR ini dari HP masing-masing.</div></div><label>Approval Link</label><textarea class="copy-area" readonly>${link}</textarea><button class="secondary full" onclick="navigator.clipboard.writeText('${link}').then(()=>alert('Link copied'))">Copy Approval Link</button><button class="ghost full" style="margin-top:8px" onclick="setHash('approve',{token:'${token}'})">Simulasi Customer Approve di Browser Ini</button><div id="waiting-status" class="notice" style="margin-top:12px">Status: ${p.status}</div></section>`);
  try{ const rows=await rpc("mvp_get_approval",{p_token:token}); if(!rows||!rows.length) throw new Error("Approval tidak ditemukan."); draw(rows[0]); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`); return; }
  const interval=setInterval(async()=>{ const box=byId("waiting-status"); if(!box){clearInterval(interval);return;} try{ const rows=await rpc("mvp_get_approval",{p_token:token}); const p=rows&&rows[0]; if(!p)return; if(p.status==="approved"){ box.className="success"; box.innerHTML="Status: Approved ✅"; setTimeout(()=>setHash("success",{token}),700); clearInterval(interval); } else if(p.status==="rejected"){ box.className="error"; box.innerHTML="Status: Rejected ❌"; clearInterval(interval); } else { box.className="notice"; box.innerHTML=`Status: ${p.status}`; } }catch(e){ console.warn(e); } },2500);
}

async function renderApprove(){
  const {params}=getRoute(); const token=params.token; byId("app").innerHTML=`<main style="padding:16px;max-width:520px;margin:auto"></main>`; const target=document.querySelector("main"); target.innerHTML=`<section class="card"><h1>Loading approval...</h1></section>`;
  try{ const rows=await rpc("mvp_get_approval",{p_token:token}); if(!rows||!rows.length) throw new Error("Approval tidak ditemukan."); const p=rows[0]; target.innerHTML=`<section class="card"><h1>Approve Pemakaian Saldo</h1><p>${OUTLET} Dining Club</p><div class="approval-alert"><div style="font-weight:900">⚠️ Permintaan Pemakaian Saldo</div><div class="big-money">${money(p.balance_used)}</div><div>Pastikan nominal ini sesuai dengan instruksi kasir di POS sebelum memasukkan PIN. Saldo setelah approval: <b>${money(p.balance_after)}</b>.</div></div><div class="item"><div class="title">Member</div><div class="meta">${p.member_name} • ${p.member_phone}</div></div><form id="approve-form"><label>Password / PIN Membership</label><input id="pass" type="password" placeholder="Password customer" required/><button class="ok full" style="margin-top:14px">Approve Pemakaian Saldo</button></form><button class="ghost full" style="margin-top:8px" id="rejectBtn">Tolak</button><div id="approve-result" style="margin-top:12px"></div></section>`;
    if(p.status!=="waiting") byId("approve-result").innerHTML=`<div class="notice">Status request: ${p.status}</div>`;
    byId("rejectBtn").onclick=async()=>{ try{ await rpc("mvp_reject_approval",{p_token:token}); byId("approve-result").innerHTML=`<div class="error">Transaksi ditolak. Saldo tidak berubah.</div>`; }catch(err){ byId("approve-result").innerHTML=`<div class="error">${err.message}</div>`; } };
    byId("approve-form").onsubmit=async(e)=>{ e.preventDefault(); const box=byId("approve-result"); box.innerHTML=`<div class="notice">Approving...</div>`; try{ const rows=await rpc("mvp_approve_balance_use",{p_token:token,p_password:byId("pass").value}); const d=rows&&rows[0]?rows[0]:{}; target.innerHTML=`<section class="card"><div class="approve-success-screen"><div class="check">✓</div><h1>Saldo Berhasil Dipakai</h1><p>Approval berhasil. Form PIN sudah ditutup untuk keamanan.</p></div><div class="item"><div class="title">Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div><div class="item"><div class="title">Saldo Tersisa</div><div class="meta">${money(d.balance_after||0)}</div></div><div class="success" style="margin-top:12px">Silakan kembali ke kasir. Tablet kasir akan otomatis berubah menjadi Approved.</div></section>`; }catch(err){ box.innerHTML=`<div class="error">${err.message}</div>`; } };
  }catch(err){ target.innerHTML=`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`; }
}

async function renderSuccess(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); try{ const rows=await rpc("mvp_get_approval",{p_token:params.token}); const p=rows&&rows[0]; if(!p) throw new Error("Approval not found"); screen(`<section class="card"><h1>Saldo Berhasil Dipakai ✅</h1><div class="item"><div class="title">Member</div><div class="meta">${p.member_name} • ${p.member_phone}</div></div><div class="item"><div class="title">Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div><div class="item"><div class="title">Saldo Sisa</div><div class="meta">${money(p.balance_after)}</div></div><div class="notice">Kasir tetap validasi manual di POS: masukkan payment Voucher/Cash to Dine sebesar ${money(p.balance_used)}. Sisa bill, kalau ada, dibayar QRIS/Cash/Card di POS.</div><button class="full" style="margin-top:12px" onclick="setHash('kasir')">Transaksi Baru</button></section>`); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`); }
}

async function renderOwner(){
  const u=requireLogin(); if(!u)return;
  if(u.role!=="owner"){setHash("kasir");return;}
  mountLayout(); setNav("owner");
  screen(`
    <section class="card">
      <h1>Owner Dashboard</h1>
      <p>${OUTLET} • Supabase connected. Ringkasan operasional member, voucher, dan saldo.</p>
      <div id="dashboard-summary" class="dashboard-grid">
        <div class="dashboard-card"><div class="label">Members</div><div class="value">-</div></div>
        <div class="dashboard-card"><div class="label">Total Saldo Member</div><div class="value">-</div></div>
        <div class="dashboard-card"><div class="label">Voucher Available</div><div class="value">-</div></div>
        <div class="dashboard-card"><div class="label">Voucher Terdaftar / Claimed</div><div class="value">-</div></div>
      </div>
    </section>

    <section class="card">
      <h2>Quick Access</h2>
      <div class="action-grid">
        <button class="action-card" onclick="setHash('members')">
          <div class="title">All Members</div>
          <div class="desc">Lihat semua member yang pernah daftar, lengkap dengan nama, nomor telpon, saldo, dan export TXT/PDF.</div>
        </button>
        <button class="action-card" onclick="setHash('gift-generate')">
          <div class="title">Voucher Control</div>
          <div class="desc">Monitor voucher available, terdaftar, claimed, expired, deleted. Copy WA per voucher.</div>
        </button>
        <button class="action-card" onclick="setHash('report')">
          <div class="title">Transaction Report</div>
          <div class="desc">Lihat transaksi top up, gift claim, dan penggunaan saldo.</div>
        </button>
        <button class="action-card" onclick="setHash('kasir')">
          <div class="title">Kasir Mode</div>
          <div class="desc">Search member, top up, request saldo, dan approval QR.</div>
        </button>
      </div>
    </section>

    <section class="card">
      <h2>System Status</h2>
      <div class="success">Connected to Supabase: ${SUPABASE_URL}</div>
      <p class="meta">Dashboard ini mengambil data langsung dari cloud, bukan local browser.</p>
    </section>
  `);

  try{
    const rows = await rpc("mvp_owner_dashboard_summary", {p_staff_id:u.id});
    const s = rows && rows[0] ? rows[0] : {};
    byId("dashboard-summary").innerHTML = `
      <div class="dashboard-card"><div class="label">Total Members</div><div class="value">${s.total_members || 0}</div></div>
      <div class="dashboard-card"><div class="label">Total Saldo Member</div><div class="value">${money(s.total_wallet_balance || 0)}</div></div>
      <div class="dashboard-card"><div class="label">Voucher Available</div><div class="value">${s.available_vouchers || 0}</div></div>
      <div class="dashboard-card"><div class="label">Terdaftar / Claimed</div><div class="value">${Number(s.registered_vouchers || 0) + Number(s.claimed_vouchers || 0)}</div></div>
    `;
  }catch(err){
    byId("dashboard-summary").innerHTML = `<div class="error" style="grid-column:1/-1">${err.message}</div>`;
  }
}
async function renderGiftGenerate(){
  const u=requireLogin(); if(!u)return; if(u.role!=="owner"){setHash("kasir");return;} mountLayout(); setNav("gift");
  screen(`
    <section class="card">
      <h1>Voucher Control Center</h1>
      <p>Monitor voucher lama dan baru. 10 voucher per page. Voucher terdaftar/claimed akan terkunci. Voucher available bisa dicopy WA atau di-delete/void kalau belum dishare.</p>
      <div id="voucher-summary" class="voucher-summary">
        <div class="stat"><div class="label">Total</div><div class="value">-</div></div>
        <div class="stat"><div class="label">Available</div><div class="value">-</div></div>
        <div class="stat"><div class="label">Terdaftar</div><div class="value">-</div></div>
        <div class="stat"><div class="label">Available Value</div><div class="value">-</div></div>
      </div>
      <div class="voucher-toolbar">
        <select id="voucher-filter">
          <option value="available">Available</option>
          <option value="all">All status</option>
          <option value="registered">Terdaftar</option>
          <option value="claimed">Claimed</option>
          <option value="expired">Expired</option>
          <option value="void">Deleted / Void</option>
        </select>
        <button class="secondary" id="copy-page-wa" type="button">Copy WA Page Ini</button>
        <button class="ghost" id="refresh-vouchers" type="button">Refresh</button>
      </div>
      <div id="voucher-list" class="list"><div class="notice">Loading voucher list...</div></div>
      <div class="pagination-bar">
        <button class="ghost" id="prev-page" type="button">← Prev</button>
        <div class="page-info" id="page-info">Page -</div>
        <button class="ghost" id="next-page" type="button">Next →</button>
      </div>
    </section>

    <section class="card">
      <h2>Generate Gift Code Baru</h2>
      <p>Kode dibuat 9 karakter dan dijaga unik dari database. Counter prefix: A, B, C ... Z, AA, AB, AC ... lalu random sampai total 9 karakter.</p>
      <form id="gift-form">
        <label>Campaign / Event Name</label>
        <input id="campaign" value="Soft Opening Cacayo" required/>
        <div class="grid two">
          <div>
            <label>Jumlah Kode</label>
            <input id="qty" inputmode="numeric" value="10" required/>
          </div>
          <div>
            <label>Value per Code</label>
            <input id="value" inputmode="numeric" value="100000" required/>
          </div>
        </div>
        <label>Expired Date</label>
        <input id="expired" type="date" value="2026-08-31" required/>
        <button class="full" style="margin-top:14px">Generate 9-Digit Codes</button>
      </form>
      <div id="gift-result" style="margin-top:12px"></div>
    </section>
  `);

  const joinBase = `${publicBaseUrl()}#join?code=`;
  let currentPage = 1;
  const pageSize = 10;
  let currentRows = [];
  let totalCount = 0;

  function voucherStatusClass(s){
    if(s === "registered") return "registered";
    if(s === "claimed") return "claimed";
    if(s === "used") return "registered"; // legacy status
    return s === "expired" ? "expired" : (s === "void" ? "void" : "available");
  }

  function waMessageFor(code, value){
    return `Halo Kak, kamu dapat Gift Dining Credit ${money(value)} dari ${OUTLET}.

Daftar member di link ini:
${joinBase}${code}

Gift Code: ${code}

Kode ini hanya bisa digunakan 1x saat daftar member baru.`;
  }

  async function copyText(text, label){
    await navigator.clipboard.writeText(text);
    alert(label);
  }

  function renderSummaryFromRows(rows){
    // Summary visible here is based on current filter/page for speed.
    const available = rows.filter(v=>v.voucher_status==="available").length;
    const registered = rows.filter(v=>v.voucher_status==="registered" || v.voucher_status==="used").length;
    const claimed = rows.filter(v=>v.voucher_status==="claimed").length;
    const availableValue = rows.filter(v=>v.voucher_status==="available").reduce((a,v)=>a+Number(v.value||0),0);
    byId("voucher-summary").innerHTML = `
      <div class="stat"><div class="label">Total Filter</div><div class="value">${totalCount}</div></div>
      <div class="stat"><div class="label">Available Page</div><div class="value">${available}</div></div>
      <div class="stat"><div class="label">Terdaftar Page</div><div class="value">${registered}</div></div>
      <div class="stat"><div class="label">Claimed Page</div><div class="value">${claimed}</div></div>
    `;
  }

  function renderPagination(){
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    byId("page-info").textContent = `Page ${currentPage} / ${totalPages} • ${totalCount} voucher`;
    byId("prev-page").disabled = currentPage <= 1;
    byId("next-page").disabled = currentPage >= totalPages;
  }

  function renderVoucherRows(){
    if(!currentRows.length){
      byId("voucher-list").innerHTML = `<div class="notice">Tidak ada voucher untuk filter ini.</div>`;
      renderPagination();
      return;
    }

    byId("voucher-list").innerHTML = currentRows.map(v => {
      const cls = voucherStatusClass(v.voucher_status);
      const isAvailable = v.voucher_status === "available";
      const isRegistered = v.voucher_status === "registered" || v.voucher_status === "used";
      const isClaimed = v.voucher_status === "claimed";
      const usedInfo = isRegistered
        ? `<div class="meta">Terdaftar oleh: ${v.used_by_name || "-"} • ${v.used_by_phone || "-"}</div>`
        : (isClaimed
          ? `<div class="meta">Claimed by: ${v.used_by_name || "-"} • ${v.used_by_phone || "-"}</div>`
          : (isAvailable ? `<div class="meta">Link: ${joinBase}${v.code}</div>` : `<div class="meta">Status: ${v.voucher_status}</div>`));

      const actions = isAvailable
        ? `<div class="voucher-actions">
             <button class="secondary" type="button" onclick="window.copyVoucherWA('${v.code}', ${Number(v.value||0)})">Copy WA</button>
             <button class="ghost" type="button" onclick="window.copyVoucherLink('${v.code}')">Copy Link</button>
             <button class="danger" type="button" onclick="window.deleteVoucher('${v.gift_id}', '${v.code}')">Delete</button>
           </div>`
        : `<div class="voucher-actions"><span class="badge">${isRegistered ? "TERDAFTAR - jangan kirim ulang" : (isClaimed ? "CLAIMED" : "Not active")}</span></div>`;

      return `
        <div class="voucher-row ${cls}">
          <div>
            <div class="code-box">${v.code}</div>
            <div class="meta">Exp: ${v.expired_at || "-"}</div>
          </div>
          <div>
            <div class="campaign">${v.campaign_name || "-"}</div>
            ${usedInfo}
          </div>
          <div>
            <div class="money">${money(v.value)}</div>
            <span class="status-pill ${cls}">${v.voucher_status.toUpperCase()}</span>
          </div>
          ${actions}
        </div>
      `;
    }).join("");
    renderPagination();
  }

  async function loadVouchers(){
    const filter = byId("voucher-filter").value;
    const offset = (currentPage - 1) * pageSize;
    byId("voucher-list").innerHTML = `<div class="notice">Loading voucher list...</div>`;
    try{
      const rows = await rpc("mvp_list_gift_codes_paged", {
        p_staff_id: u.id,
        p_status: filter,
        p_limit: pageSize,
        p_offset: offset
      });
      currentRows = rows || [];
      totalCount = currentRows.length ? Number(currentRows[0].total_count || 0) : 0;
      renderSummaryFromRows(currentRows);
      renderVoucherRows();
    }catch(err){
      byId("voucher-list").innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  window.copyVoucherWA = async (code, value)=> copyText(waMessageFor(code, value), `WA invite ${code} copied.`);
  window.copyVoucherLink = async (code)=> copyText(`${joinBase}${code}`, `Link ${code} copied.`);
  window.deleteVoucher = async (giftId, code)=>{
    if(!confirm(`Delete / void voucher ${code}? Voucher yang sudah dihapus tidak bisa dipakai customer.`)) return;
    try{
      await rpc("mvp_delete_gift_code", {p_staff_id:u.id, p_gift_id:giftId});
      alert(`Voucher ${code} deleted/void.`);
      await loadVouchers();
    }catch(err){
      alert(err.message);
    }
  };

  byId("voucher-filter").onchange = ()=>{ currentPage = 1; loadVouchers(); };
  byId("refresh-vouchers").onclick = loadVouchers;
  byId("prev-page").onclick = ()=>{ if(currentPage>1){ currentPage--; loadVouchers(); } };
  byId("next-page").onclick = ()=>{ currentPage++; loadVouchers(); };

  byId("copy-page-wa").onclick = async ()=>{
    const rows = currentRows.filter(v=>v.voucher_status==="available");
    if(!rows.length){ alert("Tidak ada voucher available di page ini."); return; }
    await copyText(rows.map(v=>waMessageFor(v.code, v.value)).join("\n\n-------------------------\n\n"), `${rows.length} WA invite di page ini copied.`);
  };

  byId("gift-form").onsubmit=async(e)=>{
    e.preventDefault();
    const qty=Math.min(parseMoney(byId("qty").value),500),
      value=parseMoney(byId("value").value),
      camp=byId("campaign").value.trim(),
      exp=byId("expired").value,
      box=byId("gift-result");
    box.innerHTML=`<div class="notice">Generating ${qty} unique 9-digit gift codes...</div>`;
    try{
      const created = await rpc("mvp_generate_gift_codes_batch", {
        p_staff_id:u.id,
        p_campaign_name:camp,
        p_value:value,
        p_expired_at:exp,
        p_qty:qty
      });
      const rows = created || [];
      const wa=rows.map(r=>waMessageFor(r.code,value)).join("\n\n-------------------------\n\n");
      const links=rows.map(r=>`${joinBase}${r.code}`).join("\n");
      const csv=rows.map(r=>r.code).join("\n");
      box.innerHTML=`<div class="success"><b>${rows.length} Gift Codes Generated ✅</b><br>Total Liability: ${money(rows.length*value)}<br>Kode 9 digit unik sudah masuk Supabase.</div><label>WA-ready Invite Messages Baru</label><textarea class="copy-area" id="waArea" readonly>${wa}</textarea><button class="secondary full" type="button" onclick="navigator.clipboard.writeText(document.getElementById('waArea').value).then(()=>alert('WA messages copied'))">Copy WA Invite Baru</button><label>Registration Links Baru</label><textarea class="copy-area" id="linksArea" readonly>${links}</textarea><button class="secondary full" type="button" onclick="navigator.clipboard.writeText(document.getElementById('linksArea').value).then(()=>alert('Links copied'))">Copy Links Baru</button><label>Codes Only Baru</label><textarea class="copy-area" id="codesArea" readonly>${csv}</textarea><button class="ghost full" type="button" onclick="navigator.clipboard.writeText(document.getElementById('codesArea').value).then(()=>alert('Codes copied'))">Copy Codes Only</button>`;
      currentPage = 1;
      byId("voucher-filter").value = "available";
      await loadVouchers();
    }catch(err){
      box.innerHTML=`<div class="error">${err.message}</div>`;
    }
  };

  await loadVouchers();
}
async function renderMembers(){
  const u=requireLogin(); if(!u)return; if(u.role!=="owner"){setHash("kasir");return;} mountLayout(); setNav("members");
  screen(`
    <section class="card">
      <h1>All Members</h1>
      <p>List simple semua member yang pernah daftar. Data langsung dari Supabase.</p>
      <div class="voucher-toolbar">
        <input id="member-query" placeholder="Search nama / nomor HP..." autocomplete="off" />
        <button class="secondary" id="export-txt" type="button">Export TXT</button>
        <button class="ghost" id="export-pdf" type="button">Export PDF / Print</button>
        <button class="ghost" id="refresh-members" type="button">Refresh</button>
      </div>
      <div id="member-summary" class="success">Loading member...</div>
    </section>
    <section class="card">
      <h2>Member List</h2>
      <div id="member-list"></div>
    </section>
  `);

  let members = [];

  function visibleRows(){
    const q = byId("member-query").value.trim().toLowerCase();
    return members.filter(m =>
      !q || String(m.name||"").toLowerCase().includes(q) || String(m.phone||"").includes(q) || String(m.member_code||"").toLowerCase().includes(q)
    );
  }

  function renderMemberRows(){
    const rows = visibleRows();
    const totalBalance = rows.reduce((a,m)=>a+Number(m.balance||0),0);
    byId("member-summary").innerHTML = `<b>${rows.length}</b> member ditampilkan dari total <b>${members.length}</b> member • Total saldo tampil: <b>${money(totalBalance)}</b>`;
    if(!rows.length){
      byId("member-list").innerHTML = `<div class="notice">Tidak ada member.</div>`;
      return;
    }
    byId("member-list").innerHTML = `
      <div class="member-table-wrap">
        <table class="member-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>No Telpon</th>
              <th>Member ID</th>
              <th>Saldo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((m,i)=>`
              <tr>
                <td>${i+1}</td>
                <td class="name">${m.name || "-"}</td>
                <td>${m.phone || "-"}</td>
                <td>${m.member_code || "-"}</td>
                <td><b>${money(m.balance || 0)}</b></td>
                <td>${m.status || "active"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function memberText(rows){
    const lines = [];
    lines.push("CASH TO DINE - MEMBER LIST");
    lines.push(`Export: ${new Date().toLocaleString("id-ID")}`);
    lines.push(`Total: ${rows.length} member`);
    lines.push("");
    rows.forEach((m,i)=>{
      lines.push(`${i+1}. ${m.name || "-"} | ${m.phone || "-"} | ${m.member_code || "-"} | Saldo: ${money(m.balance || 0)} | Status: ${m.status || "active"}`);
    });
    return lines.join("\n");
  }

  async function loadMembers(){
    byId("member-list").innerHTML = `<div class="notice">Loading member...</div>`;
    try{
      members = await rpc("mvp_list_members", {p_staff_id:u.id});
      members = members || [];
      renderMemberRows();
    }catch(err){
      byId("member-list").innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  byId("member-query").addEventListener("input", renderMemberRows);
  byId("refresh-members").onclick = loadMembers;
  byId("export-txt").onclick = ()=>{
    const text = memberText(visibleRows());
    const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-to-dine-members-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  byId("export-pdf").onclick = ()=>{
    const rows = visibleRows();
    const html = `
      <!doctype html><html><head><title>Cash to Dine Member List</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111827}
        h1{margin-bottom:4px}
        table{border-collapse:collapse;width:100%;margin-top:18px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
        th{background:#f3f4f6}
      </style></head><body>
      <h1>Cash to Dine - Member List</h1>
      <div>Export: ${new Date().toLocaleString("id-ID")}</div>
      <div>Total: ${rows.length} member</div>
      <table><thead><tr><th>No</th><th>Nama</th><th>No Telpon</th><th>Member ID</th><th>Saldo</th><th>Status</th></tr></thead>
      <tbody>${rows.map((m,i)=>`<tr><td>${i+1}</td><td>${m.name||"-"}</td><td>${m.phone||"-"}</td><td>${m.member_code||"-"}</td><td>${money(m.balance||0)}</td><td>${m.status||"active"}</td></tr>`).join("")}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  await loadMembers();
}
async function renderReport(){
  const u=requireLogin(); if(!u)return; mountLayout(); setNav("report"); screen(`<section class="card"><h1>Loading report...</h1></section>`); try{ const rows=await rpc("mvp_recent_transactions",{p_staff_id:u.id}); screen(`<section class="card"><h1>Transaction Report</h1><div class="list">${rows&&rows.length?rows.map(t=>`<div class="item"><div class="title">${t.type} • ${money(t.balance_used||t.credit_issued||0)}</div><div class="meta">${t.member_name||"-"} • ${t.member_phone||"-"} • ${new Date(t.created_at).toLocaleString("id-ID")}</div><div class="meta">Status: ${t.status}</div></div>`).join(""):`<p>Belum ada transaksi.</p>`}</div></section>`); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`); }
}

function route(){ const {name}=getRoute(); if(name==="login")return renderLogin(); if(name==="kasir")return renderKasir(); if(name==="member")return renderMember(); if(name==="register"||name==="join")return renderJoin(); if(name==="topup")return renderTopup(); if(name==="use-balance")return renderUseBalance(); if(name==="waiting")return renderWaiting(); if(name==="approve")return renderApprove(); if(name==="success")return renderSuccess(); if(name==="owner")return renderOwner(); if(name==="gift-generate")return renderGiftGenerate(); if(name==="report")return renderReport(); setHash("login"); }
window.addEventListener("hashchange", route);
window.addEventListener("load", route);


async function killOldCaches(){
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch(e) {
    console.warn("Cache cleanup skipped", e);
  }
}
killOldCaches();
