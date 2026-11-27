<?php
/**
 * Spamschutz für Anfrage- und Kontaktformular.
 *
 * Mehrere Stufen, alle ohne Google/Captcha (DSGVO-freundlich):
 * 1. Sitzungsschlüssel (Nonce) und verstecktes Lockfeld (Honeypot)
 * 2. Mindest-Ausfüllzeit und abgelaufene Formulare
 * 3. JavaScript-Prüfwert – einfache Bots ohne Browser scheitern
 * 4. Tageslimit pro Absender (IP-Adresse nur verschlüsselt gespeichert) und pro E-Mail
 * 5. Inhaltsprüfung: zu viele Links, Sperrwörter, fremde Schriftzeichen
 * Alle Grenzen sind unter Einstellungen → Spamschutz änderbar.
 */

defined( 'ABSPATH' ) || exit;

/** IP-Adresse nur als nicht rückrechenbarer Tages-Hash. */
function kilic_spam_ip_hash() {
	$ip = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? '' ) );
	return substr( hash_hmac( 'sha256', $ip . '|' . current_time( 'Y-m-d' ), wp_salt( 'nonce' ) ), 0, 32 );
}

function kilic_spam_limit() {
	$v = kilic_opt( 'spam_limit' );
	return '' === $v ? 2 : max( 0, (int) $v );
}

/** Zähler für heute lesen/erhöhen. */
function kilic_spam_zaehler( $schluessel, $erhoehen = false ) {
	$k = 'kilic_rl_' . md5( $schluessel . current_time( 'Y-m-d' ) );
	$n = (int) get_transient( $k );
	if ( $erhoehen ) {
		set_transient( $k, $n + 1, DAY_IN_SECONDS );
	}
	return $n;
}

/** Abgewehrte Versuche zählen (für die Anzeige im Backend). */
function kilic_spam_merken( $grund ) {
	$s = get_option( 'kilic_spam_stat', array() );
	$s = is_array( $s ) ? $s : array();
	$s['gesamt']           = (int) ( $s['gesamt'] ?? 0 ) + 1;
	$s['gruende'][ $grund ] = (int) ( $s['gruende'][ $grund ] ?? 0 ) + 1;
	$s['zuletzt']          = current_time( 'mysql' );
	update_option( 'kilic_spam_stat', $s, false );
}

/**
 * Prüft eine eingehende Anfrage. Gibt '' (in Ordnung) oder einen Fehlergrund zurück.
 * $data = bereits bereinigte Formularfelder.
 */
function kilic_spam_pruefen( $data ) {
	// Mitarbeiter im Backend (z. B. zum Testen) nicht begrenzen.
	if ( is_user_logged_in() && current_user_can( 'edit_kilic_vorgaenge' ) ) {
		return '';
	}
	// Ausfüllzeit: mindestens 4 Sekunden, höchstens 6 Stunden.
	$start = absint( $_POST['kilic_t'] ?? 0 ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( ! $start || time() - $start < 4 || time() - $start > 6 * HOUR_IN_SECONDS ) {
		return 'spam';
	}
	// JavaScript-Prüfwert (wird im Browser gesetzt).
	$js = sanitize_text_field( wp_unslash( $_POST['kilic_js'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( ! hash_equals( substr( hash_hmac( 'sha256', (string) $start, wp_salt( 'nonce' ) ), 0, 16 ), $js ) ) {
		return 'spam';
	}
	// Inhalt prüfen.
	$text  = implode( ' ', array_map( 'strval', $data ) );
	$links = preg_match_all( '#(https?://|www\.|\[url|<a\s)#i', $text );
	$max   = '' === kilic_opt( 'spam_links' ) ? 1 : (int) kilic_opt( 'spam_links' );
	if ( $links > $max ) {
		return 'inhalt';
	}
	if ( preg_match( '/[\x{0400}-\x{04FF}\x{4E00}-\x{9FFF}\x{0600}-\x{06FF}\x{0E00}-\x{0E7F}]{4,}/u', $text ) ) {
		return 'inhalt';
	}
	foreach ( array_filter( array_map( 'trim', preg_split( '/[\r\n,]+/', (string) kilic_opt( 'spam_woerter' ) ) ) ) as $w ) {
		if ( mb_strlen( $w ) >= 3 && false !== mb_stripos( $text, $w ) ) {
			return 'inhalt';
		}
	}
	// Tageslimit pro Absender und pro E-Mail-Adresse.
	$limit = kilic_spam_limit();
	if ( $limit > 0 ) {
		$ip   = kilic_spam_ip_hash();
		$mail = ! empty( $data['email'] ) ? strtolower( $data['email'] ) : '';
		if ( kilic_spam_zaehler( 'ip' . $ip ) >= $limit || ( $mail && kilic_spam_zaehler( 'mail' . $mail ) >= $limit ) ) {
			return 'limit';
		}
	}
	return '';
}

/** Nach erfolgreichem Speichern: Zähler erhöhen. */
function kilic_spam_gezaehlt( $data ) {
	if ( is_user_logged_in() && current_user_can( 'edit_kilic_vorgaenge' ) ) {
		return;
	}
	kilic_spam_zaehler( 'ip' . kilic_spam_ip_hash(), true );
	if ( ! empty( $data['email'] ) ) {
		kilic_spam_zaehler( 'mail' . strtolower( $data['email'] ), true );
	}
}

/** Prüfwert frisch vom Server holen (funktioniert auch mit Seiten-Cache). */
function kilic_spam_token() {
	$t = time();
	wp_send_json( array( 't' => $t, 's' => substr( hash_hmac( 'sha256', (string) $t, wp_salt( 'nonce' ) ), 0, 16 ) ) );
}
add_action( 'wp_ajax_nopriv_kilic_token', 'kilic_spam_token' );
add_action( 'wp_ajax_kilic_token', 'kilic_spam_token' );

/** JavaScript: beim ersten Tippen/Klicken Prüfwert holen und ins Formular schreiben. */
add_action( 'wp_footer', function () {
	?>
	<script>
	(function () {
		var forms = [].slice.call(document.querySelectorAll('input[name="kilic_t"]')).map(function (f) { return f.form; });
		if (!forms.length) return;
		var ok = false;
		function holen() {
			if (ok) return; ok = true;
			fetch(<?php echo wp_json_encode( admin_url( 'admin-ajax.php?action=kilic_token' ) ); ?>, { credentials: "same-origin" })
				.then(function (r) { return r.json(); })
				.then(function (d) {
					forms.forEach(function (form) {
						form.querySelector('input[name="kilic_t"]').value = d.t;
						var j = form.querySelector('input[name="kilic_js"]');
						if (!j) { j = document.createElement("input"); j.type = "hidden"; j.name = "kilic_js"; form.appendChild(j); }
						j.value = d.s;
					});
				}).catch(function () { ok = false; });
		}
		["pointerdown", "touchstart", "keydown", "focusin"].forEach(function (e) { document.addEventListener(e, holen, { passive: true }); });
		forms.forEach(function (f) { f.addEventListener("submit", function () { if (!ok) holen(); }); });
	})();
	</script>
	<?php
}, 99 );
