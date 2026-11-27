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
    box.querySelectorAll("[data-pflicht]").forEach(function (i) { i.required = !box.hidden; });
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
  }
  /* Anrede „Firma“: Firmenname Pflicht, Nachname freiwillig (Ansprechpartner) */
  function modus() {
    var istFirma = !!anrede && anrede.value === "Firma";
    if (istFirma) firma(true);
    form.querySelectorAll(".kk-pflicht-firma").forEach(function (s) { s.hidden = !istFirma; });
    form.querySelectorAll(".kk-pflicht-person").forEach(function (s) { s.hidden = istFirma; });
    form.querySelectorAll(".kk-nur-firma").forEach(function (r) { r.hidden = !istFirma; });
  }
  if (anrede) { anrede.addEventListener("change", modus); modus(); }
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
  form.noValidate = true;
  form.addEventListener("submit", function (e) {
    var fehlt = [], erstes = null;
    function pruef(id, label, ok) {
      var el = document.getElementById(id);
      if (!el) return;
      var gut = ok !== undefined ? ok : !!el.value.trim();
      el.classList.toggle("kk-rot", !gut);
      el.setAttribute("aria-invalid", gut ? "false" : "true");
      if (!gut) { fehlt.push(label); if (!erstes) erstes = el; }
    }
    var f = document.getElementById("kk_firma"), n = document.getElementById("kk_nachname");
    var istFirma = !!anrede && anrede.value === "Firma";
    document.getElementById("kk_nachname").classList.remove("kk-rot");
    if (f) f.classList.remove("kk-rot");
    if (istFirma) pruef("kk_firma", "Firmenname");
    else pruef("kk_nachname", "Nachname", !!(n && n.value.trim()) || !!(f && f.value.trim()));
    pruef("kk_str", "Straße"); pruef("kk_hausnr", "Hausnummer");
    pruef("kk_plz", "PLZ"); pruef("kk_ort", "Ort");
    var em = document.getElementById("kk_email");
    pruef("kk_email", "E-Mail", !!(em && em.value.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())));
    var mo = document.getElementById("kk_mobil"), te = document.getElementById("kk_telefon");
    pruef("kk_telefon", "Telefon", !!(te && te.value.trim()) || !!(mo && mo.value.trim()));
    if (fehlt.length) {
      e.preventDefault();
      var box = document.querySelector(".kk-fehlt-live");
      if (!box) {
        box = document.createElement("div"); box.className = "kk-fehlt kk-fehlt-live"; box.setAttribute("role", "alert");
        var t = form.querySelector(".kk-form"); t.parentNode.insertBefore(box, t);
      }
      box.innerHTML = "<strong>Bitte noch ausfüllen:</strong> " + fehlt.join(", ");
      erstes.focus();
      erstes.scrollIntoView({ block: "center" });
    }
  });
  form.addEventListener("input", function (e) { if (e.target.classList) e.target.classList.remove("kk-rot"); });
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

