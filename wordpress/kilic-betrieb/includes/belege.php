<?php
/**
 * Angebote & Rechnungen: Positionen, Summen, fortlaufende Nummern,
 * Status, Umwandlung Angebot → Rechnung, Druckansicht (PDF über den Browser).
 */

defined( 'ABSPATH' ) || exit;

function kilic_beleg_status_liste( $typ ) {
	if ( 'angebot' === $typ ) {
		return array(
			'entwurf'    => 'Entwurf',
			'offen'      => 'Versendet',
			'angenommen' => 'Auftrag erteilt',
			'abgelehnt'  => 'Abgelehnt',
		);
	}
	return array(
		'entwurf'   => 'Entwurf',
		'offen'     => 'Offen',
		'bezahlt'   => 'Bezahlt',
		'storniert' => 'Storniert',
	);
}

function kilic_status_badge( $status ) {
	$labels = array(
		'entwurf'    => 'Entwurf',
		'offen'      => 'Offen',
		'bezahlt'    => 'Bezahlt',
		'storniert'  => 'Storniert',
		'angenommen' => 'Auftrag erteilt',
		'abgelehnt'  => 'Abgelehnt',
		'neu'        => 'Neu',
		'bearbeitung'=> 'In Bearbeitung',
		'angebot'    => 'Angebot erstellt',
		'erledigt'   => 'Erledigt',
		'teilbezahlt'=> 'Teilbezahlt',
	);
	$status = $status ? $status : 'entwurf';
	return '<span class="kilic-badge kilic-badge-' . esc_attr( $status ) . '">' . esc_html( $labels[ $status ] ?? $status ) . '</span>';
}

function kilic_einheiten() {
	return array( 'm²', 'lfm', 'Std.', 'Stk.', 'pauschal', 'm³', 'kg', 'Tag' );
}

/** Positionen eines Belegs. */
function kilic_beleg_positionen( $id ) {
	$p = get_post_meta( $id, '_positionen', true );
	return is_array( $p ) ? $p : array();
}

/** Summen in Cent. */
function kilic_pos_summe( $pos ) {
	$r = isset( $pos['rabatt'] ) ? (float) $pos['rabatt'] : 0;
	return (int) round( (float) $pos['menge'] * (int) $pos['preis'] * ( 1 - $r / 100 ) );
}

function kilic_beleg_summen( $id ) {
	$zwischen = 0;
	foreach ( kilic_beleg_positionen( $id ) as $pos ) {
		$zwischen += kilic_pos_summe( $pos );
	}
	// Rabatt auf den ganzen Beleg: Prozent oder fester Betrag (Cent).
	$art    = get_post_meta( $id, '_rabatt_art', true );
	$wert   = (float) get_post_meta( $id, '_rabatt_wert', true );
	$rabatt = 0;
	if ( 'prozent' === $art && $wert > 0 ) {
		$rabatt = (int) round( $zwischen * $wert / 100 );
	} elseif ( 'betrag' === $art && $wert > 0 ) {
		$rabatt = min( $zwischen, (int) $wert );
	}
	$netto = $zwischen - $rabatt;
	$satz  = get_post_meta( $id, '_mwst', true );
	$satz  = '' === $satz ? (float) kilic_opt( 'mwst' ) : (float) $satz;
	$mwst  = (int) round( $netto * $satz / 100 );
	$brutto = $netto + $mwst;
	$sk_p   = (float) get_post_meta( $id, '_skonto_prozent', true );
	// Schlussrechnung: bereits gestellte Abschlagsrechnungen abziehen.
	$abz = array();
	$abz_netto = 0;
	$abz_mwst  = 0;
	if ( 'schluss' === get_post_meta( $id, '_rechnungsart', true ) ) {
		foreach ( (array) get_post_meta( $id, '_abzuege', true ) as $aid ) {
			if ( ! $aid || 'kilic_beleg' !== get_post_type( $aid ) ) {
				continue;
			}
			$as        = kilic_beleg_summen( $aid );
			$abz[]     = array( 'id' => $aid, 'netto' => $as['netto'], 'mwst' => $as['mwst'], 'brutto' => $as['brutto'] );
			$abz_netto += $as['netto'];
			$abz_mwst  += $as['mwst'];
		}
	}
	$zahlbetrag = $brutto - $abz_netto - $abz_mwst;
	return array(
		'abzuege'     => $abz,
		'abz_netto'   => $abz_netto,
		'abz_mwst'    => $abz_mwst,
		'zahlbetrag'  => $zahlbetrag,
		'zwischen'    => $zwischen,
		'rabatt'      => $rabatt,
		'rabatt_art'  => $art,
		'rabatt_wert' => $wert,
		'netto'       => $netto,
		'satz'        => $satz,
		'mwst'        => $mwst,
		'brutto'      => $brutto,
		'skonto'      => $sk_p > 0 ? (int) round( $zahlbetrag * $sk_p / 100 ) : 0,
	);
}

function kilic_zahlungsarten_beleg() {
	return array( 'Auf Rechnung (Überweisung)', 'Bar', 'EC-Karte', 'Kreditkarte', 'PayPal', 'Lastschrift', 'Vorkasse', 'Scheck', 'Sonstiges' );
}

function kilic_beleg_typ( $id ) {
	$t = get_post_meta( $id, '_typ', true );
	return 'rechnung' === $t ? 'rechnung' : 'angebot';
}

function kilic_rechnungsart_name( $id ) {
	$a = get_post_meta( $id, '_rechnungsart', true );
	return 'abschlag' === $a ? 'Abschlagsrechnung' : ( 'schluss' === $a ? 'Schlussrechnung' : 'Rechnung' );
}

function kilic_beleg_label( $id ) {
	$typ = kilic_beleg_typ( $id );
	$nr  = get_post_meta( $id, '_nummer', true );
	return ( 'rechnung' === $typ ? kilic_rechnungsart_name( $id ) : 'Angebot' ) . ' ' . ( $nr ? $nr : '(Entwurf)' );
}

/** Abschlagsrechnungen zu einem Auftrag (Angebot). */
function kilic_abschlaege( $angebot_id ) {
	return get_posts( array(
		'post_type'   => 'kilic_beleg',
		'numberposts' => -1,
		'fields'      => 'ids',
		'orderby'     => 'ID',
		'order'       => 'ASC',
		'meta_query'  => array(
			array( 'key' => '_bezug', 'value' => $angebot_id ),
			array( 'key' => '_rechnungsart', 'value' => 'abschlag' ),
			array( 'key' => '_status', 'value' => 'storniert', 'compare' => '!=' ),
		),
	) );
}

function kilic_beleg_gesperrt( $id ) {
	return 'rechnung' === kilic_beleg_typ( $id )
		&& get_post_meta( $id, '_nummer', true )
		&& in_array( get_post_meta( $id, '_status', true ), array( 'offen', 'bezahlt', 'storniert' ), true );
}

/** Nächste fortlaufende Nummer vergeben, z. B. RE-2026-0001. */
function kilic_naechste_nummer( $typ ) {
	$key    = 'rechnung' === $typ ? 're' : 'an';
	$opts   = wp_parse_args( get_option( 'kilic_settings', array() ), kilic_defaults() );
	$next   = max( 1, (int) $opts[ $key . '_next' ] );
	$prefix = $opts[ $key . '_prefix' ] ? $opts[ $key . '_prefix' ] : strtoupper( $key );
	// Nie doppelt vergeben – auch wenn der Zähler zurückgestellt wurde.
	do {
		$nummer = sprintf( '%s-%s-%04d', $prefix, gmdate( 'Y' ), $next );
		$belegt = get_posts( array( 'post_type' => 'kilic_beleg', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'meta_key' => '_nummer', 'meta_value' => $nummer ) );
		$next++;
	} while ( $belegt );
	$opts[ $key . '_next' ] = (string) $next;
	update_option( 'kilic_settings', $opts );
	return $nummer;
}

/* ---------- Bearbeitungsmaske ---------- */

