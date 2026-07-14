/* Cash to Dine MVP v0.6 - Supabase Connected */
const APP_VERSION = "3.2.0";
const PORTAL_MODE = window.CTD_PORTAL_MODE === "staff" ? "staff" : "customer";
const OUTLET = "CACAYO";
const OUTLET_FULL = "CACAYO CHINESE CALIFORNIAN FUSION FOOD";
const OUTLET_SLUG = "cacayo";
const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SESSION_KEY = "ctd_staff_session_v30";
const CUSTOMER_SESSION_KEY = "ctd_customer_session_v30";
const SUPABASE_URL = "https://xkxbmiwnufyfacviquza.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreGJtaXdudWZ5ZmFjdmlxdXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MzU5NDUsImV4cCI6MjA5OTIxMTk0NX0.GoABCsKHjeutb144Ora6Wob-_M7DfeHoRB-Dmiunag8";

function money(n){ return "Rp" + Number(n || 0).toLocaleString("id-ID"); }
function parseMoney(v){ return typeof v === "number" ? v : (Number(String(v||"").replace(/[^0-9]/g,"")) || 0); }
function byId(id){ return document.getElementById(id); }
function esc(value){ return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }
function safeError(err){ return esc(err && err.message ? err.message : err); }
function brandMiniHtml(){ return `<div class="mini-brand"><img src="./cacayo-logo.jpg" alt="CACAYO logo"/><div><b>CACAYO</b><span>CHINESE CALIFORNIAN FUSION FOOD</span></div></div>`; }
function brandLine(){ return OUTLET_FULL; }
function randomCode(len=8){ let c=""; for(let i=0;i<len;i++) c += SAFE_ALPHABET[Math.floor(Math.random()*SAFE_ALPHABET.length)]; return c; }
function memberSeq(){ return "CTD-" + Date.now().toString().slice(-6); }
function publicBaseUrl(){ return `${location.origin}/?v=${APP_VERSION}`; }
function qrImageUrl(data, size=260){ if(!window.CTDQR) throw new Error("Local QR engine not loaded"); return window.CTDQR.toDataURL(String(data), size); }
function normalizePhone(phone){ const raw=String(phone||"").trim().replace(/[^0-9]/g,""); return raw.startsWith("0") ? "62"+raw.slice(1) : raw; }
function saveSession(u){ sessionStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
function getSession(){ try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null");}catch(e){return null;} }
function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }
function currentUser(){ return getSession(); }

function saveCustomerSession(u){ sessionStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(u)); }
function getCustomerSession(){ try{return JSON.parse(sessionStorage.getItem(CUSTOMER_SESSION_KEY)||"null");}catch(e){return null;} }
function clearCustomerSession(){ sessionStorage.removeItem(CUSTOMER_SESSION_KEY); }
function customerBlockedMessage(){
  return "Anda telah salah memasukkan PIN sebanyak 10 kali. Akun dan penggunaan saldo Anda sementara diblokir untuk keamanan. Silakan datang ke cabang Cacayo terdekat untuk melakukan reset PIN melalui kasir. Saldo Anda tetap aman.";
}
function setHash(name, params={}){ const q=new URLSearchParams(params).toString(); location.hash = q ? `${name}?${q}` : name; }
function getRoute(){ const defaultRoute = PORTAL_MODE === "staff" ? "login" : "customer-login"; const raw=location.hash.replace(/^#/,"") || defaultRoute; const [name,q=""] = raw.split("?"); return {name, params:Object.fromEntries(new URLSearchParams(q))}; }
function requireLogin(){ const u=currentUser(); if(!u || !u.session_token){ renderLogin(); return false; } return u; }

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
  byId("outlet-name").textContent = `${OUTLET_FULL} • Supabase v${APP_VERSION}`;
  byId("logout-btn").onclick = async()=>{
    const u=currentUser();
    try{ if(u?.session_token) await rpc("s3_staff_logout",{p_staff_session_token:u.session_token}); }catch(e){}
    clearSession(); setHash("login");
  };
}
function screen(html){ byId("screen").innerHTML = html; }
function setNav(active){
  const u=currentUser(); const nav=byId("bottom-nav"); if(!nav||!u) return;
  if(u.role==="owner"){
    nav.innerHTML = `<button class="${active==='owner'?'active':''}" onclick="setHash('owner')">Dashboard</button><button class="${active==='members'?'active':''}" onclick="setHash('members')">Members</button><button class="${active==='gift'?'active':''}" onclick="setHash('gift-generate')">Voucher</button><button class="${active==='report'?'active':''}" onclick="setHash('report')">Report</button><button class="${active==='kasir'?'active':''}" onclick="setHash('kasir')">Kasir</button>`;
  } else {
    nav.innerHTML = `<button class="${active==='kasir'?'active':''}" onclick="setHash('kasir')">Kasir</button><button class="${active==='register'?'active':''}" onclick="setHash('join')">Daftar</button><button class="${active==='report'?'active':''}" onclick="setHash('report')">Report</button>`;
  }
}

function renderLogin(){
  if(PORTAL_MODE !== "staff"){ setHash("customer-login"); return; }
  byId("app").innerHTML = `<div class="login-wrap"><section class="login-card">${brandMiniHtml()}<div class="logo-mark">CTD</div><h1>Staff Operations</h1><p>Portal internal CACAYO untuk owner dan kasir.</p><form id="login-form"><label>Username Staff</label><input id="username" autocomplete="username" placeholder="Username"/><label>Password Staff</label><input id="password" type="password" autocomplete="current-password" placeholder="••••••••"/><button class="full" style="margin-top:14px">Login Staff</button></form><div id="login-result" style="margin-top:12px"></div></section></div>`;
  byId("login-form").onsubmit = async (e)=>{
    e.preventDefault();
    const box=byId("login-result");
    box.innerHTML=`<div class="notice">Logging in securely...</div>`;
    try{
      const rows=await rpc("s3_staff_login",{
        p_username:byId("username").value.trim(),
        p_password:byId("password").value
      });
      if(!rows||!rows.length) throw new Error("Login salah.");
      const d=rows[0];
      if(d.login_success===false) throw new Error(d.error_message||"Login salah.");
      saveSession(d);
      setHash(d.role==="owner"?"owner":"kasir");
    }catch(err){ box.innerHTML=`<div class="error">${safeError(err)}</div>`; }
  };
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
      <h2>Kasir Actions</h2>
      <div class="grid two">
        <button onclick="document.getElementById('phone').focus()">Top Up Member Lama</button>
        <button class="secondary" onclick="document.getElementById('phone').focus()">Gunakan Saldo Member</button>
      </div>
      <div class="notice" style="margin-top:12px">
        Untuk top up member lama: search nomor HP → pilih member → klik <b>Top Up Saldo</b>.
      </div>
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
      const rows = await rpc("s3_search_members", {p_staff_session_token:user.session_token, p_query:normalized});
      if(!rows || !rows.length){
        liveBox.innerHTML = `
          <div class="notice">
            Tidak ada member yang match <b>${normalized}</b>.<br>
            <button class="ghost full" style="margin-top:8px" type="button" onclick="setHash('join',{phone:'${normalized}'})">Daftarkan Nomor Ini</button>
          </div>`;
        return;
      }
      liveBox.innerHTML = rows.map(m => `
        <div class="member-action-row">
          <div>
            <div class="title">${esc(m.name)}</div>
            <div class="meta">${esc(m.phone)} • ${esc(m.member_code)} • ${m.status}</div>
            <div class="balance">Saldo: ${money(m.balance)}</div>
          </div>
          <button type="button" class="secondary" onclick="setHash('topup',{phone:'${esc(m.phone)}'})">Top Up</button>
          <button type="button" onclick="setHash('use-balance',{phone:'${esc(m.phone)}'})">Gunakan</button>
        </div>
      `).join("");
    }catch(err){
      liveBox.innerHTML = `<div class="error">${safeError(err)}</div>`;
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
async function fetchMemberByPhone(phone){ const u=currentUser(); const rows=await rpc("s3_search_member",{p_staff_session_token:u.session_token, p_phone:normalizePhone(phone)}); return rows&&rows.length?rows[0]:null; }

function historyListHtml(rows, emptyText="Belum ada transaksi."){
  if(!rows || !rows.length){
    return `<div class="notice">${emptyText}</div>`;
  }
  return `<div class="history-list">${rows.map(t=>{
    const topup = Number(t.topup_amount || 0);
    const used = Number(t.balance_used || 0);
    const after = Number(t.balance_after || 0);
    const title = t.type === "use_balance"
      ? "Pakai Saldo"
      : (t.type === "topup" ? "Top Up di Kasir" : (t.type === "gift_claim" ? "Gift Voucher" : "Transaksi"));
    return `
      <div class="history-item">
        <div class="history-head">
          <div>
            <div class="title">${title}</div>
            <div class="meta">${new Date(t.created_at).toLocaleString("id-ID")} • ${esc(t.outlet_name || OUTLET)}</div>
          </div>
          <span class="badge ${t.transaction_status === "approved" ? "ok" : ""}">${esc(t.transaction_status || "approved")}</span>
        </div>
        <div class="history-grid">
          <div><span>Top Up</span><b>${topup ? money(topup) : "-"}</b></div>
          <div><span>Pakai Saldo</span><b>${used ? money(used) : "-"}</b></div>
          <div><span>Saldo Setelah</span><b>${money(after)}</b></div>
        </div>
      </div>
    `;
  }).join("")}</div>`;
}


function dateID(value){
  if(!value) return "Tanpa tanggal expired";
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day:"2-digit",
    month:"long",
    year:"numeric"
  });
}

function expiryDays(value){
  if(!value) return null;
  const end = new Date(value).getTime();
  if(Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end-Date.now())/86400000));
}

function addMonthsFrom(value, months){
  const base = value ? new Date(value) : new Date();
  if(Number.isNaN(base.getTime())) return null;
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth()+Number(months||0));
  return d;
}