/* Arbeitskosten (§ 35a): Vorschau, was auf der Rechnung steht und was der Kunde spart */
(function () {
  var f = document.getElementById("kb_lohn");
  if (!f) return;
  var box = document.querySelector(".kb-lohn-vorschau"), firma = document.querySelector(".kb-lohn-firma");
  var mw = document.getElementById("kb_mwst"), kunde = document.getElementById("kb_kunde");
  function zahl(v) { v = (v || "").replace(/[€\s]/g, ""); if (v.indexOf(",") !== -1) v = v.replace(/\./g, "").replace(",", "."); var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function eur(n) { return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function upd() {
    var netto = zahl(f.value), satz = mw ? zahl(mw.value) : 19;
    if (netto <= 0) { box.hidden = true; } else {
      var brutto = netto * (1 + satz / 100);
      box.hidden = false;
      box.innerHTML = "Auf der Rechnung steht: <em>„In diesem Rechnungsbetrag sind Arbeitskosten in Höhe von <strong>" + eur(brutto) + "</strong> (inkl. MwSt.) enthalten …“</em><br>Ihr Kunde spart damit bis zu <strong>" + eur(brutto * 0.2) + "</strong> Steuern.";
    }
    if (firma && kunde) {
      var o = kunde.options[kunde.selectedIndex];
      firma.hidden = !(netto > 0 && o && o.dataset && o.dataset.privat === "0");
    }
  }
  f.addEventListener("input", upd);
  if (mw) mw.addEventListener("input", upd);
  if (kunde) kunde.addEventListener("change", upd);
  upd();
})();

/* Website-Bilder: Mehrfach-Upload und Bild je Platz wählen */
(function () {
  var input = document.getElementById("kb_dateien");
  if (input) {
    var drop = input.closest(".kb-drop"), anz = document.querySelector(".kb-anzahl");
    input.addEventListener("change", function () { anz.textContent = input.files.length ? input.files.length + " Bild(er) ausgewählt" : ""; });
    ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove("is-over"); }); });
    input.form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!input.files.length) { alert("Bitte zuerst Bilder auswählen."); return; }
      var form = input.form, b = form.querySelector(".kb-senden");
      var box = form.querySelector(".kb-fortschritt"), bar = box.querySelector(".kb-balken span"), st = box.querySelector(".kb-status");
      var files = [].slice.call(input.files), nonce = form.querySelector("[name=_wpnonce]").value;
      var ok = 0, zu = 0, fehler = [], offen = [], i = 0;
      b.disabled = true; b.textContent = "Wird hochgeladen …"; box.hidden = false;
      /* Große Bilder im Browser verkleinern (max. 2400 px, JPG) – schneller und unter jeder Upload-Grenze */
      function verkleinern(f) {
        var basis = f.name.replace(/\.[^.]+$/, "");
        if (f.size < 1200000 || !window.createImageBitmap) return Promise.resolve({ blob: f, name: f.name });
        return createImageBitmap(f).then(function (img) {
          var s = Math.min(1, 2400 / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          return new Promise(function (res) {
            c.toBlob(function (blob) { res(blob ? { blob: blob, name: basis + ".jpg" } : { blob: f, name: f.name }); }, "image/jpeg", 0.86);
          });
        }).catch(function () { return { blob: f, name: f.name }; });
      }
      function next() {
        if (i >= files.length) {
          var msg = ok + " Bilder hochgeladen, " + zu + " automatisch zugeordnet.";
          var url = location.pathname + "?page=kilic-bilder&ok=" + encodeURIComponent(msg);
          if (offen.length) url += "&offen=" + encodeURIComponent(offen.join(", "));
          if (fehler.length) url += "&offen=" + encodeURIComponent("FEHLER: " + fehler.join(" · "));
          location.href = url; return;
        }
        var f = files[i];
        st.textContent = "Bild " + (i + 1) + " von " + files.length + ": " + f.name;
        bar.style.width = Math.round(i / files.length * 100) + "%";
        verkleinern(f).then(function (datei) {
        var fd = new FormData();
        fd.append("action", "kilic_bild_einzeln"); fd.append("_ajax_nonce", nonce); fd.append("datei", datei.blob, datei.name);
        return fetch(form.dataset.ajax, { method: "POST", body: fd, credentials: "same-origin" });
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.success) { ok++; if (j.data.platz) zu++; else offen.push(j.data.name); }
            else fehler.push(f.name + ": " + ((j && j.data && j.data.text) || "Fehler"));
          })
          .catch(function () { fehler.push(f.name + " (Zeitüberschreitung)"); })
          .then(function () { i++; next(); });
      }
      next();
    });
  }
  document.querySelectorAll(".kb-waehlen").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!window.wp || !wp.media) return;
      var karte = btn.closest(".kb-karte"), feld = karte.querySelector("input[type=hidden]");
      var frame = wp.media({ title: "Bild für: " + btn.dataset.label, button: { text: "Dieses Bild verwenden" }, library: { type: "image" }, multiple: false });
      frame.on("select", function () { feld.value = frame.state().get("selection").first().id; btn.form.submit(); });
      frame.open();
    });
  });
  document.querySelectorAll(".kb-weg").forEach(function (btn) {
    btn.addEventListener("click", function () { btn.closest(".kb-karte").querySelector("input[type=hidden]").value = ""; btn.form.submit(); });
  });
})();