add_action( 'add_meta_boxes_kilic_beleg', function () {
	remove_meta_box( 'submitdiv', 'kilic_beleg', 'side' );
	add_meta_box( 'kilic_beleg_kopf', 'Beleg', 'kilic_beleg_kopf_box', 'kilic_beleg', 'normal', 'high' );
	add_meta_box( 'kilic_beleg_pos', 'Positionen', 'kilic_beleg_pos_box', 'kilic_beleg', 'normal', 'high' );
	add_meta_box( 'kilic_beleg_aktionen', 'Speichern & Senden', 'kilic_beleg_aktionen_box', 'kilic_beleg', 'side', 'high' );
	global $post;
	if ( $post && 'rechnung' === kilic_beleg_typ( $post->ID ) && 'auto-draft' !== $post->post_status ) {
		add_meta_box( 'kilic_beleg_zahlungen', 'Zahlungseingänge', 'kilic_beleg_zahlungen_box', 'kilic_beleg', 'normal', 'default' );
	}
} );

add_filter( 'enter_title_here', function ( $text, $post ) {
	return 'kilic_beleg' === $post->post_type ? 'Wird automatisch vergeben' : $text;
}, 10, 2 );

function kilic_beleg_kopf_box( $post ) {
	wp_nonce_field( 'kilic_beleg_save', 'kilic_beleg_nonce' );
	$id     = $post->ID;
	$typ    = get_post_meta( $id, '_typ', true );
	if ( ! $typ ) {
		$typ = isset( $_GET['kilic_typ'] ) && 'rechnung' === $_GET['kilic_typ'] ? 'rechnung' : 'angebot'; // phpcs:ignore WordPress.Security.NonceVerification
	}
	$nummer = get_post_meta( $id, '_nummer', true );
	$kunde  = (int) get_post_meta( $id, '_kunde', true );
	if ( ! $kunde && isset( $_GET['kilic_kunde'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		$kunde = absint( $_GET['kilic_kunde'] ); // phpcs:ignore WordPress.Security.NonceVerification
	}
	$datum  = get_post_meta( $id, '_datum', true );
	$datum  = $datum ? $datum : current_time( 'Y-m-d' );
	$status = get_post_meta( $id, '_status', true );
	$status = $status ? $status : 'entwurf';
	$ziel   = get_post_meta( $id, '_ziel', true );
	$ziel   = '' === $ziel ? kilic_opt( 'zahlungsziel' ) : $ziel;
	$mwst   = get_post_meta( $id, '_mwst', true );
	$mwst   = '' === $mwst ? kilic_opt( 'mwst' ) : $mwst;
	$oben   = get_post_meta( $id, '_text_oben', true );
	$unten  = get_post_meta( $id, '_text_unten', true );
	if ( 'auto-draft' === $post->post_status ) {
		$oben  = kilic_opt( $typ === 'rechnung' ? 're_text_oben' : 'an_text_oben' );
		$unten = kilic_opt( $typ === 'rechnung' ? 're_text_unten' : 'an_text_unten' );
	}
	$kunden = get_posts( array( 'post_type' => 'kilic_kunde', 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC' ) );
	$gesperrt = kilic_beleg_gesperrt( $id );
	?>
	<?php if ( $gesperrt ) : ?>
		<div class="notice notice-info inline"><p>Diese Rechnung ist abgeschlossen. <strong>Zum Ändern</strong> den Status auf „Entwurf“ setzen und speichern – danach ist alles wieder bearbeitbar und kann erneut gesendet werden. Bereits gesendete Fassungen bleiben unter „Versand &amp; Kopien“ erhalten.</p></div>
	<?php endif; ?>
	<table class="form-table kilic-form"><tbody>
		<tr>
			<th><label for="kb_typ">Art</label></th>
			<td>
				<?php if ( $nummer ) : ?>
					<input type="hidden" name="kilic_beleg[typ]" value="<?php echo esc_attr( $typ ); ?>">
					<strong><?php echo 'rechnung' === $typ ? 'Rechnung' : 'Angebot'; ?> <?php echo esc_html( $nummer ); ?></strong>
				<?php else : ?>
					<select id="kb_typ" name="kilic_beleg[typ]">
						<option value="angebot" <?php selected( $typ, 'angebot' ); ?>>Angebot</option>
						<option value="rechnung" <?php selected( $typ, 'rechnung' ); ?>>Rechnung</option>
					</select>
					<p class="description">Die Nummer wird vergeben, sobald der Status nicht mehr „Entwurf“ ist.</p>
				<?php endif; ?>
			</td>
		</tr>
		<tr>
			<th><label for="kb_kunde">Kunde</label></th>
			<td>
				<?php if ( ! $gesperrt && count( $kunden ) > 8 ) : ?>
					<input type="search" class="kilic-kunde-suche regular-text" placeholder="Kunde suchen (Name, Ort, Nummer) …" aria-label="Kunde suchen" style="margin-bottom:6px"><br>
				<?php endif; ?>
				<select id="kb_kunde" name="kilic_beleg[kunde]" <?php disabled( $gesperrt ); ?> style="min-width:340px">
					<option value="">– Kunde wählen –</option>
					<?php if ( ! $gesperrt ) : ?><option value="neu">+ Neuen Kunden hier anlegen</option><?php endif; ?>
					<?php foreach ( $kunden as $k ) : ?>
						<option value="<?php echo esc_attr( $k->ID ); ?>" data-privat="<?php echo esc_attr( get_post_meta( $k->ID, '_privat', true ) ); ?>" <?php selected( $kunde, $k->ID ); ?>><?php echo esc_html( kilic_kunde_label( $k->ID ) ); ?></option>
					<?php endforeach; ?>
				</select>
				<?php if ( $kunde ) : ?>
					<a href="<?php echo esc_url( get_edit_post_link( $kunde ) ); ?>" target="_blank">Kundendaten öffnen</a>
					<?php $kfehlt = kilic_kunde_fehlende( $kunde ); ?>
					<?php if ( $kfehlt ) : ?>
						<p class="kk-fehlt">Beim Kunden fehlt noch: <?php echo esc_html( implode( ', ', $kfehlt ) ); ?> – <a href="<?php echo esc_url( get_edit_post_link( $kunde ) ); ?>" target="_blank">jetzt ergänzen</a></p>
					<?php endif; ?>
				<?php endif; ?>
				<div class="kilic-neuer-kunde" hidden>
					<p><strong>Neuer Kunde</strong> – wird beim Speichern angelegt. <span class="kk-pflicht">*</span> = Pflichtfeld</p>
					<p><input type="text" name="kilic_neukunde[name]" placeholder="Vor- und Nachname *" data-pflicht aria-label="Vor- und Nachname" class="regular-text"> <input type="text" name="kilic_neukunde[firma]" placeholder="Firma (optional)" aria-label="Firma" class="regular-text"></p>
					<p class="kk-duo"><input type="text" name="kilic_neukunde[str]" placeholder="Straße *" data-pflicht aria-label="Straße" class="kk-gross"> <input type="text" name="kilic_neukunde[hausnr]" placeholder="Nr. *" data-pflicht aria-label="Hausnummer" class="kk-klein"></p>
					<p class="kk-duo"><input type="text" name="kilic_neukunde[plz]" placeholder="PLZ *" data-pflicht aria-label="PLZ" inputmode="numeric" class="kk-klein"> <input type="text" name="kilic_neukunde[ort]" placeholder="Ort *" data-pflicht aria-label="Ort" class="kk-gross"></p>
					<p><input type="email" name="kilic_neukunde[email]" placeholder="E-Mail *" aria-label="E-Mail" data-pflicht class="regular-text"> <input type="tel" name="kilic_neukunde[telefon]" placeholder="Telefon *" aria-label="Telefon" data-pflicht class="regular-text"></p>
					<p><label><input type="checkbox" name="kilic_neukunde[privat]" value="1" checked> Privatkunde</label></p>
				</div>
			</td>
		</tr>
		<tr>
			<th><label for="kb_datum">Datum</label></th>
			<td><input type="date" id="kb_datum" name="kilic_beleg[datum]" value="<?php echo esc_attr( $datum ); ?>" <?php disabled( $gesperrt ); ?>></td>
		</tr>
		<tr>
			<th><label for="kb_leistung">Leistungszeitraum / Baustelle</label></th>
			<td><input type="text" id="kb_leistung" name="kilic_beleg[leistung]" value="<?php echo esc_attr( get_post_meta( $id, '_leistung', true ) ); ?>" class="large-text" placeholder="z. B. 03.–05.11.2026, BV Musterweg 3, Mosbach" <?php disabled( $gesperrt ); ?>>
			<p class="description">Auf Rechnungen Pflicht: Zeitpunkt der Leistung.</p></td>
		</tr>
		<?php if ( 'angebot' === $typ ) : ?>
		<tr>
			<th><label for="kb_termin_von">Ausführungstermin (Auftrag)</label></th>
			<td><input type="date" id="kb_termin_von" name="kilic_beleg[termin_von]" value="<?php echo esc_attr( get_post_meta( $id, '_termin_von', true ) ); ?>"> bis <input type="date" name="kilic_beleg[termin_bis]" value="<?php echo esc_attr( get_post_meta( $id, '_termin_bis', true ) ); ?>" aria-label="Termin bis">
			<p class="description">Erscheint im Cockpit unter „Aufträge“ und auf der Auftragsbestätigung.</p></td>
		</tr>
		<?php endif; ?>
		<tr>
			<th><label for="kb_status">Status</label></th>
			<td>
				<select id="kb_status" name="kilic_beleg[status]">
					<?php foreach ( kilic_beleg_status_liste( $typ ) as $k => $l ) : ?>
						<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $status, $k ); ?>><?php echo esc_html( $l ); ?></option>
					<?php endforeach; ?>
				</select>
				<?php if ( 'rechnung' === $typ ) : ?>
				<span class="kilic-inline">
					<label for="kb_bezahlt">bezahlt am</label>
					<input type="date" id="kb_bezahlt" name="kilic_beleg[bezahlt_am]" value="<?php echo esc_attr( get_post_meta( $id, '_bezahlt_am', true ) ); ?>">
				</span>
				<?php endif; ?>
			</td>
		</tr>
		<tr>
			<th><label for="kb_ziel">Zahlungsziel</label></th>
			<td><input type="number" min="0" id="kb_ziel" name="kilic_beleg[ziel]" value="<?php echo esc_attr( $ziel ); ?>" class="small-text" <?php disabled( $gesperrt ); ?>> Tage
				<span class="kilic-inline"><label for="kb_mwst">MwSt.</label> <input type="number" step="0.1" min="0" id="kb_mwst" name="kilic_beleg[mwst]" value="<?php echo esc_attr( $mwst ); ?>" class="small-text" <?php disabled( $gesperrt ); ?>> %</span>
			</td>
		</tr>
		<tr>
			<th><label for="kb_zahlungsart">Zahlungsart</label></th>
			<td>
				<?php $za = get_post_meta( $id, '_zahlungsart', true ); $za = $za && 'Überweisung' !== $za ? $za : 'Auf Rechnung (Überweisung)'; ?>
				<select id="kb_zahlungsart" name="kilic_beleg[zahlungsart]" <?php disabled( $gesperrt ); ?>>
					<?php foreach ( kilic_zahlungsarten_beleg() as $a ) : ?>
						<option <?php selected( $za, $a ); ?>><?php echo esc_html( $a ); ?></option>
					<?php endforeach; ?>
				</select>
				<span class="kilic-inline"><label for="kb_skonto">Skonto</label>
					<input type="text" id="kb_skonto" name="kilic_beleg[skonto_prozent]" value="<?php echo esc_attr( (float) get_post_meta( $id, '_skonto_prozent', true ) ? kilic_num( get_post_meta( $id, '_skonto_prozent', true ), 2 ) : '' ); ?>" placeholder="0" style="width:70px" <?php disabled( $gesperrt ); ?>> % bei Zahlung innerhalb
					<input type="number" min="0" name="kilic_beleg[skonto_tage]" value="<?php echo esc_attr( get_post_meta( $id, '_skonto_tage', true ) ); ?>" placeholder="7" style="width:80px" aria-label="Skonto-Tage" <?php disabled( $gesperrt ); ?>> Tagen</span>
				<p class="description">Bei „Bar“ oder „EC-Karte“ steht auf der Rechnung „Betrag dankend erhalten“, sobald die Zahlung erfasst ist.</p>
			</td>
		</tr>
		<tr>
			<th><label for="kb_oben">Einleitungstext</label></th>
			<td><textarea id="kb_oben" name="kilic_beleg[text_oben]" rows="2" class="large-text" <?php disabled( $gesperrt ); ?>><?php echo esc_textarea( $oben ); ?></textarea></td>
		</tr>
		<tr>
			<th><label for="kb_unten">Schlusstext</label></th>
			<td><textarea id="kb_unten" name="kilic_beleg[text_unten]" rows="2" class="large-text" <?php disabled( $gesperrt ); ?>><?php echo esc_textarea( $unten ); ?></textarea></td>
		</tr>
		<tr<?php echo 'rechnung' === $typ ? '' : ' hidden'; ?>>
			<th><label for="kb_lohn">Arbeitskosten für den Steuerbonus</label><br><span class="kk-opt" style="margin:0">nur bei Privatkunden, freiwillig</span></th>
			<td>
				<p class="kb-lohn-intro">Privatkunden können <strong>20 % der Arbeitskosten</strong> von der Steuer abziehen (Handwerkerbonus, § 35a EStG). Material zählt nicht, nur Lohn, Maschinen und Anfahrt.<br>Tragen Sie hier ein, wie viel vom Rechnungsbetrag (netto) reine Arbeitskosten sind.</p>
				<div class="kb-lohn-feld"><input type="text" inputmode="decimal" id="kb_lohn" name="kilic_beleg[lohn]" value="<?php echo esc_attr( get_post_meta( $id, '_lohn', true ) ? number_format( get_post_meta( $id, '_lohn', true ) / 100, 2, ',', '' ) : '' ); ?>" placeholder="z. B. 1.000,00" <?php disabled( $gesperrt ); ?>> <span>€ netto</span></div>
				<div class="kb-lohn-vorschau" aria-live="polite" hidden></div>
				<p class="description">Leer lassen = kein Hinweis auf der Rechnung.</p>
				<p class="kk-fehlt kb-lohn-firma" hidden>Dieser Kunde ist kein Privatkunde – der Hinweis wird nicht gedruckt.</p>
			</td>
		</tr>
	</tbody></table>
	<?php
}

function kilic_beleg_pos_box( $post ) {
	$pos      = kilic_beleg_positionen( $post->ID );
	$gesperrt = kilic_beleg_gesperrt( $post->ID );
	if ( ! $pos ) {
		$pos = array( array( 'text' => '', 'menge' => 1, 'einheit' => 'm²', 'preis' => 0 ) );
	}
	$mwst = get_post_meta( $post->ID, '_mwst', true );
	$mwst = '' === $mwst ? kilic_opt( 'mwst' ) : $mwst;
	?>
	<table class="widefat kilic-pos" data-locked="<?php echo $gesperrt ? '1' : '0'; ?>" data-mwst="<?php echo esc_attr( $mwst ); ?>">
		<thead><tr><th style="width:36px">Pos.</th><th>Leistung / Beschreibung</th><th style="width:90px">Menge</th><th style="width:100px">Einheit</th><th style="width:120px">Einzelpreis netto</th><th style="width:80px">Rabatt %</th><th style="width:120px;text-align:right">Gesamt netto</th><th style="width:40px"></th></tr></thead>
		<tbody>
		<?php foreach ( $pos as $i => $p ) : ?>
			<tr class="kilic-pos-row">
				<td class="kilic-pos-nr" data-label="Pos."><?php echo (int) $i + 1; ?></td>
				<td class="kp-text" data-label="Leistung / Beschreibung"><textarea name="kilic_pos[text][]" aria-label="Leistung / Beschreibung" rows="2" <?php disabled( $gesperrt ); ?>><?php echo esc_textarea( $p['text'] ); ?></textarea></td>
				<td class="kp-f" data-label="Menge"><input type="text" inputmode="decimal" aria-label="Menge" name="kilic_pos[menge][]" value="<?php echo esc_attr( kilic_num( $p['menge'], 3 ) ); ?>" <?php disabled( $gesperrt ); ?>></td>
				<td class="kp-f" data-label="Einheit"><select aria-label="Einheit" name="kilic_pos[einheit][]" <?php disabled( $gesperrt ); ?>>
					<?php foreach ( kilic_einheiten() as $e ) : ?>
						<option <?php selected( $p['einheit'], $e ); ?>><?php echo esc_html( $e ); ?></option>
					<?php endforeach; ?>
				</select></td>
				<td class="kp-f" data-label="Einzelpreis netto (€)"><input type="text" inputmode="decimal" aria-label="Einzelpreis netto" name="kilic_pos[preis][]" value="<?php echo esc_attr( number_format( (int) $p['preis'] / 100, 2, ',', '' ) ); ?>" <?php disabled( $gesperrt ); ?>></td>
				<td class="kp-f" data-label="Rabatt %"><input type="text" inputmode="decimal" aria-label="Rabatt in Prozent" name="kilic_pos[rabatt][]" value="<?php echo esc_attr( ! empty( $p['rabatt'] ) ? kilic_num( $p['rabatt'], 2 ) : '' ); ?>" placeholder="0" <?php disabled( $gesperrt ); ?>></td>
				<td class="kilic-pos-sum" data-label="Gesamt netto" style="text-align:right"></td>
				<td class="kp-del"><?php if ( ! $gesperrt ) : ?><button type="button" class="button-link kilic-pos-del" aria-label="Position entfernen">✕</button><?php endif; ?></td>
			</tr>
		<?php endforeach; ?>
		</tbody>
		<tfoot>
			<tr class="kp-add-zeile"><td colspan="6"><?php if ( ! $gesperrt ) : ?><button type="button" class="button kilic-pos-add">+ Position hinzufügen</button>
				<span class="kilic-vorlagen"><label for="kilic-katalog">Aus Leistungskatalog:</label>
					<select id="kilic-katalog" class="kilic-pos-vorlage">
						<option value="">– Leistung wählen –</option>
						<?php foreach ( kilic_katalog() as $bereich => $items ) : ?>
							<optgroup label="<?php echo esc_attr( kilic_katalog_bereiche()[ $bereich ] ); ?>">
								<?php foreach ( $items as $it ) : ?>
									<option value="<?php echo esc_attr( $it['text'] ); ?>" data-e="<?php echo esc_attr( $it['einheit'] ); ?>" data-p="<?php echo esc_attr( number_format( $it['preis'] / 100, 2, ',', '' ) ); ?>"><?php echo esc_html( $it['titel'] . ' – ' . ( $it['preis'] ? kilic_eur( $it['preis'] ) : 'ohne Preis' ) . ' / ' . $it['einheit'] ); ?></option>
								<?php endforeach; ?>
							</optgroup>
						<?php endforeach; ?>
					</select>
					<a href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_leistung' ) ); ?>" target="_blank">Katalog bearbeiten</a>
				</span><?php endif; ?></td>
				<td colspan="2"></td></tr>
			<tr class="kilic-sum"><td colspan="6" style="text-align:right">Zwischensumme netto</td><td class="kilic-zwischen" style="text-align:right"></td><td></td></tr>
			<tr class="kilic-sum kilic-rabatt-zeile"><td colspan="6" style="text-align:right">
				<?php $ra = get_post_meta( $post->ID, '_rabatt_art', true ); $rw = (float) get_post_meta( $post->ID, '_rabatt_wert', true ); ?>
				<label for="kb_rabatt_art"><strong>Rabatt auf den Beleg</strong></label>
				<select id="kb_rabatt_art" name="kilic_beleg[rabatt_art]" <?php disabled( $gesperrt ); ?>>
					<option value="">kein Rabatt</option>
					<option value="prozent" <?php selected( $ra, 'prozent' ); ?>>in %</option>
					<option value="betrag" <?php selected( $ra, 'betrag' ); ?>>in € (netto)</option>
				</select>
				<input type="text" id="kb_rabatt_wert" name="kilic_beleg[rabatt_wert]" value="<?php echo esc_attr( $rw ? ( 'betrag' === $ra ? number_format( $rw / 100, 2, ',', '' ) : kilic_num( $rw, 2 ) ) : '' ); ?>" placeholder="0" style="width:90px" <?php disabled( $gesperrt ); ?>>
				<input type="text" name="kilic_beleg[rabatt_text]" value="<?php echo esc_attr( get_post_meta( $post->ID, '_rabatt_text', true ) ); ?>" placeholder="Bezeichnung, z. B. Treuerabatt" style="width:200px" <?php disabled( $gesperrt ); ?>>
			</td><td class="kilic-rabatt" style="text-align:right"></td><td></td></tr>
			<tr class="kilic-sum"><td colspan="6" style="text-align:right">Summe netto</td><td class="kilic-netto" style="text-align:right"></td><td></td></tr>
			<tr class="kilic-sum"><td colspan="6" style="text-align:right">zzgl. MwSt. <span class="kilic-satz"></span> %</td><td class="kilic-mwst" style="text-align:right"></td><td></td></tr>
			<tr class="kilic-sum kilic-sum-total"><td colspan="6" style="text-align:right">Gesamtbetrag</td><td class="kilic-brutto" style="text-align:right"></td><td></td></tr>
		</tfoot>
	</table>
	<?php
}

function kilic_beleg_aktionen_box( $post ) {
	$id = $post->ID;
	$fehlt = array();
	foreach ( array( 'steuernr' => 'Steuernummer', 'ust_id' => 'USt-IdNr.', 'iban' => 'IBAN', 'email' => 'E-Mail' ) as $k => $l ) {
		if ( ! kilic_opt( $k ) || kilic_ist_platzhalter( $k ) ) {
			$fehlt[] = $l;
		}
	}
	if ( $fehlt ) {
		echo '<div class="notice notice-warning inline"><p>Noch Platzhalter: ' . esc_html( implode( ', ', $fehlt ) ) . '. Vor dem Versand echter Rechnungen unter <a href="' . esc_url( admin_url( 'admin.php?page=kilic-einstellungen' ) ) . '">Einstellungen</a> eintragen.</p></div>';
	}
	echo '<div class="kilic-actions">';
	echo '<button type="submit" name="save" class="button button-primary button-large" style="width:100%">Speichern</button>';
	if ( 'auto-draft' !== $post->post_status ) {
		echo '<a class="button button-large" style="width:100%;text-align:center;margin-top:8px" href="' . esc_url( kilic_senden_url( $id ) ) . '"><span class="dashicons dashicons-email" style="vertical-align:text-bottom"></span> Per E-Mail an Kunden</a>';
		$print = wp_nonce_url( admin_url( 'admin-post.php?action=kilic_drucken&id=' . $id ), 'kilic_drucken_' . $id );
		echo '<a class="button button-large" style="width:100%;text-align:center;margin-top:8px" target="_blank" href="' . esc_url( $print ) . '">Drucken / als PDF speichern</a>';
		if ( 'angebot' === kilic_beleg_typ( $id ) ) {
			$conv = wp_nonce_url( admin_url( 'admin-post.php?action=kilic_umwandeln&id=' . $id ), 'kilic_umwandeln_' . $id );
			echo '<a class="button" style="width:100%;text-align:center;margin-top:8px" href="' . esc_url( $conv ) . '">In Rechnung umwandeln</a>';
		}
		$dup = wp_nonce_url( admin_url( 'admin-post.php?action=kilic_kopieren&id=' . $id ), 'kilic_kopieren_' . $id );
		echo '<a class="button" style="width:100%;text-align:center;margin-top:8px" href="' . esc_url( $dup ) . '">Als neuen Entwurf kopieren</a>';
		$kd = (int) get_post_meta( $id, '_kunde', true );
		if ( $kd ) {
			echo '<p><a href="' . esc_url( get_edit_post_link( $kd ) . '#kilic_kunde_verlauf' ) . '">Kundenakte &amp; Verlauf öffnen</a></p>';
		}
		$bezug = (int) get_post_meta( $id, '_bezug', true );
		if ( $bezug ) {
			echo '<p>Erstellt aus: <a href="' . esc_url( get_edit_post_link( $bezug ) ) . '">' . esc_html( kilic_beleg_label( $bezug ) ) . '</a></p>';
		}
		$anfrage = (int) get_post_meta( $id, '_anfrage', true );
		if ( $anfrage ) {
			echo '<p>Zur Anfrage: <a href="' . esc_url( get_edit_post_link( $anfrage ) ) . '">' . esc_html( get_the_title( $anfrage ) ) . '</a></p>';
		}
		if ( ! kilic_beleg_gesperrt( $id ) && current_user_can( 'delete_post', $id ) ) {
			echo '<p><a class="submitdelete" href="' . esc_url( get_delete_post_link( $id ) ) . '">In den Papierkorb</a></p>';
		}
	}
	echo '</div>';
	echo '<input type="hidden" name="post_status" value="publish">';
}

add_action( 'save_post_kilic_beleg', 'kilic_beleg_save', 10, 2 );

function kilic_beleg_save( $post_id, $post ) {
	if ( ! isset( $_POST['kilic_beleg_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['kilic_beleg_nonce'] ), 'kilic_beleg_save' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$d        = isset( $_POST['kilic_beleg'] ) ? (array) wp_unslash( $_POST['kilic_beleg'] ) : array();
	$gesperrt = kilic_beleg_gesperrt( $post_id );
	$alt_status = get_post_meta( $post_id, '_status', true );
	$alt_kunde  = (int) get_post_meta( $post_id, '_kunde', true );

	if ( ! get_post_meta( $post_id, '_nummer', true ) ) {
		update_post_meta( $post_id, '_typ', ( $d['typ'] ?? '' ) === 'rechnung' ? 'rechnung' : 'angebot' );
	}
	$typ = kilic_beleg_typ( $post_id );

	$status = sanitize_key( $d['status'] ?? 'entwurf' );
	if ( ! isset( kilic_beleg_status_liste( $typ )[ $status ] ) ) {
		$status = 'entwurf';
	}
	// Zurück in den Entwurf ist erlaubt; gesendete Fassungen bleiben im Versandarchiv.
	// Die Felder waren gesperrt und wurden daher nicht mitgesendet: in diesem
	// Speichervorgang nur den Status ändern, Inhalte bleiben unverändert.
	if ( $gesperrt && 'entwurf' === $status ) {
		kilic_log_beleg( $post_id, 'zur Bearbeitung wieder geöffnet', kilic_beleg_typ( $post_id ) );
	}
	update_post_meta( $post_id, '_status', $status );
	update_post_meta( $post_id, '_bezahlt_am', sanitize_text_field( $d['bezahlt_am'] ?? '' ) );
	if ( isset( $d['termin_von'] ) ) {
		update_post_meta( $post_id, '_termin_von', sanitize_text_field( $d['termin_von'] ) );
		update_post_meta( $post_id, '_termin_bis', sanitize_text_field( $d['termin_bis'] ?? '' ) );
	}
	if ( 'rechnung' === $typ ) {
		$vorher = count( kilic_zahlungen( $post_id ) );
		kilic_zahlungen_speichern( $post_id );
		if ( count( kilic_zahlungen( $post_id ) ) > $vorher && 'entwurf' === get_post_meta( $post_id, '_status', true ) ) {
			update_post_meta( $post_id, '_status', 'offen' );
			$status = 'offen';
		}
	}

	if ( ! $gesperrt ) {
		$kunde_id = absint( $d['kunde'] ?? 0 );
		if ( 'neu' === ( $d['kunde'] ?? '' ) ) {
			$nk = isset( $_POST['kilic_neukunde'] ) ? (array) wp_unslash( $_POST['kilic_neukunde'] ) : array();
			if ( '' !== trim( $nk['name'] ?? '' ) || '' !== trim( $nk['firma'] ?? '' ) ) {
				$kunde_id = kilic_kunde_finden_oder_anlegen( sanitize_text_field( trim( $nk['name'] ?? '' ) ? $nk['name'] : $nk['firma'] ), $nk );
			}
		}
		update_post_meta( $post_id, '_kunde', $kunde_id );
		update_post_meta( $post_id, '_datum', sanitize_text_field( $d['datum'] ?? current_time( 'Y-m-d' ) ) );
		update_post_meta( $post_id, '_leistung', sanitize_text_field( $d['leistung'] ?? '' ) );
		update_post_meta( $post_id, '_ziel', (string) absint( $d['ziel'] ?? 14 ) );
		update_post_meta( $post_id, '_mwst', (string) (float) str_replace( ',', '.', $d['mwst'] ?? kilic_opt( 'mwst' ) ) );
		update_post_meta( $post_id, '_text_oben', sanitize_textarea_field( $d['text_oben'] ?? '' ) );
		update_post_meta( $post_id, '_text_unten', sanitize_textarea_field( $d['text_unten'] ?? '' ) );
		update_post_meta( $post_id, '_lohn', kilic_to_cents( $d['lohn'] ?? '' ) );
		$ra = in_array( $d['rabatt_art'] ?? '', array( 'prozent', 'betrag' ), true ) ? $d['rabatt_art'] : '';
		update_post_meta( $post_id, '_rabatt_art', $ra );
		update_post_meta( $post_id, '_rabatt_wert', 'betrag' === $ra ? kilic_to_cents( $d['rabatt_wert'] ?? '' ) : max( 0, min( 100, kilic_to_float( $d['rabatt_wert'] ?? 0 ) ) ) );
		update_post_meta( $post_id, '_rabatt_text', sanitize_text_field( $d['rabatt_text'] ?? '' ) );
		$za = sanitize_text_field( $d['zahlungsart'] ?? '' );
		update_post_meta( $post_id, '_zahlungsart', in_array( $za, kilic_zahlungsarten_beleg(), true ) ? $za : 'Auf Rechnung (Überweisung)' );
		update_post_meta( $post_id, '_skonto_prozent', max( 0, min( 10, kilic_to_float( $d['skonto_prozent'] ?? 0 ) ) ) );
		update_post_meta( $post_id, '_skonto_tage', absint( $d['skonto_tage'] ?? 0 ) );

		$raw = isset( $_POST['kilic_pos'] ) ? (array) wp_unslash( $_POST['kilic_pos'] ) : array();
		$pos = array();
		$n   = isset( $raw['text'] ) ? count( (array) $raw['text'] ) : 0;
		for ( $i = 0; $i < $n; $i++ ) {
			$text = sanitize_textarea_field( $raw['text'][ $i ] ?? '' );
			if ( '' === trim( $text ) ) {
				continue;
			}
			$einheit = sanitize_text_field( $raw['einheit'][ $i ] ?? 'Stk.' );
			$pos[] = array(
				'text'    => $text,
				'menge'   => kilic_to_float( $raw['menge'][ $i ] ?? 1 ),
				'einheit' => in_array( $einheit, kilic_einheiten(), true ) ? $einheit : 'Stk.',
				'preis'   => kilic_to_cents( $raw['preis'][ $i ] ?? 0 ),
				'rabatt'  => max( 0, min( 100, kilic_to_float( $raw['rabatt'][ $i ] ?? 0 ) ) ),
			);
		}
		update_post_meta( $post_id, '_positionen', $pos );
	}

	if ( 'entwurf' !== $status && ! get_post_meta( $post_id, '_nummer', true ) ) {
		update_post_meta( $post_id, '_nummer', kilic_naechste_nummer( $typ ) );
	}

	if ( 'rechnung' === $typ ) {
		kilic_zahlstatus_abgleichen( $post_id );
	}
	kilic_beleg_titel_setzen( $post_id );

	// Verlauf: neuer Beleg und Statuswechsel festhalten.
	$neu_status = get_post_meta( $post_id, '_status', true );
	if ( ! $alt_status || ( ! $alt_kunde && get_post_meta( $post_id, '_kunde', true ) ) ) {
		kilic_log_beleg( $post_id, 'angelegt', $typ );
	}
	if ( $alt_status && $alt_status !== $neu_status ) {
		kilic_log_beleg( $post_id, 'Status „' . wp_strip_all_tags( kilic_status_badge( $neu_status ) ) . '“', 'angenommen' === $neu_status ? 'auftrag' : $typ );
	}
}

function kilic_beleg_titel_setzen( $post_id ) {
	$kunde = (int) get_post_meta( $post_id, '_kunde', true );
	$title = kilic_beleg_label( $post_id ) . ( $kunde ? ' – ' . get_the_title( $kunde ) : '' );
	if ( get_post_field( 'post_title', $post_id ) !== $title || 'publish' !== get_post_status( $post_id ) ) {
		remove_action( 'save_post_kilic_beleg', 'kilic_beleg_save', 10 );
		wp_update_post( array( 'ID' => $post_id, 'post_title' => $title, 'post_status' => 'publish' ) );
		add_action( 'save_post_kilic_beleg', 'kilic_beleg_save', 10, 2 );
	}
}

/** Abgeschlossene Rechnungen nicht löschen. */
add_action( 'pre_delete_post', function ( $check, $post ) {
	if ( $post && 'kilic_beleg' === $post->post_type && kilic_beleg_gesperrt( $post->ID ) ) {
		return false;
	}
	return $check;
}, 10, 2 );
add_action( 'wp_trash_post', function ( $post_id ) {
	if ( 'kilic_beleg' === get_post_type( $post_id ) && kilic_beleg_gesperrt( $post_id ) ) {
		wp_die( 'Abgeschlossene Rechnungen können nicht gelöscht werden. Bitte stornieren.', '', array( 'back_link' => true ) );
	}
} );

/* ---------- Aktionen ---------- */

/** Beleg kopieren; $typ = neuer Typ. */
function kilic_beleg_kopie( $quelle, $typ ) {
	$new = wp_insert_post( array(
		'post_type'   => 'kilic_beleg',
		'post_status' => 'publish',
		'post_title'  => 'Entwurf',
	) );
	if ( ! $new || is_wp_error( $new ) ) {
		return 0;
	}
	foreach ( array( '_kunde', '_leistung', '_mwst', '_positionen', '_lohn', '_anfrage', '_rabatt_art', '_rabatt_wert', '_rabatt_text', '_zahlungsart', '_skonto_prozent', '_skonto_tage' ) as $k ) {
		update_post_meta( $new, $k, get_post_meta( $quelle, $k, true ) );
	}
	update_post_meta( $new, '_typ', $typ );
	update_post_meta( $new, '_status', 'entwurf' );
	update_post_meta( $new, '_datum', current_time( 'Y-m-d' ) );
	update_post_meta( $new, '_ziel', kilic_opt( 'zahlungsziel' ) );
	update_post_meta( $new, '_text_oben', kilic_opt( 'rechnung' === $typ ? 're_text_oben' : 'an_text_oben' ) );
	update_post_meta( $new, '_text_unten', kilic_opt( 'rechnung' === $typ ? 're_text_unten' : 'an_text_unten' ) );
	kilic_beleg_titel_setzen( $new );
	return $new;
}

add_action( 'admin_post_kilic_umwandeln', function () {
	$id = absint( $_GET['id'] ?? 0 );
	check_admin_referer( 'kilic_umwandeln_' . $id );
	if ( ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$new = kilic_beleg_kopie( $id, 'rechnung' );
	update_post_meta( $new, '_bezug', $id );
	$abs = kilic_abschlaege( $id );
	if ( $abs ) {
		update_post_meta( $new, '_rechnungsart', 'schluss' );
		update_post_meta( $new, '_abzuege', $abs );
	}
	update_post_meta( $id, '_rechnung', $new );
	kilic_log_beleg( $new, 'Rechnungsentwurf aus ' . kilic_beleg_label( $id ) . ' erstellt', 'rechnung' );
	if ( in_array( get_post_meta( $id, '_status', true ), array( 'entwurf', 'offen' ), true ) ) {
		update_post_meta( $id, '_status', 'angenommen' );
		if ( ! get_post_meta( $id, '_nummer', true ) ) {
			update_post_meta( $id, '_nummer', kilic_naechste_nummer( 'angebot' ) );
			kilic_beleg_titel_setzen( $id );
		}
	}
	wp_safe_redirect( get_edit_post_link( $new, 'url' ) );
	exit;
} );

add_action( 'admin_post_kilic_kopieren', function () {
	$id = absint( $_GET['id'] ?? 0 );
	check_admin_referer( 'kilic_kopieren_' . $id );
	if ( ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$new = kilic_beleg_kopie( $id, kilic_beleg_typ( $id ) );
	wp_safe_redirect( get_edit_post_link( $new, 'url' ) );
	exit;
} );

add_action( 'admin_post_kilic_drucken', function () {
	$id = absint( $_GET['id'] ?? 0 );
	check_admin_referer( 'kilic_drucken_' . $id );
	if ( 'kilic_beleg' !== get_post_type( $id ) || ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$art_log = sanitize_key( $_GET['art'] ?? '' );
	$namen   = array( 'ab' => 'Auftragsbestätigung', 'mahnung' => 'Zahlungserinnerung' );
	kilic_log_beleg( $id, ( $namen[ $art_log ] ?? 'Beleg' ) . ' gedruckt / als PDF geöffnet', 'mahnung' === $art_log ? 'mahnung' : 'druck' );
	include KILIC_DIR . 'templates/beleg-druck.php';
	exit;
} );

/** CSV-Export der Rechnungen eines Jahres (z. B. für den Steuerberater). */
add_action( 'admin_post_kilic_export', function () {
	check_admin_referer( 'kilic_export' );
	if ( ! current_user_can( 'kilic_buero' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$jahr = absint( $_GET['jahr'] ?? gmdate( 'Y' ) );
	$ids  = get_posts( array(
		'post_type'   => 'kilic_beleg',
		'numberposts' => -1,
		'fields'      => 'ids',
		'meta_query'  => array(
			array( 'key' => '_typ', 'value' => 'rechnung' ),
			array( 'key' => '_nummer', 'compare' => '!=', 'value' => '' ),
			array( 'key' => '_datum', 'value' => array( $jahr . '-01-01', $jahr . '-12-31' ), 'compare' => 'BETWEEN', 'type' => 'DATE' ),
		),
		'meta_key'    => '_nummer',
		'orderby'     => 'meta_value',
		'order'       => 'ASC',
	) );
	nocache_headers();
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename="rechnungen-' . $jahr . '.csv"' );
	$out = fopen( 'php://output', 'w' );
	fwrite( $out, "\xEF\xBB\xBF" );
	fputcsv( $out, array( 'Rechnungsnummer', 'Datum', 'Kunde', 'Kundennummer', 'Netto', 'MwSt-Satz', 'MwSt', 'Brutto', 'Status', 'Bezahlt am' ), ';' );
	foreach ( $ids as $id ) {
		$s     = kilic_beleg_summen( $id );
		$kunde = (int) get_post_meta( $id, '_kunde', true );
		fputcsv( $out, array(
			get_post_meta( $id, '_nummer', true ),
			kilic_date( get_post_meta( $id, '_datum', true ) ),
			$kunde ? get_the_title( $kunde ) : '',
			$kunde ? get_post_meta( $kunde, '_kundennr', true ) : '',
			number_format( $s['netto'] / 100, 2, ',', '' ),
			kilic_num( $s['satz'], 1 ),
			number_format( $s['mwst'] / 100, 2, ',', '' ),
			number_format( $s['brutto'] / 100, 2, ',', '' ),
			get_post_meta( $id, '_status', true ),
			kilic_date( get_post_meta( $id, '_bezahlt_am', true ) ),
		), ';' );
	}
	fclose( $out );
	exit;
} );

/* ---------- Liste ---------- */

add_filter( 'manage_kilic_beleg_posts_columns', function ( $cols ) {
	return array(
		'cb'     => $cols['cb'],
		'title'  => 'Beleg',
		'kunde'  => 'Kunde',
		'datum'  => 'Datum',
		'status' => 'Status',
		'faellig'=> 'Fällig',
		'brutto' => 'Brutto',
		'druck'  => '',
	);
} );

add_action( 'manage_kilic_beleg_posts_custom_column', function ( $col, $id ) {
	switch ( $col ) {
		case 'kunde':
			$k = (int) get_post_meta( $id, '_kunde', true );
			echo $k ? '<a href="' . esc_url( get_edit_post_link( $k ) ) . '">' . esc_html( get_the_title( $k ) ) . '</a>' : '–';
			break;
		case 'datum':
			echo esc_html( kilic_date( get_post_meta( $id, '_datum', true ) ) );
			break;
		case 'status':
			echo kilic_status_badge( get_post_meta( $id, '_status', true ) ); // phpcs:ignore WordPress.Security.EscapeOutput
			break;
		case 'faellig':
			if ( 'rechnung' === kilic_beleg_typ( $id ) && 'offen' === get_post_meta( $id, '_status', true ) ) {
				$f = kilic_beleg_faellig( $id );
				$over = $f && $f < current_time( 'Y-m-d' );
				echo '<span' . ( $over ? ' class="kilic-ueberfaellig"' : '' ) . '>' . esc_html( kilic_date( $f ) ) . ( $over ? ' (überfällig)' : '' ) . '</span>';
			}
			break;
		case 'brutto':
			echo esc_html( kilic_eur( kilic_beleg_summen( $id )['brutto'] ) );
			break;
		case 'druck':
			$print = wp_nonce_url( admin_url( 'admin-post.php?action=kilic_drucken&id=' . $id ), 'kilic_drucken_' . $id );
			echo '<div class="kl-aktionen">';
			echo '<a class="kl-btn kl-primaer" href="' . esc_url( kilic_senden_url( $id ) ) . '"><span class="dashicons dashicons-email"></span><span>Senden</span></a>';
			echo '<a class="kl-btn" target="_blank" href="' . esc_url( $print ) . '"><span class="dashicons dashicons-printer"></span><span>Drucken</span></a>';
			echo '</div>';
			break;
	}
}, 10, 2 );

function kilic_beleg_faellig( $id ) {
	$datum = get_post_meta( $id, '_datum', true );
	if ( ! $datum ) {
		return '';
	}
	return gmdate( 'Y-m-d', strtotime( $datum . ' +' . absint( get_post_meta( $id, '_ziel', true ) ) . ' days' ) );
}

add_action( 'restrict_manage_posts', function ( $type ) {
	if ( 'kilic_beleg' !== $type ) {
		return;
	}
	$cur = sanitize_key( $_GET['kilic_typ'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
	echo '<select name="kilic_typ"><option value="">Alle Belege</option><option value="angebot" ' . selected( $cur, 'angebot', false ) . '>Angebote</option><option value="rechnung" ' . selected( $cur, 'rechnung', false ) . '>Rechnungen</option></select>';
} );

add_action( 'pre_get_posts', function ( $q ) {
	if ( ! is_admin() || ! $q->is_main_query() || 'kilic_beleg' !== $q->get( 'post_type' ) ) {
		return;
	}
	$typ = sanitize_key( $_GET['kilic_typ'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( in_array( $typ, array( 'angebot', 'rechnung' ), true ) ) {
		$q->set( 'meta_query', array( array( 'key' => '_typ', 'value' => $typ ) ) );
	}
} );

add_filter( 'post_row_actions', function ( $actions, $post ) {
	if ( in_array( $post->post_type, array( 'kilic_beleg', 'kilic_anfrage', 'kilic_kunde' ), true ) ) {
		unset( $actions['inline hide-if-no-js'], $actions['view'] );
	}
	if ( 'kilic_beleg' === $post->post_type && kilic_beleg_gesperrt( $post->ID ) ) {
		unset( $actions['trash'] );
	}
	return $actions;
}, 10, 2 );


/* ---------- Zahlungsverkehr ---------- */

function kilic_zahlarten() {
	return array( 'Überweisung', 'Bar', 'EC-Karte', 'Kreditkarte', 'PayPal', 'Lastschrift', 'Scheck', 'Verrechnung', 'Sonstiges' );
}

function kilic_zahlungen( $id ) {
	$z = get_post_meta( $id, '_zahlungen', true );
	return is_array( $z ) ? $z : array();
}

function kilic_beleg_bezahlt( $id ) {
	return array_sum( array_map( 'intval', wp_list_pluck( kilic_zahlungen( $id ), 'betrag' ) ) );
}

function kilic_beleg_rest( $id ) {
	$sum = kilic_beleg_summen( $id );
	$bez = kilic_beleg_bezahlt( $id );
	// Skonto gezogen: Zahlung abzüglich Skonto gilt als vollständig.
	if ( $sum['skonto'] && $bez > 0 && $bez >= $sum['zahlbetrag'] - $sum['skonto'] ) {
		return 0;
	}
	return max( 0, $sum['zahlbetrag'] - $bez );
}

/** Zahlung hinzufügen (Cent). */
function kilic_zahlung_hinzufuegen( $id, $betrag, $datum = '', $art = 'Überweisung', $notiz = '' ) {
	$z   = kilic_zahlungen( $id );
	$z[] = array(
		'datum'  => $datum ? $datum : current_time( 'Y-m-d' ),
		'betrag' => (int) $betrag,
		'art'    => $art,
		'notiz'  => $notiz,
	);
	update_post_meta( $id, '_zahlungen', $z );
	kilic_log_beleg( $id, 'Zahlungseingang ' . kilic_eur( $betrag ) . ' (' . $art . ')', 'zahlung' );
	kilic_zahlstatus_abgleichen( $id );
}

/** Status aus den Zahlungen ableiten: alles da → bezahlt. */
function kilic_zahlstatus_abgleichen( $id ) {
	$status = get_post_meta( $id, '_status', true );
	if ( ! in_array( $status, array( 'offen', 'bezahlt' ), true ) ) {
		return;
	}
	$z = kilic_zahlungen( $id );
	if ( 'bezahlt' === $status && ! $z ) {
		// Manuell auf „bezahlt“ gesetzt: vollständige Zahlung vermerken.
		$datum = get_post_meta( $id, '_bezahlt_am', true );
		update_post_meta( $id, '_zahlungen', array( array( 'datum' => $datum ? $datum : current_time( 'Y-m-d' ), 'betrag' => kilic_beleg_summen( $id )['zahlbetrag'], 'art' => 'Überweisung', 'notiz' => '' ) ) );
		$z = kilic_zahlungen( $id );
	}
	if ( $z && kilic_beleg_rest( $id ) <= 0 ) {
		update_post_meta( $id, '_status', 'bezahlt' );
		$daten = wp_list_pluck( $z, 'datum' );
		sort( $daten );
		update_post_meta( $id, '_bezahlt_am', end( $daten ) );
	} elseif ( 'bezahlt' === $status && kilic_beleg_rest( $id ) > 0 ) {
		update_post_meta( $id, '_status', 'offen' );
		update_post_meta( $id, '_bezahlt_am', '' );
	}
}

function kilic_zahlungen_speichern( $id ) {
	$z = kilic_zahlungen( $id );
	$loeschen = isset( $_POST['kilic_zahlung_loeschen'] ) ? array_map( 'absint', (array) $_POST['kilic_zahlung_loeschen'] ) : array(); // phpcs:ignore WordPress.Security.NonceVerification
	foreach ( $loeschen as $i ) {
		if ( isset( $z[ $i ] ) ) {
			kilic_log_beleg( $id, 'Zahlung vom ' . kilic_date( $z[ $i ]['datum'] ) . ' über ' . kilic_eur( $z[ $i ]['betrag'] ) . ' gelöscht', 'zahlung' );
		}
		unset( $z[ $i ] );
	}
	$z = array_values( $z );
	$neu = isset( $_POST['kilic_zahlung'] ) ? (array) wp_unslash( $_POST['kilic_zahlung'] ) : array(); // phpcs:ignore WordPress.Security.NonceVerification
	$betrag = kilic_to_cents( $neu['betrag'] ?? '' );
	if ( $betrag > 0 ) {
		$art = sanitize_text_field( $neu['art'] ?? 'Überweisung' );
		$z[] = array(
			'datum'  => sanitize_text_field( $neu['datum'] ?? current_time( 'Y-m-d' ) ),
			'betrag' => $betrag,
			'art'    => in_array( $art, kilic_zahlarten(), true ) ? $art : 'Überweisung',
			'notiz'  => sanitize_text_field( $neu['notiz'] ?? '' ),
		);
		kilic_log_beleg( $id, 'Zahlungseingang ' . kilic_eur( $betrag ) . ' (' . end( $z )['art'] . ')', 'zahlung' );
	}
	update_post_meta( $id, '_zahlungen', $z );
}

function kilic_beleg_zahlungen_box( $post ) {
	$id  = $post->ID;
	$z   = kilic_zahlungen( $id );
	$sum = kilic_beleg_summen( $id );
	$rest = kilic_beleg_rest( $id );
	echo '<p><strong>' . ( $sum['abzuege'] ? 'Zu zahlen (nach Abschlägen)' : 'Rechnungsbetrag' ) . ':</strong> ' . esc_html( kilic_eur( $sum['zahlbetrag'] ) ) . ' &nbsp;·&nbsp; <strong>bezahlt:</strong> ' . esc_html( kilic_eur( kilic_beleg_bezahlt( $id ) ) ) . ' &nbsp;·&nbsp; <strong>offen:</strong> <span class="' . ( $rest ? 'kilic-ueberfaellig' : '' ) . '">' . esc_html( kilic_eur( $rest ) ) . '</span></p>';
	if ( $z ) {
		echo '<table class="widefat striped"><thead><tr><th>Datum</th><th>Art</th><th>Notiz</th><th style="text-align:right">Betrag</th><th>Löschen</th></tr></thead><tbody>';
		foreach ( $z as $i => $row ) {
			printf(
				'<tr><td>%s</td><td>%s</td><td>%s</td><td style="text-align:right">%s</td><td><input type="checkbox" name="kilic_zahlung_loeschen[]" value="%d" aria-label="Zahlung löschen"></td></tr>',
				esc_html( kilic_date( $row['datum'] ) ),
				esc_html( $row['art'] ),
				esc_html( $row['notiz'] ),
				esc_html( kilic_eur( $row['betrag'] ) ),
				(int) $i
			);
		}
		echo '</tbody></table>';
	}
	if ( 'entwurf' === get_post_meta( $id, '_status', true ) ) {
		echo '<p class="description">Wird eine Zahlung erfasst (z. B. bar vor Ort), wird die Rechnung beim Speichern automatisch abgeschlossen und nummeriert.</p>';
	}
	if ( $rest > 0 ) {
		$vor = get_post_meta( $id, '_zahlungsart', true );
		$vor = ( ! $vor || 0 === strpos( $vor, 'Auf Rechnung' ) || 'Vorkasse' === $vor ) ? 'Überweisung' : $vor;
		echo '<h4>Zahlungseingang erfassen</h4><p class="kilic-zahlung-neu">';
		echo '<input type="date" name="kilic_zahlung[datum]" value="' . esc_attr( current_time( 'Y-m-d' ) ) . '" aria-label="Datum"> ';
		echo '<input type="text" name="kilic_zahlung[betrag]" placeholder="' . esc_attr( number_format( $rest / 100, 2, ',', '' ) ) . '" style="width:110px" aria-label="Betrag"> € ';
		echo '<select name="kilic_zahlung[art]" aria-label="Zahlungsart">';
		foreach ( kilic_zahlarten() as $a ) {
			echo '<option ' . selected( $vor, $a, false ) . '>' . esc_html( $a ) . '</option>';
		}
		echo '</select> <input type="text" name="kilic_zahlung[notiz]" placeholder="Notiz (optional)" aria-label="Notiz"> ';
		echo '<button type="button" class="button kilic-rest-uebernehmen" data-rest="' . esc_attr( number_format( $rest / 100, 2, ',', '' ) ) . '">Restbetrag einsetzen</button>';
		if ( $sum['skonto'] && kilic_beleg_bezahlt( $id ) === 0 ) {
			echo ' <button type="button" class="button kilic-rest-uebernehmen" data-rest="' . esc_attr( number_format( ( $sum['zahlbetrag'] - $sum['skonto'] ) / 100, 2, ',', '' ) ) . '">mit Skonto (' . esc_html( kilic_eur( $sum['zahlbetrag'] - $sum['skonto'] ) ) . ')</button>';
		}
		echo '</p><p class="description">Dann oben rechts „Speichern“. Ist alles bezahlt, steht die Rechnung automatisch auf „Bezahlt“.</p>';
	}
	if ( 'offen' === get_post_meta( $id, '_status', true ) ) {
		echo '<p><a class="button" target="_blank" href="' . esc_url( kilic_druck_url( $id, 'mahnung' ) ) . '">Zahlungserinnerung drucken</a></p>';
	}
}


/* ---------- Abschlagsrechnung ---------- */

add_action( 'admin_menu', function () {
	add_submenu_page( '', 'Abschlagsrechnung', 'Abschlagsrechnung', 'kilic_buero', 'kilic-abschlag', 'kilic_render_abschlag' );
}, 30 );

function kilic_render_abschlag() {
	$id = absint( $_GET['id'] ?? 0 ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( 'angebot' !== kilic_beleg_typ( $id ) || ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Auftrag nicht gefunden.' );
	}
	$sum = kilic_beleg_summen( $id );
	$abs = kilic_abschlaege( $id );
	$schon = 0;
	foreach ( $abs as $a ) {
		$schon += kilic_beleg_summen( $a )['netto'];
	}
	?>
	<div class="wrap kilic-admin">
		<h1>Abschlagsrechnung erstellen</h1>
		<p>Auftrag: <strong><?php echo esc_html( kilic_beleg_label( $id ) . ' · ' . kilic_kunde_name( $id ) ); ?></strong> · Auftragssumme netto <strong><?php echo esc_html( kilic_eur( $sum['netto'] ) ); ?></strong><?php if ( $abs ) : ?> · bereits abgerechnet: <?php echo count( $abs ); ?> Abschlag/Abschläge über <?php echo esc_html( kilic_eur( $schon ) ); ?> netto<?php endif; ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="postbox" style="padding:20px;max-width:640px">
			<input type="hidden" name="action" value="kilic_abschlag">
			<input type="hidden" name="id" value="<?php echo (int) $id; ?>">
			<?php wp_nonce_field( 'kilic_abschlag_' . $id ); ?>
			<table class="form-table kilic-form"><tbody>
				<tr><th><label for="ab_art">Höhe</label></th><td>
					<select id="ab_art" name="art"><option value="prozent">Prozent der Auftragssumme</option><option value="betrag">Fester Betrag (netto)</option></select>
					<input type="text" name="wert" value="30" style="width:110px" required>
				</td></tr>
				<tr><th><label for="ab_text">Text</label></th><td><input type="text" id="ab_text" name="text" class="large-text" value="<?php echo esc_attr( ( count( $abs ) + 1 ) . '. Abschlagszahlung gemäß Auftrag ' . get_post_meta( $id, '_nummer', true ) ); ?>"></td></tr>
			</tbody></table>
			<p><button type="submit" class="button button-primary button-hero">Abschlagsrechnung erstellen</button></p>
			<p class="description">Die Schlussrechnung („Rechnung erstellen“ beim Auftrag) zieht alle Abschlagsrechnungen automatisch ab.</p>
		</form>
	</div>
	<?php
}

add_action( 'admin_post_kilic_abschlag', function () {
	$id = absint( $_POST['id'] ?? 0 );
	check_admin_referer( 'kilic_abschlag_' . $id );
	if ( ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$sum  = kilic_beleg_summen( $id );
	$wert = kilic_to_float( wp_unslash( $_POST['wert'] ?? 0 ) );
	$art  = 'betrag' === ( $_POST['art'] ?? '' ) ? 'betrag' : 'prozent';
	$netto = 'betrag' === $art ? (int) round( $wert * 100 ) : (int) round( $sum['netto'] * min( 100, $wert ) / 100 );
	$text  = sanitize_text_field( wp_unslash( $_POST['text'] ?? 'Abschlagszahlung' ) );
	if ( 'prozent' === $art ) {
		$text .= ' (' . kilic_num( $wert, 2 ) . ' % von ' . kilic_eur( $sum['netto'] ) . ' netto)';
	}
	$new = kilic_beleg_kopie( $id, 'rechnung' );
	update_post_meta( $new, '_bezug', $id );
	update_post_meta( $new, '_rechnungsart', 'abschlag' );
	update_post_meta( $new, '_positionen', array( array( 'text' => $text, 'menge' => 1, 'einheit' => 'pauschal', 'preis' => $netto, 'rabatt' => 0 ) ) );
	update_post_meta( $new, '_rabatt_art', '' );
	update_post_meta( $new, '_lohn', 0 );
	kilic_beleg_titel_setzen( $new );
	kilic_log_beleg( $new, 'Abschlagsrechnung über ' . kilic_eur( $netto ) . ' netto erstellt', 'rechnung' );
	wp_safe_redirect( get_edit_post_link( $new, 'url' ) );
	exit;
} );
