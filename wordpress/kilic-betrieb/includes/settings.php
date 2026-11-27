<?php
/**
 * Einstellungen: Firmendaten, Kontakt, Steuer, Bank, Belegnummern, Texte.
 */

defined( 'ABSPATH' ) || exit;

function kilic_settings_fields() {
	return array(
		'Firma & Kontakt' => array(
			'firma'           => array( 'Firmenname', 'text' ),
			'firma2'          => array( 'Zweitfirma (Rohrreinigung)', 'text' ),
			'logo'            => array( 'Eigenes Logo (optional)', 'media', 'Leer = Logo im Firmendesign (Zeichen + „KILIC ESTRICH“). Mit eigenem Logo erscheint dieses auf Rechnungen, Angeboten und im Website-Kopf.' ),
			'inhaber'         => array( 'Inhaber', 'text' ),
			'strasse'         => array( 'Straße, Nr.', 'text' ),
			'plz_ort'         => array( 'PLZ, Ort', 'text' ),
			'telefon'         => array( 'Telefon Büro', 'text' ),
			'notdienst'       => array( 'Notdienst-Nummer (24/7)', 'text', 'Erscheint in der roten Leiste, im Footer und auf allen Rohrreinigungs-Seiten.' ),
			'email'           => array( 'E-Mail', 'email' ),
			'web'             => array( 'Website', 'text' ),
			'oeffnungszeiten' => array( 'Öffnungszeiten (Kurzform)', 'text' ),
		),
		'Impressum' => array(
			'beruf'          => array( 'Berufsbezeichnung', 'text', 'z. B. Estrichlegermeister (verliehen in Deutschland)' ),
			'kammer'         => array( 'Zuständige Handwerkskammer', 'text', 'z. B. Handwerkskammer Mannheim Rhein-Neckar-Odenwald' ),
			'handwerksrolle' => array( 'Eintragung in der Handwerksrolle', 'text', 'Betriebsnummer bzw. Eintragungsnummer' ),
		),
		'Steuer & Bank (für Rechnungen)' => array(
			'ust_id'       => array( 'USt-IdNr.', 'text' ),
			'steuernr'     => array( 'Steuernummer', 'text', 'Auf Rechnungen muss die Steuernummer oder die USt-IdNr. stehen (§ 14 UStG).' ),
			'bank'         => array( 'Bank', 'text' ),
			'iban'         => array( 'IBAN', 'text' ),
			'bic'          => array( 'BIC', 'text' ),
			'mwst'         => array( 'Standard-MwSt. (%)', 'number' ),
			'zahlungsziel' => array( 'Zahlungsziel (Tage)', 'number' ),
		),
		'Belegnummern' => array(
			're_prefix' => array( 'Präfix Rechnungen', 'text', 'Ergebnis z. B. RE-2026-0001' ),
			're_next'   => array( 'Nächste Rechnungsnummer', 'number', 'Fortlaufend. Nur ändern, wenn Sie mit einer bestehenden Nummernfolge weitermachen.' ),
			'an_prefix' => array( 'Präfix Angebote', 'text' ),
			'an_next'   => array( 'Nächste Angebotsnummer', 'number' ),
		),
		'Texte auf Belegen' => array(
			'an_text_oben'  => array( 'Angebot: Einleitung', 'textarea' ),
			'an_text_unten' => array( 'Angebot: Schlusstext', 'textarea' ),
			're_text_oben'  => array( 'Rechnung: Einleitung', 'textarea' ),
			're_text_unten' => array( 'Rechnung: Schlusstext', 'textarea' ),
		),
		'Anfragen' => array(
			'empfaenger'   => array( 'Benachrichtigung an', 'email', 'Leer = Firmen-E-Mail bzw. WordPress-Admin-E-Mail.' ),
			'bestaetigung' => array( 'Eingangsbestätigung an Kunden senden', 'checkbox' ),
			'inhaber_email' => array( 'Bestätigung an Inhaber', 'email', 'Der Inhaber bekommt bei jeder Anfrage eine eigene Bestätigung im Firmendesign. Leer = WordPress-Admin-E-Mail. Angebote und Rechnungen gehen ohne Kopie raus – die Kopie liegt am Beleg im Backend.' ),
			'absender'      => array( 'Antwort-Adresse', 'email', 'Antwortet ein Kunde auf eine E-Mail der Website, landet die Antwort hier.' ),
		),
		'E-Mail-Postfach (SMTP)' => array(
			'smtp_an'   => array( 'Über ein Postfach senden statt über die Website', 'checkbox', 'Aus = E-Mails gehen direkt über die Website (empfohlen, ohne Passwort). Absender ist dann eine Adresse der Website-Domain, Antworten gehen an die Antwort-Adresse oben.' ),
			'smtp_host' => array( 'Postausgangsserver', 'text', 'mail.com: smtp.mail.com · GMX: mail.gmx.net · Gmail: smtp.gmail.com · IONOS: smtp.ionos.de' ),
			'smtp_port' => array( 'Port', 'number', 'Normalerweise 587.' ),
			'smtp_user' => array( 'Benutzername', 'text', 'Meist die vollständige E-Mail-Adresse, z. B. vigrafo@mail.com.' ),
			'smtp_pass' => array( 'Passwort', 'password', 'Passwort des Postfachs (bei Gmail ein App-Passwort). Leer lassen = bisheriges Passwort bleibt. Ohne Passwort sendet der Webserver selbst – das landet oft im Spam.' ),
		),
	);
}

