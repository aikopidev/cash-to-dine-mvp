/* White-label Member Dining System */
const APP_VERSION = "4.2.0";
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
          <b>Transaksi</b><small>Saldo dan Gift Item dalam satu approval</small>
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
  const user=requireLogin();
  if(!user)return;

  mountLayout();
  setNav();

  screen(`
    <section class="tablet-page">
      ${staffPageHeader(
        "Transaksi",
        staffHomeRoute(),
        "Cari member, lalu pilih Saldo, Gift Item, atau keduanya"
      )}

      <div class="transaction-choice two unified-entry-choice">
        <button class="transaction-choice-card active"
          data-action="benefit">
          <span>${touchIcon("use")}</span>
          <b>Gunakan Benefit</b>
          <small>Saldo / Gift Item / Keduanya</small>
        </button>

        <button class="transaction-choice-card"
          data-action="topup">
          <span>${touchIcon("topup")}</span>
          <b>Top Up</b>
          <small>Tambah saldo member</small>
        </button>
      </div>

      <section class="surface-card member-picker-card">
        <label>Cari Member</label>
        <div class="search-box-large">
          <span>${touchIcon("search")}</span>
          <input id="transaction-member-search"
            placeholder="Nama atau nomor WhatsApp"
            autocomplete="off"/>
        </div>

        <div id="transaction-member-results"
          class="member-touch-list">
          <div class="empty-state">
            Ketik minimal 2 karakter nama atau nomor WhatsApp.
          </div>
        </div>
      </section>
    </section>
  `);

  let selectedAction="benefit";
  let timer=null;

  document.querySelectorAll(".transaction-choice-card")
    .forEach(button=>{
      button.onclick=()=>{
        document.querySelectorAll(".transaction-choice-card")
          .forEach(item=>item.classList.remove("active"));

        button.classList.add("active");
        selectedAction=button.dataset.action||"benefit";

        byId("transaction-member-search").focus();

        if(
          byId("transaction-member-search")
            .value
            .trim()
            .length>=2
        ){
          search();
        }
      };
    });

  const input=byId("transaction-member-search");
  const results=byId("transaction-member-results");

  async function search(){
    const query=input.value.trim();

    if(query.length<2){
      results.innerHTML=`
        <div class="empty-state">
          Ketik minimal 2 karakter nama atau nomor WhatsApp.
        </div>`;
      return;
    }

    results.innerHTML=`
      <div class="empty-state">Mencari member...</div>`;

    try{
      const rows=await rpc("s3_search_members",{
        p_staff_session_token:user.session_token,
        p_query:query
      });

      if(!rows||!rows.length){
        const digits=String(query||"")
          .replace(/[^0-9]/g,"");

        const registerButton=digits.length>=8
          ? `<button class="ghost full"
              onclick="setHash(
                'join',
                {phone:'${esc(normalizePhone(digits))}'}
              )">
              + Daftar Nomor Ini
            </button>`
          : `<button class="ghost full"
              onclick="setHash('join')">
              + Daftar Member Baru
            </button>`;

        results.innerHTML=`
          <div class="empty-state">
            Member tidak ditemukan.
            ${registerButton}
          </div>`;
        return;
      }

      results.innerHTML=rows.map(member=>`
        <button class="member-touch-row"
          type="button"
          onclick="setHash(
            '${selectedAction==="topup"?"topup":"use-benefits"}',
            {phone:'${esc(member.phone)}'}
          )">

          <span class="member-avatar">
            ${esc(
              String(member.name||"?")
                .charAt(0)
                .toUpperCase()
            )}
          </span>

          <span class="member-touch-main">
            <b>${esc(member.name)}</b>
            <small>
              ${esc(member.phone)} •
              ${String(
                member.status||"active"
              ).toUpperCase()}
            </small>
          </span>

          <span class="member-touch-balance">
            <small>Saldo</small>
            <b>${money(member.balance)}</b>
          </span>

          <span class="chevron">›</span>
        </button>
      `).join("");
    }catch(err){
      results.innerHTML=`
        <div class="error">${safeError(err)}</div>`;
    }
  }

  input.oninput=()=>{
    clearTimeout(timer);
    timer=setTimeout(search,300);
  };

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
        <div class="grid two member-action-grid" style="margin-top:12px">
          <button onclick="setHash('topup',{phone:'${esc(m.phone)}'})">
            Top Up Saldo
          </button>
          <button class="secondary"
            onclick="setHash('use-benefits',{phone:'${esc(m.phone)}'})">
            Gunakan Benefit
          </button>
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
        <p>Daftar item yang dimiliki member. Penggunaan dilakukan melalui tombol <b>Gunakan Benefit</b> di atas.</p>
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

                  </div>
                </article>`).join("")}</div>`
            : `<div class="empty-state">Member belum memiliki Gift Item.</div>`}
      </section>

      <section class="card">
        <h2>Riwayat Transaksi Customer</h2>
        <p>Kasir dan owner bisa melihat history saldo customer. Detail pembayaran POS tidak dicatat di sistem ini.</p>
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
function normalizeJsonArray(value){
  if(Array.isArray(value))return value;
  if(typeof value==="string"){
    try{
      const parsed=JSON.parse(value);
      return Array.isArray(parsed)?parsed:[];
    }catch(err){
      return [];
    }
  }
  return [];
}

function groupAvailableGiftItems(rows){
  const groups=new Map();

  (rows||[])
    .filter(item=>item.status==="available")
    .forEach(item=>{
      const key=item.gift_item_id||
        `${item.item_name}|${item.item_description||""}`;

      if(!groups.has(key)){
        groups.set(key,{
          gift_item_id:item.gift_item_id||null,
          item_name:item.item_name||"Gift Item",
          item_description:item.item_description||"",
          image_data_url:item.image_data_url||null,
          items:[]
        });
      }

      groups.get(key).items.push(item);
    });

  return Array.from(groups.values()).map(group=>{
    group.items.sort((a,b)=>
      new Date(a.expires_at).getTime()-
      new Date(b.expires_at).getTime()
    );
    return group;
  });
}

function unifiedItemSummaryHtml(items){
  const rows=items||[];

  if(!rows.length){
    return `<div class="unified-empty-items">Tidak ada Gift Item dipilih.</div>`;
  }

  return `<div class="unified-summary-items">${rows.map(item=>`
    <div class="unified-summary-item">
      <span>${esc(item.item_name||"Gift Item")}</span>
      <b>${Number(item.quantity||0)}×</b>
    </div>
  `).join("")}</div>`;
}

