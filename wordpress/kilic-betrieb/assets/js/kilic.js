/* Kilic Estrich – Website-Skripte: Menü, Nach-oben-Knopf, Referenzfilter, Anfrage-Assistent */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initToTop();
    initFilter();
    initWizard();
  });

  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* Nach oben – erscheint nach einer Bildschirmhöhe Scrollen */
  function initToTop() {
    var btn = document.querySelector(".to-top");
    if (!btn) return;
    var ticking = false;
    function update() {
      btn.classList.toggle("show", window.scrollY > window.innerHeight * 0.8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    btn.addEventListener("click", function () {
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      var logo = document.querySelector(".site-header .logo");
      if (logo) logo.focus({ preventScroll: true });
    });
    update();
  }

  function initFilter() {
    document.querySelectorAll(".filter-bar").forEach(function (bar) {
      var scope = bar.parentElement;
      bar.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        bar.querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b === btn); });
        var f = btn.dataset.filter;
        scope.querySelectorAll(".project").forEach(function (p) {
          p.classList.toggle("hidden", f !== "all" && (p.dataset.cat || "").split(" ").indexOf(f) === -1);
        });
      });
    });
  }

  function initWizard() {
    var form = document.getElementById("wizard");
    if (!form) return;

    var steps = [].slice.call(form.querySelectorAll(".wizard-step"));
    var prog = [].slice.call(form.querySelectorAll(".progress li"));
    var prev = form.querySelector("[data-prev]");
    var next = form.querySelector("[data-next]");
    var submit = form.querySelector("[data-submit]");
    var info = form.querySelector(".step-info");
    var errBox = form.querySelector(".wizard-error");
    var cur = 0;

    function show(i) {
      cur = Math.max(0, Math.min(i, steps.length - 1));
      steps.forEach(function (s, k) { s.classList.toggle("active", k === cur); });
      prog.forEach(function (p, k) {
        p.classList.toggle("done", k < cur);
        p.classList.toggle("current", k === cur);
      });
      prev.style.visibility = cur === 0 ? "hidden" : "visible";
      prev.parentNode.classList.toggle("is-first", cur === 0);
      var last = cur === steps.length - 1;
      next.hidden = last;
      submit.hidden = !last;
      info.textContent = "Schritt " + (cur + 1) + " von " + steps.length;
      updateSummary();
    }

    prev.addEventListener("click", function () { show(cur - 1); scrollToForm(); });
    next.addEventListener("click", function () { show(cur + 1); scrollToForm(); });
    prog.forEach(function (p, k) { p.addEventListener("click", function () { show(k); }); });

    function scrollToForm() {
      var top = form.getBoundingClientRect().top + window.scrollY - 110;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
    }

    form.addEventListener("submit", function (e) {
      var errors = [];
      var dsgvo = form.querySelector("[name=dsgvo]");
      var pflicht = [["vorname", "Vorname"], ["nachname", "Nachname"], ["email", "E-Mail"], ["tel", "Telefon"], ["strasse", "Straße"], ["hausnr", "Hausnummer"], ["plz", "PLZ"], ["ort", "Ort"]];
      var fehlt = [], erstes = null;
      pflicht.forEach(function (p) {
        var f = form.querySelector("[name=" + p[0] + "]");
        if (!f) return;
        var leer = !f.value.trim();
        var falsch = p[0] === "email" && !leer && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value.trim());
        f.classList.toggle("field-error", leer || falsch);
        f.setAttribute("aria-invalid", leer || falsch ? "true" : "false");
        if (leer) fehlt.push(p[1]);
        if (falsch) errors.push("Bitte prüfen Sie die E-Mail-Adresse.");
        if ((leer || falsch) && !erstes) erstes = f;
      });
      if (fehlt.length) errors.unshift("Bitte noch ausfüllen: " + fehlt.join(", ") + ".");
      if (!dsgvo.checked) errors.push("Bitte bestätigen Sie die Datenschutzerklärung.");
      if (errors.length) {
        e.preventDefault();
        show(steps.length - 1);
        errBox.textContent = errors.join(" ");
        errBox.hidden = false;
        if (erstes) { erstes.focus(); erstes.scrollIntoView({ block: "center" }); } else errBox.scrollIntoView({ block: "center" });
        return;
      }
      submit.disabled = true;
      submit.textContent = "Wird gesendet …";
    });

    form.addEventListener("change", function () { toggleConditional(); updateSummary(); });
    form.addEventListener("input", function (e) {
      if (e.target.classList && e.target.classList.contains("field-error") && e.target.value.trim()) { e.target.classList.remove("field-error"); e.target.setAttribute("aria-invalid", "false"); }
      updateSummary();
    });

    function val(name) {
      var els = form.querySelectorAll('[name="' + name + '"], [name="' + name + '[]"]');
      if (!els.length) return "";
      if (els[0].type === "radio") {
        var c = [].slice.call(els).filter(function (e) { return e.checked; })[0];
        return c ? c.value : "";
      }
      if (els[0].type === "checkbox") {
        return [].slice.call(els).filter(function (e) { return e.checked; }).map(function (e) { return e.value; }).join(", ");
      }
      return els[0].value;
    }

    function toggleConditional() {
      var service = val("leistung");
      form.querySelectorAll("[data-show-if]").forEach(function (el) {
        var sichtbar = el.dataset.showIf.split(",").indexOf(service) !== -1;
        el.classList.toggle("show", sichtbar);
        // Ausgeblendete Felder nicht mitsenden (z. B. Belagart bei Estrich).
        el.querySelectorAll("input, select, textarea").forEach(function (f) { f.disabled = !sichtbar; });
      });
    }

    var rooms = document.getElementById("rooms");
    var addRoom = document.getElementById("add-room");
    var area = form.querySelector("[name=flaeche]");
    var range = document.getElementById("flaeche_range");

    function roomRow(name, l, b) {
      var row = document.createElement("div");
      row.className = "room-row";
      row.innerHTML =
        '<input type="text" placeholder="Raum, z. B. Wohnzimmer" aria-label="Raum">' +
        '<input type="number" min="0" step="0.01" placeholder="Länge m" aria-label="Länge in Metern">' +
        '<input type="number" min="0" step="0.01" placeholder="Breite m" aria-label="Breite in Metern">' +
        '<button type="button" class="icon-btn" aria-label="Raum entfernen">×</button>';
      var inputs = row.querySelectorAll("input");
      inputs[0].value = name || ""; inputs[1].value = l || ""; inputs[2].value = b || "";
      row.querySelector("button").addEventListener("click", function () { row.remove(); calcRooms(); });
      row.addEventListener("input", calcRooms);
      rooms.appendChild(row);
    }
    function calcRooms() {
      var sum = 0;
      rooms.querySelectorAll(".room-row").forEach(function (r) {
        var i = r.querySelectorAll("input");
        sum += (parseFloat(i[1].value) || 0) * (parseFloat(i[2].value) || 0);
      });
      if (sum > 0) { area.value = Math.round(sum * 10) / 10; range.value = Math.min(sum, 1000); }
      updateSummary();
    }
    if (addRoom) {
      addRoom.addEventListener("click", function () { roomRow(); });
      roomRow();
    }
    if (range && area) {
      range.addEventListener("input", function () { area.value = range.value; updateSummary(); });
      area.addEventListener("input", function () { range.value = Math.min(area.value || 0, 1000); });
    }

    var fileInput = form.querySelector("input[type=file]");
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var list = form.querySelector(".upload-list");
        var files = [].slice.call(fileInput.files).slice(0, 5);
        list.textContent = files.length ? "Ausgewählt: " + files.map(function (f) { return f.name; }).join(", ") : "";
      });
    }

    function updateSummary() {
      var map = {
        "s-leistung": val("leistung"),
        "s-objekt": val("objekt"),
        "s-bau": val("bauvorhaben"),
        "s-estrich": val("estrichart"),
        "s-fbh": val("fbh"),
        "s-staerke": val("staerke") ? val("staerke") + " mm" : "",
        "s-termin": val("termin"),
        "s-ort": val("plz") || val("ort") ? (val("plz") + " " + val("ort")).trim() : ""
      };
      Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = map[id] || "–";
        el.classList.toggle("empty", !map[id]);
      });
      var a = document.getElementById("s-flaeche");
      if (a) a.textContent = val("flaeche") ? String(val("flaeche")).replace(".", ",") + " m²" : "– m²";
    }

    /* Beispiel-Anfragen übernehmen */
    document.querySelectorAll("[data-example]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var data;
        try { data = JSON.parse(btn.dataset.example); } catch (err) { return; }
        Object.keys(data).forEach(function (k) {
          var v = [].concat(data[k]).map(String);
          form.querySelectorAll('[name="' + k + '"], [name="' + k + '[]"]').forEach(function (el) {
            if (el.type === "radio" || el.type === "checkbox") el.checked = v.indexOf(el.value) !== -1;
            else el.value = v[0];
          });
        });
        if (data.flaeche && range) range.value = Math.min(data.flaeche, 1000);
        if (rooms) rooms.innerHTML = "";
        toggleConditional();
        show(1);
        document.getElementById("anfrage").scrollIntoView({ behavior: "smooth" });
      });
    });

    toggleConditional();
    show(0);
  }
})();

/* Nach dem Absenden direkt zur Meldung springen (auch am Handy) */
(function () {
  if (!/[?&]anfrage=(danke|fehler)/.test(location.search)) return;
  function go() {
    var el = document.querySelector('.kilic-danke [role="status"], .form-msg, #anfrage [role="status"]');
    if (!el && location.hash) el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ block: "start" });
  }
  if (document.readyState === "complete") go(); else window.addEventListener("load", go);
})();