function singleBalanceExpiryHtml(data){
  const d = data || {};
  const balance = Number(d.balance||0);
  const expiry = d.expires_at || null;
  const days = d.days_remaining !== null && d.days_remaining !== undefined
    ? Number(d.days_remaining)
    : expiryDays(expiry);

  if(balance<=0){
    return `
      <div class="single-expiry-card empty">
        <div class="expiry-label">Masa Aktif Saldo</div>
        <div class="expiry-main">Belum ada saldo aktif</div>
        <div class="expiry-note">Top up hanya dapat dilakukan melalui kasir CACAYO.</div>
      </div>`;
  }

  if(!expiry){
    return `
      <div class="single-expiry-card">
        <div class="expiry-label">Masa Aktif Total Saldo</div>
        <div class="expiry-main">Tanpa tanggal expired</div>
        <div class="expiry-balance">${money(balance)}</div>
        <div class="expiry-note">Jika melakukan top up paket, seluruh saldo akan mengikuti masa aktif paket tersebut.</div>
      </div>`;
  }

  const urgent = days!==null && days<=30;
  return `
    <div class="single-expiry-card ${urgent ? "urgent" : ""}">
      <div class="expiry-label">Total Saldo Berlaku Sampai</div>
      <div class="expiry-main">${dateID(expiry)}</div>
      <div class="expiry-balance">${money(balance)}</div>
      <div class="expiry-note">${days===0 ? "Expired hari ini" : `${days} hari lagi`} • Setiap top up akan memperpanjang tanggal ini.</div>
    </div>`;
}

async function renderMember(){
  const u=requireLogin(); if(!u) return;
  mountLayout(); setNav("kasir");
  const {params}=getRoute();
  const phone=normalizePhone(params.phone||"");
  screen(`<section class="card"><h1>Loading member...</h1></section>`);

  try{
    const m=await fetchMemberByPhone(phone);
    if(!m){
      screen(`<section class="card"><h1>Member tidak ditemukan</h1><p>No HP: <b>${phone||"-"}</b></p><button class="full" onclick="setHash('join',{phone:'${phone}'})">Daftarkan Member</button><button class="ghost full" style="margin-top:8px" onclick="setHash('kasir')">Kembali</button></section>`);
      return;
    }

    let historyRows = [];
    let historyError = "";
    let expiryInfo = {};
    let expiryError = "";
    try{
      historyRows = await rpc("s3_staff_member_history", {p_staff_session_token:u.session_token, p_member_id:m.member_id});
      historyRows = historyRows || [];
    }catch(e){
      historyError = e.message;
    }
    try{
      const expiryRows = await rpc("s3_staff_member_balance_expiry", {
        p_staff_session_token:u.session_token,
        p_member_id:m.member_id
      });
      expiryInfo = expiryRows&&expiryRows[0] ? expiryRows[0] : {};
    }catch(e){
      expiryError = e.message;
    }

    const isBlocked = String(m.status || "").toLowerCase() === "blocked";
    const resetControls = `
      <section class="card">
        <h2>Reset PIN</h2>
        <p>Reset PIN hanya dilakukan melalui staff di cabang CACAYO. Customer scan QR dan membuat PIN baru sendiri.</p>
        <button class="secondary full" id="reset-pin-btn">Reset PIN via QR</button>
        <div id="staff-action-result" style="margin-top:12px"></div>
      </section>
    `;

    const ownerDelete = u.role === "owner" ? `
      <section class="card">
        <h2>Owner Controls</h2>
        <p>Kirim gift voucher khusus member atau archive member jika saldo sudah Rp0.</p>
        <button class="secondary full" id="send-member-gift-btn">Kirim Gift Voucher</button>
        <button class="danger full" style="margin-top:8px" id="delete-member-btn">Archive Member</button>
        <div id="owner-action-result" style="margin-top:12px"></div>
      </section>
    ` : "";

    screen(`
      <section class="card">
        <h1>${esc(m.name)}</h1>
        <div class="row"><span class="badge ${isBlocked ? "" : "ok"}">${String(m.status||"active").toUpperCase()}</span><span class="badge">${esc(m.member_code)}</span></div>
        <div class="divider"></div>
        <div class="kpi"><div class="label">Saldo Dining</div><div class="value">${money(m.balance)}</div></div>
        ${isBlocked ? `<div class="error" style="margin-top:12px">${customerBlockedMessage()}</div>` : `
        <div class="grid two" style="margin-top:12px">
          <button onclick="setHash('topup',{phone:'${esc(m.phone)}'})">Top Up Saldo</button>
          <button class="secondary" onclick="setHash('use-balance',{phone:'${esc(m.phone)}'})">Gunakan Saldo</button>
        </div>`}
      </section>
      <section class="card">
        <h3>Detail</h3>
        <div class="item"><div class="title">HP</div><div class="meta">${esc(m.phone)}</div></div>
        <div class="item"><div class="title">Member ID</div><div class="meta">${esc(m.member_code)}</div></div>
      </section>
      <section class="card">
        <h2>Masa Aktif Saldo</h2>
        <p>Seluruh saldo member menggunakan satu tanggal expired.</p>
        ${expiryError ? `<div class="error">${esc(expiryError)}</div>` : singleBalanceExpiryHtml(expiryInfo)}
      </section>
      <section class="card">
        <h2>Riwayat Transaksi Customer</h2>
        <p>Kasir dan owner bisa melihat history saldo customer. Detail pembayaran POS tidak dicatat di CTD.</p>
        ${historyError ? `<div class="error">${historyError}</div>` : historyListHtml(historyRows)}
      </section>
      ${resetControls}
      ${ownerDelete}
    `);

    byId("reset-pin-btn").onclick = async ()=>{
      const box = byId("staff-action-result");
      box.innerHTML = `<div class="notice">Membuat QR reset PIN...</div>`;
      try{
        const rows = await rpc("s3_create_pin_reset_request", {
          p_staff_session_token: u.session_token,
          p_member_id: m.member_id
        });
        const d = rows && rows[0] ? rows[0] : {};
        const resetToken = d.token;
        const link = `${publicBaseUrl()}#reset-pin?token=${resetToken}`;
        box.innerHTML = `
          <div class="success"><b>QR Reset PIN siap ✅</b><br>Customer scan QR ini untuk buat PIN baru. Setelah PIN baru dibuat, akun yang terblokir akan aktif kembali.</div>
          <div class="qr-wrap">
            <img class="qr-img" src="${qrImageUrl(link)}" alt="QR Reset PIN"/>
            <div class="meta">Berlaku sampai: ${d.expires_at || "30 menit"}</div>
          </div>
          <label>Reset PIN Link</label>
          <textarea class="copy-area" readonly>${link}</textarea>
          <button class="secondary full" onclick="navigator.clipboard.writeText('${link}').then(()=>alert('Reset PIN link copied'))">Copy Reset Link</button>
        `;
      }catch(err){
        box.innerHTML = `<div class="error">${safeError(err)}</div>`;
      }
    };

    if(u.role === "owner"){
      byId("send-member-gift-btn").onclick = ()=>{
        setHash("gift-generate",{
          member_id:m.member_id,
          member_name:m.name,
          member_phone:m.phone
        });
      };

      byId("delete-member-btn").onclick = async ()=>{
        const ok = confirm(`Archive member ${esc(m.name)} (${esc(m.phone)})?\n\nMember akan disembunyikan dari search/list. Saldo harus Rp0 dan history tetap tersimpan.`);
        if(!ok) return;
        const box = byId("owner-action-result");
        box.innerHTML = `<div class="notice">Archiving member...</div>`;
        try{
          await rpc("s3_archive_member", {
            p_staff_session_token: u.session_token,
            p_member_id: m.member_id
          });
          box.innerHTML = `<div class="success"><b>Member Archived ✅</b><br>Member tidak akan muncul lagi di search/top up. History tetap tersimpan.</div><button class="full" style="margin-top:10px" onclick="setHash('members')">Kembali ke All Members</button>`;
        }catch(err){
          box.innerHTML = `<div class="error">${safeError(err)}</div>`;
        }
      };
    }
  }catch(err){
    screen(`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`);
  }
}

function renderJoin(){
  const session=currentUser();
  if(session){ mountLayout(); setNav("register"); } else { byId("app").innerHTML=`<main style="padding:16px;max-width:520px;margin:auto"></main>`; }
  const {params}=getRoute();
  const target=session?byId("screen"):document.querySelector("main");
  target.innerHTML = `
    <section class="card">
      ${!session ? brandMiniHtml() : ""}
      <h1>Daftar Member Baru</h1>
      <p>Customer bisa daftar dengan atau tanpa Gift Code. Kalau Gift Code kosong, saldo awal Rp0.</p>
      <div class="notice"><b>PIN wajib 6 digit angka.</b><br>MOHON PIN DI INGAT / DI SCREENSHOT karena PIN dipakai untuk approve transaksi saldo.</div>
      <form id="register-form">
        <label>Nama Lengkap</label>
        <input id="name" placeholder="Nama customer" required/>
        <label>No HP</label>
        <input id="phone" inputmode="numeric" placeholder="628xxxxxxxxxx" value="${esc(params.phone||"")}" required/>
        <label>PIN Membership 6 Digit</label>
        <input id="pass" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="Contoh: 123456" required/>
        <div class="search-hint"><b>PIN akan tampil jelas.</b> MOHON PIN DI INGAT / DI SCREENSHOT.</div>
        <label>Gift Code / Invite Code <span class="meta">(Opsional)</span></label>
        <input id="gift" class="code-box" placeholder="Kosongkan jika daftar tanpa voucher" value="${esc(params.code||"")}"/>
        <div class="search-hint">Jika Gift Code dikosongkan, member tetap aktif dengan saldo awal Rp0.</div>
        <button class="full" style="margin-top:14px">Daftar Sekarang</button>
      </form>
      <div id="register-result" style="margin-top:12px"></div>
      ${PORTAL_MODE==="staff"&&!session?`<button class="ghost full" style="margin-top:12px" onclick="setHash('login')">Staff Login</button>`:""}
    </section>
  `;

  byId("register-form").onsubmit = async (e)=>{
    e.preventDefault();
    const box=byId("register-result");
    const pass=byId("pass").value.trim();
    if(!/^[0-9]{6}$/.test(pass)){
      box.innerHTML=`<div class="error">PIN wajib 6 digit angka. MOHON PIN DI INGAT / DI SCREENSHOT.</div>`;
      return;
    }
    box.innerHTML=`<div class="notice">Mendaftarkan member...</div>`;
    try{
      const memberCode=memberSeq();
      const giftCode=byId("gift").value.trim().toUpperCase();
      const rows=await rpc("mvp_claim_gift_code",{
        p_outlet_slug:OUTLET_SLUG,
        p_member_code:memberCode,
        p_name:byId("name").value.trim(),
        p_phone:normalizePhone(byId("phone").value),
        p_password:pass,
        p_gift_code:giftCode
      });
      const d=rows&&rows[0]?rows[0]:{};
      const giftStatus = giftCode ? "TERDAFTAR" : "TANPA GIFT CODE";
      box.innerHTML=`<div class="success"><b>Membership Active ✅</b><br>Member ID: ${d.member_code||memberCode}<br>Saldo Awal: ${money(d.initial_balance||0)}<br>Gift Code: ${giftStatus}<br><br><b>MOHON PIN DI INGAT / DI SCREENSHOT.</b></div><button class="full" style="margin-top:10px" onclick="location.href='/#customer-login'">Login Customer Portal</button>${PORTAL_MODE==="staff"?`<button class="ghost full" style="margin-top:8px" onclick="setHash('kasir')">Kembali ke Kasir</button>`:""}`;
    }catch(err){
      box.innerHTML=`<div class="error">${safeError(err)}</div>`;
    }
  };
}

