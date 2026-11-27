<?php
/**
 * E-Mails im Firmendesign: Anfrage-Bestätigung (mit Kopie an den Inhaber),
 * Angebote/Rechnungen als PDF an Kunden senden, Archiv der gesendeten Kopien.
 */

defined( 'ABSPATH' ) || exit;

/* ---------- Layout ---------- */

/** E-Mail-taugliches HTML (Tabellen, Inline-Styles) im Kilic-Design. */
function kilic_mail_layout( $inhalt, $vorschau = '' ) {
	$wort = explode( ' ', preg_replace( '/\s+Meisterbetrieb$/i', '', kilic_opt( 'firma' ) ), 2 );
	$ort  = trim( preg_replace( '/^\d+\s*/', '', explode( '-', kilic_opt( 'plz_ort' ) )[0] ) );
	$logo = kilic_opt( 'logo' )
		? '<img src="' . esc_url( kilic_opt( 'logo' ) ) . '" alt="' . esc_attr( kilic_opt( 'firma' ) ) . '" style="max-height:56px;display:block">'
		: '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
			. '<td style="padding-right:12px"><table role="presentation" cellpadding="0" cellspacing="0" style="background:#2a3036;border-radius:6px"><tr><td style="padding:8px 7px 6px">'
			. '<div style="width:30px;height:4px;background:#c9c5bd;margin-bottom:3px"></div><div style="width:30px;height:5px;background:#8f8c87;margin-bottom:3px"></div><div style="width:30px;height:6px;background:#e8892b"></div>'
			. '</td></tr></table></td>'
			. '<td><div style="font:bold 26px/1 \'Arial Narrow\',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#ffffff">' . esc_html( $wort[0] ) . ( isset( $wort[1] ) ? ' <span style="color:#e8892b">' . esc_html( $wort[1] ) . '</span>' : '' ) . '</div>'
			. '<div style="font:11px/1.4 Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#aab0b6;margin-top:4px">Meisterbetrieb · ' . esc_html( $ort ) . '</div></td>'
			. '</tr></table>';
	$tel  = kilic_opt( 'telefon' );
	$nd   = kilic_opt( 'notdienst' );
	ob_start();
	?>
<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?php echo esc_html( kilic_opt( 'firma' ) ); ?></title></head>
<body style="margin:0;padding:0;background:#efede9">
<div style="display:none;max-height:0;overflow:hidden"><?php echo esc_html( $vorschau ); ?></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efede9"><tr><td align="center" style="padding:24px 12px">
	<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
		<tr><td style="background:#1b1f23;padding:22px 28px"><?php echo $logo; // phpcs:ignore WordPress.Security.EscapeOutput ?></td></tr>
		<tr><td style="height:4px;background:#e8892b;font-size:0;line-height:0">&nbsp;</td></tr>
		<tr><td style="padding:30px 28px;font:15px/1.6 Arial,Helvetica,sans-serif;color:#1b1f23"><?php echo $inhalt; // phpcs:ignore WordPress.Security.EscapeOutput ?></td></tr>
		<tr><td style="background:#d7262f;padding:14px 28px;font:bold 14px/1.4 Arial,sans-serif;color:#ffffff">Rohrreinigung 24/7 Notdienst – auch sonntags: <a href="<?php echo esc_attr( kilic_tel_href( $nd ) ); ?>" style="color:#ffffff"><?php echo esc_html( $nd ); ?></a></td></tr>
		<tr><td style="background:#1b1f23;padding:20px 28px;font:12px/1.6 Arial,sans-serif;color:#aab0b6">
			<strong style="color:#ffffff"><?php echo esc_html( kilic_opt( 'firma' ) ); ?></strong> · <?php echo esc_html( kilic_opt( 'firma2' ) ); ?><br>
			Inh. <?php echo esc_html( kilic_opt( 'inhaber' ) ); ?> · <?php echo esc_html( kilic_opt( 'strasse' ) . ', ' . kilic_opt( 'plz_ort' ) ); ?><br>
			Tel. <a href="<?php echo esc_attr( kilic_tel_href( $tel ) ); ?>" style="color:#ffb469"><?php echo esc_html( $tel ); ?></a>
			<?php if ( kilic_opt( 'email' ) && ! kilic_ist_platzhalter( 'email' ) ) : ?> · <a href="mailto:<?php echo esc_attr( kilic_opt( 'email' ) ); ?>" style="color:#ffb469"><?php echo esc_html( kilic_opt( 'email' ) ); ?></a><?php endif; ?>
			· <a href="<?php echo esc_url( home_url( '/' ) ); ?>" style="color:#ffb469"><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></a>
		</td></tr>
	</table>
</td></tr></table>
</body></html>
	<?php
	return ob_get_clean();
}

function kilic_mail_button( $text, $url ) {
	return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="background:#e8892b;border-radius:6px"><a href="' . esc_url( $url ) . '" style="display:inline-block;padding:13px 24px;font:bold 15px Arial,sans-serif;color:#ffffff;text-decoration:none;text-transform:uppercase;letter-spacing:1px">' . esc_html( $text ) . '</a></td></tr></table>';
}

