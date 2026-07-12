window.CTD_PORTAL_MODE = "staff";
window.__CTD_BOOT_OK = false;

(function(){
  function show(message){
    var app = document.getElementById("app");
    if(!app || window.__CTD_BOOT_OK) return;
    app.innerHTML =
      '<main style="padding:20px;max-width:560px;margin:40px auto">' +
        '<section class="card">' +
          '<div class="mini-brand">' +
            '<img src="./cacayo-logo.jpg" alt="CACAYO logo"/>' +
            '<div><b>CACAYO</b><span>CHINESE CALIFORNIAN FUSION FOOD</span></div>' +
          '</div>' +
          '<h1>Staff Portal Gagal Dimuat</h1>' +
          '<div class="error">' + String(message || "File aplikasi tidak berhasil dimuat.") + '</div>' +
          '<p>Refresh halaman atau pastikan deployment menggunakan v3.1.1.</p>' +
          '<button class="full" onclick="location.reload()">Refresh Halaman</button>' +
        '</section>' +
      '</main>';
  }

  window.addEventListener("error", function(event){
    show(event.message || "JavaScript error");
  });

  setTimeout(function(){
    if(!window.__CTD_BOOT_OK){
      show("Aplikasi staff belum selesai dimuat. Kemungkinan asset lama masih tersimpan di cache.");
    }
  }, 5000);
})();