async function renderTopup(){
  const user=requireLogin(); if(!user)return; mountLayout(); setNav("kasir");
  const {params}=getRoute(); const phone=normalizePhone(params.phone||"");
  screen(`<section class="card"><h1>Loading top up...</h1></section>`);
  try{
    const member=await fetchMemberByPhone(phone);
    if(!member){ setHash("kasir"); return; }

    let currentExpiryInfo = {};
    try{
      const expiryRows = await rpc("s3_staff_member_balance_expiry", {
        p_staff_session_token:user.session_token,
        p_member_id:member.member_id
      });
      currentExpiryInfo = expiryRows&&expiryRows[0] ? expiryRows[0] : {};
      if(currentExpiryInfo.balance !== undefined){
        member.balance = Number(currentExpiryInfo.balance||0);
      }
    }catch(e){
      currentExpiryInfo = {};
    }

    screen(`
      <section class="card">
        <h1>Top Up Saldo Member</h1>
        <p>Kasir menerima pembayaran di POS, lalu input invoice POS dan saldo yang diberikan ke member.</p>
        <div class="kpi"><div class="label">${esc(member.name)} • ${esc(member.phone)}</div><div class="value">${money(member.balance)}</div></div>
        <div class="topup-expiry-current">
          Masa aktif saldo saat ini:
          <b>${currentExpiryInfo.expires_at ? dateID(currentExpiryInfo.expires_at) : (Number(member.balance||0)>0 ? "Tanpa tanggal expired" : "Belum ada saldo aktif")}</b>
        </div>
      </section>

      <section class="card">
        <h2>Pilih Paket Top Up</h2>
        <div class="simple-topup-grid" id="package-grid">
          <button type="button" class="simple-topup-card nickel active" data-package="NICKEL" data-paid="1000000" data-credit="1050000" data-valid-months="2">
            <div class="top"><div class="name">⚙️ NICKEL</div><div class="badge">+5%</div></div>
            <div class="pay">Bayar Rp1.000.000</div>
            <div class="credit">Dapat saldo Rp1.050.000</div>
            <div class="validity">Valid 2 bulan</div>
          </button>
          <button type="button" class="simple-topup-card silver" data-package="SILVER" data-paid="2000000" data-credit="2200000" data-valid-months="2">
            <div class="top"><div class="name">🥈 SILVER</div><div class="badge">+10%</div></div>
            <div class="pay">Bayar Rp2.000.000</div>
            <div class="credit">Dapat saldo Rp2.200.000</div>
            <div class="validity">Valid 2 bulan</div>
          </button>
          <button type="button" class="simple-topup-card gold" data-package="GOLD" data-paid="3000000" data-credit="3450000" data-valid-months="4">
            <div class="top"><div class="name">🏆 GOLD</div><div class="badge">+15%</div></div>
            <div class="pay">Bayar Rp3.000.000</div>
            <div class="credit">Dapat saldo Rp3.450.000</div>
            <div class="validity">Valid 4 bulan</div>
          </button>
          <button type="button" class="simple-topup-card diamond" data-package="DIAMOND" data-paid="4000000" data-credit="4800000" data-valid-months="4">
            <div class="top"><div class="name">💎 DIAMOND</div><div class="badge">+20%</div></div>
            <div class="pay">Bayar Rp4.000.000</div>
            <div class="credit">Dapat saldo Rp4.800.000</div>
            <div class="validity">Valid 4 bulan</div>
          </button>
        </div>

        <form id="topup-form" style="margin-top:16px">
          <div class="grid two">
            <div>
              <label>Uang Diterima Kasir</label>
              <input id="cashPaid" inputmode="numeric" value="1000000" readonly />
            </div>
            <div>
              <label>Saldo yang Diberikan</label>
              <input id="creditIssued" inputmode="numeric" value="1050000" readonly />
            </div>
          </div>
          <label>Invoice Number dari POS</label>
          <input id="invoiceNumber" placeholder="Contoh: INV-2026-000123" required />
          <div id="topup-preview" class="success" style="margin-top:12px"></div>
          <button class="full" style="margin-top:14px">Submit Top Up</button>
        </form>
        <div id="topup-result" style="margin-top:12px"></div>
      </section>
    `);

    let selectedPackage = "NICKEL";
    let selectedValidMonths = 2;

    function refreshPreview(){
      const paid=parseMoney(byId("cashPaid").value), credit=parseMoney(byId("creditIssued").value);
      const hasActiveBalance = Number(member.balance||0)>0;
      const currentExpiry = currentExpiryInfo.expires_at && new Date(currentExpiryInfo.expires_at)>new Date()
        ? currentExpiryInfo.expires_at
        : null;
      const expiryBase = hasActiveBalance && currentExpiry ? currentExpiry : new Date();
      const estimatedExpiry = addMonthsFrom(expiryBase, selectedValidMonths);
      byId("topup-preview").innerHTML=`
        Paket: <b>${selectedPackage}</b> • Perpanjangan <b>+${selectedValidMonths} bulan</b><br>
        Customer bayar <b>${money(paid)}</b>, saldo bertambah <b>${money(credit)}</b>.<br>
        Total saldo setelah top up: <b>${money(Number(member.balance||0)+credit)}</b><br>
        Tanggal expired seluruh saldo: <b>${dateID(estimatedExpiry)}</b>
      `;
    }

    document.querySelectorAll(".simple-topup-card").forEach(btn=>{
      btn.onclick=()=>{
        document.querySelectorAll(".simple-topup-card").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        selectedPackage = btn.dataset.package || "NICKEL";
        selectedValidMonths = Number(btn.dataset.validMonths || 2);
        byId("cashPaid").value=btn.dataset.paid;
        byId("creditIssued").value=btn.dataset.credit;
        refreshPreview();
      };
    });

    refreshPreview();

    byId("topup-form").onsubmit=async(e)=>{
      e.preventDefault();
      const box=byId("topup-result");
      const paid=parseMoney(byId("cashPaid").value), credit=parseMoney(byId("creditIssued").value);
      const invoiceNumber = byId("invoiceNumber").value.trim();

      if(paid < 0 || credit <= 0){
        box.innerHTML=`<div class="error">Nominal tidak valid. Saldo yang diberikan harus lebih dari Rp0.</div>`;
        return;
      }
      if(!invoiceNumber){
        box.innerHTML=`<div class="error">Invoice Number dari POS wajib diisi.</div>`;
        return;
      }

      box.innerHTML=`<div class="notice">Submitting top up...</div>`;
      try{
        const rows=await rpc("s3_topup_member",{
          p_staff_session_token:user.session_token,
          p_member_id:member.member_id,
          p_cash_paid:paid,
          p_credit_issued:credit,
          p_invoice_number:invoiceNumber,
          p_package_name:selectedPackage,
          p_valid_months:selectedValidMonths
        });
        const d=rows&&rows[0]?rows[0]:{};
        box.innerHTML=`<div class="success"><b>Top Up Sukses ✅</b><br>Paket: <b>${esc(d.package_name||selectedPackage)}</b><br>Saldo ditambahkan: <b>${money(d.credit_issued||credit)}</b><br>Total saldo aktif: <b>${money(d.new_balance||0)}</b><br>Seluruh saldo berlaku sampai: <b>${dateID(d.expires_at)}</b><br>Invoice POS: <b>${esc(invoiceNumber)}</b></div><div class="grid two" style="margin-top:12px"><button onclick="setHash('kasir')">Kembali ke Kasir</button><button class="secondary" onclick="setHash('member',{phone:'${esc(member.phone)}'})">Lihat Member</button></div>`;
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
      }
    };
  }catch(err){
    screen(`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`);
  }
}
async function renderUseBalance(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); screen(`<section class="card"><h1>Loading saldo...</h1></section>`);
  try{ const m=await fetchMemberByPhone(params.phone); if(!m){setHash("kasir");return;} const bal=Number(m.balance||0); const dis=bal<=0?"disabled":""; screen(`<section class="card"><h1>Gunakan Saldo</h1><p>${esc(m.name)} • Saldo ${money(bal)}</p>${bal<=0?`<div class="error"><b>Saldo customer Rp0.</b><br>Request pemakaian saldo tidak bisa dibuat sampai customer top up / mendapat saldo baru.</div>`:`<div class="notice">Kasir cukup input nominal saldo/voucher yang akan dipakai. Bill dan payment split tetap divalidasi manual di POS.</div>`}<form id="use-form"><label>Nominal Saldo / Voucher yang Dipakai</label><input id="balanceUsed" inputmode="numeric" placeholder="100000" ${dis} required/><div id="calc" class="notice" style="margin-top:12px">Nominal akan dikirim ke customer untuk approval.</div><button id="requestBtn" class="full" style="margin-top:14px" ${dis}>Request Customer Approval</button></form><div id="use-result" style="margin-top:12px"></div></section>`);
    const update=()=>{ const used=parseMoney(byId("balanceUsed").value); const btn=byId("requestBtn"), box=byId("calc"); if(used<=0){box.className="notice";box.innerHTML="Masukkan nominal saldo yang akan dipakai.";btn.disabled=true;return;} if(used>bal){box.className="error";box.innerHTML=`<b>Saldo tidak cukup.</b><br>Saldo customer: ${money(bal)}. Request: ${money(used)}. Saldo tidak boleh minus.`;btn.disabled=true;return;} box.className="success"; box.innerHTML = used===bal ? `Request valid. Customer akan approve ${money(used)}. Saldo setelah approval menjadi <b>Rp0</b>.` : `Request valid. Customer akan approve ${money(used)}. Saldo setelah approval: <b>${money(bal-used)}</b>.`; btn.disabled=false; };
    if(bal>0){ byId("balanceUsed").oninput=update; update(); }
    byId("use-form").onsubmit=async(e)=>{ e.preventDefault(); const used=parseMoney(byId("balanceUsed").value); const box=byId("use-result"); if(used<=0||used>bal){ box.innerHTML=`<div class="error">Saldo tidak cukup / nominal tidak valid. Saldo tidak boleh minus.</div>`; return; } box.innerHTML=`<div class="notice">Creating approval request...</div>`; try{       const rows=await rpc("s3_create_approval_request",{p_staff_session_token:u.session_token,p_member_id:m.member_id,p_balance_used:used});
      const d=rows&&rows[0]?rows[0]:{};
      if(!d.token) throw new Error("Approval token gagal dibuat.");
      setHash("waiting",{token:d.token}); }catch(err){ box.innerHTML=`<div class="error">${safeError(err)}</div>`; } };
  }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`); }
}

async function renderWaiting(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); const token=params.token; const link=`${publicBaseUrl()}#approve?token=${token}`; screen(`<section class="card"><h1>Loading approval...</h1></section>`);
  const draw=(p)=>screen(`<section class="card"><h1>Menunggu Approval Customer</h1><p>Customer scan QR ini di HP sendiri dan input PIN/password membership.</p><div class="item"><div class="title">Member</div><div class="meta">${esc(p.member_name)} • ${esc(p.member_phone)}</div></div><div class="item"><div class="title">Nominal Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div><div class="item"><div class="title">Saldo Setelah Approval</div><div class="meta">${money(p.balance_after)}</div></div><div class="qr-wrap"><img class="qr-img" src="${qrImageUrl(link)}" alt="QR Approval"/><div class="meta">Customer scan QR ini dari HP masing-masing.</div></div><label>Approval Link</label><textarea class="copy-area" readonly>${link}</textarea><button class="secondary full" onclick="navigator.clipboard.writeText('${link}').then(()=>alert('Link copied'))">Copy Approval Link</button><button class="ghost full" style="margin-top:8px" onclick="setHash('approve',{token:'${token}'})">Simulasi Customer Approve di Browser Ini</button><div id="waiting-status" class="notice" style="margin-top:12px">Status: ${p.status}</div></section>`);
  try{ const rows=await rpc("mvp_get_approval",{p_token:token}); if(!rows||!rows.length) throw new Error("Approval tidak ditemukan."); draw(rows[0]); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`); return; }
  const interval=setInterval(async()=>{ const box=byId("waiting-status"); if(!box){clearInterval(interval);return;} try{ const rows=await rpc("mvp_get_approval",{p_token:token}); const p=rows&&rows[0]; if(!p)return; if(p.status==="approved"){ box.className="success"; box.innerHTML="Status: Approved ✅"; setTimeout(()=>setHash("success",{token}),700); clearInterval(interval); } else if(p.status==="rejected"){ box.className="error"; box.innerHTML="Status: Rejected ❌"; clearInterval(interval); } else { box.className="notice"; box.innerHTML=`Status: ${p.status}`; } }catch(e){ console.warn(e); } },2500);
}


function customerTopupInfoHtml(){
  return `
    <section class="card">
      <h2>Tambah Saldo</h2>
      <p>Top up tetap dilakukan di kasir/POS. Tunjukkan halaman ini ke kasir untuk tambah saldo.</p>
      <div class="customer-topup-grid">
        <div class="customer-topup-card"><div class="title">⚙️ NICKEL</div><div class="desc">Bayar Rp1.000.000 → Saldo Rp1.050.000 • Valid 2 bulan</div></div>
        <div class="customer-topup-card"><div class="title">🥈 SILVER</div><div class="desc">Bayar Rp2.000.000 → Saldo Rp2.200.000 • Valid 2 bulan</div></div>
        <div class="customer-topup-card"><div class="title">🏆 GOLD</div><div class="desc">Bayar Rp3.000.000 → Saldo Rp3.450.000 • Valid 4 bulan</div></div>
        <div class="customer-topup-card"><div class="title">💎 DIAMOND</div><div class="desc">Bayar Rp4.000.000 → Saldo Rp4.800.000 • Valid 4 bulan</div></div>
      </div>
      <div class="customer-topup-note">Hubungi kasir untuk top up. Pembayaran dan invoice tetap melalui POS.</div>
    </section>
  `;
}

async function renderCustomerHome(){
  const {params}=getRoute();
  const token=params.token;
  byId("app").innerHTML=`<main style="padding:16px;max-width:560px;margin:auto"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<section class="card"><h1>Loading customer home...</h1></section>`;
  try{
    if(!token) throw new Error("Customer token tidak ditemukan.");
    const rows=await rpc("mvp_get_approval",{p_token:token});
    if(!rows||!rows.length) throw new Error("Data customer tidak ditemukan.");
    const p=rows[0];
    const saldo = p.balance_after ?? p.balance_before ?? 0;
    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <div class="customer-home-header">
          <h1>${OUTLET_FULL}</h1>
          <p>${esc(p.member_name || "Member")} • ${esc(p.member_phone || "")}</p>
        </div>
        <div class="kpi"><div class="label">Saldo Saat Ini</div><div class="value">${money(saldo)}</div></div>
        <div class="notice" style="margin-top:12px">Ini adalah halaman customer. Untuk pembayaran/top up, tetap hubungi kasir.</div>
      </section>
      ${customerTopupInfoHtml()}
    `;
  }catch(err){
    target.innerHTML=`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`;
  }
}