async function renderUseBenefits(){
  const user=requireLogin();
  if(!user)return;

  mountLayout();
  setNav("kasir");

  const {params}=getRoute();

  screen(`
    <section class="tablet-page">
      ${staffPageHeader(
        "Gunakan Benefit",
        "transaction",
        "Saldo, Gift Item, atau keduanya dalam satu transaksi"
      )}
      <div class="surface-card">
        <div class="empty-state">Memuat benefit member...</div>
      </div>
    </section>
  `);

  try{
    const member=await fetchMemberByPhone(params.phone);

    if(!member){
      setHash("transaction");
      return;
    }

    const [expiryRows,itemRows]=await Promise.all([
      rpc("s3_staff_member_balance_expiry",{
        p_staff_session_token:user.session_token,
        p_member_id:member.member_id
      }),
      rpc("s42_staff_member_benefits",{
        p_staff_session_token:user.session_token,
        p_member_id:member.member_id
      })
    ]);

    const expiryInfo=expiryRows&&expiryRows[0]
      ? expiryRows[0]
      : {};

    const availableBalance=Number(
      expiryInfo.balance??member.balance??0
    );

    const itemGroups=groupAvailableGiftItems(itemRows||[]);
    const selectedQuantities=new Map();

    screen(`
      <section class="tablet-page unified-transaction-page">
        ${staffPageHeader(
          "Gunakan Benefit",
          "transaction",
          "Satu QR dan satu PIN untuk seluruh pilihan"
        )}

        <section class="surface-card unified-member-header">
          <div class="member-avatar large">
            ${esc(
              String(member.name||"?")
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div>
            <h2>${esc(member.name)}</h2>
            <p>
              ${esc(member.phone)} •
              ${esc(member.member_code||"")}
            </p>
          </div>

          <div class="unified-member-balance">
            <small>Saldo Aktif</small>
            <b>${money(availableBalance)}</b>
            <span>
              ${expiryInfo.expires_at
                ? `ED ${dateID(expiryInfo.expires_at)} • 23:59`
                : "Tidak ada saldo aktif"}
            </span>
          </div>
        </section>

        <form id="unified-transaction-form">
          <section class="surface-card benefit-choice-card">
            <div class="benefit-section-heading">
              <div>
                <h2>1. Gunakan Saldo</h2>
                <p>Aktifkan bila saldo Dining akan digunakan.</p>
              </div>

              <label class="benefit-toggle">
                <input id="use-balance-toggle"
                  type="checkbox"
                  ${availableBalance<=0?"disabled":""}/>
                <span></span>
              </label>
            </div>

            <div id="balance-use-fields"
              class="balance-use-fields"
              hidden>
              <label>Nominal Saldo yang Digunakan</label>

              <div class="money-input-large">
                <span>Rp</span>
                <input id="unified-balance-used"
                  inputmode="numeric"
                  placeholder="100000"/>
              </div>

              <div id="unified-balance-calculation"
                class="notice">
                Masukkan nominal saldo.
              </div>
            </div>

            ${availableBalance<=0
              ? `<div class="empty-state compact">
                  Saldo member Rp0.
                </div>`
              : ""}
          </section>

          <section class="surface-card benefit-choice-card">
            <div class="benefit-section-heading">
              <div>
                <h2>2. Gunakan Gift Item</h2>
                <p>Pilih satu atau beberapa item.</p>
              </div>

              <span class="badge">
                ${itemGroups.reduce(
                  (sum,group)=>sum+group.items.length,
                  0
                )} tersedia
              </span>
            </div>

            <div id="unified-item-picker"
              class="unified-item-picker">
              ${itemGroups.length
                ? itemGroups.map((group,index)=>`
                    <article class="unified-item-card"
                      data-item-group-index="${index}">
                      <div class="unified-item-image">
                        ${group.image_data_url
                          ? `<img src="${group.image_data_url}"
                              alt="${esc(group.item_name)}"/>`
                          : `<div class="gift-item-image-placeholder">
                              ${touchIcon("item")}
                            </div>`}
                      </div>

                      <div class="unified-item-info">
                        <h3>${esc(group.item_name)}</h3>
                        ${group.item_description
                          ? `<p>${esc(group.item_description)}</p>`
                          : ""}

                        <small>
                          ${group.items.length} tersedia •
                          ED terdekat
                          ${dateID(group.items[0].expires_at)}
                        </small>

                        <div class="quantity-stepper">
                          <button type="button"
                            data-item-minus="${index}">
                            −
                          </button>

                          <strong id="item-qty-${index}">0</strong>

                          <button type="button"
                            data-item-plus="${index}">
                            +
                          </button>
                        </div>
                      </div>
                    </article>
                  `).join("")
                : `<div class="empty-state">
                    Member belum memiliki Gift Item aktif.
                  </div>`}
            </div>
          </section>

          <section class="surface-card">
            <h2>3. Referensi POS</h2>
            <p>Nomor Bill/Invoice wajib diisi untuk mencocokkan transaksi dengan POS restoran.</p>

            <label>Nomor Bill / Invoice POS</label>
            <input id="unified-invoice"
              maxlength="80"
              placeholder="Contoh: INV-150726-001"
              required/>
          </section>

          <section class="surface-card unified-checkout-card">
            <h2>Ringkasan Transaksi</h2>

            <div class="unified-summary-row">
              <span>Saldo digunakan</span>
              <b id="summary-balance-used">${money(0)}</b>
            </div>

            <div id="summary-items">
              ${unifiedItemSummaryHtml([])}
            </div>

            <div class="unified-summary-row total">
              <span>Benefit dipilih</span>
              <b id="summary-benefit-count">0</b>
            </div>

            <div id="unified-validation-message"
              class="notice">
              Pilih saldo, Gift Item, atau keduanya.
            </div>

            <button class="full touch-button"
              id="create-unified-request"
              disabled>
              Buat QR Konfirmasi
            </button>

            <div id="unified-request-result"></div>
          </section>
        </form>
      </section>
    `);

    const balanceToggle=byId("use-balance-toggle");
    const balanceFields=byId("balance-use-fields");
    const balanceInput=byId("unified-balance-used");
    const invoiceInput=byId("unified-invoice");
    const createButton=byId("create-unified-request");
    const validationBox=byId("unified-validation-message");

    function selectedItemIds(){
      const ids=[];

      itemGroups.forEach((group,index)=>{
        const qty=Number(
          selectedQuantities.get(index)||0
        );

        group.items
          .slice(0,qty)
          .forEach(item=>{
            ids.push(item.member_gift_item_id);
          });
      });

      return ids;
    }

    function selectedItemSummary(){
      return itemGroups.map((group,index)=>({
        item_name:group.item_name,
        quantity:Number(
          selectedQuantities.get(index)||0
        )
      })).filter(item=>item.quantity>0);
    }

    function updateSummary(){
      const useBalance=Boolean(
        balanceToggle&&balanceToggle.checked
      );

      const balanceUsed=useBalance
        ? parseMoney(balanceInput.value)
        : 0;

      const itemIds=selectedItemIds();
      const itemSummary=selectedItemSummary();
      const invoice=invoiceInput.value.trim();

      byId("summary-balance-used").textContent=
        money(balanceUsed);

      byId("summary-items").innerHTML=
        unifiedItemSummaryHtml(itemSummary);

      byId("summary-benefit-count").textContent=
        `${(balanceUsed>0?1:0)+itemIds.length} benefit`;

      let error="";

      if(useBalance&&balanceUsed<=0){
        error="Masukkan nominal saldo yang digunakan.";
      }else if(balanceUsed>availableBalance){
        error="Saldo yang digunakan melebihi saldo member.";
      }else if(balanceUsed<=0&&!itemIds.length){
        error="Pilih saldo, Gift Item, atau keduanya.";
      }else if(!invoice){
        error="Nomor Bill/Invoice POS wajib diisi.";
      }

      if(useBalance){
        const calculation=byId(
          "unified-balance-calculation"
        );

        if(balanceUsed<=0){
          calculation.className="notice";
          calculation.textContent=
            "Masukkan nominal saldo.";
        }else if(balanceUsed>availableBalance){
          calculation.className="error";
          calculation.textContent=
            `Saldo tidak cukup. Saldo aktif ${money(
              availableBalance
            )}.`;
        }else{
          calculation.className="success";
          calculation.innerHTML=
            `Saldo setelah transaksi:
             <b>${money(
               availableBalance-balanceUsed
             )}</b>.`;
        }
      }

      validationBox.className=error
        ? "notice"
        : "success";

      validationBox.textContent=error||
        "Transaksi siap dibuat. Customer akan approve satu kali.";

      createButton.disabled=Boolean(error);
    }

    if(balanceToggle){
      balanceToggle.onchange=()=>{
        balanceFields.hidden=!balanceToggle.checked;

        if(!balanceToggle.checked){
          balanceInput.value="";
        }

        updateSummary();
      };
    }

    balanceInput.oninput=updateSummary;
    invoiceInput.oninput=updateSummary;

    document.querySelectorAll("[data-item-minus]")
      .forEach(button=>{
        button.onclick=()=>{
          const index=Number(button.dataset.itemMinus);
          const current=Number(
            selectedQuantities.get(index)||0
          );

          selectedQuantities.set(
            index,
            Math.max(0,current-1)
          );

          byId(`item-qty-${index}`).textContent=
            selectedQuantities.get(index);

          updateSummary();
        };
      });

    document.querySelectorAll("[data-item-plus]")
      .forEach(button=>{
        button.onclick=()=>{
          const index=Number(button.dataset.itemPlus);
          const max=itemGroups[index].items.length;
          const current=Number(
            selectedQuantities.get(index)||0
          );

          selectedQuantities.set(
            index,
            Math.min(max,current+1)
          );

          byId(`item-qty-${index}`).textContent=
            selectedQuantities.get(index);

          updateSummary();
        };
      });

    byId("unified-transaction-form").onsubmit=
      async event=>{
        event.preventDefault();

        updateSummary();

        if(createButton.disabled)return;

        const box=byId("unified-request-result");
        const balanceUsed=balanceToggle.checked
          ? parseMoney(balanceInput.value)
          : 0;

        const itemIds=selectedItemIds();

        box.innerHTML=`
          <div class="notice">
            Membuat satu approval transaksi...
          </div>`;

        createButton.disabled=true;

        try{
          const rows=await rpc(
            "s42_create_unified_transaction",
            {
              p_staff_session_token:user.session_token,
              p_member_id:member.member_id,
              p_invoice_number:invoiceInput.value.trim(),
              p_balance_used:balanceUsed,
              p_member_gift_item_ids:itemIds
            }
          );

          const result=rows&&rows[0]?rows[0]:{};

          if(!result.token){
            throw new Error(
              "Token transaksi gagal dibuat."
            );
          }

          setHash("unified-waiting",{
            token:result.token
          });
        }catch(err){
          box.innerHTML=`
            <div class="error">${safeError(err)}</div>`;
          updateSummary();
        }
      };

    updateSummary();
  }catch(err){
    screen(`
      <section class="card">
        <h1>Error</h1>
        <div class="error">${safeError(err)}</div>
      </section>
    `);
  }
}

