/* White-label Member Dining System */
const APP_VERSION = "4.1.0";
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
function goPortalLogin(){
  setHash(PORTAL_MODE==="staff" ? "login" : "customer-login");
}
function brandMiniHtml(){
  const label=PORTAL_MODE==="staff"
    ? "Kembali ke login staff"
    : "Kembali ke login customer";
  return `<button type="button" class="brand-button" onclick="goPortalLogin()" aria-label="${label}">
    <img src="./cacayo-logo.jpg" alt="${OUTLET} logo" class="brand-logo-large"/>
  </button>`;
}
function staffHomeRoute(){
  const u=currentUser();
  return u&&u.role==="owner" ? "owner" : "kasir";
}
function staffPageHeader(title,backRoute=staffHomeRoute(),subtitle=""){
  return `<div class="page-heading">
    <button class="back-button" type="button" onclick="setHash('${backRoute}')" aria-label="Kembali">←</button>
    <div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:""}</div>
  </div>`;
}
function touchIcon(name){
  const icons={transaction:"▣",history:"◷",members:"♙",promo:"▧",voucher:"◇",summary:"▤",use:"▱",topup:"⊕",item:"▦",search:"⌕"};
  return icons[name]||"•";
}
function brandLine(){ return OUTLET_FULL; }
function randomCode(len=8){ let c=""; for(let i=0;i<len;i++) c += SAFE_ALPHABET[Math.floor(Math.random()*SAFE_ALPHABET.length)]; return c; }
function memberSeq(){ return "MBR-" + Date.now().toString().slice(-6); }
function publicBaseUrl(){ return `${location.origin}/?v=${APP_VERSION}`; }
function qrImageUrl(data, size=260){ if(!window.CTDQR) throw new Error("Local QR engine not loaded"); return window.CTDQR.toDataURL(String(data), size); }
function normalizePhone(phone){
  const raw=String(phone||"").trim().replace(/[^0-9]/g,"");
  return raw.startsWith("0") ? "62"+raw.slice(1) : raw;
}
function localPhoneKey(value){
  let digits=String(value||"").replace(/[^0-9]/g,"");
  if(digits.startsWith("62"))digits=digits.slice(2);
  else if(digits.startsWith("0"))digits=digits.slice(1);
  return digits;
}
function memberMatchesSearch(member,query){
  const text=String(query||"").trim().toLowerCase();
  if(!text)return true;

  const name=String(member?.name||"").toLowerCase();
  const memberCode=String(member?.member_code||"").toLowerCase();

  if(name.includes(text)||memberCode.includes(text))return true;

  const queryPhone=localPhoneKey(text);
  const memberPhone=localPhoneKey(member?.phone||"");

  return queryPhone.length>=2 && memberPhone.includes(queryPhone);
}

function giftItemCountdown(days){
  const n=Number(days);
  if(!Number.isFinite(n))return "";
  if(n<0)return "Expired";
  if(n===0)return "Hari terakhir";
  if(n===1)return "1 hari lagi";
  return `${n} hari lagi`;
}
function giftItemStatusLabel(status){
  const s=String(status||"").toLowerCase();
  if(s==="available")return "Tersedia";
  if(s==="redeemed")return "Sudah digunakan";
  if(s==="expired")return "Expired";
  return s.toUpperCase();
}
function customerGiftItemCardsHtml(rows){
  const items=rows||[];
  if(!items.length)return `<div class="empty-state">Belum ada Gift Item.</div>`;
  return `<div class="customer-gift-item-grid">${items.map(item=>`
    <article class="customer-gift-item-card ${esc(item.status||"")}">
      <div class="gift-item-image-wrap">
        ${item.image_data_url
          ? `<img src="${item.image_data_url}" alt="${esc(item.item_name||"Gift Item")}"/>`
          : `<div class="gift-item-image-placeholder">${touchIcon("item")}</div>`}
        <span class="gift-item-status">${esc(giftItemStatusLabel(item.status))}</span>
      </div>
      <div class="gift-item-card-body">
        <h3>${esc(item.item_name||"Gift Item")}</h3>
        ${item.item_description?`<p>${esc(item.item_description)}</p>`:""}
        <div class="gift-item-expiry">
          <b>Gunakan sebelum ${dateID(item.expires_at)}</b>
          <span>${esc(giftItemCountdown(item.days_remaining))}</span>
        </div>
      </div>
    </article>`).join("")}</div>`;
}
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
  byId("app").innerHTML=byId("layout-template").innerHTML;
  const u=currentUser();
  const outletName=byId("outlet-name");
  if(outletName){
    outletName.textContent=u ? `${u.name||"Staff"} • ${String(u.role||"").toUpperCase()}` : OUTLET;
  }
  const brandHome=byId("brand-home-link");
  if(brandHome){
    brandHome.onclick=goPortalLogin;
    brandHome.onkeydown=(event)=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        goPortalLogin();
      }
    };
  }
  byId("logout-btn").onclick=async()=>{
    const user=currentUser();
    try{
      if(user?.session_token){
        await rpc("s3_staff_logout",{p_staff_session_token:user.session_token});
      }
    }catch(e){}
    clearSession();
    setHash("login");
  };
}
function screen(html){ byId("screen").innerHTML=html; }
function setNav(){
  const nav=byId("bottom-nav");
  if(nav){nav.innerHTML="";nav.style.display="none";}
}
function staffHomeHtml(user){
  const ownerTools=user.role==="owner" ? `
    <div class="secondary-tools">
      <button class="secondary-tool" onclick="setHash('gift-generate')"><span>${touchIcon('voucher')}</span><b>Voucher & Gift Item</b></button>
      <button class="secondary-tool" onclick="setHash('owner-summary')"><span>${touchIcon('summary')}</span><b>Ringkasan</b></button>
    </div>` : "";
  return `
    <section class="staff-home-shell">
      <div class="staff-logo-stage">
        <img src="./cacayo-logo.jpg" alt="${OUTLET} logo" class="staff-home-logo"/>
      </div>
      <div class="touch-menu three">
        <button class="touch-menu-card primary" onclick="setHash('transaction')">
          <span class="touch-menu-icon">${touchIcon('transaction')}</span>
          <b>Transaksi</b><small>Saldo / Top Up / Gift Item</small>
        </button>
        <button class="touch-menu-card" onclick="setHash('report')">
          <span class="touch-menu-icon">${touchIcon('history')}</span>
          <b>History Transaksi</b><small>Report per hari</small>
        </button>
        <button class="touch-menu-card" onclick="setHash('members')">
          <span class="touch-menu-icon">${touchIcon('members')}</span>
          <b>Daftar Member</b><small>Cari & lihat history</small>
        </button>
      </div>
      <button class="promo-shortcut" onclick="setHash('promo-manage')">
        <span>${touchIcon('promo')}</span><span><b>Kelola Promo Customer</b><small>Upload gambar yang tampil setelah transaksi</small></span><span>→</span>
      </button>
      ${ownerTools}
    </section>`;
}

function renderLogin(){
  if(PORTAL_MODE!=="staff"){setHash("customer-login");return;}
  byId("app").innerHTML=`<div class="login-wrap white-label-login"><section class="login-card clean-login">
    ${brandMiniHtml()}
    <h1>Staff Login</h1>
    <p>Masuk untuk mengelola transaksi dan member.</p>
    <form id="login-form">
      <label>Username</label><input id="username" autocomplete="username" placeholder="Username"/>
      <label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="Password"/>
      <button class="full touch-button" style="margin-top:16px">Login</button>
    </form>
    <div id="login-result" style="margin-top:12px"></div>
  </section></div>`;
  byId("login-form").onsubmit=async(event)=>{
    event.preventDefault();
    const box=byId("login-result");
    box.innerHTML=`<div class="notice">Memeriksa akun...</div>`;
    try{
      const rows=await rpc("s3_staff_login",{
        p_username:byId("username").value.trim(),
        p_password:byId("password").value
      });
      if(!rows||!rows.length)throw new Error("Login salah.");
      const data=rows[0];
      if(data.login_success===false)throw new Error(data.error_message||"Login salah.");
      saveSession(data);
      setHash(data.role==="owner"?"owner":"kasir");
    }catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;}
  };
}

async function renderKasir(){
  const user=requireLogin();if(!user)return;
  mountLayout();setNav();
  screen(staffHomeHtml(user));
}