async function renderApprove(){
  const {params}=getRoute();
  const token=params.token;
  byId("app").innerHTML=`<main style="padding:16px;max-width:560px;margin:auto"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<section class="card"><h1>Loading approval...</h1></section>`;

  try{
    const rows=await rpc("mvp_get_approval",{p_token:token});
    if(!rows||!rows.length) throw new Error("Approval tidak ditemukan.");
    const p=rows[0];

    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <h1>Approve Pemakaian Saldo</h1>
        <p>${OUTLET_FULL}</p>
        <div class="approval-alert">
          <div style="font-weight:900">⚠️ Permintaan Pemakaian Saldo</div>
          <div class="big-money">${money(p.balance_used)}</div>
          <div>Pastikan nominal ini sesuai instruksi kasir di POS sebelum memasukkan PIN.</div>
          <div>Saldo setelah approval: <b>${money(p.balance_after)}</b>.</div>
        </div>
        <div class="item"><div class="title">Member</div><div class="meta">${esc(p.member_name)} • ${esc(p.member_phone)}</div></div>
        <form id="approve-form">
          <label>PIN Membership 6 Digit</label>
          <input id="pass" type="password" inputmode="numeric" maxlength="6" placeholder="Masukkan PIN 6 digit" required/>
          <button class="ok full" style="margin-top:14px">Approve Pemakaian Saldo</button>
        </form>
        <button class="ghost full" style="margin-top:8px" id="rejectBtn">Tolak</button>
        <div id="approve-result" style="margin-top:12px"></div>
      </section>
    `;

    if(p.status!=="waiting"){
      byId("approve-result").innerHTML=`<div class="notice">Status request: ${p.status}</div>`;
    }

    byId("rejectBtn").onclick=async()=>{
      try{
        await rpc("mvp_reject_approval",{p_token:token});
        byId("approve-result").innerHTML=`<div class="error">Transaksi ditolak. Saldo tidak berubah.</div>`;
      }catch(err){
        byId("approve-result").innerHTML=`<div class="error">${safeError(err)}</div>`;
      }
    };

    byId("approve-form").onsubmit=async(e)=>{
      e.preventDefault();
      const box=byId("approve-result");
      box.innerHTML=`<div class="notice">Approving...</div>`;
      try{
        const rows=await rpc("mvp_approve_balance_use",{p_token:token,p_password:byId("pass").value});
        const d=rows&&rows[0]?rows[0]:{};
        if(d.approval_success === false){
          box.innerHTML=`<div class="error">${d.error_message || "PIN salah."}</div>`;
          return;
        }
        const saldoAfter = d.balance_after ?? p.balance_after ?? 0;

        target.innerHTML=`
          <section class="card">
            ${brandMiniHtml()}
            <div class="customer-home-header">
              <div class="check">✓</div>
              <h1>Saldo Berhasil Dipakai</h1>
              <p>Approval berhasil. Form PIN sudah ditutup.</p>
            </div>
            <div class="item"><div class="title">Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div>
            <div class="item"><div class="title">Sisa Saldo</div><div class="meta"><b>${money(saldoAfter)}</b></div></div>
            <div class="success" style="margin-top:12px">Transaksi berhasil. Silakan kembali ke kasir untuk menyelesaikan bill di POS.</div>
            <button class="full" style="margin-top:14px" onclick="location.hash='customer-home?token=${token}'">HOME Customer</button>
          </section>
          ${customerTopupInfoHtml()}
        `;
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
      }
    };
  }catch(err){
    target.innerHTML=`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`;
  }
}
async function renderSuccess(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); try{ const rows=await rpc("mvp_get_approval",{p_token:params.token}); const p=rows&&rows[0]; if(!p) throw new Error("Approval not found"); screen(`<section class="card"><h1>Saldo Berhasil Dipakai ✅</h1><div class="item"><div class="title">Member</div><div class="meta">${esc(p.member_name)} • ${esc(p.member_phone)}</div></div><div class="item"><div class="title">Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div><div class="item"><div class="title">Saldo Sisa</div><div class="meta">${money(p.balance_after)}</div></div><div class="notice">Kasir tetap validasi manual di POS: masukkan payment Voucher/Cash to Dine sebesar ${money(p.balance_used)}. Sisa bill, kalau ada, dibayar QRIS/Cash/Card di POS.</div><button class="full" style="margin-top:12px" onclick="setHash('kasir')">Transaksi Baru</button></section>`); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`); }
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
    const rows = await rpc("s3_owner_dashboard_summary", {p_staff_session_token:u.session_token});
    const s = rows && rows[0] ? rows[0] : {};
    byId("dashboard-summary").innerHTML = `
      <div class="dashboard-card"><div class="label">Total Members</div><div class="value">${s.total_members || 0}</div></div>
      <div class="dashboard-card"><div class="label">Total Saldo Member</div><div class="value">${money(s.total_wallet_balance || 0)}</div></div>
      <div class="dashboard-card"><div class="label">Voucher Available</div><div class="value">${s.available_vouchers || 0}</div></div>
      <div class="dashboard-card"><div class="label">Terdaftar / Claimed</div><div class="value">${Number(s.registered_vouchers || 0) + Number(s.claimed_vouchers || 0)}</div></div>
    `;
  }catch(err){
    byId("dashboard-summary").innerHTML = `<div class="error" style="grid-column:1/-1">${safeError(err)}</div>`;
  }
}
async function renderGiftGenerate(){
  const u=requireLogin();
  if(!u)return;
  if(u.role!=="owner"){setHash("kasir");return;}

  mountLayout();
  setNav("gift");

  const {params}=getRoute();
  const defaultExpiry=new Date(Date.now()+30*86400000).toISOString().slice(0,10);

  screen(`
    <section class="card">
      <h1>Voucher Control Center</h1>
      <p>Voucher untuk member baru dan existing member. Voucher yang sudah dicopy akan terkunci dan tidak bisa dicopy ulang.</p>
      <div id="voucher-summary" class="voucher-summary">
        <div class="stat"><div class="label">Total</div><div class="value">-</div></div>
        <div class="stat"><div class="label">Available</div><div class="value">-</div></div>
        <div class="stat"><div class="label">Terdaftar</div><div class="value">-</div></div>
        <div class="stat"><div class="label">Claimed</div><div class="value">-</div></div>
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
        <span class="badge">Copy hanya 1x per voucher</span>
        <button class="ghost" id="refresh-vouchers" type="button">Refresh</button>
      </div>

      <div id="voucher-list" class="list">
        <div class="notice">Loading voucher list...</div>
      </div>

      <div class="pagination-bar">
        <button class="ghost" id="prev-page" type="button">← Prev</button>
        <div class="page-info" id="page-info">Page -</div>
        <button class="ghost" id="next-page" type="button">Next →</button>
      </div>
    </section>

    <section class="card member-gift-card">
      <div class="section-eyebrow">EXISTING MEMBER</div>
      <h2>Kirim Gift ke Existing Member</h2>
      <p>Gift terikat ke member yang dipilih. Jika link diteruskan, akun lain tetap tidak bisa claim.</p>

      <label>Cari Existing Member</label>
      <input id="member-gift-search" placeholder="Nama atau nomor WhatsApp" value="${esc(params.member_phone||params.member_name||"")}"/>
      <div id="member-gift-search-result" class="member-gift-search-result"></div>
      <div id="selected-gift-member"></div>

      <form id="existing-member-gift-form">
        <label>Campaign / Event</label>
        <input id="existing-gift-campaign" value="Special Gift CACAYO" required/>

        <div class="grid two">
          <div>
            <label>Nominal Gift</label>
            <input id="existing-gift-value" inputmode="numeric" value="100000" required/>
          </div>
          <div>
            <label>Voucher Expired Date</label>
            <input id="existing-gift-expired" type="date" value="${defaultExpiry}" required/>
          </div>
        </div>

        <div class="notice">
          Saat diclaim, nominal gift langsung menambah saldo member.
          Expiry gift tidak akan memperpendek masa aktif saldo yang sudah ada.
        </div>

        <button class="full" style="margin-top:14px">Generate Gift untuk Member</button>
      </form>
      <div id="existing-member-gift-result" style="margin-top:12px"></div>
    </section>

    <section class="card">
      <div class="section-eyebrow">MEMBER BARU</div>
      <h2>Generate Voucher Pendaftaran</h2>
      <p>Voucher ini dipakai saat customer baru mendaftar sebagai member.</p>

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
        <input id="expired" type="date" value="${defaultExpiry}" required/>
        <button class="full" style="margin-top:14px">Generate Voucher Member Baru</button>
      </form>
      <div id="gift-result" style="margin-top:12px"></div>
    </section>
  `);

  const joinBase=`${publicBaseUrl()}#join?code=`;
  const claimBase=`${publicBaseUrl()}#claim-gift?code=`;

  let selectedGiftMember = params.member_id
    ? {
        member_id:params.member_id,
        name:params.member_name||"-",
        phone:params.member_phone||"-"
      }
    : null;

  let memberSearchRows=[];
  let currentPage=1;
  const pageSize=10;
  let currentRows=[];
  let totalCount=0;

  function voucherStatusClass(s){
    if(s==="registered")return "registered";
    if(s==="claimed")return "claimed";
    if(s==="used")return "registered";
    return s==="expired"?"expired":(s==="void"?"void":"available");
  }

  function voucherLink(data){
    return data.gift_type==="existing_member"
      ? `${claimBase}${data.code}`
      : `${joinBase}${data.code}`;
  }

  function waMessageFor(data){
    if(data.gift_type==="existing_member"){
      const recipient=data.target_member_name||"Kak";
      return `Halo ${recipient}, kamu mendapat Gift Dining Credit ${money(data.value)} dari ${OUTLET}.

Event: ${data.campaign_name||"Special Gift CACAYO"}
Berlaku sampai: ${data.expired_at||"-"}

Claim gift melalui link ini:
${voucherLink(data)}

Login menggunakan nomor WhatsApp dan PIN member.
Voucher ini khusus untuk akun kamu dan hanya bisa digunakan 1x.`;
    }

    return `Halo Kak, kamu dapat Gift Dining Credit ${money(data.value)} dari ${OUTLET}.

Daftar member di link ini:
${voucherLink(data)}

Gift Code: ${data.code}

Kode ini hanya bisa digunakan 1x saat daftar member baru.`;
  }

  function renderSelectedGiftMember(){
    const box=byId("selected-gift-member");
    if(!selectedGiftMember){
      box.innerHTML=`<div class="notice">Belum ada member yang dipilih.</div>`;
      return;
    }

    box.innerHTML=`
      <div class="selected-member-card">
        <div>
          <div class="title">${esc(selectedGiftMember.name||"-")}</div>
          <div class="meta">${esc(selectedGiftMember.phone||"-")}</div>
        </div>
        <span class="badge ok">SELECTED</span>
      </div>`;
  }

  window.selectExistingGiftMember=(index)=>{
    const member=memberSearchRows[index];
    if(!member)return;
    selectedGiftMember={
      member_id:member.member_id,
      name:member.name,
      phone:member.phone
    };
    byId("member-gift-search").value=`${member.name} • ${member.phone}`;
    byId("member-gift-search-result").innerHTML="";
    renderSelectedGiftMember();
  };

  let searchTimer=null;
  byId("member-gift-search").oninput=()=>{
    clearTimeout(searchTimer);
    searchTimer=setTimeout(async()=>{
      const q=byId("member-gift-search").value.trim();
      const box=byId("member-gift-search-result");

      if(q.length<3){
        box.innerHTML="";
        return;
      }

      box.innerHTML=`<div class="notice">Mencari member...</div>`;

      try{
        const rows=await rpc("s3_search_members",{
          p_staff_session_token:u.session_token,
          p_query:q
        });
        memberSearchRows=(rows||[]).filter(m=>m.status!=="deleted");

        if(!memberSearchRows.length){
          box.innerHTML=`<div class="notice">Member tidak ditemukan.</div>`;
          return;
        }

        box.innerHTML=memberSearchRows.map((m,i)=>`
          <button class="member-search-option" type="button"
            onclick="window.selectExistingGiftMember(${i})">
            <span>
              <b>${esc(m.name)}</b>
              <small>${esc(m.phone)} • ${esc(m.member_code||"-")}</small>
            </span>
            <strong>${money(m.balance||0)}</strong>
          </button>
        `).join("");
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
      }
    },350);
  };

  function renderSummaryFromRows(rows){
    const available=rows.filter(v=>v.voucher_status==="available").length;
    const registered=rows.filter(v=>v.voucher_status==="registered"||v.voucher_status==="used").length;
    const claimed=rows.filter(v=>v.voucher_status==="claimed").length;

    byId("voucher-summary").innerHTML=`
      <div class="stat"><div class="label">Total Filter</div><div class="value">${totalCount}</div></div>
      <div class="stat"><div class="label">Available Page</div><div class="value">${available}</div></div>
      <div class="stat"><div class="label">Terdaftar Page</div><div class="value">${registered}</div></div>
      <div class="stat"><div class="label">Claimed Page</div><div class="value">${claimed}</div></div>
    `;
  }

  function renderPagination(){
    const totalPages=Math.max(1,Math.ceil(totalCount/pageSize));
    byId("page-info").textContent=`Page ${currentPage} / ${totalPages} • ${totalCount} voucher`;
    byId("prev-page").disabled=currentPage<=1;
    byId("next-page").disabled=currentPage>=totalPages;
  }

  function renderVoucherRows(){
    if(!currentRows.length){
      byId("voucher-list").innerHTML=`<div class="notice">Tidak ada voucher untuk filter ini.</div>`;
      renderPagination();
      return;
    }

    byId("voucher-list").innerHTML=currentRows.map(v=>{
      const cls=voucherStatusClass(v.voucher_status);
      const isAvailable=v.voucher_status==="available";
      const isRegistered=v.voucher_status==="registered"||v.voucher_status==="used";
      const isClaimed=v.voucher_status==="claimed";
      const isCopied=Boolean(v.copied_at);
      const copyMethod=String(v.copied_method||"").toUpperCase();
      const isExisting=v.gift_type==="existing_member";

      const targetInfo=isExisting
        ? `<div class="target-member-info">
             <span class="badge">EXISTING MEMBER</span>
             <b>${esc(v.target_member_name||"-")}</b>
             <span>${esc(v.target_member_phone||"-")}</span>
           </div>`
        : `<div class="target-member-info"><span class="badge">MEMBER BARU</span></div>`;

      const usedInfo=isRegistered
        ? `<div class="meta">Terdaftar oleh: ${esc(v.used_by_name||"-")} • ${esc(v.used_by_phone||"-")}</div>`
        : (isClaimed
          ? `<div class="meta">Claimed by: ${esc(v.used_by_name||"-")} • ${esc(v.used_by_phone||"-")}</div>`
          : (isAvailable
            ? (isCopied
              ? `<div class="meta copied-meta">COPIED${copyMethod?` via ${esc(copyMethod)}`:""} • ${new Date(v.copied_at).toLocaleString("id-ID")}</div>`
              : `<div class="meta">Belum dicopy / belum dikirim</div>`)
            : `<div class="meta">Status: ${esc(v.voucher_status)}</div>`));

      const actions=isAvailable
        ? (isCopied
          ? `<div class="voucher-actions copied-actions"><span class="copied-badge">✓ COPIED</span></div>`
          : `<div class="voucher-actions">
               <button class="secondary" type="button"
                 onclick="window.copyVoucherOnce('${v.gift_id}','wa',this)">Copy WA</button>
               <button class="ghost" type="button"
                 onclick="window.copyVoucherOnce('${v.gift_id}','link',this)">Copy Link</button>
               <button class="danger" type="button"
                 onclick="window.deleteVoucher('${v.gift_id}','${v.code}')">Delete</button>
             </div>`)
        : `<div class="voucher-actions"><span class="badge">${isRegistered?"TERDAFTAR":(isClaimed?"CLAIMED":"Not active")}</span></div>`;

      return `
        <div class="voucher-row ${cls}">
          <div>
            <div class="code-box">${esc(v.code)}</div>
            <div class="meta">Exp: ${esc(v.expired_at||"-")}</div>
          </div>
          <div>
            <div class="campaign">${esc(v.campaign_name||"-")}</div>
            ${targetInfo}
            ${usedInfo}
          </div>
          <div>
            <div class="money">${money(v.value)}</div>
            <span class="status-pill ${cls}">${esc(String(v.voucher_status||"").toUpperCase())}</span>
          </div>
          ${actions}
        </div>`;
    }).join("");

    renderPagination();
  }

  async function loadVouchers(){
    const filter=byId("voucher-filter").value;
    const offset=(currentPage-1)*pageSize;

    byId("voucher-list").innerHTML=`<div class="notice">Loading voucher list...</div>`;

    try{
      const rows=await rpc("s3_list_gift_codes_paged",{
        p_staff_session_token:u.session_token,
        p_status:filter,
        p_limit:pageSize,
        p_offset:offset
      });

      currentRows=rows||[];
      totalCount=currentRows.length?Number(currentRows[0].total_count||0):0;
      renderSummaryFromRows(currentRows);
      renderVoucherRows();
    }catch(err){
      byId("voucher-list").innerHTML=`<div class="error">${safeError(err)}</div>`;
    }
  }

  async function copyWithFallback(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(err){
      window.prompt("Clipboard browser gagal. Copy teks berikut secara manual:",text);
      return false;
    }
  }

  window.copyVoucherOnce=async(giftId,method,button)=>{
    if(!giftId||!["wa","link"].includes(method))return;

    const row=button?button.closest(".voucher-row"):null;
    const rowButtons=row?Array.from(row.querySelectorAll("button")):[];
    rowButtons.forEach(btn=>btn.disabled=true);
    if(button)button.textContent="COPYING...";

    try{
      const rows=await rpc("s3_copy_gift_code",{
        p_staff_session_token:u.session_token,
        p_gift_id:giftId,
        p_method:method
      });
      const d=rows&&rows[0]?rows[0]:{};

      if(d.copy_allowed===false){
        alert(d.error_message||"Voucher sudah pernah dicopy.");
        await loadVouchers();
        return;
      }

      const text=method==="wa"
        ? waMessageFor(d)
        : voucherLink(d);

      const copied=await copyWithFallback(text);
      await loadVouchers();

      if(copied){
        alert(`${method==="wa"?"WA invite":"Link"} ${d.code} berhasil dicopy. Voucher sekarang terkunci.`);
      }
    }catch(err){
      rowButtons.forEach(btn=>btn.disabled=false);
      if(button)button.textContent=method==="wa"?"Copy WA":"Copy Link";
      alert(safeError(err));
    }
  };

  window.deleteVoucher=async(giftId,code)=>{
    if(!confirm(`Delete / void voucher ${code}?`))return;

    try{
      await rpc("s3_delete_gift_code",{
        p_staff_session_token:u.session_token,
        p_gift_id:giftId
      });
      alert(`Voucher ${code} deleted/void.`);
      await loadVouchers();
    }catch(err){
      alert(safeError(err));
    }
  };

  byId("voucher-filter").onchange=()=>{
    currentPage=1;
    loadVouchers();
  };
  byId("refresh-vouchers").onclick=loadVouchers;
  byId("prev-page").onclick=()=>{
    if(currentPage>1){
      currentPage--;
      loadVouchers();
    }
  };
  byId("next-page").onclick=()=>{
    currentPage++;
    loadVouchers();
  };

  byId("existing-member-gift-form").onsubmit=async(e)=>{
    e.preventDefault();

    const box=byId("existing-member-gift-result");
    const value=parseMoney(byId("existing-gift-value").value);
    const campaign=byId("existing-gift-campaign").value.trim();
    const expired=byId("existing-gift-expired").value;

    if(!selectedGiftMember){
      box.innerHTML=`<div class="error">Pilih existing member terlebih dahulu.</div>`;
      return;
    }

    if(value<=0){
      box.innerHTML=`<div class="error">Nominal gift harus lebih dari Rp0.</div>`;
      return;
    }

    if(!confirm(`Kirim gift ${money(value)} untuk ${selectedGiftMember.name}?`)){
      return;
    }

    box.innerHTML=`<div class="notice">Generating gift voucher khusus member...</div>`;

    try{
      const rows=await rpc("s3_generate_member_gift",{
        p_staff_session_token:u.session_token,
        p_member_id:selectedGiftMember.member_id,
        p_campaign_name:campaign,
        p_value:value,
        p_expired_at:expired
      });
      const d=rows&&rows[0]?rows[0]:{};

      box.innerHTML=`
        <div class="success">
          <b>Gift Voucher Berhasil Dibuat ✅</b><br>
          Recipient: <b>${esc(d.target_member_name||selectedGiftMember.name)}</b><br>
          Nominal: <b>${money(d.value||value)}</b><br>
          Code: <b>${esc(d.code||"-")}</b>
        </div>
        <div class="notice" style="margin-top:10px">
          Copy voucher dari list Available melalui Copy WA atau Copy Link.
        </div>`;

      currentPage=1;
      byId("voucher-filter").value="available";
      await loadVouchers();
    }catch(err){
      box.innerHTML=`<div class="error">${safeError(err)}</div>`;
    }
  };

  byId("gift-form").onsubmit=async(e)=>{
    e.preventDefault();

    const qty=Math.min(parseMoney(byId("qty").value),500);
    const value=parseMoney(byId("value").value);
    const camp=byId("campaign").value.trim();
    const exp=byId("expired").value;
    const box=byId("gift-result");

    box.innerHTML=`<div class="notice">Generating ${qty} voucher member baru...</div>`;

    try{
      const created=await rpc("s3_generate_gift_codes_batch",{
        p_staff_session_token:u.session_token,
        p_campaign_name:camp,
        p_value:value,
        p_expired_at:exp,
        p_qty:qty
      });
      const rows=created||[];

      box.innerHTML=`
        <div class="success">
          <b>${rows.length} Voucher Member Baru Generated ✅</b><br>
          Total Liability: ${money(rows.length*value)}
        </div>
        <div class="notice" style="margin-top:10px">
          Copy satu per satu dari list Available.
        </div>`;

      currentPage=1;
      byId("voucher-filter").value="available";
      await loadVouchers();
    }catch(err){
      box.innerHTML=`<div class="error">${safeError(err)}</div>`;
    }
  };

  renderSelectedGiftMember();
  await loadVouchers();
}
async function renderMembers(){
  const u=requireLogin(); if(!u)return; if(u.role!=="owner"){setHash("kasir");return;} mountLayout(); setNav("members");
  screen(`
    <section class="card">
      <h1>All Members</h1>
      <p>List simple semua member aktif. Owner bisa buka detail member untuk reset PIN atau delete member.</p>
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((m,i)=>`
              <tr>
                <td>${i+1}</td>
                <td class="name">${esc(m.name || "-")}</td>
                <td>${esc(m.phone || "-")}</td>
                <td>${esc(m.member_code || "-")}</td>
                <td><b>${money(m.balance || 0)}</b></td>
                <td>${m.status || "active"}</td>
                <td><button class="ghost" onclick="setHash('member',{phone:'${esc(m.phone)}'})">Open</button></td>
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
      lines.push(`${i+1}. ${esc(m.name || "-")} | ${esc(m.phone || "-")} | ${esc(m.member_code || "-")} | Saldo: ${money(m.balance || 0)} | Status: ${m.status || "active"}`);
    });
    return lines.join("\n");
  }

  async function loadMembers(){
    byId("member-list").innerHTML = `<div class="notice">Loading member...</div>`;
    try{
      members = await rpc("s3_list_members", {p_staff_session_token:u.session_token});
      members = members || [];
      renderMemberRows();
    }catch(err){
      byId("member-list").innerHTML = `<div class="error">${safeError(err)}</div>`;
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
      <tbody>${rows.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.name||"-")}</td><td>${esc(m.phone||"-")}</td><td>${esc(m.member_code||"-")}</td><td>${money(m.balance||0)}</td><td>${m.status||"active"}</td></tr>`).join("")}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  await loadMembers();
}

function requireCustomerSession(){
  const s=getCustomerSession();
  if(!s || !s.session_token){
    renderCustomerLogin();
    return false;
  }
  return s;
}

function renderCustomerLogin(){
  clearSession();
  const {params}=getRoute();
  const claimCode=String(params.claim||"").trim().toUpperCase();
  byId("app").innerHTML=`<main style="padding:16px;max-width:560px;margin:auto"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`
    <section class="card">
      ${brandMiniHtml()}
      <h1>Customer Portal</h1>
      <p>Login menggunakan nomor WhatsApp dan PIN untuk melihat saldo serta riwayat transaksi.</p>
      ${claimCode?`<div class="notice">Login untuk claim Gift Code <b>${esc(claimCode)}</b>.</div>`:""}
      <form id="customer-login-form">
        <label>Nomor WhatsApp</label>
        <input id="customer-phone" inputmode="numeric" placeholder="628xxxxxxxxxx" autocomplete="tel" required/>
        <label>PIN 6 Digit</label>
        <input id="customer-pin" type="password" inputmode="numeric" maxlength="6" placeholder="Masukkan PIN" required/>
        <button class="full" style="margin-top:14px">Login Customer</button>
      </form>
      <div id="customer-login-result" style="margin-top:12px"></div>
      <div class="divider"></div>
      <button class="ghost full" onclick="setHash('join')">Daftar Member Baru</button>
      
    </section>
  `;

  byId("customer-login-form").onsubmit = async(e)=>{
    e.preventDefault();
    const box=byId("customer-login-result");
    const phone=normalizePhone(byId("customer-phone").value);
    const pin=byId("customer-pin").value.trim();

    if(!/^[0-9]{6}$/.test(pin)){
      box.innerHTML=`<div class="error">PIN wajib 6 digit angka.</div>`;
      return;
    }

    box.innerHTML=`<div class="notice">Login customer...</div>`;
    try{
      const rows=await rpc("mvp_customer_login",{
        p_outlet_slug:OUTLET_SLUG,
        p_phone:phone,
        p_pin:pin
      });
      if(!rows||!rows.length) throw new Error("Login customer gagal.");
      const d=rows[0];
      if(d.login_success === false){
        box.innerHTML=`<div class="error">${d.error_message || "PIN salah."}</div>`;
        return;
      }
      saveCustomerSession(d);
      if(claimCode){
        setHash("claim-gift",{code:claimCode});
      }else{
        setHash("customer-portal");
      }
    }catch(err){
      box.innerHTML=`<div class="error">${safeError(err)}</div>`;
    }
  };
}

