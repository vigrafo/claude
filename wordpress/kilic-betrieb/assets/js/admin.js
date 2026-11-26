/* Kilic Betrieb – Positionen in Angeboten/Rechnungen */
(function () {
  "use strict";
  var table = document.querySelector(".kilic-pos");
  if (!table) return;
  var body = table.querySelector("tbody");
  var locked = table.dataset.locked === "1";

  function num(v) {
    v = String(v || "").trim().replace(/\s|€/g, "");
    if (v.indexOf(",") !== -1) v = v.replace(/\./g, "").replace(",", ".");
    return parseFloat(v) || 0;
  }
  function eur(c) {
    return (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
  function mwst() {
    var f = document.getElementById("kb_mwst");
    return f ? num(f.value) : num(table.dataset.mwst);
  }
  function calc() {
    var zw = 0;
    body.querySelectorAll(".kilic-pos-row").forEach(function (row, i) {
      row.querySelector(".kilic-pos-nr").textContent = i + 1;
      var menge = num(row.querySelector('[name="kilic_pos[menge][]"]').value);
      var preis = Math.round(num(row.querySelector('[name="kilic_pos[preis][]"]').value) * 100);
      var rf = row.querySelector('[name="kilic_pos[rabatt][]"]');
      var r = rf ? Math.min(100, Math.max(0, num(rf.value))) : 0;
      var sum = Math.round(menge * preis * (1 - r / 100));
      zw += sum;
      row.querySelector(".kilic-pos-sum").textContent = eur(sum);
    });
    var art = document.getElementById("kb_rabatt_art");
    var wert = document.getElementById("kb_rabatt_wert");
    var rabatt = 0;
    if (art && wert) {
      if (art.value === "prozent") rabatt = Math.round(zw * Math.min(100, num(wert.value)) / 100);
      else if (art.value === "betrag") rabatt = Math.min(zw, Math.round(num(wert.value) * 100));
      wert.style.visibility = art.value ? "visible" : "hidden";
    }
    var netto = zw - rabatt;
    var satz = mwst();
    var steuer = Math.round(netto * satz / 100);
    var z = table.querySelector(".kilic-zwischen"); if (z) z.textContent = eur(zw);
    var rz = table.querySelector(".kilic-rabatt"); if (rz) rz.textContent = rabatt ? "– " + eur(rabatt) : "";
    table.querySelector(".kilic-netto").textContent = eur(netto);
    table.querySelector(".kilic-satz").textContent = String(satz).replace(".", ",");
    table.querySelector(".kilic-mwst").textContent = eur(steuer);
    table.querySelector(".kilic-brutto").textContent = eur(netto + steuer);
  }
  function addRow(text, einheit, preis) {
    var tpl = body.querySelector(".kilic-pos-row");
    var row = tpl.cloneNode(true);
    row.querySelectorAll("textarea, input").forEach(function (el) { el.value = ""; });
    row.querySelector('[name="kilic_pos[menge][]"]').value = "1";
    row.querySelector('[name="kilic_pos[preis][]"]').value = "0,00";
    if (text) row.querySelector("textarea").value = text;
    if (einheit) row.querySelector("select").value = einheit;
    if (preis) row.querySelector('[name="kilic_pos[preis][]"]').value = preis;
    body.appendChild(row);
    calc();
    row.querySelector("textarea").focus();
  }
  table.addEventListener("input", calc);
  table.addEventListener("change", calc);
  var mw = document.getElementById("kb_mwst");
  if (mw) mw.addEventListener("input", calc);
  if (!locked) {
    table.querySelector(".kilic-pos-add").addEventListener("click", function () { addRow(); });
    table.addEventListener("click", function (e) {
      var del = e.target.closest(".kilic-pos-del");
      if (!del) return;
      var rows = body.querySelectorAll(".kilic-pos-row");
      if (rows.length > 1) del.closest("tr").remove();
      else del.closest("tr").querySelectorAll("textarea, input").forEach(function (el) { el.value = ""; });
      calc();
    });
    var v = table.querySelector(".kilic-pos-vorlage");
    v.addEventListener("change", function () {
      var opt = v.options[v.selectedIndex];
      if (!opt.value) return;
      var first = body.querySelector(".kilic-pos-row textarea");
      var rows = body.querySelectorAll(".kilic-pos-row");
      if (rows.length === 1 && !first.value.trim()) {
        first.value = opt.value;
        rows[0].querySelector("select").value = opt.dataset.e;
        if (opt.dataset.p) rows[0].querySelector('[name="kilic_pos[preis][]"]').value = opt.dataset.p;
        calc();
      } else {
        addRow(opt.value, opt.dataset.e, opt.dataset.p);
      }
      v.selectedIndex = 0;
    });
  }
  calc();
})();

/* Titel von Belegen wird automatisch vergeben */
(function () {
  var t = document.querySelector(".post-type-kilic_beleg #title");
  if (t) { t.readOnly = true; t.style.background = "#f6f7f7"; }
})();

/* Kundenauswahl: Suche und „Neuen Kunden hier anlegen“ */
(function () {
  var sel = document.getElementById("kb_kunde");
  if (!sel) return;
  var box = document.querySelector(".kilic-neuer-kunde");
  function toggle() {
    if (!box) return;
    box.hidden = sel.value !== "neu";
    if (!box.hidden) box.querySelector("input").focus();
  }
  sel.addEventListener("change", toggle);
  toggle();
  var suche = document.querySelector(".kilic-kunde-suche");
  if (suche) {
    suche.addEventListener("input", function () {
      var q = suche.value.toLowerCase().trim();
      var first = null;
      [].forEach.call(sel.options, function (o) {
        if (!o.value || o.value === "neu") return;
        var hit = !q || o.text.toLowerCase().indexOf(q) !== -1;
        o.hidden = !hit;
        if (hit && !first) first = o;
      });
      if (q && first) sel.value = first.value;
    });
  }
})();

/* Einstellungen: Logo aus der Mediathek wählen */
(function () {
  document.querySelectorAll(".kilic-media-waehlen").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!window.wp || !wp.media) return;
      var frame = wp.media({ title: "Logo wählen", button: { text: "Als Logo verwenden" }, library: { type: "image" }, multiple: false });
      frame.on("select", function () {
        var a = frame.state().get("selection").first().toJSON();
        document.getElementById(btn.dataset.target).value = a.url;
        var v = btn.parentNode.querySelector(".kilic-media-vorschau");
        if (v) v.innerHTML = '<img src="' + a.url + '" style="max-height:60px">';
      });
      frame.open();
    });
  });
  document.querySelectorAll(".kilic-media-entfernen").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.getElementById(btn.dataset.target).value = "";
      var v = btn.parentNode.querySelector(".kilic-media-vorschau");
      if (v) v.innerHTML = "<em>Logo im Firmendesign wird verwendet (nach dem Speichern).</em>";
    });
  });
})();