async function renderTransaction(){
  const user=requireLogin();if(!user)return;
  mountLayout();setNav();
  screen(`
    <section class="tablet-page">
      ${staffPageHeader("Transaksi",staffHomeRoute(),"Pilih jenis transaksi lalu cari member")}
      <div class="transaction-choice three">
        <button class="transaction-choice-card active" data-action="use">
          <span>${touchIcon('use')}</span><b>Gunakan Saldo</b>
        </button>
        <button class="transaction-choice-card" data-action="topup">
          <span>${touchIcon('topup')}</span><b>Top Up</b>
        </button>
        <button class="transaction-choice-card" data-action="item">
          <span>${touchIcon('item')}</span><b>Gunakan Gift Item</b>
        </button>
      </div>
      <section class="surface-card member-picker-card">
        <label>Cari Member</label>
        <div class="search-box-large"><span>${touchIcon('search')}</span><input id="transaction-member-search" placeholder="Nama atau nomor WhatsApp" autocomplete="off"/></div>
        <div id="transaction-member-results" class="member-touch-list"><div class="empty-state">Ketik minimal 2 karakter nama atau nomor WhatsApp.</div></div>
      </section>
    </section>`);
  let selectedAction="use";
  let timer=null;
  document.querySelectorAll(".transaction-choice-card").forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll(".transaction-choice-card").forEach(item=>item.classList.remove("active"));
      button.classList.add("active");
      selectedAction=button.dataset.action||"use";
      byId("transaction-member-search").focus();
      if(byId("transaction-member-search").value.trim().length>=2)search();
    };
  });
  const input=byId("transaction-member-search");
  const results=byId("transaction-member-results");
  async function search(){
    const query=input.value.trim();
    if(query.length<2){
      results.innerHTML=`<div class="empty-state">Ketik minimal 2 karakter nama atau nomor WhatsApp.</div>`;
      return;
    }
    results.innerHTML=`<div class="empty-state">Mencari member...</div>`;
    try{
      const rows=await rpc("s3_search_members",{p_staff_session_token:user.session_token,p_query:query});
      if(!rows||!rows.length){
        const digits=String(query||"").replace(/[^0-9]/g,"");
        const phoneButton=digits.length>=8
          ? `<button class="ghost full" onclick="setHash('join',{phone:'${esc(normalizePhone(digits))}'})">+ Daftar Nomor Ini</button>`
          : `<button class="ghost full" onclick="setHash('join')">+ Daftar Member Baru</button>`;

        results.innerHTML=`
          <div class="empty-state">
            Member tidak ditemukan.
            ${phoneButton}
          </div>`;
        return;
      }
      results.innerHTML=rows.map(member=>`
        <button class="member-touch-row" type="button" onclick="setHash('${selectedAction==='topup'?'topup':selectedAction==='item'?'member':'use-balance'}',{phone:'${esc(member.phone)}',action:'${selectedAction}'})">
          <span class="member-avatar">${esc(String(member.name||'?').charAt(0).toUpperCase())}</span>
          <span class="member-touch-main"><b>${esc(member.name)}</b><small>${esc(member.phone)} • ${String(member.status||'active').toUpperCase()}</small></span>
          <span class="member-touch-balance"><small>Saldo</small><b>${money(member.balance)}</b></span><span class="chevron">›</span>
        </button>`).join("");
    }catch(err){results.innerHTML=`<div class="error">${safeError(err)}</div>`;}
  }
  input.oninput=()=>{clearTimeout(timer);timer=setTimeout(search,300);};
  input.focus();
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
      : t.type === "topup"
        ? "Top Up di Kasir"
        : t.type === "gift_claim"
          ? "Voucher / Gift Saldo"
          : t.type === "gift_item_claim"
            ? "Gift Item Diterima"
            : t.type === "gift_item_redeem"
              ? "Gift Item Digunakan"
              : "Transaksi";
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
    let giftItemRows = [];
    let giftItemError = "";
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
    try{
      giftItemRows = await rpc("s4_staff_member_gift_items", {
        p_staff_session_token:u.session_token,
        p_member_id:m.member_id
      });
      giftItemRows = giftItemRows || [];
    }catch(e){
      giftItemError = e.message;
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
        <p>Archive member hanya untuk owner dan hanya bisa jika saldo Rp0. History tetap tersimpan.</p>
        <button class="danger full" id="delete-member-btn">Archive Member</button>
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
        <div class="grid three member-action-grid" style="margin-top:12px">
          <button onclick="setHash('topup',{phone:'${esc(m.phone)}'})">Top Up Saldo</button>
          <button class="secondary" onclick="setHash('use-balance',{phone:'${esc(m.phone)}'})">Gunakan Saldo</button>
          <button class="ghost" onclick="document.getElementById('member-gift-items-card')?.scrollIntoView({behavior:'smooth'})">Gift Item</button>
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

      <section class="card" id="member-gift-items-card">
        <h2>Gift Item Member</h2>
        <p>Pilih item yang akan digunakan. Customer harus scan QR dan approve menggunakan PIN.</p>
        ${giftItemError
          ? `<div class="error">${esc(giftItemError)}</div>`
          : giftItemRows.length
            ? `<div class="staff-gift-item-grid">${giftItemRows.map(item=>`
                <article class="staff-gift-item-card ${esc(item.status||"")}">
                  <div class="staff-gift-item-image">
                    ${item.image_data_url
                      ? `<img src="${item.image_data_url}" alt="${esc(item.item_name||"Gift Item")}"/>`
                      : `<div class="gift-item-image-placeholder">${touchIcon("item")}</div>`}
                  </div>
                  <div class="staff-gift-item-info">
                    <h3>${esc(item.item_name||"Gift Item")}</h3>
                    ${item.item_description?`<p>${esc(item.item_description)}</p>`:""}
                    <small>ED ${dateID(item.expires_at)} • ${esc(giftItemCountdown(item.days_remaining))}</small>
                    <span class="badge ${item.status==="available"?"ok":""}">${esc(giftItemStatusLabel(item.status))}</span>
                    ${item.status==="available"&&!isBlocked
                      ? `<button class="full touch-button" onclick="window.startGiftItemRedemption('${item.member_gift_item_id}')">Gunakan Item</button>`
                      : ""}
                  </div>
                </article>`).join("")}</div>`
            : `<div class="empty-state">Member belum memiliki Gift Item.</div>`}
        <div id="gift-item-redemption-result" style="margin-top:12px"></div>
      </section>

      <section class="card">
        <h2>Riwayat Transaksi Customer</h2>
        <p>Kasir dan owner bisa melihat history saldo customer. Detail pembayaran POS tidak dicatat di sistem ini.</p>
        ${historyError ? `<div class="error">${historyError}</div>` : historyListHtml(historyRows)}
      </section>
      ${resetControls}
      ${ownerDelete}
    `);

    window.startGiftItemRedemption=async(memberGiftItemId)=>{
      const box=byId("gift-item-redemption-result");
      box.innerHTML=`<div class="notice">Membuat approval Gift Item...</div>`;
      try{
        const rows=await rpc("s4_create_item_redemption",{
          p_staff_session_token:u.session_token,
          p_member_gift_item_id:memberGiftItemId
        });
        const result=rows&&rows[0]?rows[0]:{};
        const link=`${publicBaseUrl()}#approve-item?token=${result.token}`;
        box.innerHTML=`
          <div class="success"><b>Approval Gift Item Siap ✅</b><br>${esc(result.item_name||"Gift Item")}<br>Customer scan QR dan masukkan PIN.</div>
          <div class="qr-wrap">
            <img class="qr-img" src="${qrImageUrl(link)}" alt="QR Gift Item"/>
            <div class="meta">Link berlaku 15 menit.</div>
          </div>
          <textarea class="copy-area" readonly>${link}</textarea>
          <button class="secondary full" onclick="navigator.clipboard.writeText('${link}').then(()=>alert('Link copied'))">Copy Approval Link</button>`;
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
      }
    };

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

    if(params.action==="item"){
      setTimeout(()=>document.getElementById("member-gift-items-card")?.scrollIntoView({behavior:"smooth",block:"start"}),120);
    }

    if(u.role === "owner"){
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
  const {params}=getRoute();const token=params.token;
  byId("app").innerHTML=`<main class="customer-shell"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<div class="empty-state">Memuat transaksi...</div>`;
  try{
    const rows=await rpc("mvp_get_approval",{p_token:token});
    if(!rows||!rows.length)throw new Error("Transaksi tidak ditemukan.");
    const request=rows[0];
    let pin="";
    target.innerHTML=`
      <section class="customer-confirm-card">
        ${brandMiniHtml()}
        <button class="back-button customer-back" onclick="setHash('customer-login')">←</button>
        <h1>Gunakan Saldo</h1><div class="confirm-amount">${money(request.balance_used)}</div>
        <p>Masukkan PIN Anda</p>
        <div class="pin-dots" id="pin-dots">${Array.from({length:6},()=>'<i></i>').join('')}</div>
        <div class="numeric-keypad" aria-label="Keypad PIN">
          ${[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" data-pin="${n}" aria-label="Angka ${n}">${n}</button>`).join('')}
          <button type="button" class="key-clear" aria-label="Hapus seluruh PIN">C</button>
          <button type="button" data-pin="0" aria-label="Angka 0">0</button>
          <button type="button" class="key-back" aria-label="Hapus satu angka">⌫</button>
        </div>
        <button class="full touch-button" id="approve-pin-button" disabled>Approve</button>
        <button class="text-button" id="rejectBtn">Tolak Transaksi</button>
        <div id="approve-result"></div>
      </section>`;
    const dots=()=>document.querySelectorAll("#pin-dots i").forEach((dot,index)=>dot.classList.toggle("filled",index<pin.length));
    document.querySelectorAll("[data-pin]").forEach(button=>button.onclick=()=>{if(pin.length<6){pin+=button.dataset.pin;dots();byId("approve-pin-button").disabled=pin.length!==6;}});
    document.querySelector(".key-clear").onclick=()=>{pin="";dots();byId("approve-pin-button").disabled=true;};
    document.querySelector(".key-back").onclick=()=>{pin=pin.slice(0,-1);dots();byId("approve-pin-button").disabled=pin.length!==6;};
    byId("rejectBtn").onclick=async()=>{try{await rpc("mvp_reject_approval",{p_token:token});byId("approve-result").innerHTML=`<div class="error">Transaksi ditolak.</div>`;}catch(err){byId("approve-result").innerHTML=`<div class="error">${safeError(err)}</div>`;}};
    byId("approve-pin-button").onclick=async()=>{
      const box=byId("approve-result");box.innerHTML=`<div class="notice">Memproses...</div>`;byId("approve-pin-button").disabled=true;
      try{
        const approvalRows=await rpc("mvp_approve_balance_use",{p_token:token,p_password:pin});
        const result=approvalRows&&approvalRows[0]?approvalRows[0]:{};
        if(result.approval_success===false){box.innerHTML=`<div class="error">${esc(result.error_message||'PIN salah.')}</div>`;pin="";dots();return;}
        target.innerHTML=`<section class="customer-confirm-card success-transition">${brandMiniHtml()}<div class="success-check">✓</div><h1>Transaksi Berhasil</h1><div class="confirm-amount">${money(request.balance_used)}</div><p>Sisa saldo ${money(result.balance_after??request.balance_after??0)}</p></section>`;
        setTimeout(()=>setHash("promo",{token}),900);
      }catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;pin="";dots();}
    };
  }catch(err){target.innerHTML=`<section class="customer-login-card">${brandMiniHtml()}<div class="error">${safeError(err)}</div></section>`;}
}


async function renderApproveItem(){
  const {params}=getRoute();
  const token=params.token;
  byId("app").innerHTML=`<main class="customer-shell"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<div class="empty-state">Memuat Gift Item...</div>`;

  try{
    const rows=await rpc("mvp_get_item_redemption",{p_token:token});
    if(!rows||!rows.length)throw new Error("Approval Gift Item tidak ditemukan.");
    const request=rows[0];
    if(request.request_status!=="waiting")throw new Error(`Approval sudah ${request.request_status}.`);
    let pin="";

    target.innerHTML=`<section class="customer-confirm-card">
      ${brandMiniHtml()}
      <h1>Gunakan Gift Item</h1>
      <div class="reward-item-preview compact">
        ${request.item_image_data_url?`<img src="${request.item_image_data_url}" alt="${esc(request.item_name||"Gift Item")}"/>`:""}
        <h2>${esc(request.item_name||"Gift Item")}</h2>
        <p>${esc(request.item_description||"")}</p>
        <div class="gift-item-expiry"><b>ED ${dateID(request.item_expires_at)}</b><span>${esc(giftItemCountdown(request.days_remaining))}</span></div>
      </div>
      <p>Masukkan PIN Anda</p>
      <div class="pin-dots" id="item-pin-dots">${Array.from({length:6},()=>'<i></i>').join('')}</div>
      <div class="numeric-keypad" aria-label="Keypad PIN">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" data-item-pin="${n}">${n}</button>`).join('')}
        <button type="button" class="item-key-clear">C</button>
        <button type="button" data-item-pin="0">0</button>
        <button type="button" class="item-key-back">⌫</button>
      </div>
      <button class="full touch-button" id="approve-item-button" disabled>Gunakan Item</button>
      <button class="text-button" id="reject-item-button">Batalkan</button>
      <div id="approve-item-result"></div>
    </section>`;

    const dots=()=>document.querySelectorAll("#item-pin-dots i").forEach((dot,index)=>dot.classList.toggle("filled",index<pin.length));
    document.querySelectorAll("[data-item-pin]").forEach(button=>button.onclick=()=>{
      if(pin.length<6){
        pin+=button.dataset.itemPin;
        dots();
        byId("approve-item-button").disabled=pin.length!==6;
      }
    });
    document.querySelector(".item-key-clear").onclick=()=>{pin="";dots();byId("approve-item-button").disabled=true;};
    document.querySelector(".item-key-back").onclick=()=>{pin=pin.slice(0,-1);dots();byId("approve-item-button").disabled=pin.length!==6;};
    byId("reject-item-button").onclick=async()=>{
      try{
        await rpc("mvp_reject_item_redemption",{p_token:token});
        byId("approve-item-result").innerHTML=`<div class="error">Penggunaan item dibatalkan.</div>`;
      }catch(err){byId("approve-item-result").innerHTML=`<div class="error">${safeError(err)}</div>`;}
    };
    byId("approve-item-button").onclick=async()=>{
      const box=byId("approve-item-result");
      const approveButton=byId("approve-item-button");
      approveButton.disabled=true;
      box.innerHTML=`<div class="notice">Memproses...</div>`;
      try{
        const resultRows=await rpc("mvp_approve_item_redemption",{
          p_token:token,
          p_password:pin
        });
        const result=resultRows&&resultRows[0]?resultRows[0]:{};
        if(result.approval_success===false){
          box.innerHTML=`<div class="error">${esc(result.error_message||"PIN salah.")}</div>`;
          pin="";
          dots();
          return;
        }
        target.innerHTML=`<section class="customer-confirm-card success-transition">${brandMiniHtml()}<div class="success-check">✓</div><h1>Gift Item Berhasil Digunakan</h1><h2>${esc(request.item_name||"Gift Item")}</h2></section>`;
        setTimeout(()=>setHash("promo",{token,kind:"item"}),900);
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
        pin="";
        dots();
      }
    };
  }catch(err){
    target.innerHTML=`<section class="customer-login-card">${brandMiniHtml()}<div class="error">${safeError(err)}</div></section>`;
  }
}

async function renderSuccess(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); try{ const rows=await rpc("mvp_get_approval",{p_token:params.token}); const p=rows&&rows[0]; if(!p) throw new Error("Approval not found"); screen(`<section class="card"><h1>Saldo Berhasil Dipakai ✅</h1><div class="item"><div class="title">Member</div><div class="meta">${esc(p.member_name)} • ${esc(p.member_phone)}</div></div><div class="item"><div class="title">Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div><div class="item"><div class="title">Saldo Sisa</div><div class="meta">${money(p.balance_after)}</div></div><div class="notice">Kasir tetap validasi manual di POS: masukkan payment Voucher/Member Dining sebesar ${money(p.balance_used)}. Sisa bill, kalau ada, dibayar QRIS/Cash/Card di POS.</div><button class="full" style="margin-top:12px" onclick="setHash('kasir')">Transaksi Baru</button></section>`); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${safeError(err)}</div></section>`); }
}