async function renderCustomerPortal(){
  const session=requireCustomerSession(); if(!session)return;
  clearSession();
  byId("app").innerHTML=`<main style="padding:16px;max-width:680px;margin:auto"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<section class="card">${brandMiniHtml()}<h1>Loading Customer Portal...</h1></section>`;

  try{
    const homeRows=await rpc("mvp_customer_home",{p_session_token:session.session_token});
    if(!homeRows||!homeRows.length) throw new Error("Session customer tidak valid. Silakan login ulang.");
    const c=homeRows[0];

    const historyRows=await rpc("mvp_customer_history",{p_session_token:session.session_token});
    const expiryRows=await rpc("mvp_customer_balance_expiry",{p_session_token:session.session_token});
    const expiryInfo=expiryRows&&expiryRows[0]?expiryRows[0]:{};

    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <div class="customer-home-header">
          <h1>Customer Portal</h1>
          <p>${esc(c.name || "Member")} • ${esc(c.phone || "")}</p>
        </div>
        <div class="kpi"><div class="label">Saldo Saat Ini</div><div class="value">${money(c.balance || 0)}</div></div>
        <div class="item"><div class="title">Member ID</div><div class="meta">${esc(c.member_code || "-")}</div></div>
        <div class="notice" style="margin-top:12px">Top up hanya bisa dilakukan di kasir CACAYO.</div>
        <button class="ghost full" style="margin-top:12px" id="customer-logout-btn">Logout</button>
      </section>

      <section class="card">
        <h2>Claim Gift Voucher</h2>
        <p>Masukkan Gift Code yang dikirim khusus untuk akun member kamu.</p>
        <div class="grid claim-gift-grid">
          <input id="portal-gift-code" class="code-box" placeholder="Masukkan Gift Code"/>
          <button id="portal-claim-gift-btn">Lanjut Claim</button>
        </div>
      </section>

      <section class="card">
        <h2>Masa Aktif Saldo</h2>
        <p>Seluruh saldo menggunakan satu tanggal expired. Top up baru akan memperpanjang masa aktif saldo.</p>
        ${singleBalanceExpiryHtml(expiryInfo)}
      </section>
      <section class="card">
        <h2>Riwayat Transaksi</h2>
        <p>Detail pembayaran seperti QRIS, tunai, kartu, atau sisa pembayaran tetap dicatat di POS, bukan di CTD.</p>
        ${historyListHtml(historyRows || [])}
      </section>
    `;

    byId("portal-claim-gift-btn").onclick=()=>{
      const code=byId("portal-gift-code").value.trim().toUpperCase();
      if(!code){
        alert("Masukkan Gift Code.");
        return;
      }
      setHash("claim-gift",{code});
    };

    byId("customer-logout-btn").onclick = async()=>{
      try{ await rpc("mvp_customer_logout",{p_session_token:session.session_token}); }catch(e){}
      clearCustomerSession();
      setHash("customer-login");
    };
  }catch(err){
    clearCustomerSession();
    target.innerHTML=`<section class="card">${brandMiniHtml()}<h1>Customer Portal</h1><div class="error">${safeError(err)}</div><button class="full" style="margin-top:12px" onclick="setHash('customer-login')">Login Ulang</button></section>`;
  }
}


async function renderClaimGift(){
  const {params}=getRoute();
  const code=String(params.code||"").trim().toUpperCase();
  const session=getCustomerSession();

  clearSession();
  byId("app").innerHTML=`<main style="padding:16px;max-width:600px;margin:auto"></main>`;
  const target=document.querySelector("main");

  if(!code){
    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <h1>Claim Gift Voucher</h1>
        <p>Masukkan Gift Code yang kamu terima dari CACAYO.</p>
        <input id="claim-page-code" class="code-box" placeholder="Gift Code"/>
        <button class="full" style="margin-top:12px" id="claim-page-continue">Lanjut</button>
      </section>`;

    byId("claim-page-continue").onclick=()=>{
      const input=byId("claim-page-code").value.trim().toUpperCase();
      if(!input){
        alert("Masukkan Gift Code.");
        return;
      }
      setHash("claim-gift",{code:input});
    };
    return;
  }

  if(!session||!session.session_token){
    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <h1>Kamu Mendapat Gift dari CACAYO 🎁</h1>
        <div class="gift-code-display">${esc(code)}</div>
        <p>Login dengan nomor WhatsApp dan PIN member untuk melihat dan claim gift.</p>
        <button class="full" onclick="setHash('customer-login',{claim:'${esc(code)}'})">Login untuk Claim</button>
        <button class="ghost full" style="margin-top:8px" onclick="setHash('customer-login')">Kembali</button>
      </section>`;
    return;
  }

  target.innerHTML=`
    <section class="card">
      ${brandMiniHtml()}
      <h1>Memeriksa Gift Voucher...</h1>
      <div class="notice">Mohon tunggu.</div>
    </section>`;

  try{
    const rows=await rpc("mvp_customer_preview_member_gift",{
      p_session_token:session.session_token,
      p_code:code
    });
    const gift=rows&&rows[0]?rows[0]:null;

    if(!gift){
      throw new Error("Gift Voucher tidak ditemukan.");
    }

    if(gift.claim_allowed===false){
      target.innerHTML=`
        <section class="card">
          ${brandMiniHtml()}
          <h1>Gift Voucher Tidak Bisa Diclaim</h1>
          <div class="error">${esc(gift.error_message||"Voucher tidak tersedia.")}</div>
          <button class="full" style="margin-top:12px" onclick="setHash('customer-portal')">Kembali ke Customer Portal</button>
        </section>`;
      return;
    }

    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <div class="gift-hero">
          <div class="gift-icon">🎁</div>
          <h1>${esc(gift.campaign_name||"Gift dari CACAYO")}</h1>
          <p>Gift khusus untuk akun <b>${esc(gift.member_name||"Member")}</b></p>
        </div>

        <div class="gift-value-card">
          <span>Gift Dining Credit</span>
          <strong>${money(gift.value||0)}</strong>
        </div>

        <div class="item">
          <div class="title">Gift Code</div>
          <div class="meta">${esc(gift.code||code)}</div>
        </div>
        <div class="item">
          <div class="title">Voucher berlaku sampai</div>
          <div class="meta">${dateID(gift.expired_at)}</div>
        </div>
        <div class="item">
          <div class="title">Saldo setelah claim</div>
          <div class="meta">${money(Number(gift.current_balance||0)+Number(gift.value||0))}</div>
        </div>
        <div class="item">
          <div class="title">Masa aktif total saldo setelah claim</div>
          <div class="meta">${dateID(gift.result_expiry)}</div>
        </div>

        <div class="notice">
          Gift hanya bisa diclaim 1x dan hanya oleh akun member yang dituju.
        </div>

        <button class="full" style="margin-top:14px" id="claim-gift-confirm-btn">
          Claim ${money(gift.value||0)}
        </button>
        <div id="claim-gift-result" style="margin-top:12px"></div>
      </section>`;

    byId("claim-gift-confirm-btn").onclick=async()=>{
      const button=byId("claim-gift-confirm-btn");
      const box=byId("claim-gift-result");
      button.disabled=true;
      button.textContent="CLAIMING...";
      box.innerHTML=`<div class="notice">Menambahkan gift ke saldo...</div>`;

      try{
        const claimRows=await rpc("mvp_customer_claim_member_gift",{
          p_session_token:session.session_token,
          p_code:code
        });
        const result=claimRows&&claimRows[0]?claimRows[0]:{};

        if(result.claim_success===false){
          box.innerHTML=`<div class="error">${esc(result.error_message||"Gift gagal diclaim.")}</div>`;
          button.disabled=false;
          button.textContent=`Claim ${money(gift.value||0)}`;
          return;
        }

        target.innerHTML=`
          <section class="card">
            ${brandMiniHtml()}
            <div class="customer-home-header">
              <div class="check">✓</div>
              <h1>Gift Berhasil Diclaim</h1>
              <p>${esc(result.campaign_name||"Gift dari CACAYO")}</p>
            </div>

            <div class="gift-value-card success-gift">
              <span>Saldo Ditambahkan</span>
              <strong>${money(result.gift_value||0)}</strong>
            </div>

            <div class="kpi">
              <div class="label">Total Saldo Sekarang</div>
              <div class="value">${money(result.new_balance||0)}</div>
            </div>

            <div class="success" style="margin-top:12px">
              Seluruh saldo berlaku sampai <b>${dateID(result.new_expiry)}</b>.
            </div>

            <button class="full" style="margin-top:14px" onclick="setHash('customer-portal')">
              Kembali ke Customer Portal
            </button>
          </section>`;
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
        button.disabled=false;
        button.textContent=`Claim ${money(gift.value||0)}`;
      }
    };
  }catch(err){
    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <h1>Claim Gift Voucher</h1>
        <div class="error">${safeError(err)}</div>
        <button class="full" style="margin-top:12px" onclick="setHash('customer-portal')">Kembali</button>
      </section>`;
  }
}


async function renderReport(){
  const u=requireLogin(); if(!u)return; mountLayout(); setNav("report"); screen(`<section class="card"><h1>Loading report...</h1></section>`); try{ const rows=await rpc("s3_recent_transactions",{p_staff_session_token:u.session_token}); screen(`<section class="card"><h1>Transaction Report</h1><div class="list">${rows&&rows.length?rows.map(t=>`<div class="item"><div class="title">${esc(t.type)} • ${money(t.balance_used||t.credit_issued||0)}</div><div class="meta">${esc(t.member_name||"-")} • ${esc(t.member_phone||"-")} • ${new Date(t.created_at).toLocaleString("id-ID")}</div><div class="meta">Status: ${esc(t.status)}</div></div>`).join(""):`<p>Belum ada transaksi.</p>`}</div></section>`); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`); }
}