function kilic_mail_tabelle( $zeilen ) {
	// Bezeichnung klein über dem Wert – passt auf jedes Handy, ohne Worttrennung.
	$out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;font:15px/1.45 Arial,sans-serif">';
	foreach ( $zeilen as $k => $v ) {
		if ( '' === trim( (string) $v ) ) {
			continue;
		}
		$out .= '<tr><td style="padding:10px 0;border-bottom:1px solid #e4e1db">'
			. '<div style="font-size:11px;line-height:1.3;letter-spacing:.08em;text-transform:uppercase;color:#8a8f94;margin:0 0 3px">' . esc_html( $k ) . '</div>'
			. '<div style="font-weight:bold;color:#1b1f23">' . nl2br( esc_html( $v ) ) . '</div></td></tr>';
	}
	return $out . '</table>';
}

/** Absender: eigene Domain (sonst Spam/Ablehnung bei Gmail & Co.). */
function kilic_absender_email() {
	$a    = kilic_opt( 'absender' );
	$host = kilic_site_domain();
	if ( kilic_smtp_aktiv() ) {
		// Postfach-Versand: Absender MUSS das angemeldete Postfach sein, sonst lehnen Server ab.
		$u = trim( (string) kilic_opt( 'smtp_user' ) );
		if ( is_email( $u ) ) {
			return $u;
		}
	}
	// Versand über die Website: Absender muss zur eigenen Domain passen.
	if ( is_email( $a ) && $host && substr( strtolower( $a ), -strlen( '@' . $host ) ) === strtolower( '@' . $host ) ) {
		return $a;
	}
	if ( ! $host || 'localhost' === $host || false === strpos( $host, '.' ) ) {
		return get_option( 'admin_email' );
	}
	return 'noreply@' . $host;
}

/** Versand über ein Postfach (SMTP) – nur wenn eingeschaltet und vollständig eingetragen. */
function kilic_smtp_aktiv() {
	if ( ! empty( $GLOBALS['kilic_smtp_aus'] ) ) {
		return false;
	}
	return '1' === kilic_opt( 'smtp_an' ) && kilic_opt( 'smtp_host' ) && kilic_opt( 'smtp_user' ) && kilic_opt( 'smtp_pass' );
}