/* Leistungskatalog: direkt bearbeiten, automatisch speichern */
(function () {
  var wrap = document.querySelector(".kk-wrap");
  if (!wrap) return;
  var ajax = wrap.dataset.ajax, nonce = wrap.dataset.nonce, filter = "", suche = "";
  function post(data) {
    var fd = new FormData(); fd.append("action", "kilic_katalog"); fd.append("n", nonce);
    Object.keys(data).forEach(function (k) { fd.append(k, data[k]); });
    return fetch(ajax, { method: "POST", body: fd, credentials: "same-origin" }).then(function (r) { return r.json(); });
  }
  function status(z, txt, art) { var s = z.querySelector(".kk-status"); s.textContent = txt; s.className = "kk-status " + (art || ""); if (art === "ok") setTimeout(function () { if (s.textContent === txt) s.textContent = ""; }, 1800); }
  function speichern(feld) {
    var z = feld.closest(".kk-zeile"); status(z, "Speichert …", "laeuft");
    post({ tun: "feld", id: z.dataset.id, feld: feld.dataset.feld, wert: feld.value }).then(function (j) {
      if (!j || !j.success) { status(z, "Nicht gespeichert", "fehler"); return; }
      status(z, "✓ Gespeichert", "ok");
      if (feld.dataset.feld === "preis") { feld.value = j.data.preis; z.classList.toggle("ohne-preis", !j.data.preis); zaehlen(); }
      if (feld.dataset.feld === "bereich") { z.dataset.bereich = feld.value; var ziel = wrap.querySelector('.kk-gruppe[data-bereich="' + feld.value + '"] .kk-liste'); ziel.appendChild(z); leer(); zaehlen(); z.scrollIntoView({ block: "center", behavior: "smooth" }); z.classList.add("blitz"); setTimeout(function () { z.classList.remove("blitz"); }, 1200); }
    }).catch(function () { status(z, "Nicht gespeichert", "fehler"); });
  }
  var timer = {};
  wrap.addEventListener("input", function (e) {
    var f = e.target; if (!f.dataset || !f.dataset.feld) return;
    if (f.tagName === "SELECT") return;
    var id = f.closest(".kk-zeile").dataset.id + f.dataset.feld;
    clearTimeout(timer[id]); timer[id] = setTimeout(function () { speichern(f); }, f.dataset.feld === "preis" ? 900 : 700);
  });
  wrap.addEventListener("change", function (e) { var f = e.target; if (f.dataset && f.dataset.feld) { clearTimeout(timer[f.closest(".kk-zeile").dataset.id + f.dataset.feld]); speichern(f); } });
  wrap.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    var z = t.closest(".kk-zeile");
    if (t.classList.contains("kk-text-auf")) { var tf = z.querySelector(".kk-textfeld"); tf.hidden = !tf.hidden; t.setAttribute("aria-expanded", tf.hidden ? "false" : "true"); t.classList.toggle("is-auf", !tf.hidden); if (!tf.hidden) tf.querySelector("textarea").focus(); }
    else if (t.classList.contains("kk-weg")) {
      var name = z.querySelector('[data-feld="titel"]').value;
      if (!confirm("„" + name + "“ aus dem Katalog löschen?\nBestehende Angebote und Rechnungen bleiben unverändert.")) return;
      z.classList.add("weg");
      post({ tun: "loeschen", id: z.dataset.id }).then(function (j) { if (j && j.success) { z.remove(); leer(); zaehlen(); } else { z.classList.remove("weg"); alert("Konnte nicht gelöscht werden."); } });
    }
    else if (t.classList.contains("kk-chip")) { wrap.querySelectorAll(".kk-chip").forEach(function (c) { c.classList.toggle("is-aktiv", c === t); }); filter = t.dataset.filter; anzeigen(); }
    else if (t.classList.contains("kk-neu-knopf") || t.classList.contains("kk-neu-mini")) {
      var b = t.dataset.bereich; if (t.classList.contains("kk-neu-knopf") && filter && filter !== "ohne-preis") b = filter;
      t.disabled = true;
      post({ tun: "neu", bereich: b }).then(function (j) {
        t.disabled = false; if (!j || !j.success) { alert("Konnte nicht angelegt werden."); return; }
        var d = document.createElement("div"); d.innerHTML = j.data.html.trim(); var neu = d.firstChild;
        wrap.querySelector('.kk-gruppe[data-bereich="' + b + '"] .kk-liste').appendChild(neu); leer(); zaehlen(); anzeigen();
        var n = neu.querySelector('[data-feld="titel"]'); neu.scrollIntoView({ block: "center", behavior: "smooth" }); n.focus(); n.select(); neu.classList.add("blitz");
      });
    }
  });
  wrap.querySelector(".kk-suche input").addEventListener("input", function (e) { suche = e.target.value.toLowerCase().trim(); anzeigen(); });
  function anzeigen() {
    wrap.querySelectorAll(".kk-zeile").forEach(function (z) {
      var txt = [].map.call(z.querySelectorAll("input,textarea"), function (i) { return i.value; }).join(" ").toLowerCase();
      var ok = (!filter || (filter === "ohne-preis" ? z.classList.contains("ohne-preis") : z.dataset.bereich === filter)) && (!suche || suche.split(/\s+/).every(function (w) { return txt.indexOf(w) !== -1; }));
      z.hidden = !ok;
    });
    wrap.querySelectorAll(".kk-gruppe").forEach(function (g) { g.hidden = (filter && filter !== "ohne-preis" && g.dataset.bereich !== filter) || ((filter === "ohne-preis" || suche) && !g.querySelector(".kk-zeile:not([hidden])")); });
  }
  function leer() { wrap.querySelectorAll(".kk-gruppe").forEach(function (g) { g.querySelector(".kk-leer").hidden = !!g.querySelector(".kk-zeile"); }); }
  function zaehlen() {
    wrap.querySelectorAll(".kk-chip").forEach(function (c) {
      var f = c.dataset.filter, n = f === "" ? wrap.querySelectorAll(".kk-zeile").length : f === "ohne-preis" ? wrap.querySelectorAll(".kk-zeile.ohne-preis").length : wrap.querySelectorAll('.kk-gruppe[data-bereich="' + f + '"] .kk-zeile').length;
      c.querySelector("b").textContent = n; if (f === "ohne-preis") c.hidden = !n;
    });
  }
})();