async function renderResetPin(){
  const {params}=getRoute();
  const token=params.token;
  byId("app").innerHTML=`<main style="padding:16px;max-width:560px;margin:auto"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<section class="card"><h1>Loading reset PIN...</h1></section>`;

  try{
    if(!token) throw new Error("Reset token tidak ditemukan.");
    const rows=await rpc("mvp_get_pin_reset_request",{p_token:token});
    if(!rows||!rows.length) throw new Error("Reset PIN request tidak ditemukan.");
    const p=rows[0];

    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <h1>Buat PIN Baru</h1>
        <p>${OUTLET_FULL}</p>
        <div class="notice">
          Member: <b>${esc(p.member_name)}</b><br>
          HP: <b>${esc(p.member_phone)}</b><br>
          PIN wajib 6 digit angka. <b>MOHON PIN DI INGAT / DI SCREENSHOT.</b>
        </div>
        <form id="reset-pin-form">
          <label>PIN Baru 6 Digit</label>
          <input id="new-pin" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="Contoh: 123456" required/>
          <div class="search-hint"><b>PIN akan tampil jelas.</b> Mohon screenshot sebelum submit.</div>
          <button class="full" style="margin-top:14px">Simpan PIN Baru</button>
        </form>
        <div id="reset-pin-result" style="margin-top:12px"></div>
      </section>
    `;

    if(p.status !== "waiting"){
      byId("reset-pin-form").style.display = "none";
      byId("reset-pin-result").innerHTML = `<div class="notice">Reset PIN status: ${p.status}. Link ini sudah tidak aktif.</div>`;
      return;
    }

    byId("reset-pin-form").onsubmit = async(e)=>{
      e.preventDefault();
      const box=byId("reset-pin-result");
      const pin=byId("new-pin").value.trim();
      if(!/^[0-9]{6}$/.test(pin)){
        box.innerHTML=`<div class="error">PIN baru wajib 6 digit angka.</div>`;
        return;
      }
      box.innerHTML=`<div class="notice">Menyimpan PIN baru...</div>`;
      try{
        await rpc("mvp_complete_pin_reset",{
          p_token:token,
          p_new_pin:pin
        });
        const homeLink = `#customer-reset-home?token=${token}`;
        target.innerHTML=`
          <section class="card">
            ${brandMiniHtml()}
            <div class="customer-home-header">
              <div class="check">✓</div>
              <h1>PIN Baru Berhasil Disimpan</h1>
              <p>Gunakan PIN ini untuk approval transaksi saldo berikutnya.</p>
            </div>
            <div class="pin-confirm-box">
              <div class="label">PIN Baru Kamu</div>
              <div class="pin-number">${pin}</div>
              <div class="success"><b>MOHON PIN DI INGAT / DI SCREENSHOT.</b></div>
            </div>
            <button class="full" style="margin-top:14px" onclick="location.hash='${homeLink}'">Kembali ke Home Customer</button>
          </section>
        `;
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
      }
    };
  }catch(err){
    target.innerHTML=`<section class="card">${brandMiniHtml()}<h1>Error</h1><div class="error">${safeError(err)}</div></section>`;
  }
}

