<?php
/**
 * Schnellsuche im Backend: Kunden, Angebote/Rechnungen und Anfragen nach Name,
 * Vorname, Firma, Telefon, E-Mail, Ort, Kunden- oder Belegnummer finden.
 * Öffnet sich über die Lupe in der Kopfleiste oder mit Strg+K / „/“.
 */

defined( 'ABSPATH' ) || exit;

/** IDs eines Beitragstyps, bei denen JEDES Suchwort in Titel oder Metadaten vorkommt. */
function kilic_suche_ids( $typ, $q, $limit = 8 ) {
	global $wpdb;
	$woerter = array_filter( preg_split( '/\s+/', trim( (string) $q ) ) );
	if ( ! $woerter ) {
		return array();
	}
	$felder = array(
		'kilic_kunde'   => array( '_kundennr', '_anrede', '_vorname', '_nachname', '_firma', '_email', '_telefon', '_mobil', '_str', '_hausnr', '_plz', '_ort', '_strasse', '_plz_ort', '_ust_id', '_notizen' ),
		'kilic_beleg'   => array( '_nummer', '_leistung' ),
		'kilic_anfrage' => array( '_daten', '_notiz' ),
	);
	$keys  = "'" . implode( "','", array_map( 'esc_sql', $felder[ $typ ] ?? array( '_nummer' ) ) ) . "'";
	$where = array();
	$args  = array( $typ );
	foreach ( array_slice( $woerter, 0, 5 ) as $w ) {
		$like    = '%' . $wpdb->esc_like( $w ) . '%';
		$where[] = "( p.post_title LIKE %s OR EXISTS ( SELECT 1 FROM {$wpdb->postmeta} m WHERE m.post_id = p.ID AND m.meta_key IN ($keys) AND m.meta_value LIKE %s ) )";
		$args[]  = $like;
		$args[]  = $like;
	}
	$args[] = (int) $limit;
	$sql    = "SELECT p.ID FROM {$wpdb->posts} p WHERE p.post_type = %s AND p.post_status NOT IN ('trash','auto-draft','inherit') AND " . implode( ' AND ', $where ) . ' ORDER BY p.post_modified DESC LIMIT %d';
	return array_map( 'intval', $wpdb->get_col( $wpdb->prepare( $sql, $args ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
}

add_action( 'wp_ajax_kilic_suche', function () {
	check_ajax_referer( 'kilic_suche', 'n' );
	$q = sanitize_text_field( wp_unslash( $_GET['q'] ?? '' ) );
	if ( mb_strlen( $q ) < 2 ) {
		wp_send_json_success( array() );
	}
	$gruppen = array();

	// Kunden
	$liste = array();
	foreach ( kilic_suche_ids( 'kilic_kunde', $q ) as $id ) {
		if ( ! current_user_can( 'edit_post', $id ) ) {
			continue;
		}
		$m       = function ( $k ) use ( $id ) {
			return trim( (string) get_post_meta( $id, '_' . $k, true ) );
		};
		$tel     = $m( 'telefon' ) ? $m( 'telefon' ) : $m( 'mobil' );
		$liste[] = array(
			'titel'  => get_the_title( $id ),
			'unter'  => implode( ' · ', array_filter( array( $m( 'kundennr' ), $m( 'firma' ) !== get_the_title( $id ) ? $m( 'firma' ) : '', $m( 'plz_ort' ), $tel ) ) ),
			'url'    => get_edit_post_link( $id, 'raw' ),
			'icon'   => 'groups',
			'tel'    => $tel ? kilic_tel_href( $tel ) : '',
			'mail'   => $m( 'email' ) ? 'mailto:' . $m( 'email' ) : '',
			'neu'    => admin_url( 'post-new.php?post_type=kilic_beleg&kilic_typ=angebot&kilic_kunde=' . $id ),
		);
	}
	if ( $liste ) {
		$gruppen[] = array( 'name' => 'Kunden', 'eintraege' => $liste );
	}

	// Angebote & Rechnungen
	$liste = array();
	foreach ( kilic_suche_ids( 'kilic_beleg', $q ) as $id ) {
		if ( ! current_user_can( 'edit_post', $id ) ) {
			continue;
		}
		$s       = kilic_beleg_summen( $id );
		$status  = (string) get_post_meta( $id, '_status', true );
		$liste[] = array(
			'titel'  => get_the_title( $id ),
			'unter'  => implode( ' · ', array_filter( array( kilic_date( get_post_meta( $id, '_datum', true ) ), kilic_eur( $s['brutto'] ), ucfirst( $status ) ) ) ),
			'url'    => get_edit_post_link( $id, 'raw' ),
			'icon'   => 'media-document',
		);
	}
	if ( $liste ) {
		$gruppen[] = array( 'name' => 'Angebote & Rechnungen', 'eintraege' => $liste );
	}

	// Anfragen
	$liste = array();
	foreach ( kilic_suche_ids( 'kilic_anfrage', $q ) as $id ) {
		if ( ! current_user_can( 'edit_post', $id ) ) {
			continue;
		}
		$d       = (array) get_post_meta( $id, '_daten', true );
		$liste[] = array(
			'titel'  => get_the_title( $id ),
			'unter'  => implode( ' · ', array_filter( array( get_the_date( 'd.m.Y', $id ), trim( ( $d['plz'] ?? '' ) . ' ' . ( $d['ort'] ?? '' ) ), $d['tel'] ?? '' ) ) ),
			'url'    => get_edit_post_link( $id, 'raw' ),
			'icon'   => 'email-alt',
		);
	}
	if ( $liste ) {
		$gruppen[] = array( 'name' => 'Anfragen', 'eintraege' => $liste );
	}

	wp_send_json_success( $gruppen );
} );

/** Auch die normale Listen-Suche (Kunden, Belege, Anfragen) durchsucht Vorname, Telefon, Ort usw. */
add_filter( 'posts_search', function ( $search, $query ) {
	global $wpdb;
	if ( ! is_admin() || ! $query->is_main_query() || '' === $query->get( 's' ) ) {
		return $search;
	}
	$typ = $query->get( 'post_type' );
	if ( ! in_array( $typ, array( 'kilic_kunde', 'kilic_beleg', 'kilic_anfrage' ), true ) ) {
		return $search;
	}
	$ids = kilic_suche_ids( $typ, $query->get( 's' ), 500 );
	return $ids ? " AND {$wpdb->posts}.ID IN (" . implode( ',', $ids ) . ')' : ' AND 1=0';
}, 10, 2 );

/** Suchfenster + Skript auf allen Kilic-Seiten. */
add_action( 'admin_footer', function () {
	if ( ! function_exists( 'kilic_ist_kilic_screen' ) || ! kilic_ist_kilic_screen() ) {
		return;
	}
	?>
	<div class="ks" id="kilic-suche" hidden role="dialog" aria-modal="true" aria-label="Suche">
		<div class="ks-hinter" data-ks-zu></div>
		<div class="ks-box">
			<div class="ks-feld">
				<span class="dashicons dashicons-search" aria-hidden="true"></span>
				<input type="search" id="ks-eingabe" placeholder="Name, Vorname, Firma, Telefon, Ort, Kd.-Nr. oder Rechnungsnummer …" autocomplete="off" aria-label="Suchbegriff" aria-controls="ks-ergebnis">
				<button type="button" class="ks-zu" data-ks-zu aria-label="Suche schließen">Abbrechen</button>
			</div>
			<div class="ks-ergebnis" id="ks-ergebnis" aria-live="polite">
				<p class="ks-tipp">Tippe mindestens 2 Buchstaben. Mehrere Wörter grenzen ein, z. B. „Bach Limbach“.</p>
			</div>
			<div class="ks-fuss"><span><kbd>↑</kbd><kbd>↓</kbd> auswählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> schließen</span></div>
		</div>
	</div>
	<script>
	(function () {
		var box = document.getElementById("kilic-suche"), ein = document.getElementById("ks-eingabe"), erg = document.getElementById("ks-ergebnis");
		var url = <?php echo wp_json_encode( admin_url( 'admin-ajax.php' ) ); ?>, nonce = <?php echo wp_json_encode( wp_create_nonce( 'kilic_suche' ) ); ?>;
		var timer, aktiv = -1, zuletzt = "";
		function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
		function mark(s, q) {
			s = esc(s);
			q.split(/\s+/).filter(Boolean).forEach(function (w) {
				w = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				s = s.replace(new RegExp("(" + esc(w) + ")", "ig"), "<mark>$1</mark>");
			});
			return s;
		}
		function auf() { box.hidden = false; document.body.classList.add("ks-offen"); setTimeout(function () { ein.focus(); ein.select(); }, 30); }
		function zu() { box.hidden = true; document.body.classList.remove("ks-offen"); }
		window.kilicSuche = auf;
		document.querySelectorAll("[data-ks-auf]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); auf(); }); });
		box.querySelectorAll("[data-ks-zu]").forEach(function (b) { b.addEventListener("click", zu); });
		document.addEventListener("keydown", function (e) {
			var tag = (e.target.tagName || "").toLowerCase(), tippt = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); box.hidden ? auf() : zu(); }
			else if (e.key === "/" && !tippt && box.hidden) { e.preventDefault(); auf(); }
			else if (e.key === "Escape" && !box.hidden) { zu(); }
		});
		function links() { return [].slice.call(erg.querySelectorAll("a.ks-treffer")); }
		function setze(i) { var l = links(); if (!l.length) return; aktiv = (i + l.length) % l.length; l.forEach(function (a, k) { a.classList.toggle("is-aktiv", k === aktiv); }); l[aktiv].scrollIntoView({ block: "nearest" }); }
		ein.addEventListener("keydown", function (e) {
			if (e.key === "ArrowDown") { e.preventDefault(); setze(aktiv + 1); }
			else if (e.key === "ArrowUp") { e.preventDefault(); setze(aktiv - 1); }
			else if (e.key === "Enter") { var l = links(); if (l.length) { e.preventDefault(); location.href = l[Math.max(aktiv, 0)].href; } }
		});
		ein.addEventListener("input", function () {
			clearTimeout(timer);
			var q = ein.value.trim();
			if (q.length < 2) { erg.innerHTML = '<p class="ks-tipp">Tippe mindestens 2 Buchstaben. Mehrere Wörter grenzen ein, z. B. „Bach Limbach“.</p>'; return; }
			erg.classList.add("ks-laedt");
			timer = setTimeout(function () {
				zuletzt = q;
				fetch(url + "?action=kilic_suche&n=" + nonce + "&q=" + encodeURIComponent(q), { credentials: "same-origin" })
					.then(function (r) { return r.json(); })
					.then(function (j) {
						if (q !== zuletzt) return;
						erg.classList.remove("ks-laedt"); aktiv = -1;
						var g = (j && j.data) || [];
						if (!g.length) { erg.innerHTML = '<p class="ks-leer">Nichts gefunden für „' + esc(q) + '“.</p>'; return; }
						erg.innerHTML = g.map(function (gr) {
							return '<div class="ks-gruppe"><h3>' + esc(gr.name) + ' <small>' + gr.eintraege.length + '</small></h3>' + gr.eintraege.map(function (t) {
								var knopf = "";
								if (t.tel) knopf += '<a class="ks-mini" href="' + esc(t.tel) + '" title="Anrufen" aria-label="Anrufen"><span class="dashicons dashicons-phone"></span></a>';
								if (t.mail) knopf += '<a class="ks-mini" href="' + esc(t.mail) + '" title="E-Mail" aria-label="E-Mail schreiben"><span class="dashicons dashicons-email"></span></a>';
								if (t.neu) knopf += '<a class="ks-mini" href="' + esc(t.neu) + '" title="Neues Angebot" aria-label="Neues Angebot"><span class="dashicons dashicons-plus-alt2"></span></a>';
								return '<div class="ks-zeile"><a class="ks-treffer" href="' + esc(t.url) + '"><span class="ks-ic dashicons dashicons-' + esc(t.icon) + '"></span><span class="ks-txt"><strong>' + mark(t.titel, q) + '</strong><small>' + mark(t.unter, q) + '</small></span></a>' + (knopf ? '<span class="ks-aktionen">' + knopf + '</span>' : '') + '</div>';
							}).join("") + '</div>';
						}).join("");
						setze(0);
					})
					.catch(function () { erg.classList.remove("ks-laedt"); erg.innerHTML = '<p class="ks-leer">Suche gerade nicht möglich. Bitte Seite neu laden.</p>'; });
			}, 180);
		});
	})();
	</script>
	<?php
} );