add_action( 'admin_init', function () {
	register_setting(
		'kilic_settings',
		'kilic_settings',
		array( 'sanitize_callback' => 'kilic_sanitize_settings' )
	);
} );

function kilic_sanitize_settings( $input ) {
	$out = array();
	foreach ( kilic_settings_fields() as $fields ) {
		foreach ( $fields as $key => $f ) {
			$v = $input[ $key ] ?? '';
			switch ( $f[1] ) {
				case 'email':
					$out[ $key ] = sanitize_email( $v );
					break;
				case 'number':
					$out[ $key ] = '' === $v ? '' : (string) max( 0, (float) str_replace( ',', '.', $v ) );
					break;
				case 'textarea':
					$out[ $key ] = sanitize_textarea_field( $v );
					break;
				case 'checkbox':
					$out[ $key ] = empty( $v ) ? '0' : '1';
					break;
				case 'password':
					$alt         = get_option( 'kilic_settings', array() );
					$out[ $key ] = '' === trim( (string) $v ) ? ( $alt[ $key ] ?? '' ) : trim( (string) $v );
					break;
				case 'media':
					$out[ $key ] = esc_url_raw( $v );
					break;
				default:
					$out[ $key ] = sanitize_text_field( $v );
			}
		}
	}
	return $out;
}

