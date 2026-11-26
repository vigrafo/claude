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
	$out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;font:14px/1.5 Arial,sans-serif">';
	foreach ( $zeilen as $k => $v ) {
		$out .= '<tr><td style="padding:8px 10px 8px 0;border-bottom:1px solid #e4e1db;color:#6b7279;width:42%;vertical-align:top">' . esc_html( $k ) . '</td><td style="padding:8px 0;border-bottom:1px solid #e4e1db;vertical-align:top"><strong>' . nl2br( esc_html( $v ) ) . '</strong></td></tr>';
	}
	return $out . '</table>';
}

/** HTML-Mail senden. */
function kilic_send_mail( $an, $betreff, $html, $anhaenge = array(), $bcc = '' ) {
	$headers   = array( 'Content-Type: text/html; charset=UTF-8' );
	$absender  = kilic_opt( 'email' );
	$headers[] = 'From: ' . kilic_opt( 'firma' ) . ' <' . ( $absender && ! kilic_ist_platzhalter( 'email' ) ? $absender : get_option( 'admin_email' ) ) . '>';
	if ( $bcc && is_email( $bcc ) ) {
		$headers[] = 'Bcc: ' . $bcc;
	}
	return wp_mail( $an, $betreff, $html, $headers, $anhaenge );
}

/** Kopie-Empfänger: Inhaber (Einstellung) oder Admin-E-Mail. */
function kilic_inhaber_email() {
	$e = kilic_opt( 'inhaber_email' );
	return $e ? $e : get_option( 'admin_email' );
}

/* ---------- Anfrage-Mails ---------- */

function kilic_anfrage_mails_html( $id, $data, $dateien ) {
	$felder = kilic_anfrage_felder();
	$zeilen = array();
	foreach ( $data as $k => $v ) {
		$zeilen[ $felder[ $k ] ?? $k ] = $v;
	}

	// Büro: Benachrichtigung.
	$buero  = '<h1 style="font:bold 24px/1.2 Arial,sans-serif;margin:0 0 10px;text-transform:uppercase">Neue Anfrage</h1>';
	$buero .= '<p style="margin:0 0 6px">' . esc_html( get_the_title( $id ) ) . ' · eingegangen ' . esc_html( get_the_date( 'd.m.Y H:i', $id ) ) . ' Uhr</p>';
	$buero .= kilic_mail_tabelle( $zeilen );
	if ( $dateien ) {
		$buero .= '<p>' . count( $dateien ) . ' Foto(s)/Datei(en) angehängt – im Backend einsehbar.</p>';
	}
	$buero .= kilic_mail_button( 'Im Cockpit öffnen', admin_url( 'post.php?post=' . $id . '&action=edit' ) );
	$headers_reply = ! empty( $data['email'] ) ? $data['email'] : '';
	add_filter( 'wp_mail', $f = function ( $args ) use ( $headers_reply, $data ) {
		if ( $headers_reply ) {
			$args['headers'][] = 'Reply-To: ' . ( $data['name'] ?? '' ) . ' <' . $headers_reply . '>';
		}
		return $args;
	} );
	kilic_send_mail( kilic_empfaenger(), 'Neue Anfrage: ' . get_the_title( $id ), kilic_mail_layout( $buero, 'Neue Anfrage über die Website' ) );
	remove_filter( 'wp_mail', $f );

	// Kunde: Eingangsbestätigung, Kopie an den Inhaber.
	if ( '1' === kilic_opt( 'bestaetigung' ) && ! empty( $data['email'] ) && is_email( $data['email'] ) ) {
		$k  = '<h1 style="font:bold 24px/1.2 Arial,sans-serif;margin:0 0 14px;text-transform:uppercase">Vielen Dank für Ihre Anfrage</h1>';
		$k .= '<p>Guten Tag ' . esc_html( $data['name'] ) . ',</p>';
		$k .= '<p>wir haben Ihre Anfrage erhalten und melden uns in der Regel innerhalb von 24 Stunden (werktags) mit einem Angebot oder einem Terminvorschlag zur Besichtigung.</p>';
		$k .= '<p style="margin-top:22px"><strong>Ihre Angaben im Überblick</strong></p>' . kilic_mail_tabelle( $zeilen );
		$k .= '<p>Haben Sie Fragen? Rufen Sie uns an: <a href="' . esc_attr( kilic_tel_href( kilic_opt( 'telefon' ) ) ) . '" style="color:#c96f17;font-weight:bold">' . esc_html( kilic_opt( 'telefon' ) ) . '</a></p>';
		$k .= '<p>Freundliche Grüße<br><strong>' . esc_html( kilic_opt( 'inhaber' ) ) . '</strong><br>' . esc_html( kilic_opt( 'firma' ) ) . '</p>';
		kilic_send_mail( $data['email'], 'Ihre Anfrage bei ' . kilic_opt( 'firma' ), kilic_mail_layout( $k, 'Wir haben Ihre Anfrage erhalten.' ), array(), kilic_inhaber_email() );
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
				<tr><th>Anhang</th><td><span class="dashicons dashicons-pdf"></span> <?php echo esc_html( $dok ); ?> als PDF (im Firmendesign) · <a target="_blank" href="<?php echo esc_url( kilic_druck_url( $id, $art ) ); ?>">Vorschau</a></td></tr>
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
	$sum   = kilic_beleg_summen( $id );
	$typ   = kilic_beleg_typ( $id );
	$inhalt  = '<p>' . nl2br( esc_html( $text ) ) . '</p>';
	$eckdaten = array( 'Dokument' => basename( preg_replace( '/-\d{8}-\d{6}-\w{6}\.pdf$/', '.pdf', $datei ) ) );
	$eckdaten[ 'rechnung' === $typ ? ( 'mahnung' === $art ? 'Offener Betrag' : 'Rechnungsbetrag' ) : 'Summe' ] = kilic_eur( 'mahnung' === $art ? kilic_beleg_rest( $id ) : $sum['brutto'] );
	if ( 'rechnung' === $typ ) {
		$eckdaten['Bankverbindung'] = trim( kilic_opt( 'bank' ) . "\nIBAN " . kilic_opt( 'iban' ) );
	}
	$inhalt .= kilic_mail_tabelle( $eckdaten );
	$ok = kilic_send_mail( $an, $betreff, kilic_mail_layout( $inhalt, $betreff ), array( $datei ) );

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
	$msg = $ok ? 'E-Mail an ' . $an . ' gesendet. Die Kopie liegt am Beleg unter „Versand & Kopien“.' : 'Die E-Mail konnte nicht gesendet werden. Bitte E-Mail-Versand des Servers prüfen (z. B. Plugin „WP Mail SMTP“). Die PDF-Kopie wurde trotzdem gespeichert.';
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
