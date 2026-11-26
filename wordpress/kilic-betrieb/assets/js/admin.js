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
    var netto = 0;
    body.querySelectorAll(".kilic-pos-row").forEach(function (row, i) {
      row.querySelector(".kilic-pos-nr").textContent = i + 1;
      var menge = num(row.querySelector('[name="kilic_pos[menge][]"]').value);
      var preis = Math.round(num(row.querySelector('[name="kilic_pos[preis][]"]').value) * 100);
      var sum = Math.round(menge * preis);
      netto += sum;
      row.querySelector(".kilic-pos-sum").textContent = eur(sum);
    });
    var satz = mwst();
    var steuer = Math.round(netto * satz / 100);
    table.querySelector(".kilic-netto").textContent = eur(netto);
    table.querySelector(".kilic-satz").textContent = String(satz).replace(".", ",");
    table.querySelector(".kilic-mwst").textContent = eur(steuer);
    table.querySelector(".kilic-brutto").textContent = eur(netto + steuer);
  }
  function addRow(text, einheit) {
    var tpl = body.querySelector(".kilic-pos-row");
    var row = tpl.cloneNode(true);
    row.querySelectorAll("textarea, input").forEach(function (el) { el.value = ""; });
    row.querySelector('[name="kilic_pos[menge][]"]').value = "1";
    row.querySelector('[name="kilic_pos[preis][]"]').value = "0,00";
    if (text) row.querySelector("textarea").value = text;
    if (einheit) row.querySelector("select").value = einheit;
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
        calc();
      } else {
        addRow(opt.value, opt.dataset.e);
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