async function renderOwner(){
  const user=requireLogin();if(!user)return;
  if(user.role!=="owner"){setHash("kasir");return;}
  mountLayout();setNav();
  screen(staffHomeHtml(user));
}

async function renderOwnerSummary(){
  const user=requireLogin();if(!user)return;
  if(user.role!=="owner"){setHash("kasir");return;}
  mountLayout();setNav();
  screen(`<section class="tablet-page">${staffPageHeader("Ringkasan",staffHomeRoute())}<div id="dashboard-summary" class="dashboard-grid"><div class="dashboard-card"><div class="label">Members</div><div class="value">-</div></div><div class="dashboard-card"><div class="label">Total Saldo</div><div class="value">-</div></div><div class="dashboard-card"><div class="label">Voucher Available</div><div class="value">-</div></div><div class="dashboard-card"><div class="label">Voucher / Gift Terpakai</div><div class="value">-</div></div></div></section>`);
  try{
    const rows=await rpc("s3_owner_dashboard_summary",{p_staff_session_token:user.session_token});
    const data=rows&&rows[0]?rows[0]:{};
    byId("dashboard-summary").innerHTML=`
      <div class="dashboard-card"><div class="label">Total Member</div><div class="value">${data.total_members||0}</div></div>
      <div class="dashboard-card"><div class="label">Total Saldo</div><div class="value">${money(data.total_wallet_balance||0)}</div></div>
      <div class="dashboard-card"><div class="label">Voucher Available</div><div class="value">${data.available_vouchers||0}</div></div>
      <div class="dashboard-card"><div class="label">Terdaftar / Claimed</div><div class="value">${Number(data.registered_vouchers||0)+Number(data.claimed_vouchers||0)}</div></div>`;
  }catch(err){byId("dashboard-summary").innerHTML=`<div class="error">${safeError(err)}</div>`;}
}

