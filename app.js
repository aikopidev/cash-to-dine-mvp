/* Cash to Dine MVP v0.6 - Supabase Connected */
const APP_VERSION = "0.7.0";
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
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir");
  screen(`<section class="card"><h1>Kasir Home</h1><p>Mulai dari nomor HP customer format 62xxxxxxxxxx.</p><form id="search-form"><label>Cari Member by Nomor HP</label><input id="phone" inputmode="numeric" placeholder="628553007700"/><button class="full" style="margin-top:12px">Cari Member</button></form></section><section class="card"><h3>Quick Action</h3><div class="grid two"><button onclick="setHash('join')">Daftar Member Baru</button><button class="secondary" onclick="setHash('report')">Transaksi Report</button></div></section>`);
  byId("search-form").onsubmit = (e)=>{ e.preventDefault(); setHash("member", {phone: normalizePhone(byId("phone").value)}); };
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
    byId("approve-form").onsubmit=async(e)=>{ e.preventDefault(); const box=byId("approve-result"); box.innerHTML=`<div class="notice">Approving...</div>`; try{ const rows=await rpc("mvp_approve_balance_use",{p_token:token,p_password:byId("pass").value}); const d=rows&&rows[0]?rows[0]:{}; box.innerHTML=`<div class="success"><b>Approved ✅</b><br>Saldo berhasil dipotong. Saldo tersisa: ${money(d.balance_after||0)}.</div>`; }catch(err){ box.innerHTML=`<div class="error">${err.message}</div>`; } };
  }catch(err){ target.innerHTML=`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`; }
}

async function renderSuccess(){
  const u=requireLogin(); if(!u) return; mountLayout(); setNav("kasir"); const {params}=getRoute(); try{ const rows=await rpc("mvp_get_approval",{p_token:params.token}); const p=rows&&rows[0]; if(!p) throw new Error("Approval not found"); screen(`<section class="card"><h1>Saldo Berhasil Dipakai ✅</h1><div class="item"><div class="title">Member</div><div class="meta">${p.member_name} • ${p.member_phone}</div></div><div class="item"><div class="title">Saldo Dipakai</div><div class="meta">${money(p.balance_used)}</div></div><div class="item"><div class="title">Saldo Sisa</div><div class="meta">${money(p.balance_after)}</div></div><div class="notice">Kasir tetap validasi manual di POS: masukkan payment Voucher/Cash to Dine sebesar ${money(p.balance_used)}. Sisa bill, kalau ada, dibayar QRIS/Cash/Card di POS.</div><button class="full" style="margin-top:12px" onclick="setHash('kasir')">Transaksi Baru</button></section>`); }catch(err){ screen(`<section class="card"><h1>Error</h1><div class="error">${err.message}</div></section>`); }
}

async function renderOwner(){ const u=requireLogin(); if(!u)return; if(u.role!=="owner"){setHash("kasir");return;} mountLayout(); setNav("owner"); screen(`<section class="card"><h1>Owner Dashboard</h1><p>${OUTLET} • Supabase connected.</p><div class="grid two"><button onclick="setHash('gift-generate')">Generate Gift Code</button><button class="secondary" onclick="setHash('report')">Transaction Report</button></div></section><section class="card"><h3>Database Status</h3><div class="success">Connected to Supabase: ${SUPABASE_URL}</div><p>Untuk dashboard metric lengkap, next iteration perlu RPC summary report.</p></section>`); }

async function renderGiftGenerate(){
  const u=requireLogin(); if(!u)return; if(u.role!=="owner"){setHash("kasir");return;} mountLayout(); setNav("gift"); screen(`<section class="card"><h1>Generate Gift Code</h1><p>Kode random 8 digit. Kode = uang saldo, hanya 1x pakai saat daftar member baru.</p><form id="gift-form"><label>Campaign / Event Name</label><input id="campaign" value="Soft Opening Cacayo" required/><div class="grid two"><div><label>Jumlah Kode</label><input id="qty" inputmode="numeric" value="5" required/></div><div><label>Value per Code</label><input id="value" inputmode="numeric" value="100000" required/></div></div><label>Expired Date</label><input id="expired" type="date" value="2026-08-31" required/><button class="full" style="margin-top:14px">Generate Codes</button></form><div id="gift-result" style="margin-top:12px"></div></section>`);
  byId("gift-form").onsubmit=async(e)=>{ e.preventDefault(); const qty=Math.min(parseMoney(byId("qty").value),100), value=parseMoney(byId("value").value), camp=byId("campaign").value.trim(), exp=byId("expired").value, box=byId("gift-result"); box.innerHTML=`<div class="notice">Generating ${qty} gift codes...</div>`; const created=[]; try{ for(let i=0;i<qty;i++){ const code=randomCode(8); await rpc("mvp_generate_gift_code",{p_staff_id:u.id,p_campaign_name:camp,p_code:code,p_value:value,p_expired_at:exp}); created.push(code); } const joinBase=`${publicBaseUrl()}#join?code=`; const wa=created.map(code=>`Halo Kak, kamu dapat Gift Dining Credit ${money(value)} dari ${OUTLET}.\n\nDaftar member di link ini:\n${joinBase}${code}\n\nGift Code: ${code}\n\nKode ini hanya bisa digunakan 1x saat daftar member baru.`).join("\n\n-------------------------\n\n"); const links=created.map(code=>`${joinBase}${code}`).join("\n"), csv=created.join("\n"); box.innerHTML=`<div class="success"><b>${qty} Gift Codes Generated ✅</b><br>Total Liability: ${money(qty*value)}<br>Data sudah masuk Supabase.</div><label>WA-ready Invite Messages</label><textarea class="copy-area" id="waArea" readonly>${wa}</textarea><button class="secondary full" onclick="navigator.clipboard.writeText(document.getElementById('waArea').value).then(()=>alert('WA messages copied'))">Copy WA Invite Messages</button><label>Registration Links per Code</label><textarea class="copy-area" id="linksArea" readonly>${links}</textarea><button class="secondary full" onclick="navigator.clipboard.writeText(document.getElementById('linksArea').value).then(()=>alert('Links copied'))">Copy Registration Links</button><label>Codes Only</label><textarea class="copy-area" id="codesArea" readonly>${csv}</textarea><button class="ghost full" onclick="navigator.clipboard.writeText(document.getElementById('codesArea').value).then(()=>alert('Codes copied'))">Copy Codes Only</button>`; }catch(err){ box.innerHTML=`<div class="error">${err.message}</div>`; } };
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