async function renderUnifiedWaiting(){
  const user=requireLogin();
  if(!user)return;

  mountLayout();
  setNav("kasir");

  const {params}=getRoute();
  const token=params.token;
  const link=
    `${publicBaseUrl()}#approve-transaction?token=${token}`;

  screen(`
    <section class="tablet-page">
      ${staffPageHeader(
        "Menunggu Konfirmasi",
        "transaction"
      )}
      <section class="surface-card">
        <div class="empty-state">
          Memuat transaksi...
        </div>
      </section>
    </section>
  `);

  function draw(request){
    const items=normalizeJsonArray(request.items);

    screen(`
      <section class="tablet-page unified-waiting-page">
        ${staffPageHeader(
          "Menunggu Konfirmasi",
          "transaction",
          request.reference_code||""
        )}

        <section class="surface-card">
          <div class="unified-waiting-header">
            <div>
              <h2>${esc(request.member_name||"-")}</h2>
              <p>${esc(request.member_phone||"-")}</p>
            </div>

            <span class="status-pill ${
              request.status==="waiting"
                ?"available"
                : request.status
            }">
              ${esc(
                String(request.status||"").toUpperCase()
              )}
            </span>
          </div>

          <div class="unified-detail-grid">
            <div>
              <span>Bill / Invoice</span>
              <b>${esc(request.invoice_number||"-")}</b>
            </div>
            <div>
              <span>Referensi</span>
              <b>${esc(request.reference_code||"-")}</b>
            </div>
            <div>
              <span>Saldo Dipakai</span>
              <b>${money(request.balance_used||0)}</b>
            </div>
            <div>
              <span>Saldo Setelah</span>
              <b>${money(request.balance_after||0)}</b>
            </div>
          </div>

          <h3>Gift Item</h3>
          ${unifiedItemSummaryHtml(items)}

          <div class="qr-wrap">
            <img class="qr-img"
              src="${qrImageUrl(link)}"
              alt="QR Konfirmasi Transaksi"/>

            <div class="meta">
              Customer scan QR dan masukkan PIN satu kali.
            </div>
          </div>

          <label>Link Konfirmasi</label>
          <textarea class="copy-area"
            readonly>${link}</textarea>

          <button class="secondary full"
            id="copy-unified-link">
            Copy Link
          </button>

          <button class="ghost full"
            style="margin-top:8px"
            onclick="setHash(
              'approve-transaction',
              {token:'${token}'}
            )">
            Simulasi Customer di Browser Ini
          </button>

          <div id="unified-waiting-status"
            class="notice"
            style="margin-top:12px">
            Status: ${esc(request.status||"waiting")}
          </div>
        </section>
      </section>
    `);

    byId("copy-unified-link").onclick=async()=>{
      try{
        await navigator.clipboard.writeText(link);
        alert("Link copied");
      }catch(err){
        window.prompt("Copy link berikut:",link);
      }
    };
  }

  try{
    const rows=await rpc(
      "mvp_get_unified_transaction",
      {p_token:token}
    );

    if(!rows||!rows.length){
      throw new Error(
        "Transaksi tidak ditemukan."
      );
    }

    draw(rows[0]);
  }catch(err){
    screen(`
      <section class="card">
        <h1>Error</h1>
        <div class="error">${safeError(err)}</div>
      </section>
    `);
    return;
  }

  const interval=setInterval(async()=>{
    const box=byId("unified-waiting-status");

    if(!box){
      clearInterval(interval);
      return;
    }

    try{
      const rows=await rpc(
        "mvp_get_unified_transaction",
        {p_token:token}
      );

      const request=rows&&rows[0];

      if(!request)return;

      if(request.status==="approved"){
        box.className="success";
        box.innerHTML="Status: Approved ✅";

        setTimeout(()=>{
          setHash("unified-success",{token});
        },700);

        clearInterval(interval);
      }else if(
        request.status==="rejected"||
        request.status==="expired"
      ){
        box.className="error";
        box.innerHTML=
          `Status: ${String(
            request.status
          ).toUpperCase()}`;

        clearInterval(interval);
      }else{
        box.className="notice";
        box.innerHTML=
          `Status: ${esc(request.status)}`;
      }
    }catch(err){
      console.warn(err);
    }
  },2500);
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


async function renderApproveTransaction(){
  const {params}=getRoute();
  const token=params.token;

  byId("app").innerHTML=`
    <main class="customer-shell"></main>`;

  const target=document.querySelector("main");

  target.innerHTML=`
    <div class="empty-state">
      Memuat transaksi...
    </div>`;

  try{
    const rows=await rpc(
      "mvp_get_unified_transaction",
      {p_token:token}
    );

    if(!rows||!rows.length){
      throw new Error(
        "Transaksi tidak ditemukan."
      );
    }

    const request=rows[0];

    if(request.status!=="waiting"){
      throw new Error(
        `Transaksi sudah ${request.status}.`
      );
    }

    const items=normalizeJsonArray(request.items);

    let pin="";

    target.innerHTML=`
      <section class="customer-confirm-card unified-customer-confirm">
        ${brandMiniHtml()}

        <button class="back-button customer-back"
          onclick="setHash('customer-login')">
          ←
        </button>

        <h1>Konfirmasi Transaksi</h1>

        <div class="customer-reference-strip">
          <span>Bill ${esc(request.invoice_number||"-")}</span>
          <b>${esc(request.reference_code||"-")}</b>
        </div>

        ${Number(request.balance_used||0)>0
          ? `<div class="customer-confirm-benefit">
              <span>Saldo yang digunakan</span>
              <strong>${money(request.balance_used)}</strong>
              <small>
                Sisa saldo ${money(request.balance_after||0)}
              </small>
            </div>`
          : ""}

        ${items.length
          ? `<div class="customer-confirm-items">
              <h3>Gift Item</h3>
              ${items.map(item=>`
                <div>
                  <span>${esc(item.item_name||"Gift Item")}</span>
                  <b>${Number(item.quantity||0)}×</b>
                </div>
              `).join("")}
            </div>`
          : ""}

        <div class="unified-atomic-note">
          Saldo dan seluruh Gift Item akan diproses bersamaan
          setelah PIN benar.
        </div>

        <p>Masukkan PIN Anda</p>

        <div class="pin-dots" id="unified-pin-dots">
          ${Array.from(
            {length:6},
            ()=>"<i></i>"
          ).join("")}
        </div>

        <div class="numeric-keypad"
          aria-label="Keypad PIN">
          ${[1,2,3,4,5,6,7,8,9]
            .map(number=>`
              <button type="button"
                data-unified-pin="${number}"
                aria-label="Angka ${number}">
                ${number}
              </button>
            `).join("")}

          <button type="button"
            class="unified-key-clear"
            aria-label="Hapus seluruh PIN">
            C
          </button>

          <button type="button"
            data-unified-pin="0"
            aria-label="Angka 0">
            0
          </button>

          <button type="button"
            class="unified-key-back"
            aria-label="Hapus satu angka">
            ⌫
          </button>
        </div>

        <button class="full touch-button"
          id="approve-unified-button"
          disabled>
          APPROVE
        </button>

        <button class="text-button"
          id="reject-unified-button">
          Tolak Transaksi
        </button>

        <div id="approve-unified-result"></div>
      </section>
    `;

    const drawDots=()=>{
      document.querySelectorAll(
        "#unified-pin-dots i"
      ).forEach((dot,index)=>{
        dot.classList.toggle(
          "filled",
          index<pin.length
        );
      });
    };

    document.querySelectorAll("[data-unified-pin]")
      .forEach(button=>{
        button.onclick=()=>{
          if(pin.length<6){
            pin+=button.dataset.unifiedPin;
            drawDots();

            byId(
              "approve-unified-button"
            ).disabled=pin.length!==6;
          }
        };
      });

    document.querySelector(
      ".unified-key-clear"
    ).onclick=()=>{
      pin="";
      drawDots();

      byId(
        "approve-unified-button"
      ).disabled=true;
    };

    document.querySelector(
      ".unified-key-back"
    ).onclick=()=>{
      pin=pin.slice(0,-1);
      drawDots();

      byId(
        "approve-unified-button"
      ).disabled=pin.length!==6;
    };

    byId("reject-unified-button").onclick=
      async()=>{
        const box=byId("approve-unified-result");

        try{
          await rpc(
            "mvp_reject_unified_transaction",
            {p_token:token}
          );

          box.innerHTML=`
            <div class="error">
              Transaksi ditolak. Saldo dan Gift Item tidak berubah.
            </div>`;

          byId("approve-unified-button").disabled=true;
          byId("reject-unified-button").disabled=true;
        }catch(err){
          box.innerHTML=`
            <div class="error">${safeError(err)}</div>`;
        }
      };

    byId("approve-unified-button").onclick=
      async()=>{
        const box=byId("approve-unified-result");
        const button=byId(
          "approve-unified-button"
        );

        button.disabled=true;

        box.innerHTML=`
          <div class="notice">
            Memproses seluruh benefit...
          </div>`;

        try{
          const approvalRows=await rpc(
            "mvp_approve_unified_transaction",
            {
              p_token:token,
              p_password:pin
            }
          );

          const result=approvalRows&&approvalRows[0]
            ? approvalRows[0]
            : {};

          if(result.approval_success===false){
            box.innerHTML=`
              <div class="error">
                ${esc(
                  result.error_message||
                  "PIN salah."
                )}
              </div>`;

            pin="";
            drawDots();
            return;
          }

          const approvedItems=normalizeJsonArray(
            result.items
          ).length
            ? normalizeJsonArray(result.items)
            : items;

          target.innerHTML=`
            <section class="customer-confirm-card success-transition">
              ${brandMiniHtml()}

              <div class="success-check">✓</div>
              <h1>Transaksi Berhasil</h1>

              ${Number(request.balance_used||0)>0
                ? `<div class="confirm-amount">
                    ${money(request.balance_used)}
                  </div>
                  <p>
                    Sisa saldo
                    ${money(result.balance_after||0)}
                  </p>`
                : ""}

              ${approvedItems.length
                ? `<div class="customer-confirm-items success-items">
                    ${approvedItems.map(item=>`
                      <div>
                        <span>${esc(
                          item.item_name||"Gift Item"
                        )}</span>
                        <b>${Number(
                          item.quantity||0
                        )}×</b>
                      </div>
                    `).join("")}
                  </div>`
                : ""}
            </section>`;

          setTimeout(()=>{
            setHash("promo",{
              token,
              kind:"unified"
            });
          },900);
        }catch(err){
          box.innerHTML=`
            <div class="error">${safeError(err)}</div>`;

          pin="";
          drawDots();
        }
      };
  }catch(err){
    target.innerHTML=`
      <section class="customer-login-card">
        ${brandMiniHtml()}
        <div class="error">${safeError(err)}</div>
      </section>`;
  }
}

async function renderUnifiedSuccess(){
  const user=requireLogin();
  if(!user)return;

  mountLayout();
  setNav("kasir");

  const {params}=getRoute();

  try{
    const rows=await rpc(
      "mvp_get_unified_transaction",
      {p_token:params.token}
    );

    const request=rows&&rows[0];

    if(!request){
      throw new Error("Transaksi tidak ditemukan.");
    }

    const items=normalizeJsonArray(request.items);

    screen(`
      <section class="tablet-page">
        ${staffPageHeader(
          "Transaksi Berhasil",
          "transaction",
          request.reference_code||""
        )}

        <section class="surface-card unified-success-card">
          <div class="success-check">✓</div>
          <h1>Approval Customer Berhasil</h1>

          <div class="unified-detail-grid">
            <div>
              <span>Member</span>
              <b>${esc(request.member_name||"-")}</b>
            </div>
            <div>
              <span>Bill / Invoice</span>
              <b>${esc(request.invoice_number||"-")}</b>
            </div>
            <div>
              <span>Saldo Dipakai</span>
              <b>${money(request.balance_used||0)}</b>
            </div>
            <div>
              <span>Saldo Sisa</span>
              <b>${money(request.balance_after||0)}</b>
            </div>
          </div>

          ${items.length
            ? `<h3>Gift Item Digunakan</h3>
              ${unifiedItemSummaryHtml(items)}`
            : ""}

          <div class="notice">
            Cocokkan referensi
            <b>${esc(request.reference_code||"-")}</b>
            dan Bill
            <b>${esc(request.invoice_number||"-")}</b>
            pada POS restoran.
          </div>

          <button class="full touch-button"
            onclick="setHash('transaction')">
            Transaksi Baru
          </button>

          <button class="ghost full"
            style="margin-top:8px"
            onclick="setHash(
              'member',
              {phone:'${esc(request.member_phone||"")}'}
            )">
            Lihat Member
          </button>
        </section>
      </section>
    `);
  }catch(err){
    screen(`
      <section class="card">
        <h1>Error</h1>
        <div class="error">${safeError(err)}</div>
      </section>
    `);
  }
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
    <section class="tablet-page reward-admin-page">
      ${staffPageHeader(
        "Voucher & Gift",
        staffHomeRoute(),
        "Pilih jenis reward"
      )}

      <section class="reward-type-section">
        <div class="reward-type-grid" id="reward-type-grid">
          <button class="reward-type-card active" type="button"
            data-reward-type="voucher">
            <span class="reward-type-icon">◇</span>
            <b>VOUCHER</b>
            <small>Member Baru</small>
          </button>

          <button class="reward-type-card" type="button"
            data-reward-type="gift">
            <span class="reward-type-icon">＋</span>
            <b>GIFT SALDO</b>
            <small>Existing Member</small>
          </button>

          <button class="reward-type-card" type="button"
            data-reward-type="item">
            <span class="reward-type-icon">▦</span>
            <b>GIFT ITEM</b>
            <small>Hadiah Menu</small>
          </button>
        </div>
      </section>

      <section class="surface-card reward-generator-card">
        <div id="reward-generator-header"></div>

        <form id="balance-reward-form">
          <label>Campaign / Event</label>
          <input id="balance-campaign"
            value="Soft Opening CACAYO"
            maxlength="100"
            required/>

          <div class="grid two">
            <div>
              <label>Jumlah Kode</label>
              <input id="balance-qty"
                inputmode="numeric"
                value="5"
                required/>
            </div>
            <div>
              <label>Nominal per Kode</label>
              <input id="balance-value"
                inputmode="numeric"
                value="100000"
                required/>
            </div>
          </div>

          <label>Expired Date</label>
          <input id="balance-expired"
            type="date"
            value="${defaultExpiry}"
            required/>

          <div class="expiry-cutoff-note">
            Berlaku sampai pukul 23:59 pada tanggal ED.
          </div>

          <button class="full touch-button"
            id="balance-generate-button"
            style="margin-top:14px">
            Generate Voucher
          </button>
        </form>

        <form id="item-reward-form" hidden>
          <div class="item-picker-heading">
            <div>
              <h3>Pilih Gift Item</h3>
              <p>Pilih item dari kartu bergambar.</p>
            </div>
            <button class="ghost" type="button"
              id="open-master-item-button">
              Kelola Master Item
            </button>
          </div>

          <div id="visual-item-picker"
            class="visual-item-picker">
            <div class="empty-state">Loading Master Item...</div>
          </div>

          <input id="selected-gift-item-id"
            type="hidden"/>

          <label>Campaign / Event</label>
          <input id="item-campaign"
            maxlength="100"
            value="Special Gift CACAYO"
            required/>

          <div class="grid two">
            <div>
              <label>Jumlah Kode</label>
              <input id="item-qty"
                inputmode="numeric"
                value="10"
                required/>
            </div>
            <div>
              <label>Expired Date</label>
              <input id="item-expired"
                type="date"
                value="${defaultExpiry}"
                required/>
            </div>
          </div>

          <div class="expiry-cutoff-note">
            Setiap kode memberikan 1 item. Berlaku sampai pukul 23:59
            pada tanggal ED.
          </div>

          <button class="full touch-button"
            style="margin-top:14px">
            Generate Gift Item
          </button>
        </form>

        <div id="reward-generate-result"
          style="margin-top:12px"></div>
      </section>

      <section class="surface-card master-item-panel"
        id="master-item-panel" hidden>
        <div class="section-heading-row">
          <div>
            <h2>Master Gift Item</h2>
            <p>Buat dan kelola menu yang dapat dijadikan Gift Item.</p>
          </div>
          <button class="ghost" type="button"
            id="close-master-item-button">
            Tutup
          </button>
        </div>

        <div class="gift-item-admin-layout">
          <form id="gift-item-master-form"
            class="gift-item-master-form">
            <input id="gift-item-id" type="hidden"/>

            <label>Nama Item</label>
            <input id="gift-item-name"
              maxlength="100"
              placeholder="Contoh: Mie Ayam"
              required/>

            <label>Deskripsi Singkat</label>
            <textarea id="gift-item-description"
              maxlength="240"
              placeholder="Contoh: 1 porsi Mie Ayam Original"></textarea>

            <label>Foto Item</label>
            <input id="gift-item-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"/>

            <small>Foto otomatis dipotong menjadi 800 × 800 px.</small>

            <div id="gift-item-preview"
              class="gift-item-master-preview">
              <div class="empty-state">Belum ada foto.</div>
            </div>

            <label class="switch-row">
              <span>Item Aktif</span>
              <input id="gift-item-active"
                type="checkbox"
                checked/>
            </label>

            <button class="full touch-button">
              Simpan Master Item
            </button>

            <button class="ghost full"
              type="button"
              id="gift-item-reset-form">
              + Item Baru
            </button>

            <div id="gift-item-master-result"></div>
          </form>

          <div>
            <h3>Daftar Master Item</h3>
            <div id="gift-item-master-list"
              class="gift-item-master-list">
              <div class="empty-state">Loading...</div>
            </div>
          </div>
        </div>
      </section>

      <section class="surface-card reward-control-card"
        id="reward-control-section">
        <div class="section-heading-row">
          <div>
            <h2 id="reward-control-title">Voucher Control</h2>
            <p id="reward-control-description">
              Kode untuk pendaftaran member baru.
            </p>
          </div>
          <button class="ghost" type="button"
            id="refresh-reward-codes">
            Refresh
          </button>
        </div>

        <div class="reward-control-type-grid"
          id="reward-control-type-grid">
          <button class="active" type="button"
            data-control-type="voucher">
            <b>VOUCHER</b>
            <small>Member Baru</small>
          </button>

          <button type="button"
            data-control-type="gift">
            <b>GIFT SALDO</b>
            <small>Existing Member</small>
          </button>

          <button type="button"
            data-control-type="item">
            <b>GIFT ITEM</b>
            <small>Hadiah Menu</small>
          </button>
        </div>

        <div class="reward-status-filter"
          id="reward-status-filter">
          <button class="active" type="button"
            data-code-status="available">
            Available
          </button>
          <button type="button"
            data-code-status="claimed">
            Claimed
          </button>
          <button type="button"
            data-code-status="registered">
            Registered
          </button>
          <button type="button"
            data-code-status="expired">
            Expired
          </button>
          <button type="button"
            data-code-status="all">
            All
          </button>
        </div>

        <div id="reward-code-summary"
          class="reward-code-summary"></div>

        <div id="reward-code-list"
          class="list reward-code-list">
          <div class="empty-state">Loading...</div>
        </div>

        <div class="pagination-bar">
          <button class="ghost" id="reward-prev-page"
            type="button">
            ← Prev
          </button>
          <div class="page-info" id="reward-page-info">
            Page -
          </div>
          <button class="ghost" id="reward-next-page"
            type="button">
            Next →
          </button>
        </div>
      </section>
    </section>
  `);

  const joinBase=`${publicBaseUrl()}#join?code=`;
  const claimBase=`${publicBaseUrl()}#claim-gift?code=`;

  const pageSize=10;
  let activeRewardType="voucher";
  let activeControlType="voucher";
  let activeStatus="available";
  let currentPage=1;
  let currentRows=[];
  let totalCount=0;
  let masterItems=[];
  let masterImageData=null;

  function normalizedCodeType(value){
    const type=String(value||"voucher").toLowerCase();
    return ["voucher","gift","item"].includes(type)
      ? type
      : "voucher";
  }

  function rewardTypeTitle(type){
    if(type==="gift")return "Generate Gift Saldo";
    if(type==="item")return "Generate Gift Item";
    return "Generate Voucher";
  }

  function rewardTypeDescription(type){
    if(type==="gift"){
      return "Gift saldo untuk existing member. Saldo bertambah setelah claim.";
    }
    if(type==="item"){
      return "Hadiah menu untuk existing member dalam bentuk kartu bergambar.";
    }
    return "Voucher digunakan satu kali saat customer baru mendaftar.";
  }

  function controlDescription(type){
    if(type==="gift"){
      return "Kode Gift Saldo untuk existing member.";
    }
    if(type==="item"){
      return "Kode Gift Item berdasarkan Master Item.";
    }
    return "Kode Voucher untuk pendaftaran member baru.";
  }

  function codeTypeLabel(type){
    if(type==="gift")return "GIFT SALDO";
    if(type==="item")return "GIFT ITEM";
    return "VOUCHER";
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

Login menggunakan nomor WhatsApp dan PIN member, lalu klik CLAIM / OK.

Satu kode hanya dapat diclaim 1 kali.`;
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

  function setActiveRewardType(type,options={}){
    activeRewardType=normalizedCodeType(type);

    document.querySelectorAll("[data-reward-type]")
      .forEach(button=>{
        button.classList.toggle(
          "active",
          button.dataset.rewardType===activeRewardType
        );
      });

    byId("reward-generator-header").innerHTML=`
      <div class="reward-generator-heading">
        <span class="code-type-pill ${activeRewardType}">
          ${codeTypeLabel(activeRewardType)}
        </span>
        <h2>${rewardTypeTitle(activeRewardType)}</h2>
        <p>${rewardTypeDescription(activeRewardType)}</p>
      </div>`;

    const itemMode=activeRewardType==="item";
    byId("balance-reward-form").hidden=itemMode;
    byId("item-reward-form").hidden=!itemMode;

    if(!itemMode){
      const giftMode=activeRewardType==="gift";
      byId("balance-campaign").value=giftMode
        ? "Special Gift CACAYO"
        : "Soft Opening CACAYO";
      byId("balance-generate-button").textContent=giftMode
        ? "Generate Gift Saldo"
        : "Generate Voucher";
    }

    if(options.syncControl!==false){
      setActiveControlType(activeRewardType,{
        load:true,
        scroll:false
      });
    }
  }

  function setActiveControlType(type,options={}){
    activeControlType=normalizedCodeType(type);

    document.querySelectorAll("[data-control-type]")
      .forEach(button=>{
        button.classList.toggle(
          "active",
          button.dataset.controlType===activeControlType
        );
      });

    byId("reward-control-title").textContent=
      `${codeTypeLabel(activeControlType)} Control`;

    byId("reward-control-description").textContent=
      controlDescription(activeControlType);

    currentPage=1;

    if(options.load!==false){
      loadRewardCodes();
    }

    if(options.scroll){
      byId("reward-control-section")
        .scrollIntoView({
          behavior:"smooth",
          block:"start"
        });
    }
  }

  function setActiveStatus(status){
    activeStatus=String(status||"available").toLowerCase();

    document.querySelectorAll("[data-code-status]")
      .forEach(button=>{
        button.classList.toggle(
          "active",
          button.dataset.codeStatus===activeStatus
        );
      });

    currentPage=1;
    loadRewardCodes();
  }

  function renderPagination(){
    const pages=Math.max(
      1,
      Math.ceil(totalCount/pageSize)
    );

    byId("reward-page-info").textContent=
      `Page ${currentPage} / ${pages} • ${totalCount} kode`;

    byId("reward-prev-page").disabled=currentPage<=1;
    byId("reward-next-page").disabled=currentPage>=pages;
  }

  function renderCodeSummary(){
    const label=codeTypeLabel(activeControlType);

    byId("reward-code-summary").innerHTML=`
      <div>
        <span>Kategori</span>
        <b>${label}</b>
      </div>
      <div>
        <span>Status</span>
        <b>${activeStatus.toUpperCase()}</b>
      </div>
      <div>
        <span>Total</span>
        <b>${totalCount}</b>
      </div>`;
  }

  function renderRewardCodes(){
    renderCodeSummary();

    if(!currentRows.length){
      byId("reward-code-list").innerHTML=`
        <div class="empty-state reward-empty-state">
          <b>Belum ada ${codeTypeLabel(activeControlType)}</b>
          <span>
            ${activeStatus==="available"
              ? "Generate kode baru dari bagian atas halaman."
              : "Tidak ada kode dengan status ini."}
          </span>
        </div>`;
      renderPagination();
      return;
    }

    byId("reward-code-list").innerHTML=
      currentRows.map(row=>{
        const type=normalizedCodeType(row.code_type);
        const cls=voucherStatusClass(row.voucher_status);
        const isAvailable=row.voucher_status==="available";
        const isCopied=Boolean(row.copied_at);

        const memberText=row.voucher_status==="registered"
          ? `Registered by ${row.used_by_name||"-"}`
          : row.voucher_status==="claimed"
            ? `Claimed by ${row.used_by_name||"-"}`
            : isCopied
              ? `COPIED ${String(
                  row.copied_method||""
                ).toUpperCase()}`
              : "Belum dibagikan";

        const rewardValue=type==="item"
          ? `<div class="reward-item-code-name">
              <span class="reward-item-code-icon">▦</span>
              <b>${esc(
                row.gift_item_name||"Gift Item"
              )}</b>
            </div>`
          : `<div class="money">${money(row.value)}</div>`;

        let actions="";

        if(isAvailable){
          if(isCopied){
            actions=`
              <div class="voucher-actions">
                <span class="copied-badge">✓ COPIED</span>
              </div>`;
          }else{
            actions=`
              <div class="voucher-actions">
                <button class="secondary"
                  type="button"
                  onclick="window.shareRewardCode(
                    '${row.gift_id}',
                    'wa',
                    this
                  )">
                  Copy WA
                </button>

                <button class="ghost"
                  type="button"
                  onclick="window.shareRewardCode(
                    '${row.gift_id}',
                    'link',
                    this
                  )">
                  Copy Link
                </button>

                <button class="danger"
                  type="button"
                  onclick="window.deleteRewardCode(
                    '${row.gift_id}',
                    '${esc(row.code)}'
                  )">
                  Delete
                </button>
              </div>`;
          }
        }else{
          actions=`
            <div class="voucher-actions">
              <span class="status-pill ${cls}">
                ${esc(
                  String(row.voucher_status||"").toUpperCase()
                )}
              </span>
            </div>`;
        }

        return `
          <article class="reward-code-row ${cls}">
            <div class="reward-code-primary">
              <span class="code-type-pill ${type}">
                ${codeTypeLabel(type)}
              </span>
              <div class="code-box">${esc(row.code)}</div>
              <div class="meta">
                ED ${esc(row.expired_at||"-")} • 23:59
              </div>
            </div>

            <div class="reward-code-detail">
              <b>${esc(row.campaign_name||"-")}</b>
              <span>${esc(memberText)}</span>
            </div>

            <div class="reward-code-value">
              ${rewardValue}
            </div>

            ${actions}
          </article>`;
      }).join("");

    renderPagination();
  }

  async function loadRewardCodes(){
    byId("reward-code-list").innerHTML=`
      <div class="empty-state">Loading...</div>`;

    try{
      currentRows=await rpc("s4_list_reward_codes_paged",{
        p_staff_session_token:user.session_token,
        p_code_type:activeControlType,
        p_status:activeStatus,
        p_limit:pageSize,
        p_offset:(currentPage-1)*pageSize
      })||[];

      totalCount=currentRows.length
        ? Number(currentRows[0].total_count||0)
        : 0;

      renderRewardCodes();
    }catch(err){
      currentRows=[];
      totalCount=0;
      renderCodeSummary();

      byId("reward-code-list").innerHTML=`
        <div class="error">
          ${safeError(err)}
        </div>`;

      renderPagination();
    }
  }

  async function copyWithFallback(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(err){
      window.prompt("Copy teks berikut:",text);
      return false;
    }
  }

  window.shareRewardCode=async(
    rewardId,
    method,
    button
  )=>{
    const row=button
      ? button.closest(".reward-code-row")
      : null;

    const buttons=row
      ? Array.from(row.querySelectorAll("button"))
      : [];

    buttons.forEach(item=>item.disabled=true);

    try{
      const rows=await rpc("s4_copy_reward_code",{
        p_staff_session_token:user.session_token,
        p_gift_id:rewardId,
        p_method:method
      });

      const result=rows&&rows[0]?rows[0]:{};

      if(result.copy_allowed===false){
        alert(
          result.error_message||
          "Kode sudah pernah dicopy."
        );
        await loadRewardCodes();
        return;
      }

      const text=method==="wa"
        ? waMessageFor(result)
        : codeLink(result);

      await copyWithFallback(text);
      await loadRewardCodes();
    }catch(err){
      buttons.forEach(item=>item.disabled=false);
      alert(safeError(err));
    }
  };

  window.deleteRewardCode=async(rewardId,code)=>{
    if(!confirm(`Delete kode ${code}?`))return;

    try{
      await rpc("s3_delete_gift_code",{
        p_staff_session_token:user.session_token,
        p_gift_id:rewardId
      });

      await loadRewardCodes();
    }catch(err){
      alert(safeError(err));
    }
  };

  function resetMasterForm(){
    byId("gift-item-id").value="";
    byId("gift-item-name").value="";
    byId("gift-item-description").value="";
    byId("gift-item-active").checked=true;
    byId("gift-item-file").value="";
    masterImageData=null;

    byId("gift-item-preview").innerHTML=`
      <div class="empty-state">Belum ada foto.</div>`;
  }

  function renderVisualItemPicker(){
    const activeItems=masterItems.filter(
      item=>item.is_active
    );

    if(!activeItems.length){
      byId("visual-item-picker").innerHTML=`
        <button class="empty-item-picker"
          type="button"
          id="empty-create-item-button">
          <span>＋</span>
          <b>Buat Master Gift Item</b>
          <small>Belum ada item aktif.</small>
        </button>`;

      byId("selected-gift-item-id").value="";

      byId("empty-create-item-button").onclick=()=>{
        showMasterItemPanel();
      };

      return;
    }

    const currentId=byId(
      "selected-gift-item-id"
    ).value;

    const selectedExists=activeItems.some(
      item=>item.item_id===currentId
    );

    if(!selectedExists){
      byId("selected-gift-item-id").value=
        activeItems[0].item_id;
    }

    const selectedId=byId(
      "selected-gift-item-id"
    ).value;

    byId("visual-item-picker").innerHTML=
      activeItems.map(item=>`
        <button class="visual-item-card ${
          item.item_id===selectedId?"active":""
        }"
          type="button"
          data-item-picker-id="${item.item_id}">
          <div class="visual-item-image">
            ${item.image_data_url
              ? `<img src="${item.image_data_url}"
                  alt="${esc(item.name)}"/>`
              : `<div class="gift-item-image-placeholder">
                  ▦
                </div>`}
          </div>
          <b>${esc(item.name)}</b>
          <small>${esc(
            item.description||"1 Gift Item"
          )}</small>
          <span class="visual-item-check">✓</span>
        </button>
      `).join("");

    document.querySelectorAll("[data-item-picker-id]")
      .forEach(button=>{
        button.onclick=()=>{
          byId("selected-gift-item-id").value=
            button.dataset.itemPickerId;

          document.querySelectorAll(
            "[data-item-picker-id]"
          ).forEach(item=>{
            item.classList.toggle(
              "active",
              item===button
            );
          });
        };
      });
  }

  function renderMasterItems(){
    if(!masterItems.length){
      byId("gift-item-master-list").innerHTML=`
        <div class="empty-state">
          Belum ada Master Gift Item.
        </div>`;

      renderVisualItemPicker();
      return;
    }

    byId("gift-item-master-list").innerHTML=
      masterItems.map((item,index)=>`
        <article class="gift-item-master-row">
          <div class="gift-item-master-thumb">
            ${item.image_data_url
              ? `<img src="${item.image_data_url}"
                  alt="${esc(item.name)}"/>`
              : ""}
          </div>

          <div>
            <h3>${esc(item.name)}</h3>
            <p>${esc(item.description||"")}</p>
            <span class="badge ${item.is_active?"ok":""}">
              ${item.is_active?"AKTIF":"NONAKTIF"}
            </span>
          </div>

          <button class="ghost"
            type="button"
            onclick="window.editGiftItemMaster(${index})">
            Edit
          </button>
        </article>
      `).join("");

    renderVisualItemPicker();
  }

  async function loadMasterItems(){
    try{
      masterItems=await rpc("s4_list_gift_item_master",{
        p_staff_session_token:user.session_token,
        p_include_inactive:true
      })||[];

      renderMasterItems();
    }catch(err){
      byId("gift-item-master-list").innerHTML=`
        <div class="error">${safeError(err)}</div>`;

      byId("visual-item-picker").innerHTML=`
        <div class="error">${safeError(err)}</div>`;
    }
  }

  function showMasterItemPanel(){
    byId("master-item-panel").hidden=false;
    byId("master-item-panel").scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  }

  function hideMasterItemPanel(){
    byId("master-item-panel").hidden=true;
  }

  window.editGiftItemMaster=index=>{
    const item=masterItems[index];
    if(!item)return;

    showMasterItemPanel();

    byId("gift-item-id").value=item.item_id;
    byId("gift-item-name").value=item.name||"";
    byId("gift-item-description").value=
      item.description||"";
    byId("gift-item-active").checked=
      Boolean(item.is_active);

    masterImageData=item.image_data_url||null;

    byId("gift-item-preview").innerHTML=
      masterImageData
        ? `<img src="${masterImageData}"
            alt="${esc(item.name)}"/>`
        : `<div class="empty-state">
            Belum ada foto.
          </div>`;
  };

  document.querySelectorAll("[data-reward-type]")
    .forEach(button=>{
      button.onclick=()=>{
        setActiveRewardType(
          button.dataset.rewardType
        );
      };
    });

  document.querySelectorAll("[data-control-type]")
    .forEach(button=>{
      button.onclick=()=>{
        setActiveControlType(
          button.dataset.controlType,
          {load:true,scroll:false}
        );
      };
    });

  document.querySelectorAll("[data-code-status]")
    .forEach(button=>{
      button.onclick=()=>{
        setActiveStatus(
          button.dataset.codeStatus
        );
      };
    });

  byId("balance-reward-form").onsubmit=
    async event=>{
      event.preventDefault();

      const box=byId("reward-generate-result");
      const qty=Math.min(
        parseMoney(byId("balance-qty").value),
        500
      );

      const value=parseMoney(
        byId("balance-value").value
      );

      if(qty<1){
        box.innerHTML=`
          <div class="error">
            Jumlah kode minimal 1.
          </div>`;
        return;
      }

      if(value<1000){
        box.innerHTML=`
          <div class="error">
            Nominal minimal Rp1.000.
          </div>`;
        return;
      }

      box.innerHTML=`
        <div class="notice">
          Generating ${codeTypeLabel(activeRewardType)}...
        </div>`;

      try{
        const rows=await rpc(
          "s3_generate_campaign_codes",
          {
            p_staff_session_token:user.session_token,
            p_code_type:activeRewardType,
            p_campaign_name:byId(
              "balance-campaign"
            ).value.trim(),
            p_value:value,
            p_expired_at:byId(
              "balance-expired"
            ).value,
            p_qty:qty
          }
        );

        const createdCount=(rows||[]).length;

        box.innerHTML=`
          <div class="success">
            <b>${createdCount} ${
              codeTypeLabel(activeRewardType)
            } berhasil dibuat.</b><br>
            Kode langsung ditampilkan pada Control di bawah.
          </div>`;

        activeStatus="available";
        document.querySelectorAll(
          "[data-code-status]"
        ).forEach(button=>{
          button.classList.toggle(
            "active",
            button.dataset.codeStatus==="available"
          );
        });

        setActiveControlType(
          activeRewardType,
          {load:true,scroll:true}
        );
      }catch(err){
        box.innerHTML=`
          <div class="error">${safeError(err)}</div>`;
      }
    };

  byId("item-reward-form").onsubmit=
    async event=>{
      event.preventDefault();

      const box=byId("reward-generate-result");
      const itemId=byId(
        "selected-gift-item-id"
      ).value;

      const qty=Math.min(
        parseMoney(byId("item-qty").value),
        500
      );

      if(!itemId){
        box.innerHTML=`
          <div class="error">
            Pilih atau buat Master Gift Item terlebih dahulu.
          </div>`;
        return;
      }

      if(qty<1){
        box.innerHTML=`
          <div class="error">
            Jumlah kode minimal 1.
          </div>`;
        return;
      }

      box.innerHTML=`
        <div class="notice">
          Generating Gift Item...
        </div>`;

      try{
        const rows=await rpc(
          "s4_generate_item_gift_codes",
          {
            p_staff_session_token:user.session_token,
            p_gift_item_id:itemId,
            p_campaign_name:byId(
              "item-campaign"
            ).value.trim(),
            p_expired_at:byId(
              "item-expired"
            ).value,
            p_qty:qty
          }
        );

        const createdCount=(rows||[]).length;

        box.innerHTML=`
          <div class="success">
            <b>${createdCount} Gift Item berhasil dibuat.</b><br>
            Kode langsung ditampilkan pada Gift Item Control.
          </div>`;

        activeStatus="available";

        document.querySelectorAll(
          "[data-code-status]"
        ).forEach(button=>{
          button.classList.toggle(
            "active",
            button.dataset.codeStatus==="available"
          );
        });

        setActiveControlType(
          "item",
          {load:true,scroll:true}
        );
      }catch(err){
        box.innerHTML=`
          <div class="error">${safeError(err)}</div>`;
      }
    };

  byId("open-master-item-button").onclick=
    showMasterItemPanel;

  byId("close-master-item-button").onclick=
    hideMasterItemPanel;

  byId("gift-item-reset-form").onclick=()=>{
    resetMasterForm();
    byId("gift-item-master-form")
      .scrollIntoView({
        behavior:"smooth",
        block:"start"
      });
  };

  byId("gift-item-file").onchange=async()=>{
    const file=byId("gift-item-file").files[0];
    if(!file)return;

    const box=byId("gift-item-master-result");
    box.innerHTML=`
      <div class="notice">
        Menyiapkan foto...
      </div>`;

    try{
      masterImageData=await resizeUploadedImage(
        file,
        800,
        800,
        1800000
      );

      byId("gift-item-preview").innerHTML=`
        <img src="${masterImageData}"
          alt="Preview item"/>`;

      box.innerHTML=`
        <div class="success">
          Foto siap 800 × 800 px.
        </div>`;
    }catch(err){
      box.innerHTML=`
        <div class="error">${safeError(err)}</div>`;
    }
  };

  byId("gift-item-master-form").onsubmit=
    async event=>{
      event.preventDefault();

      const box=byId("gift-item-master-result");

      box.innerHTML=`
        <div class="notice">
          Menyimpan Master Item...
        </div>`;

      try{
        await rpc("s4_save_gift_item_master",{
          p_staff_session_token:user.session_token,
          p_item_id:byId("gift-item-id").value||null,
          p_name:byId("gift-item-name").value.trim(),
          p_description:byId(
            "gift-item-description"
          ).value.trim(),
          p_image_data_url:masterImageData,
          p_is_active:byId(
            "gift-item-active"
          ).checked
        });

        box.innerHTML=`
          <div class="success">
            Master Gift Item tersimpan.
          </div>`;

        resetMasterForm();
        await loadMasterItems();

        setActiveRewardType("item",{
          syncControl:false
        });
      }catch(err){
        box.innerHTML=`
          <div class="error">${safeError(err)}</div>`;
      }
    };

  byId("refresh-reward-codes").onclick=
    loadRewardCodes;

  byId("reward-prev-page").onclick=()=>{
    if(currentPage>1){
      currentPage--;
      loadRewardCodes();
    }
  };

  byId("reward-next-page").onclick=()=>{
    const pages=Math.max(
      1,
      Math.ceil(totalCount/pageSize)
    );

    if(currentPage<pages){
      currentPage++;
      loadRewardCodes();
    }
  };

  setActiveRewardType("voucher",{
    syncControl:false
  });

  setActiveControlType("voucher",{
    load:false,
    scroll:false
  });

  await Promise.all([
    loadMasterItems(),
    loadRewardCodes()
  ]);
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

  byId("app").innerHTML=`
    <main class="customer-shell promo-customer-shell"></main>`;

  const target=document.querySelector("main");

  try{
    const [transactionRows,promoRows]=await Promise.all([
      rpc(
        "mvp_get_unified_transaction",
        {p_token:token}
      ),
      rpc(
        "mvp_get_active_promo",
        {p_outlet_slug:OUTLET_SLUG}
      )
    ]);

    const transaction=transactionRows&&transactionRows[0]
      ? transactionRows[0]
      : {};

    const items=normalizeJsonArray(transaction.items);

    const promo=promoRows&&promoRows[0]
      ? promoRows[0]
      : null;

    const parts=[];

    if(Number(transaction.balance_used||0)>0){
      parts.push(
        `Saldo ${money(transaction.balance_used)}`
      );
    }

    if(items.length){
      parts.push(
        items.map(item=>
          `${Number(item.quantity||0)}× ${
            item.item_name||"Gift Item"
          }`
        ).join(", ")
      );
    }

    const detail=parts.join(" • ")||
      "Transaksi member";

    target.innerHTML=`
      <section class="promo-customer-card">
        ${brandMiniHtml()}

        <div class="transaction-success-strip">
          <span>✓</span>
          <div>
            <b>Transaksi Berhasil</b>
            <small>${esc(detail)}</small>
          </div>
        </div>

        ${promo&&promo.image_data_url
          ? `<img class="promo-customer-image"
              src="${promo.image_data_url}"
              alt="${esc(promo.title||"Promo")}"/>

            <h1>${esc(
              promo.title||"Promo Spesial"
            )}</h1>

            <p>${esc(promo.caption||"")}</p>`
          : `<div class="no-promo-state">
              <div class="success-check">✓</div>
              <h1>Terima Kasih</h1>
              <p>Transaksi Anda telah selesai.</p>
            </div>`}

        <button class="full touch-button"
          onclick="setHash('customer-login')">
          Selesai
        </button>
      </section>`;
  }catch(err){
    target.innerHTML=`
      <section class="customer-login-card">
        ${brandMiniHtml()}
        <div class="error">${safeError(err)}</div>
        <button class="full"
          onclick="setHash('customer-login')">
          Selesai
        </button>
      </section>`;
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
    byId("report-list").innerHTML=keys.length?keys.map(date=>`<section class="daily-report-group"><header><b>${new Date(date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</b><span>${groups[date].length} transaksi</span></header>${groups[date].map(row=>`<div class="report-row"><span class="report-time">${new Date(row.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span><span><b>${esc(typeLabel(row.type))}</b><small>${esc(row.member_name||'-')} • ${esc(row.member_phone||'-')}${row.invoice_number?` • Bill ${esc(row.invoice_number)}`:""}${row.reference_code?` • ${esc(row.reference_code)}`:""}${row.item_name?` • ${esc(row.item_name)}`:""}</small></span><strong class="${row.type==='use_balance'?'minus':'plus'}">${row.type==='gift_item_claim'||row.type==='gift_item_redeem'?'1 Item':`${row.type==='use_balance'?'-':'+'}${money(row.type==='use_balance'?row.balance_used:row.credit_issued)}`}</strong><span class="status-dot">${esc(row.status||'approved')}</span></div>`).join('')}</section>`).join(''):`<div class="empty-state">Belum ada transaksi pada periode ini.</div>`;
  }
  async function load(){byId("report-list").innerHTML=`<div class="empty-state">Loading...</div>`;try{rows=await rpc("s42_staff_transactions_by_date",{p_staff_session_token:user.session_token,p_date_from:byId("report-from").value,p_date_to:byId("report-to").value,p_type:byId("report-type").value})||[];draw();}catch(err){byId("report-list").innerHTML=`<div class="error">${safeError(err)}</div>`;}}
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
  const staffRoutes=new Set(["login","owner","owner-summary","transaction","promo-manage","members","gift-generate","report","kasir","member","register","join","topup","use-benefits","unified-waiting","unified-success"]);
  const customerRoutes=new Set(["customer-login","customer-portal","register","join","claim-gift","approve-transaction","promo","reset-pin","customer-reset-home"]);
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
  if(name==="use-benefits")return renderUseBenefits();
  if(name==="unified-waiting")return renderUnifiedWaiting();
  if(name==="approve-transaction")return renderApproveTransaction();
  if(name==="promo")return renderPromo();
  if(name==="customer-reset-home")return renderCustomerResetHome();
  if(name==="reset-pin")return renderResetPin();
  if(name==="unified-success")return renderUnifiedSuccess();
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