/** Domain der Website (ohne www). */
function kilic_site_domain() {
	return preg_replace( '/^www\./', '', (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
}

add_action( 'phpmailer_init', function ( $m ) {
	if ( ! kilic_smtp_aktiv() ) {
		return;
	}
	$m->isSMTP();
	$m->Host       = kilic_opt( 'smtp_host' ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	$m->Port       = (int) ( kilic_opt( 'smtp_port' ) ? kilic_opt( 'smtp_port' ) : 587 ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	$m->SMTPAuth   = true; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	$m->Username   = kilic_opt( 'smtp_user' ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	$m->Password   = kilic_opt( 'smtp_pass' ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	$m->SMTPSecure = 465 === (int) kilic_opt( 'smtp_port' ) ? 'ssl' : 'tls'; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	$m->Timeout    = 15; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	// Eigener Server (Plesk): Zertifikat gilt oft nur für den Hostnamen – trotzdem verschlüsselt verbinden.
	$h = strtolower( (string) $m->Host );
	if ( ! empty( $GLOBALS['kilic_smtp_lokal'] ) || in_array( $h, array( 'localhost', '127.0.0.1', kilic_site_domain(), 'mail.' . kilic_site_domain() ), true ) ) {
		if ( ! empty( $GLOBALS['kilic_smtp_lokal'] ) ) {
			$m->Host = 'localhost'; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
		}
		$m->SMTPOptions = array( 'ssl' => array( 'verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true ) ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	}
}, 5 );

/** Antwortadresse: Firmen-E-Mail, sonst Benachrichtigungsadresse. */
function kilic_antwort_email() {
	$e = kilic_opt( 'email' );
	if ( is_email( kilic_opt( 'absender' ) ) ) {
		return kilic_opt( 'absender' );
	}
	return ( $e && ! kilic_ist_platzhalter( 'email' ) && is_email( $e ) ) ? $e : kilic_empfaenger();
}

/** Letzter Versandfehler (für Protokoll und Test). */
add_action( 'wp_mail_failed', function ( $err ) {
	$GLOBALS['kilic_mail_fehler'] = is_wp_error( $err ) ? $err->get_error_message() : 'unbekannter Fehler';
} );

/** HTML-Mail senden. $reply_to optional (z. B. Kunde bei Büro-Benachrichtigung). */
function kilic_send_mail( $an, $betreff, $html, $anhaenge = array(), $bcc = '', $reply_to = '' ) {
	$GLOBALS['kilic_mail_fehler'] = '';
	$von       = kilic_absender_email();
	$headers   = array( 'Content-Type: text/html; charset=UTF-8' );
	$headers[] = 'From: ' . wp_specialchars_decode( kilic_opt( 'firma' ), ENT_QUOTES ) . ' <' . $von . '>';
	$headers[] = 'Reply-To: ' . ( $reply_to ? $reply_to : kilic_antwort_email() );
	if ( $bcc && is_email( $bcc ) ) {
		$headers[] = 'Bcc: ' . $bcc;
	}
	// Envelope-Sender (Return-Path) passend zum Absender – wichtig für SPF.
	$sender = function ( $phpmailer ) use ( $von ) {
		$phpmailer->Sender = $von; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	};
	add_action( 'phpmailer_init', $sender );
	$ok = wp_mail( $an, $betreff, $html, $headers, $anhaenge );
	remove_action( 'phpmailer_init', $sender );
	if ( ! $ok && kilic_smtp_aktiv() && empty( $GLOBALS['kilic_smtp_lokal'] ) && false !== stripos( (string) ( $GLOBALS['kilic_mail_fehler'] ?? '' ), 'connect' ) ) {
		// Server erreicht sich selbst nicht über den Domainnamen → über „localhost“ versuchen.
		$GLOBALS['kilic_smtp_lokal'] = true;
		$ok = kilic_send_mail( $an, $betreff, $html, $anhaenge, $bcc, $reply_to );
		$GLOBALS['kilic_smtp_lokal'] = false;
	}
	if ( ! $ok && kilic_smtp_aktiv() ) {
		// Postfach nicht erreichbar → einmal direkt über die Website senden.
		$fehler                    = $GLOBALS['kilic_mail_fehler'] ?? '';
		$GLOBALS['kilic_smtp_aus'] = true;
		$ok = kilic_send_mail( $an, $betreff, $html, $anhaenge, $bcc, $reply_to );
		$GLOBALS['kilic_smtp_aus'] = false;
		if ( ! $ok && $fehler ) {
			$GLOBALS['kilic_mail_fehler'] = $fehler . ' / Website: ' . ( $GLOBALS['kilic_mail_fehler'] ?? '' );
		}
	}
	if ( empty( $GLOBALS['kilic_smtp_aus'] ) && empty( $GLOBALS['kilic_smtp_lokal'] ) ) {
		kilic_versand_log( $an, $betreff, $ok, $von, $anhaenge );
	}
	return $ok;
}

/** Kopie-Empfänger: Inhaber (Einstellung) oder Admin-E-Mail. */
function kilic_inhaber_email() {
	$e = kilic_opt( 'inhaber_email' );
	return $e ? $e : get_option( 'admin_email' );
}

/** Versand an einer Anfrage protokollieren (im Backend sichtbar). */
function kilic_mail_protokoll( $id, $an, $was, $ok ) {
	$log   = (array) get_post_meta( $id, '_mail_log', true );
	$log[] = array(
		'zeit'   => current_time( 'mysql' ),
		'an'     => $an,
		'was'    => $was,
		'ok'     => $ok ? 1 : 0,
		'fehler' => $ok ? '' : ( $GLOBALS['kilic_mail_fehler'] ?? '' ),
	);
	update_post_meta( $id, '_mail_log', array_filter( $log ) );
}

add_action( 'admin_post_kilic_mailtest', function () {
	check_admin_referer( 'kilic_mailtest' );
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$an = sanitize_email( wp_unslash( $_POST['an'] ?? '' ) );
	$ok = false;
	if ( is_email( $an ) ) {
		$html = '<h1 style="font:bold 24px/1.2 Arial,sans-serif;margin:0 0 10px;text-transform:uppercase">Test-E-Mail</h1><p>Wenn Sie diese E-Mail sehen, funktioniert der Versand von der Website. Absender: ' . esc_html( kilic_absender_email() ) . '</p>';
		$ok   = kilic_send_mail( $an, 'Test-E-Mail – ' . kilic_opt( 'firma' ), kilic_mail_layout( $html, 'Test des E-Mail-Versands' ) );
	}
	set_transient( 'kilic_mailtest', array( 'ok' => $ok, 'an' => $an, 'fehler' => $GLOBALS['kilic_mail_fehler'] ?? ( is_email( $an ) ? '' : 'ungültige Adresse' ) ), 300 );
	wp_safe_redirect( admin_url( 'admin.php?page=kilic-einstellungen&kilic_test=1#kilic_test_an' ) );
	exit;
} );

/* ---------- Anfrage-Mails ---------- */

function kilic_anfrage_mails_html( $id, $data, $dateien ) {
	$felder = kilic_anfrage_felder();
	$zeilen = array();
	// Kontakt zuerst, zusammengefasst; Einzelteile (Vorname, Nachname, Nr.) nicht doppelt zeigen.
	$zeilen['Name'] = trim( ( $data['vorname'] ?? '' ) . ' ' . ( $data['nachname'] ?? '' ) ) ?: ( $data['name'] ?? '' );
	if ( ! empty( $data['firma'] ) ) {
		$zeilen['Firma'] = $data['firma'];
	}
	$zeilen['Telefon'] = $data['tel'] ?? '';
	$zeilen['E-Mail']  = $data['email'] ?? '';
	$zeilen['Adresse des Objekts'] = trim( ( $data['strasse'] ?? '' ) . "\n" . trim( ( $data['plz'] ?? '' ) . ' ' . ( $data['ort'] ?? '' ) ) );
	$weg = array( 'name', 'vorname', 'nachname', 'hausnr', 'firma', 'tel', 'email', 'strasse', 'plz', 'ort' );
	foreach ( $data as $k => $v ) {
		if ( ! in_array( $k, $weg, true ) ) {
			$zeilen[ $felder[ $k ] ?? ucfirst( $k ) ] = $v;
		}
	}

	// Büro: Benachrichtigung.
	$buero  = '<h1 style="font:bold 24px/1.2 Arial,sans-serif;margin:0 0 10px;text-transform:uppercase">Neue Anfrage</h1>';
	$buero .= '<p style="margin:0 0 6px">' . esc_html( get_the_title( $id ) ) . ' · eingegangen ' . esc_html( get_the_date( 'd.m.Y H:i', $id ) ) . ' Uhr</p>';
	$buero .= kilic_mail_tabelle( $zeilen );
	if ( $dateien ) {
		$buero .= '<p>' . count( $dateien ) . ' Foto(s)/Datei(en) angehängt – im Backend einsehbar.</p>';
	}
	$buero .= kilic_mail_button( 'Im Cockpit öffnen', admin_url( 'post.php?post=' . $id . '&action=edit' ) );
	$reply = ( ! empty( $data['email'] ) && is_email( $data['email'] ) ) ? $data['email'] : '';
	$an_buero = kilic_empfaenger();
	$ok = kilic_send_mail( $an_buero, 'Neue Anfrage: ' . get_the_title( $id ), kilic_mail_layout( $buero, 'Neue Anfrage über die Website' ), array(), '', $reply );
	kilic_mail_protokoll( $id, $an_buero, 'Benachrichtigung Büro', $ok );

	$anrede = trim( ( $data['vorname'] ?? '' ) . ' ' . ( $data['nachname'] ?? '' ) );
	$anrede = $anrede ? $anrede : ( $data['name'] ?? '' );

	// Kunde: Eingangsbestätigung im Firmendesign.
	if ( '1' === kilic_opt( 'bestaetigung' ) && $reply ) {
		$k  = '<h1 style="font:bold 24px/1.2 Arial,sans-serif;margin:0 0 14px;text-transform:uppercase">Vielen Dank für Ihre Anfrage</h1>';
		$k .= '<p>Guten Tag ' . esc_html( $anrede ) . ',</p>';
		$k .= '<p>wir haben Ihre Anfrage erhalten und melden uns in der Regel innerhalb von 24 Stunden (werktags) mit einem Angebot oder einem Terminvorschlag zur Besichtigung.</p>';
		$k .= '<p style="margin-top:22px"><strong>Ihre Angaben im Überblick</strong></p>' . kilic_mail_tabelle( $zeilen );
		$k .= '<p>Haben Sie Fragen? Rufen Sie uns an: <a href="' . esc_attr( kilic_tel_href( kilic_opt( 'telefon' ) ) ) . '" style="color:#c96f17;font-weight:bold">' . esc_html( kilic_opt( 'telefon' ) ) . '</a></p>';
		$k .= '<p>Freundliche Grüße<br><strong>' . esc_html( kilic_opt( 'inhaber' ) ) . '</strong><br>' . esc_html( kilic_opt( 'firma' ) ) . '</p>';
		$ok = kilic_send_mail( $data['email'], 'Ihre Anfrage bei ' . kilic_opt( 'firma' ), kilic_mail_layout( $k, 'Wir haben Ihre Anfrage erhalten.' ) );
		kilic_mail_protokoll( $id, $data['email'], 'Bestätigung Kunde', $ok );
	}

	// Inhaber: eigene Bestätigung im Firmendesign (nicht doppelt, wenn er schon die Büro-Mail bekommt).
	$inhaber = kilic_inhaber_email();
	if ( $inhaber && is_email( $inhaber ) && strtolower( $inhaber ) !== strtolower( $an_buero ) ) {
		$i  = '<h1 style="font:bold 24px/1.2 Arial,sans-serif;margin:0 0 10px;text-transform:uppercase">Neue Anfrage eingegangen</h1>';
		$i .= '<p style="margin:0 0 6px">Von <strong>' . esc_html( $anrede ) . '</strong> · ' . esc_html( get_the_date( 'd.m.Y H:i', $id ) ) . ' Uhr' . ( $reply ? ' · Bestätigung an ' . esc_html( $reply ) . ' gesendet' : '' ) . '</p>';
		$i .= kilic_mail_tabelle( $zeilen );
		$i .= kilic_mail_button( 'Anfrage im Backend öffnen', admin_url( 'post.php?post=' . $id . '&action=edit' ) );
		$ok = kilic_send_mail( $inhaber, 'Neue Anfrage: ' . get_the_title( $id ), kilic_mail_layout( $i, 'Neue Anfrage über die Website' ), array(), '', $reply );
		kilic_mail_protokoll( $id, $inhaber, 'Bestätigung Inhaber', $ok );
	}
}

/* ---------- PDF ---------- */

/** PDF eines Belegs erzeugen und als Dateipfad zurückgeben. */
function kilic_beleg_pdf( $id, $art = '' ) {
	require_once KILIC_DIR . 'lib/vendor/autoload.php';
	$kilic_pdf = true;
	$kilic_art = $art;
	ob_start();
	include KILIC_DIR . 'templates/beleg-druck.php';
	$html = ob_get_clean();

	$up  = wp_upload_dir();
	$dir = trailingslashit( $up['basedir'] ) . 'kilic-belege';
	if ( ! is_dir( $dir ) ) {
		wp_mkdir_p( $dir );
		// Kopien nicht öffentlich abrufbar machen.
		file_put_contents( $dir . '/.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		file_put_contents( $dir . '/index.php', '<?php // Stille.' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	}
	$opt = new \Dompdf\Options();
	$opt->set( 'defaultFont', 'helvetica' );
	$opt->set( 'isRemoteEnabled', true );
	$opt->set( 'fontCache', $dir );
	$opt->set( 'tempDir', get_temp_dir() );
	$opt->set( 'chroot', array( KILIC_DIR, $up['basedir'], ABSPATH ) );
	$pdf = new \Dompdf\Dompdf( $opt );
	$pdf->loadHtml( $html, 'UTF-8' );
	$pdf->setPaper( 'A4' );
	$pdf->render();

	$name = sanitize_file_name( ( 'mahnung' === $art ? 'Zahlungserinnerung' : ( 'ab' === $art ? 'Auftragsbestaetigung' : ( 'rechnung' === kilic_beleg_typ( $id ) ? 'Rechnung' : 'Angebot' ) ) ) . '-' . ( get_post_meta( $id, '_nummer', true ) ? get_post_meta( $id, '_nummer', true ) : 'Entwurf' ) );
	$datei = $dir . '/' . $name . '-' . gmdate( 'Ymd-His' ) . '-' . wp_generate_password( 6, false ) . '.pdf';
	file_put_contents( $datei, $pdf->output() ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	return $datei;
}

/* ---------- Senden ---------- */

add_action( 'admin_menu', function () {
	add_submenu_page( '', 'Per E-Mail senden', 'Per E-Mail senden', 'kilic_buero', 'kilic-senden', 'kilic_render_senden' );
}, 30 );

function kilic_senden_url( $id, $art = '' ) {
	return admin_url( 'admin.php?page=kilic-senden&id=' . $id . ( $art ? '&art=' . $art : '' ) );
}

function kilic_render_senden() {
	$id  = absint( $_GET['id'] ?? 0 ); // phpcs:ignore WordPress.Security.NonceVerification
	$art = sanitize_key( $_GET['art'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( 'kilic_beleg' !== get_post_type( $id ) || ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Beleg nicht gefunden.' );
	}
	$typ    = kilic_beleg_typ( $id );
	$kunde  = (int) get_post_meta( $id, '_kunde', true );
	$email  = $kunde ? get_post_meta( $kunde, '_email', true ) : '';
	$name   = $kunde ? get_the_title( $kunde ) : '';
	$nummer = get_post_meta( $id, '_nummer', true );
	$dok    = 'mahnung' === $art ? 'Zahlungserinnerung' : ( 'ab' === $art ? 'Auftragsbestätigung' : ( 'rechnung' === $typ ? 'Rechnung' : 'Angebot' ) );
	$schon  = count( (array) get_post_meta( $id, '_versand', true ) );
	if ( 'rechnung' === $typ && 'mahnung' !== $art ) {
		$text = "Guten Tag {$name},\n\nanbei erhalten Sie unsere Rechnung" . ( $nummer ? " {$nummer}" : '' ) . ".\nBitte überweisen Sie den Betrag bis zum " . kilic_date( kilic_beleg_faellig( $id ) ) . ".\n\nVielen Dank für Ihren Auftrag!";
	} elseif ( 'mahnung' === $art ) {
		$text = "Guten Tag {$name},\n\nsicher ist es Ihrer Aufmerksamkeit entgangen: Unsere Rechnung {$nummer} ist noch offen. Details finden Sie im Anhang.\n\nSollte sich Ihre Zahlung überschnitten haben, betrachten Sie diese Nachricht bitte als gegenstandslos.";
	} elseif ( 'ab' === $art ) {
		$text = "Guten Tag {$name},\n\nvielen Dank für Ihren Auftrag! Anbei erhalten Sie unsere Auftragsbestätigung.";
	} else {
		$text = "Guten Tag {$name},\n\nvielen Dank für Ihre Anfrage. Anbei erhalten Sie unser Angebot" . ( $nummer ? " {$nummer}" : '' ) . ".\nWir freuen uns auf Ihren Auftrag – bei Fragen rufen Sie uns gerne an.";
	}
	$text .= "\n\nFreundliche Grüße\n" . kilic_opt( 'inhaber' ) . "\n" . kilic_opt( 'firma' );
	?>
	<div class="wrap kilic-admin kilic-senden">
		<h1><?php echo esc_html( $dok ); ?> per E-Mail senden</h1>
		<p><a href="<?php echo esc_url( get_edit_post_link( $id ) ); ?>">← zurück zu <?php echo esc_html( kilic_beleg_label( $id ) ); ?></a><?php echo $schon ? ' · bereits ' . (int) $schon . '× gesendet (Kopien unter „Versand & Kopien“ am Beleg)' : ''; ?></p>
		<?php if ( 'entwurf' === get_post_meta( $id, '_status', true ) && ! $art ) : ?>
			<div class="notice notice-info inline"><p>Beim Senden wird der Beleg nummeriert und auf „<?php echo 'rechnung' === $typ ? 'Offen' : 'Versendet'; ?>“ gesetzt. Sie können ihn danach jederzeit wieder bearbeiten und erneut senden.</p></div>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="kilic_senden">
			<input type="hidden" name="id" value="<?php echo (int) $id; ?>">
			<input type="hidden" name="art" value="<?php echo esc_attr( $art ); ?>">
			<?php wp_nonce_field( 'kilic_senden_' . $id ); ?>
			<table class="form-table kilic-form"><tbody>
				<tr><th><label for="ks_an">An</label></th><td><input type="email" id="ks_an" name="an" value="<?php echo esc_attr( $email ); ?>" class="regular-text" required><?php if ( ! $email ) : ?><p class="description kilic-ueberfaellig">Beim Kunden ist keine E-Mail-Adresse hinterlegt – bitte hier eintragen (wird beim Kunden gespeichert).</p><?php endif; ?></td></tr>
				<tr><th><label for="ks_betreff">Betreff</label></th><td><input type="text" id="ks_betreff" name="betreff" value="<?php echo esc_attr( $dok . ( $nummer ? ' ' . $nummer : '' ) . ' – ' . kilic_opt( 'firma' ) ); ?>" class="large-text" required></td></tr>
				<tr><th><label for="ks_text">Nachricht</label></th><td><textarea id="ks_text" name="text" rows="10" class="large-text"><?php echo esc_textarea( $text ); ?></textarea></td></tr>
				<tr><th>PDF</th><td><span class="dashicons dashicons-pdf"></span> <?php echo esc_html( $dok ); ?> im Firmendesign – der Kunde bekommt einen Knopf „PDF öffnen“<?php echo '1' === kilic_opt( 'pdf_anhang' ) ? ' und das PDF als Anhang' : ''; ?> · <a target="_blank" href="<?php echo esc_url( kilic_druck_url( $id, $art ) ); ?>">Vorschau</a></td></tr>
			</tbody></table>
			<?php submit_button( 'Jetzt an den Kunden senden', 'primary large', 'submit', false ); ?>
		</form>
	</div>
	<?php
}

add_action( 'admin_post_kilic_senden', function () {
	$id = absint( $_POST['id'] ?? 0 );
	check_admin_referer( 'kilic_senden_' . $id );
	if ( ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$art     = sanitize_key( $_POST['art'] ?? '' );
	$an      = sanitize_email( wp_unslash( $_POST['an'] ?? '' ) );
	$betreff = sanitize_text_field( wp_unslash( $_POST['betreff'] ?? '' ) );
	$text    = sanitize_textarea_field( wp_unslash( $_POST['text'] ?? '' ) );
	if ( ! is_email( $an ) ) {
		wp_die( 'Bitte eine gültige E-Mail-Adresse angeben.', '', array( 'back_link' => true ) );
	}
	$kunde = (int) get_post_meta( $id, '_kunde', true );
	if ( $kunde && ! get_post_meta( $kunde, '_email', true ) ) {
		update_post_meta( $kunde, '_email', $an );
	}
	// Entwurf beim ersten Senden abschließen.
	if ( ! $art && 'entwurf' === get_post_meta( $id, '_status', true ) ) {
		update_post_meta( $id, '_status', 'offen' );
	}
	if ( ! get_post_meta( $id, '_nummer', true ) ) {
		update_post_meta( $id, '_nummer', kilic_naechste_nummer( kilic_beleg_typ( $id ) ) );
		$betreff = preg_replace( '/\s–\s/', ' ' . get_post_meta( $id, '_nummer', true ) . ' – ', $betreff, 1 );
	}
	kilic_beleg_titel_setzen( $id );

	$datei = kilic_beleg_pdf( $id, $art );
	$link  = kilic_pdf_link( $datei );
	$sum   = kilic_beleg_summen( $id );
	$typ   = kilic_beleg_typ( $id );
	$inhalt  = '<p>' . nl2br( esc_html( $text ) ) . '</p>';
	$eckdaten = array( 'Dokument' => basename( preg_replace( '/-\d{8}-\d{6}-\w{6}\.pdf$/', '.pdf', $datei ) ) );
	$eckdaten[ 'rechnung' === $typ ? ( 'mahnung' === $art ? 'Offener Betrag' : 'Rechnungsbetrag' ) : 'Summe' ] = kilic_eur( 'mahnung' === $art ? kilic_beleg_rest( $id ) : $sum['brutto'] );
	if ( 'rechnung' === $typ ) {
		$eckdaten['Bankverbindung'] = trim( kilic_opt( 'bank' ) . "\nIBAN " . kilic_opt( 'iban' ) );
	}
	$inhalt .= kilic_mail_tabelle( $eckdaten );
	$dok_name = 'mahnung' === $art ? 'Zahlungserinnerung' : ( 'ab' === $art ? 'Auftragsbestätigung' : ( 'rechnung' === $typ ? 'Rechnung' : 'Angebot' ) );
	$inhalt .= kilic_mail_button( $dok_name . ' als PDF öffnen', $link );
	$inhalt .= '<p style="font-size:13px;color:#6b7279">Der Link ist 12 Monate gültig. Sie können das PDF dort speichern oder ausdrucken.</p>';
	$anh = '1' === kilic_opt( 'pdf_anhang' ) ? array( $datei ) : array();
	$ok  = kilic_send_mail( $an, $betreff, kilic_mail_layout( $inhalt, $betreff ), $anh );
	if ( ! $ok && $anh ) {
		$ok = kilic_send_mail( $an, $betreff, kilic_mail_layout( $inhalt, $betreff ), array() );
	}

	// Kopie im Backend ablegen.
	$v   = get_post_meta( $id, '_versand', true );
	$v   = is_array( $v ) ? $v : array();
	$u   = wp_get_current_user();
	$v[] = array(
		'zeit'    => current_time( 'mysql' ),
		'an'      => $an,
		'betreff' => $betreff,
		'text'    => $text,
		'datei'   => basename( $datei ),
		'wer'     => $u->display_name,
		'ok'      => $ok ? 1 : 0,
	);
	update_post_meta( $id, '_versand', $v );
	kilic_log_beleg( $id, ( $ok ? 'per E-Mail gesendet an ' : 'E-Mail-Versand FEHLGESCHLAGEN an ' ) . $an . ( $art ? ' (' . ( 'ab' === $art ? 'Auftragsbestätigung' : 'Zahlungserinnerung' ) . ')' : '' ), 'mahnung' === $art ? 'mahnung' : kilic_beleg_typ( $id ) );
	if ( 'mahnung' === $art ) {
		update_post_meta( $id, '_mahnung', current_time( 'Y-m-d' ) );
	}
	$msg = $ok ? 'E-Mail an ' . $an . ' gesendet. Die Kopie liegt am Beleg unter „Versand & Kopien“.' : 'Die E-Mail konnte nicht gesendet werden. Bitte unter Einstellungen „Test-E-Mail senden“ prüfen. Die PDF-Kopie wurde trotzdem gespeichert.';
	wp_safe_redirect( add_query_arg( 'kilic_msg', rawurlencode( $msg ), admin_url( 'admin.php?page=kilic' ) ) );
	exit;
} );

/* ---------- Archiv: gesendete Kopien ---------- */

add_action( 'add_meta_boxes_kilic_beleg', function ( $post ) {
	if ( 'auto-draft' !== $post->post_status ) {
		add_meta_box( 'kilic_beleg_versand', 'Versand & Kopien', 'kilic_beleg_versand_box', 'kilic_beleg', 'normal', 'default' );
	}
}, 20 );

function kilic_beleg_versand_box( $post ) {
	$id    = $post->ID;
	$v     = get_post_meta( $id, '_versand', true );
	$v     = is_array( $v ) ? $v : array();
	$typ   = kilic_beleg_typ( $id );
	$kunde = (int) get_post_meta( $id, '_kunde', true );
	$email = $kunde ? (string) get_post_meta( $kunde, '_email', true ) : '';
	$doc   = 'rechnung' === $typ ? 'Rechnung' : 'Angebot';
	$letzt = $v ? end( $v ) : null;

	echo '<div class="kv">';
	// Status
	if ( $letzt ) {
		echo '<div class="kv-status is-ok"><span class="kv-ic dashicons dashicons-yes-alt"></span><div><strong>' . esc_html( $doc ) . ' wurde ' . count( $v ) . '× gesendet</strong><span>Zuletzt am ' . esc_html( mysql2date( 'd.m.Y \u\m H:i', $letzt['zeit'] ) ) . ' Uhr an ' . esc_html( $letzt['an'] ) . '</span></div></div>';
	} else {
		echo '<div class="kv-status"><span class="kv-ic dashicons dashicons-email-alt"></span><div><strong>Noch nicht gesendet</strong><span>' . ( $email ? 'Geht als PDF im Firmendesign an ' . esc_html( $email ) : 'Beim Kunden ist noch keine E-Mail-Adresse hinterlegt – sie kann beim Senden eingetragen werden.' ) . '</span></div></div>';
	}
	// Aktionen
	echo '<div class="kv-aktionen">';
	echo '<a class="kv-btn kv-primaer" href="' . esc_url( kilic_senden_url( $id ) ) . '"><span class="dashicons dashicons-email"></span>' . ( $v ? 'Erneut senden' : esc_html( $doc ) . ' per E-Mail senden' ) . '</a>';
	if ( 'angebot' === $typ && 'angenommen' === get_post_meta( $id, '_status', true ) ) {
		echo '<a class="kv-btn" href="' . esc_url( kilic_senden_url( $id, 'ab' ) ) . '"><span class="dashicons dashicons-yes"></span>Auftragsbestätigung senden</a>';
	}
	if ( 'rechnung' === $typ && 'offen' === get_post_meta( $id, '_status', true ) ) {
		echo '<a class="kv-btn" href="' . esc_url( kilic_senden_url( $id, 'mahnung' ) ) . '"><span class="dashicons dashicons-bell"></span>Zahlungserinnerung senden</a>';
	}
	echo '<a class="kv-btn" target="_blank" href="' . esc_url( kilic_druck_url( $id, '' ) ) . '"><span class="dashicons dashicons-printer"></span>Drucken / PDF</a>';
	echo '</div>';
	// Verlauf
	if ( $v ) {
		echo '<h4 class="kv-titel">Gesendete Kopien</h4><ul class="kv-liste">';
		foreach ( array_reverse( $v, true ) as $i => $e ) {
			$url = wp_nonce_url( admin_url( 'admin-post.php?action=kilic_kopie&id=' . $id . '&i=' . $i ), 'kilic_kopie_' . $id . '_' . $i );
			printf(
				'<li><span class="kv-datum">%s</span><span class="kv-info"><strong>%s</strong><small>an %s · von %s%s</small></span><a class="kv-pdf" href="%s" target="_blank"><span class="dashicons dashicons-pdf"></span>PDF</a></li>',
				esc_html( mysql2date( 'd.m.Y', $e['zeit'] ) . ' · ' . mysql2date( 'H:i', $e['zeit'] ) ),
				esc_html( $e['betreff'] ),
				esc_html( $e['an'] ),
				esc_html( $e['wer'] ),
				$e['ok'] ? '' : ' · <b class="kilic-ueberfaellig">nicht zugestellt</b>',
				esc_url( $url )
			);
		}
		echo '</ul><p class="kv-hinweis">Jede gesendete Fassung bleibt hier gespeichert – auch wenn der Beleg später geändert wird.</p>';
	} else {
		echo '<p class="kv-hinweis">Nach dem Senden liegt hier automatisch eine Kopie jeder versendeten Fassung.</p>';
	}
	echo '</div>';
}

add_action( 'admin_post_kilic_kopie', function () {
	$id = absint( $_GET['id'] ?? 0 );
	$i  = absint( $_GET['i'] ?? 0 );
	check_admin_referer( 'kilic_kopie_' . $id . '_' . $i );
	if ( ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$v = (array) get_post_meta( $id, '_versand', true );
	if ( empty( $v[ $i ]['datei'] ) ) {
		wp_die( 'Kopie nicht gefunden.' );
	}
	$up    = wp_upload_dir();
	$datei = trailingslashit( $up['basedir'] ) . 'kilic-belege/' . basename( $v[ $i ]['datei'] );
	if ( ! is_readable( $datei ) ) {
		wp_die( 'Datei nicht gefunden.' );
	}
	nocache_headers();
	header( 'Content-Type: application/pdf' );
	header( 'Content-Disposition: inline; filename="' . basename( preg_replace( '/-\d{8}-\d{6}-\w{6}\.pdf$/', '.pdf', $datei ) ) . '"' );
	readfile( $datei ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	exit;
} );


/** Prüft auf dem Server, ob die Absender-Domain für E-Mail eingerichtet ist (SPF, DKIM, DMARC, MX). */
function kilic_mail_diagnose() {
	$von    = kilic_absender_email();
	$domain = strtolower( substr( strrchr( $von, '@' ), 1 ) );
	$txt    = function ( $name ) {
		$r = function_exists( 'dns_get_record' ) ? @dns_get_record( $name, DNS_TXT ) : array(); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		return array_map( function ( $x ) { return $x['txt'] ?? ''; }, (array) $r );
	};
	$spf  = array_values( array_filter( $txt( $domain ), function ( $t ) { return 0 === stripos( $t, 'v=spf1' ); } ) );
	$dmarc = array_values( array_filter( $txt( '_dmarc.' . $domain ), function ( $t ) { return 0 === stripos( $t, 'v=DMARC1' ); } ) );
	$dkim = array();
	foreach ( array( 'default', 'mail', 'dkim', 'selector1', 'google' ) as $sel ) {
		if ( array_filter( $txt( $sel . '._domainkey.' . $domain ), function ( $t ) { return false !== stripos( $t, 'p=' ); } ) ) {
			$dkim[] = $sel;
		}
	}
	$mx = function_exists( 'dns_get_record' ) ? (array) @dns_get_record( $domain, DNS_MX ) : array(); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	return array(
		'absender' => $von,
		'domain'   => $domain,
		'smtp'     => kilic_smtp_aktiv(),
		'spf'      => $spf ? $spf[0] : '',
		'dkim'     => $dkim ? implode( ', ', $dkim ) : '',
		'dmarc'    => $dmarc ? $dmarc[0] : '',
		'mx'       => $mx ? implode( ', ', wp_list_pluck( $mx, 'target' ) ) : '',
	);
}


/** Letzte 30 Versandversuche (für Einstellungen → Versandprotokoll). */
function kilic_versand_log( $an, $betreff, $ok, $von, $anhaenge ) {
	$log   = get_option( 'kilic_versand_log', array() );
	$log   = is_array( $log ) ? $log : array();
	$log[] = array(
		'zeit'    => current_time( 'mysql' ),
		'an'      => is_array( $an ) ? implode( ', ', $an ) : (string) $an,
		'betreff' => (string) $betreff,
		'von'     => (string) $von,
		'weg'     => kilic_smtp_aktiv() ? 'Postfach ' . kilic_opt( 'smtp_host' ) : 'Website',
		'pdf'     => count( (array) $anhaenge ),
		'ok'      => $ok ? 1 : 0,
		'fehler'  => $ok ? '' : (string) ( $GLOBALS['kilic_mail_fehler'] ?? '' ),
	);
	update_option( 'kilic_versand_log', array_slice( $log, -30 ), false );
}


/** Geheimer, nicht erratbarer Download-Link für ein gesendetes PDF (12 Monate gültig). */
function kilic_pdf_link( $datei ) {
	$name = basename( (string) $datei );
	$bis  = time() + YEAR_IN_SECONDS;
	$sig  = hash_hmac( 'sha256', $name . '|' . $bis, wp_salt( 'auth' ) );
	return add_query_arg( array( 'action' => 'kilic_pdf', 'f' => rawurlencode( $name ), 'b' => $bis, 's' => $sig ), admin_url( 'admin-post.php' ) );
}

function kilic_pdf_ausliefern() {
	$name = basename( sanitize_file_name( wp_unslash( $_GET['f'] ?? '' ) ) ); // phpcs:ignore WordPress.Security.NonceVerification
	$bis  = absint( $_GET['b'] ?? 0 ); // phpcs:ignore WordPress.Security.NonceVerification
	$sig  = sanitize_text_field( wp_unslash( $_GET['s'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
	$soll = hash_hmac( 'sha256', $name . '|' . $bis, wp_salt( 'auth' ) );
	if ( ! $name || ! $sig || ! hash_equals( $soll, $sig ) || $bis < time() || ! preg_match( '/\.pdf$/', $name ) ) {
		wp_die( 'Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie das Dokument erneut an: ' . esc_html( kilic_opt( 'telefon' ) ), 'Link ungültig', array( 'response' => 403 ) );
	}
	$up    = wp_upload_dir();
	$datei = trailingslashit( $up['basedir'] ) . 'kilic-belege/' . $name;
	if ( ! is_readable( $datei ) ) {
		wp_die( 'Dokument nicht gefunden.', '', array( 'response' => 404 ) );
	}
	nocache_headers();
	header( 'Content-Type: application/pdf' );
	header( 'X-Robots-Tag: noindex' );
	header( 'Content-Disposition: inline; filename="' . preg_replace( '/-\d{8}-\d{6}-\w{6}\.pdf$/', '.pdf', $name ) . '"' );
	readfile( $datei ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	exit;
}
add_action( 'admin_post_nopriv_kilic_pdf', 'kilic_pdf_ausliefern' );
add_action( 'admin_post_kilic_pdf', 'kilic_pdf_ausliefern' );