async function renderGiftGenerate(){
  const user=requireLogin();
  if(!user)return;
  if(user.role!=="owner"){setHash("kasir");return;}

  mountLayout();
  setNav("gift");

  const defaultExpiry=new Date(Date.now()+30*86400000)
    .toISOString()
    .slice(0,10);

  screen(`
    <section class="tablet-page">
      ${staffPageHeader("Voucher & Gift",staffHomeRoute(),"Saldo dan Gift Item")}

      <div class="gift-admin-tabs">
        <button class="active" data-gift-tab="balance">Voucher / Gift Saldo</button>
        <button data-gift-tab="item">Gift Item</button>
      </div>

      <div id="gift-balance-panel">
        <section class="surface-card generate-code-card">
          <h2>Generate Voucher / Gift Saldo</h2>
          <form id="campaign-code-form">
            <label>Jenis Kode</label>
            <select id="code-type">
              <option value="voucher">VOUCHER — New Member</option>
              <option value="gift">GIFT SALDO — Existing Member</option>
            </select>
            <div id="code-type-help" class="type-help"></div>
            <label>Campaign / Event</label>
            <input id="campaign" value="Soft Opening CACAYO" required/>
            <div class="grid two">
              <div><label>Jumlah Kode</label><input id="qty" inputmode="numeric" value="5" required/></div>
              <div><label>Nominal per Kode</label><input id="value" inputmode="numeric" value="100000" required/></div>
            </div>
            <label>Expired Date</label>
            <input id="expired" type="date" value="${defaultExpiry}" required/>
            <button class="full touch-button" id="generate-code-btn" style="margin-top:14px">Generate Voucher</button>
          </form>
          <div id="gift-result" style="margin-top:12px"></div>
        </section>
      </div>

      <div id="gift-item-panel" hidden>
        <div class="gift-item-admin-layout">
          <section class="surface-card">
            <h2>Master Gift Item</h2>
            <p>Buat item satu kali, lalu generate kode sesuai jumlah yang dibutuhkan.</p>
            <form id="gift-item-master-form">
              <input id="gift-item-id" type="hidden"/>
              <label>Nama Item</label>
              <input id="gift-item-name" maxlength="100" placeholder="Contoh: Mie Ayam" required/>
              <label>Deskripsi Singkat</label>
              <textarea id="gift-item-description" maxlength="240" placeholder="Contoh: 1 porsi Mie Ayam Original"></textarea>
              <label>Foto Item</label>
              <input id="gift-item-file" type="file" accept="image/jpeg,image/png,image/webp"/>
              <small>Foto otomatis dipotong menjadi 800 × 800 px.</small>
              <div id="gift-item-preview" class="gift-item-master-preview"><div class="empty-state">Belum ada foto.</div></div>
              <label class="switch-row"><span>Item Aktif</span><input id="gift-item-active" type="checkbox" checked/></label>
              <button class="full touch-button">Simpan Master Item</button>
              <button class="ghost full" type="button" id="gift-item-reset-form">Item Baru</button>
            </form>
            <div id="gift-item-master-result"></div>
          </section>

          <section class="surface-card">
            <h2>Generate Gift Item</h2>
            <form id="gift-item-generate-form">
              <label>Pilih Item</label>
              <select id="gift-item-select" required></select>
              <label>Campaign / Event</label>
              <input id="gift-item-campaign" maxlength="100" value="Special Gift CACAYO" required/>
              <div class="grid two">
                <div><label>Jumlah Kode</label><input id="gift-item-qty" inputmode="numeric" value="10" required/></div>
                <div><label>Expired Date</label><input id="gift-item-expired" type="date" value="${defaultExpiry}" required/></div>
              </div>
              <div class="notice">Setiap kode memberikan 1 item. Cut-off pada tanggal ED pukul 23:59.</div>
              <button class="full touch-button" style="margin-top:14px">Generate Gift Item</button>
            </form>
            <div id="gift-item-generate-result"></div>
          </section>
        </div>

        <section class="surface-card">
          <h2>Daftar Master Item</h2>
          <div id="gift-item-master-list" class="gift-item-master-list"><div class="empty-state">Loading...</div></div>
        </section>
      </div>

      <section class="surface-card">
        <h2>Voucher & Gift Control</h2>
        <div class="voucher-toolbar">
          <select id="voucher-filter">
            <option value="available">Available</option>
            <option value="all">All Status</option>
            <option value="registered">Registered</option>
            <option value="claimed">Claimed</option>
            <option value="expired">Expired</option>
            <option value="void">Deleted / Void</option>
          </select>
          <span class="badge">1 kode = 1 penerima</span>
          <button class="ghost" id="refresh-vouchers" type="button">Refresh</button>
        </div>
        <div id="voucher-list" class="list"><div class="notice">Loading...</div></div>
        <div class="pagination-bar">
          <button class="ghost" id="prev-page" type="button">← Prev</button>
          <div class="page-info" id="page-info">Page -</div>
          <button class="ghost" id="next-page" type="button">Next →</button>
        </div>
      </section>
    </section>
  `);

  const joinBase=`${publicBaseUrl()}#join?code=`;
  const claimBase=`${publicBaseUrl()}#claim-gift?code=`;
  let currentPage=1;
  const pageSize=10;
  let currentRows=[];
  let totalCount=0;
  let masterItems=[];
  let masterImageData=null;

  function normalizedCodeType(value){
    const type=String(value||"voucher").toLowerCase();
    return ["voucher","gift","item"].includes(type)?type:"voucher";
  }
  function codeTypeLabel(value){
    const type=normalizedCodeType(value);
    return type==="item"?"GIFT ITEM":type==="gift"?"GIFT SALDO":"VOUCHER NEW MEMBER";
  }
  function codeLink(row){
    return normalizedCodeType(row.code_type)==="voucher"
      ? `${joinBase}${row.code}`
      : `${claimBase}${row.code}`;
  }
  function waMessageFor(row){
    const type=normalizedCodeType(row.code_type);
    const event=row.campaign_name||"-";
    const expiry=row.expired_at||"-";
    const link=codeLink(row);
    if(type==="item"){
      return `Halo Kak 🎁

Kamu mendapatkan Gift Item dari ${OUTLET}.

Item: ${row.gift_item_name||"Gift Item"}
Event: ${event}
Gunakan sebelum: ${expiry} pukul 23:59

Klik link berikut untuk claim:
${link}

Login menggunakan nomor WhatsApp dan PIN member, lalu klik CLAIM / OK.

Satu kode hanya dapat diclaim 1 kali.`;
    }
    if(type==="gift"){
      return `Halo Kak 🎁

Kamu mendapatkan Gift Dining Credit ${money(row.value)} dari ${OUTLET}.

Event: ${event}
Berlaku sampai: ${expiry} pukul 23:59

Klik link berikut untuk menerima gift:
${link}

Login menggunakan nomor WhatsApp dan PIN member, lalu klik CLAIM / OK.`;
    }
    return `Halo Kak 🎁

Kamu mendapatkan Voucher Dining Credit ${money(row.value)} dari ${OUTLET}.

Event: ${event}
Berlaku sampai: ${expiry} pukul 23:59

Daftar dan aktifkan voucher:
${link}

Voucher hanya dapat digunakan 1 kali untuk member baru.`;
  }
  function voucherStatusClass(status){
    if(status==="registered"||status==="used")return "registered";
    if(status==="claimed")return "claimed";
    if(status==="expired")return "expired";
    if(status==="void")return "void";
    return "available";
  }
  function renderTypeHelp(){
    const type=normalizedCodeType(byId("code-type").value);
    if(type==="gift"){
      byId("code-type-help").innerHTML=`<div class="gift-type-card"><b>GIFT SALDO</b><span>Saldo existing member bertambah setelah claim.</span></div>`;
      byId("generate-code-btn").textContent="Generate Gift Saldo";
      if(byId("campaign").value==="Soft Opening CACAYO")byId("campaign").value="Special Gift CACAYO";
    }else{
      byId("code-type-help").innerHTML=`<div class="voucher-type-card"><b>VOUCHER</b><span>Digunakan saat customer baru mendaftar.</span></div>`;
      byId("generate-code-btn").textContent="Generate Voucher";
      if(byId("campaign").value==="Special Gift CACAYO")byId("campaign").value="Soft Opening CACAYO";
    }
  }
  function renderPagination(){
    const pages=Math.max(1,Math.ceil(totalCount/pageSize));
    byId("page-info").textContent=`Page ${currentPage} / ${pages} • ${totalCount} kode`;
    byId("prev-page").disabled=currentPage<=1;
    byId("next-page").disabled=currentPage>=pages;
  }
  function renderVoucherRows(){
    if(!currentRows.length){
      byId("voucher-list").innerHTML=`<div class="empty-state">Tidak ada kode.</div>`;
      renderPagination();
      return;
    }
    byId("voucher-list").innerHTML=currentRows.map(row=>{
      const type=normalizedCodeType(row.code_type);
      const cls=voucherStatusClass(row.voucher_status);
      const isAvailable=row.voucher_status==="available";
      const isCopied=Boolean(row.copied_at);
      const usedText=row.voucher_status==="registered"
        ? `Registered by ${row.used_by_name||"-"}`
        : row.voucher_status==="claimed"
          ? `Claimed by ${row.used_by_name||"-"}`
          : isCopied
            ? `COPIED ${String(row.copied_method||"").toUpperCase()}`
            : "Belum dibagikan";
      const valueHtml=type==="item"
        ? `<div class="gift-code-item-thumb">${row.gift_item_image_data_url?`<img src="${row.gift_item_image_data_url}" alt="${esc(row.gift_item_name||"Item")}"/>`:""}<b>${esc(row.gift_item_name||"Gift Item")}</b></div>`
        : `<div class="money">${money(row.value)}</div>`;
      const actions=isAvailable
        ? isCopied
          ? `<div class="voucher-actions"><span class="copied-badge">✓ COPIED</span></div>`
          : `<div class="voucher-actions">
              <button class="secondary" onclick="window.shareCampaignCode('${row.gift_id}','wa',this)">Copy WA</button>
              <button class="ghost" onclick="window.shareCampaignCode('${row.gift_id}','link',this)">Copy Link</button>
              <button class="danger" onclick="window.deleteCampaignCode('${row.gift_id}','${esc(row.code)}')">Delete</button>
            </div>`
        : `<div class="voucher-actions"><span class="badge">${esc(String(row.voucher_status||"").toUpperCase())}</span></div>`;
      return `<div class="voucher-row ${cls}">
        <div><div class="code-box">${esc(row.code)}</div><div class="meta">ED ${esc(row.expired_at||"-")} • 23:59</div></div>
        <div><span class="code-type-pill ${type}">${codeTypeLabel(type)}</span><div class="campaign">${esc(row.campaign_name||"-")}</div><div class="meta">${esc(usedText)}</div></div>
        <div>${valueHtml}<span class="status-pill ${cls}">${esc(String(row.voucher_status||"").toUpperCase())}</span></div>
        ${actions}
      </div>`;
    }).join("");
    renderPagination();
  }
  async function loadCodes(){
    byId("voucher-list").innerHTML=`<div class="empty-state">Loading...</div>`;
    try{
      currentRows=await rpc("s3_list_gift_codes_paged",{
        p_staff_session_token:user.session_token,
        p_status:byId("voucher-filter").value,
        p_limit:pageSize,
        p_offset:(currentPage-1)*pageSize
      })||[];
      totalCount=currentRows.length?Number(currentRows[0].total_count||0):0;
      renderVoucherRows();
    }catch(err){
      byId("voucher-list").innerHTML=`<div class="error">${safeError(err)}</div>`;
    }
  }
  async function copyWithFallback(text){
    try{await navigator.clipboard.writeText(text);return true;}
    catch(err){window.prompt("Copy teks berikut:",text);return false;}
  }
  window.shareCampaignCode=async(giftId,method,button)=>{
    const buttons=button?Array.from(button.closest(".voucher-row").querySelectorAll("button")):[];
    buttons.forEach(btn=>btn.disabled=true);
    try{
      const rows=await rpc("s3_copy_gift_code",{
        p_staff_session_token:user.session_token,
        p_gift_id:giftId,
        p_method:method
      });
      const result=rows&&rows[0]?rows[0]:{};
      if(result.copy_allowed===false){
        alert(result.error_message||"Kode sudah pernah dicopy.");
        await loadCodes();
        return;
      }
      await copyWithFallback(method==="wa"?waMessageFor(result):codeLink(result));
      await loadCodes();
    }catch(err){
      buttons.forEach(btn=>btn.disabled=false);
      alert(safeError(err));
    }
  };
  window.deleteCampaignCode=async(giftId,code)=>{
    if(!confirm(`Delete kode ${code}?`))return;
    try{
      await rpc("s3_delete_gift_code",{
        p_staff_session_token:user.session_token,
        p_gift_id:giftId
      });
      await loadCodes();
    }catch(err){alert(safeError(err));}
  };

  function resetMasterForm(){
    byId("gift-item-id").value="";
    byId("gift-item-name").value="";
    byId("gift-item-description").value="";
    byId("gift-item-active").checked=true;
    byId("gift-item-file").value="";
    masterImageData=null;
    byId("gift-item-preview").innerHTML=`<div class="empty-state">Belum ada foto.</div>`;
  }
  function renderMasterItems(){
    const active=masterItems.filter(item=>item.is_active);
    byId("gift-item-select").innerHTML=active.length
      ? active.map(item=>`<option value="${item.item_id}">${esc(item.name)}</option>`).join("")
      : `<option value="">Belum ada item aktif</option>`;
    byId("gift-item-master-list").innerHTML=masterItems.length
      ? masterItems.map((item,index)=>`
          <article class="gift-item-master-row">
            <div class="gift-item-master-thumb">${item.image_data_url?`<img src="${item.image_data_url}" alt="${esc(item.name)}"/>`:""}</div>
            <div><h3>${esc(item.name)}</h3><p>${esc(item.description||"")}</p><span class="badge ${item.is_active?"ok":""}">${item.is_active?"AKTIF":"NONAKTIF"}</span></div>
            <button class="ghost" onclick="window.editGiftItemMaster(${index})">Edit</button>
          </article>`).join("")
      : `<div class="empty-state">Belum ada Master Gift Item.</div>`;
  }
  async function loadMasterItems(){
    try{
      masterItems=await rpc("s4_list_gift_item_master",{
        p_staff_session_token:user.session_token,
        p_include_inactive:true
      })||[];
      renderMasterItems();
    }catch(err){
      byId("gift-item-master-list").innerHTML=`<div class="error">${safeError(err)}</div>`;
    }
  }
  window.editGiftItemMaster=index=>{
    const item=masterItems[index];
    if(!item)return;
    byId("gift-item-id").value=item.item_id;
    byId("gift-item-name").value=item.name||"";
    byId("gift-item-description").value=item.description||"";
    byId("gift-item-active").checked=Boolean(item.is_active);
    masterImageData=item.image_data_url||null;
    byId("gift-item-preview").innerHTML=masterImageData?`<img src="${masterImageData}" alt="${esc(item.name)}"/>`:`<div class="empty-state">Belum ada foto.</div>`;
    byId("gift-item-master-form").scrollIntoView({behavior:"smooth"});
  };

  document.querySelectorAll("[data-gift-tab]").forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll("[data-gift-tab]").forEach(b=>b.classList.toggle("active",b===button));
      const itemTab=button.dataset.giftTab==="item";
      byId("gift-balance-panel").hidden=itemTab;
      byId("gift-item-panel").hidden=!itemTab;
    };
  });

  byId("code-type").onchange=renderTypeHelp;
  byId("campaign-code-form").onsubmit=async(event)=>{
    event.preventDefault();
    const box=byId("gift-result");
    box.innerHTML=`<div class="notice">Generating...</div>`;
    try{
      const rows=await rpc("s3_generate_campaign_codes",{
        p_staff_session_token:user.session_token,
        p_code_type:normalizedCodeType(byId("code-type").value),
        p_campaign_name:byId("campaign").value.trim(),
        p_value:parseMoney(byId("value").value),
        p_expired_at:byId("expired").value,
        p_qty:Math.min(parseMoney(byId("qty").value),500)
      });
      box.innerHTML=`<div class="success">${(rows||[]).length} kode berhasil dibuat.</div>`;
      currentPage=1;
      byId("voucher-filter").value="available";
      await loadCodes();
    }catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;}
  };

  byId("gift-item-file").onchange=async()=>{
    const file=byId("gift-item-file").files[0];
    if(!file)return;
    const box=byId("gift-item-master-result");
    box.innerHTML=`<div class="notice">Menyiapkan foto...</div>`;
    try{
      masterImageData=await resizeUploadedImage(file,800,800,1800000);
      byId("gift-item-preview").innerHTML=`<img src="${masterImageData}" alt="Preview item"/>`;
      box.innerHTML=`<div class="success">Foto siap 800 × 800 px.</div>`;
    }catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;}
  };
  byId("gift-item-master-form").onsubmit=async(event)=>{
    event.preventDefault();
    const box=byId("gift-item-master-result");
    box.innerHTML=`<div class="notice">Menyimpan item...</div>`;
    try{
      await rpc("s4_save_gift_item_master",{
        p_staff_session_token:user.session_token,
        p_item_id:byId("gift-item-id").value||null,
        p_name:byId("gift-item-name").value.trim(),
        p_description:byId("gift-item-description").value.trim(),
        p_image_data_url:masterImageData,
        p_is_active:byId("gift-item-active").checked
      });
      box.innerHTML=`<div class="success">Master Gift Item tersimpan.</div>`;
      resetMasterForm();
      await loadMasterItems();
    }catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;}
  };
  byId("gift-item-reset-form").onclick=resetMasterForm;
  byId("gift-item-generate-form").onsubmit=async(event)=>{
    event.preventDefault();
    const box=byId("gift-item-generate-result");
    box.innerHTML=`<div class="notice">Generating Gift Item...</div>`;
    try{
      const rows=await rpc("s4_generate_item_gift_codes",{
        p_staff_session_token:user.session_token,
        p_gift_item_id:byId("gift-item-select").value,
        p_campaign_name:byId("gift-item-campaign").value.trim(),
        p_expired_at:byId("gift-item-expired").value,
        p_qty:Math.min(parseMoney(byId("gift-item-qty").value),500)
      });
      box.innerHTML=`<div class="success">${(rows||[]).length} Gift Item berhasil dibuat.</div>`;
      currentPage=1;
      byId("voucher-filter").value="available";
      await loadCodes();
    }catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;}
  };

  byId("voucher-filter").onchange=()=>{currentPage=1;loadCodes();};
  byId("refresh-vouchers").onclick=loadCodes;
  byId("prev-page").onclick=()=>{if(currentPage>1){currentPage--;loadCodes();}};
  byId("next-page").onclick=()=>{currentPage++;loadCodes();};

  renderTypeHelp();
  await Promise.all([loadMasterItems(),loadCodes()]);
}
async function renderMembers(){
  const user=requireLogin();if(!user)return;
  mountLayout();setNav();
  screen(`
    <section class="tablet-page">
      ${staffPageHeader("Daftar Member",staffHomeRoute())}
      <div class="member-page-toolbar">
        <div class="search-box-large"><span>${touchIcon('search')}</span><input id="member-query" placeholder="Cari nama / nomor WhatsApp" autocomplete="off"/></div>
        <button class="touch-button" onclick="setHash('join')">+ Member Baru</button>
      </div>
      <div class="member-summary-line" id="member-summary">Loading...</div>
      <div id="member-list" class="member-touch-list"><div class="empty-state">Loading member...</div></div>
      <div class="report-actions"><button class="ghost" id="export-members-pdf">Export PDF</button><button class="ghost" id="refresh-members">Refresh</button></div>
    </section>`);
  let members=[];
  function visible(){
    const query=byId("member-query").value;
    return members.filter(member=>memberMatchesSearch(member,query));
  }
  function draw(){
    const rows=visible();
    byId("member-summary").textContent=`${rows.length} dari ${members.length} member`;
    byId("member-list").innerHTML=rows.length?rows.map(member=>`
      <button class="member-touch-row" onclick="setHash('member',{phone:'${esc(member.phone)}'})">
        <span class="member-avatar">${esc(String(member.name||'?').charAt(0).toUpperCase())}</span>
        <span class="member-touch-main"><b>${esc(member.name||'-')}</b><small>${esc(member.phone||'-')}</small></span>
        <span class="member-touch-balance"><small>Saldo</small><b>${money(member.balance||0)}</b></span><span class="chevron">›</span>
      </button>`).join(""):`<div class="empty-state">Tidak ada member.</div>`;
  }
  async function load(){
    try{members=await rpc("s3_list_members",{p_staff_session_token:user.session_token})||[];draw();}
    catch(err){byId("member-list").innerHTML=`<div class="error">${safeError(err)}</div>`;}
  }
  byId("member-query").oninput=draw;
  byId("refresh-members").onclick=load;
  byId("export-members-pdf").onclick=()=>{
    const rows=visible();
    const html=`<!doctype html><html><head><title>${OUTLET} Member List</title><style>body{font-family:Arial;padding:24px;color:#17211a}h1{margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#eef4ef}</style></head><body><h1>${OUTLET} — Daftar Member</h1><div>${new Date().toLocaleString('id-ID')}</div><table><thead><tr><th>No</th><th>Nama</th><th>WhatsApp</th><th>Saldo</th><th>Status</th></tr></thead><tbody>${rows.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.name||'-')}</td><td>${esc(m.phone||'-')}</td><td>${money(m.balance||0)}</td><td>${esc(m.status||'active')}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`;
    const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return;}w.document.write(html);w.document.close();
  };
  await load();
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
  byId("app").innerHTML=`<main class="customer-shell login-customer-shell"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`
    <section class="customer-login-card">
      ${brandMiniHtml()}
      <h1>Selamat Datang</h1>
      <p>Masuk untuk melihat saldo Dining.</p>
      ${claimCode?`<div class="notice">Login untuk claim Gift <b>${esc(claimCode)}</b>.</div>`:""}
      <form id="customer-login-form">
        <label>Nomor WhatsApp</label><input id="customer-phone" inputmode="numeric" placeholder="08xxxxxxxxxx" autocomplete="tel" required/>
        <label>PIN</label><input id="customer-pin" type="password" inputmode="numeric" maxlength="6" placeholder="6 digit PIN" required/>
        <button class="full touch-button" style="margin-top:16px">Login</button>
      </form>
      <div id="customer-login-result" style="margin-top:12px"></div>
      ${claimCode?"":`<button class="text-button" onclick="setHash('join')">Belum menjadi member? Daftar</button>`}
    </section>`;
  byId("customer-login-form").onsubmit=async(event)=>{
    event.preventDefault();
    const box=byId("customer-login-result");
    const phone=normalizePhone(byId("customer-phone").value);
    const pin=byId("customer-pin").value.trim();
    if(!/^[0-9]{6}$/.test(pin)){box.innerHTML=`<div class="error">PIN wajib 6 digit angka.</div>`;return;}
    box.innerHTML=`<div class="notice">Masuk...</div>`;
    try{
      const rows=await rpc("mvp_customer_login",{p_outlet_slug:OUTLET_SLUG,p_phone:phone,p_pin:pin});
      if(!rows||!rows.length)throw new Error("Login gagal.");
      const data=rows[0];
      if(data.login_success===false){box.innerHTML=`<div class="error">${esc(data.error_message||'PIN salah.')}</div>`;return;}
      saveCustomerSession(data);
      setHash(claimCode?"claim-gift":"customer-portal",claimCode?{code:claimCode}:{});
    }catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;}
  };
}

async function renderCustomerPortal(){
  const session=requireCustomerSession();if(!session)return;
  clearSession();
  byId("app").innerHTML=`<main class="customer-shell"></main>`;
  const target=document.querySelector("main");
  target.innerHTML=`<div class="empty-state">Memuat...</div>`;
  try{
    const [homeRows,historyRows,expiryRows,giftItemRows]=await Promise.all([
      rpc("mvp_customer_home",{p_session_token:session.session_token}),
      rpc("mvp_customer_history",{p_session_token:session.session_token}),
      rpc("mvp_customer_balance_expiry",{p_session_token:session.session_token}),
      rpc("mvp_customer_gift_items",{p_session_token:session.session_token})
    ]);
    if(!homeRows||!homeRows.length)throw new Error("Session tidak valid.");
    const customer=homeRows[0];
    const expiry=expiryRows&&expiryRows[0]?expiryRows[0]:{};
    target.innerHTML=`
      <section class="customer-home-card">
        ${brandMiniHtml()}
        <div class="customer-greeting"><span>Halo,</span><b>${esc(customer.name||'Member')}</b></div>
        <div class="balance-hero"><span>Saldo Dining</span><strong>${money(customer.balance||0)}</strong><small>Berlaku sampai ${dateID(expiry.expires_at)}</small></div>
        <div class="customer-action-grid five">
          <button data-panel="items"><span>▦</span><b>Gift Saya</b></button>
          <button data-panel="gift"><span>◇</span><b>Claim Gift</b></button>
          <button data-panel="history"><span>◷</span><b>Riwayat</b></button>
          <button data-panel="topup"><span>⊕</span><b>Top Up</b></button>
          <button data-panel="account"><span>?</span><b>Akun</b></button>
        </div>
        <div id="customer-panel" class="customer-panel"></div>
        <button class="text-button" id="customer-logout-btn">Logout</button>
      </section>`;
    const panel=byId("customer-panel");
    const panels={
      items:`<h2>Gift Item Saya</h2>${customerGiftItemCardsHtml(giftItemRows||[])}`,
      history:`<h2>Riwayat Transaksi</h2>${historyListHtml(historyRows||[])}`,
      gift:`<h2>Claim Gift</h2><div class="claim-code-row"><input id="portal-gift-code" class="code-box" placeholder="Gift Code"/><button id="portal-gift-claim-btn">Lanjut</button></div>`,
      topup:`<h2>Top Up</h2><p>Tunjukkan akun ini ke kasir untuk menambah saldo.</p><div class="compact-package-list"><div><b>NICKEL</b><span>Rp1 jt → Rp1,05 jt</span></div><div><b>SILVER</b><span>Rp2 jt → Rp2,2 jt</span></div><div><b>GOLD</b><span>Rp3 jt → Rp3,45 jt</span></div><div><b>DIAMOND</b><span>Rp4 jt → Rp4,8 jt</span></div></div>`,
      account:`<h2>Keamanan PIN</h2><p class="pin-disclaimer-text">PIN bersifat rahasia dan menjadi satu-satunya otorisasi untuk penggunaan saldo Dining. Customer wajib menjaga kerahasiaan PIN dan tidak memberikannya kepada pihak lain. Pihak kasir maupun restoran tidak dapat melihat PIN Customer. Setiap transaksi dengan PIN yang benar dianggap sah. Kehilangan saldo akibat kelalaian Customer dalam menjaga PIN bukan tanggung jawab pihak restoran, kecuali disebabkan oleh kesalahan sistem.</p>`
    };
    function openPanel(name){panel.innerHTML=panels[name]||"";document.querySelectorAll("[data-panel]").forEach(b=>b.classList.toggle("active",b.dataset.panel===name));if(name==="gift"){byId("portal-gift-claim-btn").onclick=()=>{const code=byId("portal-gift-code").value.trim().toUpperCase();if(!code){alert("Masukkan Gift Code.");return;}setHash("claim-gift",{code});};}}
    document.querySelectorAll("[data-panel]").forEach(button=>button.onclick=()=>openPanel(button.dataset.panel));
    openPanel((giftItemRows||[]).some(item=>item.status==="available")?"items":"history");
    byId("customer-logout-btn").onclick=async()=>{try{await rpc("mvp_customer_logout",{p_session_token:session.session_token});}catch(e){}clearCustomerSession();setHash("customer-login");};
  }catch(err){clearCustomerSession();target.innerHTML=`<section class="customer-login-card">${brandMiniHtml()}<div class="error">${safeError(err)}</div><button class="full" onclick="setHash('customer-login')">Login Ulang</button></section>`;}
}

async function renderClaimGift(){
  const {params}=getRoute();
  const code=String(params.code||"").trim().toUpperCase();
  const session=getCustomerSession();
  clearSession();
  byId("app").innerHTML=`<main class="customer-shell"></main>`;
  const target=document.querySelector("main");

  if(!code){
    target.innerHTML=`<section class="customer-login-card">${brandMiniHtml()}<h1>Claim Gift</h1><input id="claim-gift-code-input" class="code-box" placeholder="Gift Code"/><button class="full touch-button" style="margin-top:12px" id="claim-gift-code-continue">Lanjut</button><button class="text-button" onclick="setHash('customer-portal')">Kembali</button></section>`;
    byId("claim-gift-code-continue").onclick=()=>{
      const entered=byId("claim-gift-code-input").value.trim().toUpperCase();
      if(!entered)return alert("Masukkan Gift Code.");
      setHash("claim-gift",{code:entered});
    };
    return;
  }

  if(!session||!session.session_token){
    target.innerHTML=`<section class="customer-login-card">${brandMiniHtml()}<div class="gift-icon">🎁</div><h1>Kamu Mendapat Gift</h1><div class="gift-code-display">${esc(code)}</div><p>Login untuk melihat detail dan claim gift.</p><button class="full touch-button" onclick="setHash('customer-login',{claim:'${esc(code)}'})">Login untuk Claim</button></section>`;
    return;
  }

  target.innerHTML=`<div class="empty-state">Memeriksa Gift...</div>`;

  try{
    const rows=await rpc("mvp_customer_preview_reward",{
      p_session_token:session.session_token,
      p_code:code
    });
    const reward=rows&&rows[0]?rows[0]:{};
    if(reward.claim_allowed===false)throw new Error(reward.error_message||"Gift tidak dapat diclaim.");
    const isItem=reward.code_type==="item";

    target.innerHTML=`<section class="customer-confirm-card reward-preview-card">
      ${brandMiniHtml()}
      ${isItem
        ? `<div class="reward-item-preview">${reward.item_image_data_url?`<img src="${reward.item_image_data_url}" alt="${esc(reward.item_name||"Gift Item")}"/>`:""}<h1>${esc(reward.item_name||"Gift Item")}</h1><p>${esc(reward.item_description||"")}</p><div class="gift-item-expiry"><b>Gunakan sebelum ${dateID(reward.expired_at)}</b><span>Cut-off 23:59</span></div></div>`
        : `<div class="gift-hero"><div class="gift-icon">🎁</div><h1>${esc(reward.campaign_name||"Gift Saldo")}</h1></div><div class="gift-value-card"><span>Gift Dining Credit</span><strong>${money(reward.value||0)}</strong></div><div class="item"><div class="title">Saldo setelah claim</div><div class="meta">${money(Number(reward.current_balance||0)+Number(reward.value||0))}</div></div><div class="item"><div class="title">Masa aktif saldo</div><div class="meta">${dateID(reward.result_expiry)} • 23:59</div></div>`}
      <div class="notice">Satu kode hanya dapat diclaim satu kali.</div>
      <button class="full touch-button" style="margin-top:14px" id="confirm-reward-claim">CLAIM / OK</button>
      <div id="claim-gift-result"></div>
    </section>`;

    byId("confirm-reward-claim").onclick=async()=>{
      const button=byId("confirm-reward-claim");
      const box=byId("claim-gift-result");
      button.disabled=true;
      box.innerHTML=`<div class="notice">Memproses...</div>`;
      try{
        const claimRows=await rpc("mvp_customer_claim_reward",{
          p_session_token:session.session_token,
          p_code:code
        });
        const result=claimRows&&claimRows[0]?claimRows[0]:{};
        if(result.claim_success===false)throw new Error(result.error_message||"Claim gagal.");

        if(result.code_type==="item"){
          target.innerHTML=`<section class="customer-confirm-card">${brandMiniHtml()}<div class="success-check">✓</div><h1>Gift Item Berhasil Diclaim</h1><div class="reward-item-preview compact">${result.item_image_data_url?`<img src="${result.item_image_data_url}" alt="${esc(result.item_name||"Gift Item")}"/>`:""}<h2>${esc(result.item_name||"Gift Item")}</h2><div class="gift-item-expiry"><b>Gunakan sebelum ${dateID(result.item_expires_at)}</b><span>Cut-off 23:59</span></div></div><button class="full touch-button" onclick="setHash('customer-portal')">Lihat Gift Saya</button></section>`;
        }else{
          target.innerHTML=`<section class="customer-confirm-card">${brandMiniHtml()}<div class="success-check">✓</div><h1>Gift Saldo Berhasil Diclaim</h1><div class="gift-value-card success-gift"><span>Saldo Ditambahkan</span><strong>${money(result.gift_value||0)}</strong></div><div class="kpi"><div class="label">Total Saldo</div><div class="value">${money(result.new_balance||0)}</div></div><div class="success">Berlaku sampai ${dateID(result.new_expiry)} pukul 23:59.</div><button class="full touch-button" onclick="setHash('customer-portal')">Kembali</button></section>`;
        }
      }catch(err){
        box.innerHTML=`<div class="error">${safeError(err)}</div>`;
        button.disabled=false;
      }
    };
  }catch(err){
    target.innerHTML=`<section class="customer-login-card">${brandMiniHtml()}<div class="error">${safeError(err)}</div><button class="full" onclick="setHash('customer-portal')">Kembali</button></section>`;
  }
}
async function resizeUploadedImage(file,width,height,maxOutputLength=2300000){
  if(!file)throw new Error("Pilih gambar.");
  if(file.size>10*1024*1024)throw new Error("File asli maksimal 10 MB.");
  const dataUrl=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error("Gagal membaca gambar."));
    reader.readAsDataURL(file);
  });
  const image=await new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Format gambar tidak didukung."));
    img.src=dataUrl;
  });
  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext("2d");
  const scale=Math.max(width/image.width,height/image.height);
  const sourceWidth=width/scale;
  const sourceHeight=height/scale;
  const sx=(image.width-sourceWidth)/2;
  const sy=(image.height-sourceHeight)/2;
  ctx.drawImage(image,sx,sy,sourceWidth,sourceHeight,0,0,width,height);
  const output=canvas.toDataURL("image/jpeg",0.82);
  if(output.length>maxOutputLength)throw new Error("Gambar masih terlalu besar.");
  return output;
}

async function renderPromoManage(){
  const user=requireLogin();if(!user)return;
  mountLayout();setNav();
  screen(`<section class="tablet-page">${staffPageHeader("Kelola Promo",staffHomeRoute(),"Tampil setelah transaksi customer berhasil")}<section class="surface-card promo-admin-card"><div class="promo-preview-frame" id="promo-preview"><div class="empty-state">Belum ada gambar promo.</div></div><form id="promo-form"><label>Gambar Promo</label><input id="promo-file" type="file" accept="image/jpeg,image/png,image/webp"/><small>Gambar otomatis dipotong menjadi 1200 × 800 px. Maksimal file awal 10 MB.</small><label>Judul</label><input id="promo-title" maxlength="100" placeholder="Contoh: Buy 1 Get 1"/><label>Keterangan</label><textarea id="promo-caption" maxlength="240" placeholder="Promo berlaku setiap Senin"></textarea><label class="switch-row"><span>Aktifkan Promo</span><input id="promo-active" type="checkbox"/></label><button class="full touch-button">Simpan Promo</button></form><div id="promo-result"></div></section></section>`);
  let imageData=null;
  try{const rows=await rpc("s4_get_promo_admin",{p_staff_session_token:user.session_token});const promo=rows&&rows[0]?rows[0]:{};byId("promo-title").value=promo.title||"";byId("promo-caption").value=promo.caption||"";byId("promo-active").checked=Boolean(promo.is_active);if(promo.image_data_url){imageData=promo.image_data_url;byId("promo-preview").innerHTML=`<img src="${promo.image_data_url}" alt="Preview promo"/>`;}}catch(err){byId("promo-result").innerHTML=`<div class="error">${safeError(err)}</div>`;}
  byId("promo-file").onchange=async()=>{const file=byId("promo-file").files[0];if(!file)return;byId("promo-result").innerHTML=`<div class="notice">Menyiapkan gambar...</div>`;try{imageData=await resizeUploadedImage(file,1200,800,2300000);byId("promo-preview").innerHTML=`<img src="${imageData}" alt="Preview promo"/>`;byId("promo-result").innerHTML=`<div class="success">Gambar siap: 1200 × 800 px.</div>`;}catch(err){byId("promo-result").innerHTML=`<div class="error">${safeError(err)}</div>`;}};
  byId("promo-form").onsubmit=async(event)=>{event.preventDefault();const box=byId("promo-result");box.innerHTML=`<div class="notice">Menyimpan promo...</div>`;try{const rows=await rpc("s4_save_promo",{p_staff_session_token:user.session_token,p_title:byId("promo-title").value.trim(),p_caption:byId("promo-caption").value.trim(),p_image_data_url:imageData,p_is_active:byId("promo-active").checked});const promo=rows&&rows[0]?rows[0]:{};box.innerHTML=`<div class="success">Promo tersimpan. Status: <b>${promo.is_active?'AKTIF':'NONAKTIF'}</b>.</div>`;}catch(err){box.innerHTML=`<div class="error">${safeError(err)}</div>`;}};
}

async function renderPromo(){
  const {params}=getRoute();
  const token=params.token;
  const kind=params.kind==="item"?"item":"balance";
  byId("app").innerHTML=`<main class="customer-shell promo-customer-shell"></main>`;
  const target=document.querySelector("main");
  try{
    const transactionPromise=kind==="item"
      ? rpc("mvp_get_item_redemption",{p_token:token})
      : rpc("mvp_get_approval",{p_token:token});
    const [transactionRows,promoRows]=await Promise.all([
      transactionPromise,
      rpc("mvp_get_active_promo",{p_outlet_slug:OUTLET_SLUG})
    ]);
    const transaction=transactionRows&&transactionRows[0]?transactionRows[0]:{};
    const promo=promoRows&&promoRows[0]?promoRows[0]:null;
    const detail=kind==="item"
      ? `${transaction.item_name||"Gift Item"}`
      : `${money(transaction.balance_used||0)} • Sisa saldo ${money(transaction.balance_after||0)}`;
    target.innerHTML=`<section class="promo-customer-card">${brandMiniHtml()}<div class="transaction-success-strip"><span>✓</span><div><b>Transaksi Berhasil</b><small>${esc(detail)}</small></div></div>${promo&&promo.image_data_url?`<img class="promo-customer-image" src="${promo.image_data_url}" alt="${esc(promo.title||"Promo")}"/><h1>${esc(promo.title||"Promo Spesial")}</h1><p>${esc(promo.caption||"")}</p>`:`<div class="no-promo-state"><div class="success-check">✓</div><h1>Terima Kasih</h1><p>Transaksi Anda telah selesai.</p></div>`}<button class="full touch-button" onclick="setHash('customer-login')">Selesai</button></section>`;
  }catch(err){
    target.innerHTML=`<section class="customer-login-card">${brandMiniHtml()}<div class="error">${safeError(err)}</div><button class="full" onclick="setHash('customer-login')">Selesai</button></section>`;
  }
}
async function renderReport(){
  const user=requireLogin();if(!user)return;
  mountLayout();setNav();
  const today=new Date();const from=new Date(today.getTime()-6*86400000).toISOString().slice(0,10);const to=today.toISOString().slice(0,10);
  screen(`<section class="tablet-page">${staffPageHeader("History Transaksi",staffHomeRoute())}<div class="report-filter-bar"><input id="report-from" type="date" value="${from}"/><span>s/d</span><input id="report-to" type="date" value="${to}"/><select id="report-type"><option value="all">Semua Jenis</option><option value="use_balance">Gunakan Saldo</option><option value="topup">Top Up</option><option value="gift_claim">Voucher / Gift Saldo</option><option value="gift_item_claim">Gift Item Claimed</option><option value="gift_item_redeem">Gift Item Used</option></select><button id="report-load">Tampilkan</button></div><div id="report-summary" class="report-summary"></div><div id="report-list"></div><div class="report-actions"><button class="touch-button" id="report-pdf">Export PDF</button></div></section>`);
  let rows=[];
  function typeLabel(type){
    return type==="use_balance"?"Gunakan Saldo"
      :type==="topup"?"Top Up"
      :type==="gift_claim"?"Voucher / Gift Saldo"
      :type==="gift_item_claim"?"Gift Item Claimed"
      :type==="gift_item_redeem"?"Gift Item Used"
      :type;
  }
  function groupRows(){const groups={};rows.forEach(row=>{const key=new Date(row.created_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Jakarta"});(groups[key]||(groups[key]=[])).push(row);});return groups;}
  function draw(){
    const totalTopup=rows.reduce((sum,row)=>sum+Number(row.credit_issued||0),0);const totalUsed=rows.reduce((sum,row)=>sum+Number(row.balance_used||0),0);
    byId("report-summary").innerHTML=`<div><small>Transaksi</small><b>${rows.length}</b></div><div><small>Saldo Masuk</small><b>${money(totalTopup)}</b></div><div><small>Saldo Dipakai</small><b>${money(totalUsed)}</b></div>`;
    const groups=groupRows();const keys=Object.keys(groups).sort().reverse();
    byId("report-list").innerHTML=keys.length?keys.map(date=>`<section class="daily-report-group"><header><b>${new Date(date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</b><span>${groups[date].length} transaksi</span></header>${groups[date].map(row=>`<div class="report-row"><span class="report-time">${new Date(row.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span><span><b>${esc(typeLabel(row.type))}</b><small>${esc(row.member_name||'-')} • ${esc(row.member_phone||'-')}</small></span><strong class="${row.type==='use_balance'?'minus':'plus'}">${row.type==='gift_item_claim'||row.type==='gift_item_redeem'?'1 Item':`${row.type==='use_balance'?'-':'+'}${money(row.type==='use_balance'?row.balance_used:row.credit_issued)}`}</strong><span class="status-dot">${esc(row.status||'approved')}</span></div>`).join('')}</section>`).join(''):`<div class="empty-state">Belum ada transaksi pada periode ini.</div>`;
  }
  async function load(){byId("report-list").innerHTML=`<div class="empty-state">Loading...</div>`;try{rows=await rpc("s4_staff_transactions_by_date",{p_staff_session_token:user.session_token,p_date_from:byId("report-from").value,p_date_to:byId("report-to").value,p_type:byId("report-type").value})||[];draw();}catch(err){byId("report-list").innerHTML=`<div class="error">${safeError(err)}</div>`;}}
  byId("report-load").onclick=load;
  byId("report-pdf").onclick=()=>{const groups=groupRows();const html=`<!doctype html><html><head><title>${OUTLET} Transaction Report</title><style>body{font-family:Arial;padding:28px;color:#17211a}h1{margin:0}.day{margin-top:22px;border-top:2px solid #245c38;padding-top:10px}.row{display:grid;grid-template-columns:80px 1fr 140px;padding:8px 0;border-bottom:1px solid #ddd}.amount{text-align:right;font-weight:bold}</style></head><body><h1>${OUTLET} — History Transaksi</h1><p>${byId('report-from').value} s/d ${byId('report-to').value}</p>${Object.keys(groups).sort().reverse().map(date=>`<div class="day"><h3>${date}</h3>${groups[date].map(row=>`<div class="row"><span>${new Date(row.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span><span>${esc(typeLabel(row.type))} — ${esc(row.member_name||'-')}</span><span class="amount">${row.type==='gift_item_claim'||row.type==='gift_item_redeem'?'1 Item':money(row.type==='use_balance'?row.balance_used:row.credit_issued)}</span></div>`).join('')}</div>`).join('')}<script>window.onload=()=>window.print();</script></body></html>`;const w=window.open('','_blank');if(!w){alert('Popup diblokir browser.');return;}w.document.write(html);w.document.close();};
  await load();
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
  const staffRoutes=new Set(["login","owner","owner-summary","transaction","promo-manage","members","gift-generate","report","kasir","member","register","join","topup","use-balance","waiting","success"]);
  const customerRoutes=new Set(["customer-login","customer-portal","register","join","claim-gift","approve","approve-item","promo","customer-home","reset-pin","customer-reset-home"]);
  if(PORTAL_MODE==="staff" && !staffRoutes.has(name)){ setHash("login"); return; }
  if(PORTAL_MODE==="customer" && !customerRoutes.has(name)){ setHash("customer-login"); return; }
  if(name==="login")return renderLogin();
  if(name==="customer-login")return renderCustomerLogin();
  if(name==="customer-portal")return renderCustomerPortal();
  if(name==="claim-gift")return renderClaimGift();
  if(name==="kasir")return renderKasir();
  if(name==="transaction")return renderTransaction();
  if(name==="promo-manage")return renderPromoManage();
  if(name==="owner-summary")return renderOwnerSummary();
  if(name==="member")return renderMember();
  if(name==="register"||name==="join")return renderJoin();
  if(name==="topup")return renderTopup();
  if(name==="use-balance")return renderUseBalance();
  if(name==="waiting")return renderWaiting();
  if(name==="approve")return renderApprove();
  if(name==="approve-item")return renderApproveItem();
  if(name==="promo")return renderPromo();
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