async function renderCustomerResetHome(){
  const {params}=getRoute();
  const token=params.token;
  byId("app").innerHTML=`<main style="padding:16px;max-width:560px;margin:auto"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<section class="card">${brandMiniHtml()}<h1>Loading Home Customer...</h1></section>`;

  try{
    if(!token) throw new Error("Customer token tidak ditemukan.");
    const rows=await rpc("mvp_get_pin_reset_request",{p_token:token});
    if(!rows||!rows.length) throw new Error("Customer home tidak ditemukan.");
    const p=rows[0];

    target.innerHTML=`
      <section class="card">
        ${brandMiniHtml()}
        <div class="customer-home-header">
          <div class="check">✓</div>
          <h1>Home Customer</h1>
          <p>${OUTLET_FULL}</p>
        </div>
        <div class="kpi">
          <div class="label">${esc(p.member_name || "-")}</div>
          <div class="value">${money(p.balance || 0)}</div>
        </div>
        <div class="item"><div class="title">No HP</div><div class="meta">${esc(p.member_phone || "-")}</div></div>
        <div class="item"><div class="title">Member ID</div><div class="meta">${esc(p.member_code || "-")}</div></div>
        <div class="success" style="margin-top:12px">PIN sudah berhasil di-update. Gunakan PIN baru untuk approve transaksi saldo berikutnya.</div>
      </section>
      ${customerTopupInfoHtml()}
    `;
  }catch(err){
    target.innerHTML=`<section class="card">${brandMiniHtml()}<h1>Error</h1><div class="error">${safeError(err)}</div></section>`;
  }
}