/* Fotos: Dateiliste anzeigen, „Neuer Kunde“ ein-/ausblenden, Restbetrag einsetzen */
(function () {
  document.querySelectorAll('input[name="kilic_fotos[]"]').forEach(function (inp) {
    inp.addEventListener("change", function () {
      var info = document.querySelector(".kilic-upload-liste, .kilic-upload-info");
      if (info) info.textContent = inp.files.length + " Datei(en) ausgewählt";
    });
  });
  var kf = document.getElementById("kf_kunde");
  if (kf) {
    var neu = document.querySelector(".kf-neu");
    kf.addEventListener("change", function () { neu.hidden = kf.value !== "neu"; neu.required = kf.value === "neu"; });
  }
  document.querySelectorAll(".kilic-rest-uebernehmen").forEach(function (b) {
    b.addEventListener("click", function () { var f = document.querySelector('[name="kilic_zahlung[betrag]"]'); if (f) f.value = b.dataset.rest; });
  });
})();

/* Kunde: Nachname oder Firma ist Pflicht; Firmenangaben ein-/ausblenden */
(function () {
  var form = document.querySelector(".post-type-kilic_kunde #post");
  if (!form) return;
  var anrede = document.getElementById("kk_anrede");
  function firma(zeigen) {
    form.querySelectorAll(".kk-firma").forEach(function (r) { r.classList.toggle("is-hidden", !zeigen); });
    form.querySelectorAll(".kk-firma-link").forEach(function (r) { r.classList.toggle("is-hidden", zeigen); });
    form.querySelectorAll(".kk-nur-firma").forEach(function (r) { r.hidden = !zeigen; });
  }
  if (anrede) anrede.addEventListener("change", function () { if (anrede.value === "Firma") { firma(true); } });
  form.querySelectorAll(".kk-firma-zeigen").forEach(function (b) {
    b.addEventListener("click", function () { firma(true); var f = document.getElementById("kk_firma"); if (f) f.focus(); });
  });
  /* PLZ eingetippt mit Ort („74821 Mosbach“) → automatisch aufteilen */
  var plz = document.getElementById("kk_plz"), ort = document.getElementById("kk_ort");
  if (plz && ort) plz.addEventListener("change", function () {
    var m = plz.value.trim().match(/^(\d{4,5})[\s,]+(.+)$/);
    if (m) { plz.value = m[1]; if (!ort.value.trim()) ort.value = m[2]; }
  });
  var str = document.getElementById("kk_str"), nr = document.getElementById("kk_hausnr");
  if (str && nr) str.addEventListener("change", function () {
    var m = str.value.trim().match(/^(.*?)[\s,]+(\d+\s*[a-zA-Z]?)$/);
    if (m && !nr.value.trim()) { str.value = m[1]; nr.value = m[2].replace(/\s/g, ""); }
  });
  form.addEventListener("submit", function (e) {
    var n = document.getElementById("kk_nachname"), f = document.getElementById("kk_firma");
    if (n && !n.value.trim() && !(f && f.value.trim())) {
      e.preventDefault();
      n.focus();
      n.style.borderColor = "#d7262f";
      alert("Bitte den Nachnamen (oder bei Firmen die Firma) eintragen.");
    }
  });
})();