function kilic_render_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Keine Berechtigung.', 'kilic-betrieb' ) );
	}
	$opts = wp_parse_args( get_option( 'kilic_settings', array() ), kilic_defaults() );
	?>
	<div class="wrap kilic-admin">
		<h1>Einstellungen</h1>
		<p>Diese Angaben erscheinen auf der Website (Telefon, Notdienst, Adresse) und auf Angeboten und Rechnungen. Sie müssen sie nur hier ändern.</p>
		<?php
		$ph = array();
		foreach ( array( 'email' => 'E-Mail', 'ust_id' => 'USt-IdNr.', 'steuernr' => 'Steuernummer', 'bank' => 'Bank', 'iban' => 'IBAN', 'bic' => 'BIC' ) as $k => $l ) {
			if ( kilic_ist_platzhalter( $k ) ) {
				$ph[] = $l;
			}
		}
		if ( $ph ) :
			?>
			<div class="notice notice-warning inline"><p><strong>Noch Platzhalter:</strong> <?php echo esc_html( implode( ', ', $ph ) ); ?>. Bitte vor dem Versand echter Rechnungen ersetzen. Benachrichtigungen über neue Anfragen gehen bis dahin an die WordPress-Admin-E-Mail.</p></div>
		<?php endif; ?>
		<form method="post" action="options.php">
			<?php settings_fields( 'kilic_settings' ); ?>
			<?php foreach ( kilic_settings_fields() as $section => $fields ) : ?>
				<h2><?php echo esc_html( $section ); ?></h2>
				<table class="form-table" role="presentation">
					<?php foreach ( $fields as $key => $f ) :
						$id = 'kilic_' . $key;
						$name = 'kilic_settings[' . $key . ']';
						$val = $opts[ $key ] ?? '';
						?>
						<tr>
							<th scope="row"><label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $f[0] ); ?></label></th>
							<td>
								<?php if ( 'textarea' === $f[1] ) : ?>
									<textarea id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" rows="3" class="large-text"><?php echo esc_textarea( $val ); ?></textarea>
								<?php elseif ( 'media' === $f[1] ) : ?>
									<div class="kilic-media">
										<input type="url" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( $val ); ?>" class="regular-text">
										<button type="button" class="button kilic-media-waehlen" data-target="<?php echo esc_attr( $id ); ?>">Aus Mediathek wählen</button>
										<button type="button" class="button-link kilic-media-entfernen" data-target="<?php echo esc_attr( $id ); ?>">Entfernen</button>
										<div class="kilic-media-vorschau"><?php echo kilic_logo_html(); // phpcs:ignore WordPress.Security.EscapeOutput ?></div>
									</div>
								<?php elseif ( 'checkbox' === $f[1] ) : ?>
									<input type="hidden" name="<?php echo esc_attr( $name ); ?>" value="0">
									<label><input type="checkbox" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="1" <?php checked( '1', $val ); ?>> Ja</label>
								<?php elseif ( 'password' === $f[1] ) : ?>
									<input type="password" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="" class="regular-text" autocomplete="new-password" placeholder="<?php echo $val ? '•••••••• (gespeichert)' : 'noch nicht eingetragen'; ?>">
								<?php else : ?>
									<input type="<?php echo 'number' === $f[1] ? 'number' : esc_attr( $f[1] ); ?>" step="any" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( $val ); ?>" class="<?php echo 'number' === $f[1] ? 'small-text' : 'regular-text'; ?>">
								<?php endif; ?>
								<?php if ( ! empty( $f[2] ) ) : ?>
									<p class="description"><?php echo esc_html( $f[2] ); ?></p>
								<?php endif; ?>
							</td>
						</tr>
					<?php endforeach; ?>
				</table>
			<?php endforeach; ?>
			<?php submit_button( 'Einstellungen speichern' ); ?>
		</form>

		<h2>E-Mail-Versand testen</h2>
		<p>Schickt eine Test-E-Mail im Firmendesign. Absender: <code><?php echo esc_html( kilic_absender_email() ); ?></code> · Versand: <strong><?php echo kilic_smtp_aktiv() ? 'über Postfach ' . esc_html( kilic_opt( 'smtp_host' ) ) : 'direkt über die Website'; ?></strong></p>
		<?php if ( isset( $_GET['kilic_test'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<?php $t = get_transient( 'kilic_mailtest' ); ?>
			<div class="notice <?php echo ! empty( $t['ok'] ) ? 'notice-success' : 'notice-error'; ?> inline"><p><?php echo ! empty( $t['ok'] ) ? 'Test-E-Mail wurde an ' . esc_html( $t['an'] ?? '' ) . ' übergeben. Bitte Posteingang (und Spam-Ordner) prüfen.' : 'Versand fehlgeschlagen: ' . esc_html( $t['fehler'] ?? 'unbekannter Fehler' ) . '. Tipp: Haken „Über ein Postfach senden“ entfernen – dann geht die E-Mail direkt über die Website.'; ?></p></div>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kilic-mailtest">
			<input type="hidden" name="action" value="kilic_mailtest">
			<?php wp_nonce_field( 'kilic_mailtest' ); ?>
			<p><label for="kilic_test_an">An</label><br><input type="email" id="kilic_test_an" name="an" value="<?php echo esc_attr( kilic_inhaber_email() ); ?>" class="regular-text" required></p>
			<?php submit_button( 'Test-E-Mail senden', 'secondary', 'submit', false ); ?>
		</form>

		<h2>Seiten neu einrichten</h2>
		<p>Fehlende Standardseiten (Estrich, Boden, Rohrreinigung, Unterseiten, Kontakt …) und das Hauptmenü neu anlegen. Bestehende Seiten werden nicht überschrieben.</p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="kilic_setup_pages">
			<?php wp_nonce_field( 'kilic_setup_pages' ); ?>
			<?php submit_button( 'Fehlende Seiten anlegen', 'secondary', 'submit', false ); ?>
		</form>

		<h2>Seiteninhalte auf Standard zurücksetzen</h2>
		<p>Ersetzt den Inhalt aller Kilic-Seiten (Start, Estrich, Boden, Rohrreinigung, Unterseiten …) durch die aktuelle Standardversion des Plugins. <strong>Eigene Änderungen an diesen Seiten gehen dabei verloren.</strong> Sinnvoll nach einem Plugin-Update, solange die Texte noch nicht angepasst wurden.</p>
		<?php if ( isset( $_GET['kilic_reset'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="notice notice-success inline"><p><?php echo (int) $_GET['kilic_reset']; // phpcs:ignore WordPress.Security.NonceVerification ?> Seiten wurden zurückgesetzt.</p></div>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="kilic_reset_pages">
			<?php wp_nonce_field( 'kilic_reset_pages' ); ?>
			<p><label><input type="checkbox" name="bestaetigt" value="1" required> Ja, Inhalte der Kilic-Seiten überschreiben</label></p>
			<?php submit_button( 'Seiteninhalte zurücksetzen', 'secondary', 'submit', false ); ?>
		</form>
	</div>
	<?php
}