function route(){
  const {name}=getRoute();
  const staffRoutes=new Set(["login","owner","members","gift-generate","report","kasir","member","register","join","topup","use-balance","waiting","success"]);
  const customerRoutes=new Set(["customer-login","customer-portal","register","join","claim-gift","approve","customer-home","reset-pin","customer-reset-home"]);
  if(PORTAL_MODE==="staff" && !staffRoutes.has(name)){ setHash("login"); return; }
  if(PORTAL_MODE==="customer" && !customerRoutes.has(name)){ setHash("customer-login"); return; }
  if(name==="login")return renderLogin();
  if(name==="customer-login")return renderCustomerLogin();
  if(name==="customer-portal")return renderCustomerPortal();
  if(name==="claim-gift")return renderClaimGift();
  if(name==="kasir")return renderKasir();
  if(name==="member")return renderMember();
  if(name==="register"||name==="join")return renderJoin();
  if(name==="topup")return renderTopup();
  if(name==="use-balance")return renderUseBalance();
  if(name==="waiting")return renderWaiting();
  if(name==="approve")return renderApprove();
  if(name==="customer-home")return renderCustomerHome();
  if(name==="customer-reset-home")return renderCustomerResetHome();
  if(name==="reset-pin")return renderResetPin();
  if(name==="success")return renderSuccess();
  if(name==="owner")return renderOwner();
  if(name==="members")return renderMembers();
  if(name==="gift-generate")return renderGiftGenerate();
  if(name==="report")return renderReport();
  setHash(PORTAL_MODE==="staff"?"login":"customer-login");
}

function showFatalPortalError(err){
  const target = document.getElementById("app");
  if(!target) return;
  const message = safeError(err || "Portal gagal dimuat.");
  target.innerHTML = `
    <main style="padding:20px;max-width:560px;margin:40px auto">
      <section class="card">
        ${brandMiniHtml()}
        <h1>Staff Portal Gagal Dimuat</h1>
        <div class="error">${message}</div>
        <p>Silakan refresh halaman. Jika masih muncul, pastikan deployment sudah menggunakan v${APP_VERSION}.</p>
        <button class="full" onclick="location.reload()">Refresh Halaman</button>
      </section>
    </main>`;
}

window.addEventListener("hashchange", ()=>{
  try{ route(); }
  catch(err){ showFatalPortalError(err); }
});

window.addEventListener("load", ()=>{
  try{
    route();
    window.__CTD_BOOT_OK = true;
  }catch(err){
    window.__CTD_BOOT_OK = false;
    showFatalPortalError(err);
  }
});


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