/* Fotos-Seite: Vorschau, entfernen, Belege nach Kunde filtern */
(function () {
  var input = document.getElementById("kf_dateien");
  if (!input) return;
  var drop = document.querySelector(".kf-drop");
  var box = document.querySelector(".kf-previews");
  var btn = document.querySelector(".kf-submit");
  var kunde = document.getElementById("kf_kunde");
  var beleg = document.getElementById("kf_beleg");
  var dt = new DataTransfer();
  function update() {
    box.innerHTML = "";
    [].forEach.call(dt.files, function (f, i) {
      var fig = document.createElement("figure");
      if (f.type.indexOf("image") === 0) {
        var img = document.createElement("img"); img.alt = f.name; img.src = URL.createObjectURL(f); fig.appendChild(img);
      } else { var c = document.createElement("figcaption"); c.textContent = f.name; fig.appendChild(c); }
      var x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", "Foto entfernen"); x.textContent = "×";
      x.addEventListener("click", function () { var n = new DataTransfer(); [].forEach.call(dt.files, function (g, j) { if (j !== i) n.items.add(g); }); dt = n; input.files = dt.files; update(); });
      fig.appendChild(x); box.appendChild(fig);
    });
    var n = dt.files.length;
    btn.textContent = n ? n + (n === 1 ? " Foto hochladen" : " Fotos hochladen") : "Fotos hochladen";
    btn.disabled = !n || !kunde.value || (kunde.value === "neu" && !document.querySelector(".kf-neu").value.trim());
  }
  input.addEventListener("change", function () { [].forEach.call(input.files, function (f) { dt.items.add(f); }); input.files = dt.files; update(); });
  ["dragenter", "dragover"].forEach(function (e) { drop.addEventListener(e, function () { drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (e) { drop.addEventListener(e, function () { drop.classList.remove("over"); }); });
  function filterBelege() {
    [].forEach.call(beleg.options, function (o) { if (o.value) o.hidden = o.dataset.kunde !== kunde.value; });
    if (beleg.selectedOptions[0] && beleg.selectedOptions[0].hidden) beleg.value = "";
  }
  kunde.addEventListener("change", function () { filterBelege(); update(); });
  document.querySelector(".kf-neu").addEventListener("input", update);
  filterBelege(); update();
})();
