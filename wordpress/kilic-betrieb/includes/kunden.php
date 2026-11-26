<?php
/**
 * Kunden: Stammdaten, Liste, Belege je Kunde.
 */

defined( 'ABSPATH' ) || exit;

function kilic_kunde_fields() {
	return array(
		'firma'    => 'Firma',
		'str'      => 'Straße',
		'hausnr'   => 'Hausnummer',
		'plz'      => 'PLZ',
		'ort'      => 'Ort',
		'land'     => 'Land',
		'email'    => 'E-Mail',
		'telefon'  => 'Telefon',
		'mobil'    => 'Mobil',
		'ust_id'   => 'USt-IdNr.',
		'steuernr' => 'Steuernummer',
	);
}

/** Pflichtangaben, die beim Kunden noch fehlen (Labels). Telefon: Telefon oder Mobil genügt. */
function kilic_kunde_fehlende( $id ) {
	$a = kilic_kunde_adressteile( $id );
	$f = array();
	$pruef = array( 'str' => 'Straße', 'hausnr' => 'Hausnummer', 'plz' => 'PLZ', 'ort' => 'Ort' );
	foreach ( $pruef as $k => $label ) {
		if ( '' === trim( (string) $a[ $k ] ) ) {
			$f[] = $label;
		}
	}
	if ( '' === trim( (string) get_post_meta( $id, '_email', true ) ) ) {
		$f[] = 'E-Mail';
	}
	if ( '' === trim( get_post_meta( $id, '_telefon', true ) . get_post_meta( $id, '_mobil', true ) ) ) {
		$f[] = 'Telefon';
	}
	return $f;
}

/** „Am Wiesental 5a“ → array( 'Am Wiesental', '5a' ). */
function kilic_strasse_teilen( $s ) {
	$s = trim( (string) $s );
	if ( preg_match( '/^(.*?)[\s,]+(\d+\s*[a-zA-Z]?(?:\s*[-\/]\s*\d+\s*[a-zA-Z]?)?)$/u', $s, $m ) ) {
		return array( trim( $m[1], " ,\t" ), str_replace( ' ', '', $m[2] ) );
	}
	return array( $s, '' );
}

/** „74838, Limbach“ → array( '74838', 'Limbach' ). */
function kilic_plz_ort_teilen( $s ) {
	$s = trim( (string) $s );
	if ( preg_match( '/^(\d{4,5})[\s,]*(.*)$/u', $s, $m ) ) {
		return array( $m[1], trim( $m[2], " ,\t" ) );
	}
	return array( '', $s );
}

/** Adressfelder eines Kunden – ältere Kunden (Straße/PLZ in einem Feld) werden aufgeteilt. */
function kilic_kunde_adressteile( $id ) {
	$str = get_post_meta( $id, '_str', true );
	$hnr = get_post_meta( $id, '_hausnr', true );
	$plz = get_post_meta( $id, '_plz', true );
	$ort = get_post_meta( $id, '_ort', true );
	if ( '' === $str . $hnr ) {
		list( $str, $hnr ) = kilic_strasse_teilen( get_post_meta( $id, '_strasse', true ) );
	}
	if ( '' === $plz . $ort ) {
		list( $plz, $ort ) = kilic_plz_ort_teilen( get_post_meta( $id, '_plz_ort', true ) );
	}
	return array( 'str' => $str, 'hausnr' => $hnr, 'plz' => $plz, 'ort' => $ort );
}

add_action( 'add_meta_boxes_kilic_kunde', function () {
	add_meta_box( 'kilic_kunde_daten', 'Kundendaten', 'kilic_kunde_box', 'kilic_kunde', 'normal', 'high' );
	add_meta_box( 'kilic_kunde_belege', 'Angebote & Rechnungen', 'kilic_kunde_belege_box', 'kilic_kunde', 'normal', 'default' );
} );

function kilic_kunde_box( $post ) {
	wp_nonce_field( 'kilic_kunde_save', 'kilic_kunde_nonce' );
	$id  = $post->ID;
	$m   = function ( $k ) use ( $id ) {
		return (string) get_post_meta( $id, '_' . $k, true );
	};
	$nr  = $m( 'kundennr' );
	$adr = kilic_kunde_adressteile( $id );
	$vorname  = $m( 'vorname' );
	$nachname = $m( 'nachname' );
	if ( ! $vorname && ! $nachname && 'auto-draft' !== $post->post_status && $post->post_title !== $m( 'firma' ) ) {
		$nachname = $post->post_title;
	}
	$anrede = $m( 'anrede' );
	$ist_firma = 'Firma' === $anrede || '' !== $m( 'firma' ) || '' !== $m( 'ust_id' ) || '' !== $m( 'steuernr' );
	$feld = function ( $key, $wert, $attr = '' ) {
		return sprintf( '<input type="text" id="kk_%1$s" name="kilic_kunde[%1$s]" value="%2$s" %3$s>', esc_attr( $key ), esc_attr( $wert ), $attr );
	};
	$abschnitt = function ( $titel, $klasse = '' ) {
		echo '<tr class="kk-abschnitt ' . esc_attr( $klasse ) . '"><th colspan="2">' . esc_html( $titel ) . '</th></tr>';
	};

	if ( 'auto-draft' !== $post->post_status ) {
		$fehlt = kilic_kunde_fehlende( $id );
		if ( $fehlt ) {
			echo '<div class="kk-fehlt" role="alert"><strong>Bitte noch ergänzen:</strong> ' . esc_html( implode( ', ', $fehlt ) ) . '</div>';
		}
	}
	echo '<p class="kk-legende"><span class="kk-pflicht">*</span> = Pflichtfeld</p>';
	echo '<table class="form-table kilic-form kk-form"><tbody>';
	if ( $nr ) {
		echo '<tr><th>Kundennummer</th><td><strong>' . esc_html( $nr ) . '</strong></td></tr>';
	}

	$abschnitt( 'Person' );
	echo '<tr><th><label for="kk_anrede">Anrede</label></th><td><select id="kk_anrede" name="kilic_kunde[anrede]">';
	foreach ( array( '', 'Herr', 'Frau', 'Familie', 'Firma' ) as $a ) {
		echo '<option value="' . esc_attr( $a ) . '" ' . selected( $anrede, $a, false ) . '>' . esc_html( $a ? $a : '– bitte wählen –' ) . '</option>';
	}
	echo '</select></td></tr>';
	echo '<tr><th><label for="kk_vorname">Vorname</label></th><td>' . $feld( 'vorname', $vorname, 'autocomplete="given-name"' ) . '</td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
	echo '<tr><th><label for="kk_nachname">Nachname <span class="kk-pflicht">*</span></label></th><td>' . $feld( 'nachname', $nachname, 'autocomplete="family-name"' ) . '<p class="description kk-nur-firma"' . ( $ist_firma ? '' : ' hidden' ) . '>Bei Firmen = Ansprechpartner, kann leer bleiben.</p></td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput

	$abschnitt( 'Firma', 'kk-firma' . ( $ist_firma ? '' : ' is-hidden' ) );
	echo '<tr class="kk-firma' . ( $ist_firma ? '' : ' is-hidden' ) . '"><th><label for="kk_firma">Firmenname</label></th><td>' . $feld( 'firma', $m( 'firma' ), 'autocomplete="organization"' ) . '</td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
	echo '<tr class="kk-firma' . ( $ist_firma ? '' : ' is-hidden' ) . '"><th><label for="kk_ust_id">USt-IdNr. <span class="kk-opt">optional</span></label></th><td>' . $feld( 'ust_id', $m( 'ust_id' ), 'placeholder="z. B. DE123456789"' ) . '</td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
	echo '<tr class="kk-firma' . ( $ist_firma ? '' : ' is-hidden' ) . '"><th><label for="kk_steuernr">Steuernummer <span class="kk-opt">optional</span></label></th><td>' . $feld( 'steuernr', $m( 'steuernr' ), 'placeholder="z. B. 12345/67890"' ) . '<p class="description">Eines von beiden genügt. Steht dann auf Angebot und Rechnung.</p></td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
	echo '<tr class="kk-firma-link' . ( $ist_firma ? ' is-hidden' : '' ) . '"><th></th><td><button type="button" class="button-link kk-firma-zeigen">+ Firmenangaben (Firma, USt-IdNr., Steuernummer)</button></td></tr>';

	$abschnitt( 'Adresse' );
	echo '<tr><th><label for="kk_str">Straße / Hausnummer <span class="kk-pflicht">*</span></label></th><td><div class="kk-duo">' . $feld( 'str', $adr['str'], 'class="kk-gross" placeholder="Straße" autocomplete="address-line1" required' ) . $feld( 'hausnr', $adr['hausnr'], 'class="kk-klein" placeholder="Nr." aria-label="Hausnummer" required' ) . '</div></td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
	echo '<tr><th><label for="kk_plz">PLZ / Ort <span class="kk-pflicht">*</span></label></th><td><div class="kk-duo">' . $feld( 'plz', $adr['plz'], 'class="kk-klein" placeholder="PLZ" inputmode="numeric" autocomplete="postal-code" required' ) . $feld( 'ort', $adr['ort'], 'class="kk-gross" placeholder="Ort" aria-label="Ort" autocomplete="address-level2" required' ) . '</div></td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
	echo '<tr><th><label for="kk_land">Land</label></th><td>' . $feld( 'land', $m( 'land' ), 'placeholder="Deutschland" autocomplete="country-name"' ) . '<p class="description">Nur ausfüllen, wenn nicht Deutschland.</p></td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput

	$abschnitt( 'Kontakt' );
	echo '<tr><th><label for="kk_email">E-Mail <span class="kk-pflicht">*</span></label></th><td><input type="email" id="kk_email" name="kilic_kunde[email]" value="' . esc_attr( $m( 'email' ) ) . '" autocomplete="email" required><p class="description">Hierhin werden Angebote und Rechnungen geschickt.</p></td></tr>';
	echo '<tr><th><label for="kk_telefon">Telefon <span class="kk-pflicht">*</span></label></th><td><input type="tel" id="kk_telefon" name="kilic_kunde[telefon]" value="' . esc_attr( $m( 'telefon' ) ) . '" autocomplete="tel"><p class="description">Festnetz oder Mobil – eine Nummer genügt.</p></td></tr>';
	echo '<tr><th><label for="kk_mobil">Mobil</label></th><td><input type="tel" id="kk_mobil" name="kilic_kunde[mobil]" value="' . esc_attr( $m( 'mobil' ) ) . '"></td></tr>';

	$abschnitt( 'Sonstiges' );
	echo '<tr><th>Kundenart</th><td><label><input type="checkbox" name="kilic_kunde[privat]" value="1" ' . checked( '1', $m( 'privat' ), false ) . '> Privatkunde</label><p class="description">Bei Privatkunden stehen auf der Rechnung der Hinweis zur Aufbewahrungspflicht (§ 14 UStG) und der Lohnanteil für § 35a EStG.</p></td></tr>';
	echo '<tr><th><label for="kk_notizen">Notizen</label></th><td><textarea id="kk_notizen" name="kilic_kunde[notizen]" rows="4" class="large-text">' . esc_textarea( $m( 'notizen' ) ) . '</textarea></td></tr>';
	echo '</tbody></table>';
}

function kilic_kunde_belege_box( $post ) {
	$belege = get_posts( array(
		'post_type'   => 'kilic_beleg',
		'numberposts' => 50,
		'meta_key'    => '_kunde',
		'meta_value'  => $post->ID,
	) );
	if ( $post->post_status !== 'auto-draft' ) {
		$url = add_query_arg( array( 'post_type' => 'kilic_beleg', 'kilic_kunde' => $post->ID, 'kilic_typ' => 'angebot' ), admin_url( 'post-new.php' ) );
		$url2 = add_query_arg( array( 'post_type' => 'kilic_beleg', 'kilic_kunde' => $post->ID, 'kilic_typ' => 'rechnung' ), admin_url( 'post-new.php' ) );
		echo '<p><a class="button" href="' . esc_url( $url ) . '">Neues Angebot</a> <a class="button" href="' . esc_url( $url2 ) . '">Neue Rechnung</a></p>';
	}
	if ( ! $belege ) {
		echo '<p>Noch keine Belege für diesen Kunden.</p>';
		return;
	}
	echo '<table class="widefat striped"><thead><tr><th>Beleg</th><th>Datum</th><th>Status</th><th style="text-align:right">Brutto</th></tr></thead><tbody>';
	foreach ( $belege as $b ) {
		$s = kilic_beleg_summen( $b->ID );
		printf(
			'<tr><td><a href="%s">%s</a></td><td>%s</td><td>%s</td><td style="text-align:right">%s</td></tr>',
			esc_url( get_edit_post_link( $b->ID ) ),
			esc_html( kilic_beleg_label( $b->ID ) ),
			esc_html( kilic_date( get_post_meta( $b->ID, '_datum', true ) ) ),
			kilic_status_badge( get_post_meta( $b->ID, '_status', true ) ),
			esc_html( kilic_eur( $s['brutto'] ) )
		);
	}
	echo '</tbody></table>';
}

add_action( 'save_post_kilic_kunde', function ( $post_id ) {
	if ( ! isset( $_POST['kilic_kunde_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['kilic_kunde_nonce'] ), 'kilic_kunde_save' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$data = isset( $_POST['kilic_kunde'] ) ? (array) wp_unslash( $_POST['kilic_kunde'] ) : array();
	kilic_kunde_save_data( $post_id, $data );
	kilic_kunde_name_sichern( $post_id );
} );

/** Kunde ohne Namen: Firma, E-Mail oder Kundennummer als Namen verwenden. */
function kilic_kunde_name_sichern( $post_id ) {
	if ( '' !== trim( get_post_field( 'post_title', $post_id ) ) ) {
		return;
	}
	$name = get_post_meta( $post_id, '_firma', true );
	$name = $name ? $name : get_post_meta( $post_id, '_email', true );
	$name = $name ? $name : 'Kunde ' . get_post_meta( $post_id, '_kundennr', true );
	remove_all_actions( 'save_post_kilic_kunde' );
	wp_update_post( array( 'ID' => $post_id, 'post_title' => $name ) );
}

/** Anzeigename für Auswahllisten: „K-0001 · Max Muster · Firma · 74821 Mosbach“. */
function kilic_kunde_label( $kunde_id ) {
	$teile = array_filter( array(
		get_post_meta( $kunde_id, '_kundennr', true ),
		trim( get_the_title( $kunde_id ) ),
		get_post_meta( $kunde_id, '_firma', true ),
		get_post_meta( $kunde_id, '_plz_ort', true ),
	) );
	return $teile ? implode( ' · ', array_unique( $teile ) ) : 'Kunde #' . $kunde_id;
}

function kilic_kunde_save_data( $post_id, $data ) {
	// Ältere Formulare liefern „strasse“ bzw. „plz_ort“ in einem Feld → aufteilen.
	if ( ! isset( $data['str'] ) && isset( $data['strasse'] ) ) {
		list( $data['str'], $data['hausnr'] ) = kilic_strasse_teilen( $data['strasse'] );
	}
	if ( ! isset( $data['plz'] ) && isset( $data['plz_ort'] ) ) {
		list( $data['plz'], $data['ort'] ) = kilic_plz_ort_teilen( $data['plz_ort'] );
	}
	foreach ( array_keys( kilic_kunde_fields() ) as $key ) {
		if ( ! array_key_exists( $key, $data ) && in_array( $key, array( 'land', 'mobil', 'ust_id', 'steuernr' ), true ) ) {
			continue; // Formulare ohne diese Felder überschreiben sie nicht.
		}
		$v = $data[ $key ] ?? '';
		$v = 'email' === $key ? sanitize_email( $v ) : sanitize_text_field( $v );
		if ( 'ust_id' === $key ) {
			$v = strtoupper( str_replace( ' ', '', $v ) );
		}
		update_post_meta( $post_id, '_' . $key, $v );
	}
	// Zusammengesetzte Felder für Anschrift, Listen und Suche.
	$ort  = trim( get_post_meta( $post_id, '_plz', true ) . ' ' . get_post_meta( $post_id, '_ort', true ) );
	update_post_meta( $post_id, '_strasse', trim( get_post_meta( $post_id, '_str', true ) . ' ' . get_post_meta( $post_id, '_hausnr', true ) ) );
	update_post_meta( $post_id, '_plz_ort', $ort );
	foreach ( array( 'anrede', 'vorname', 'nachname' ) as $k ) {
		if ( isset( $data[ $k ] ) ) {
			update_post_meta( $post_id, '_' . $k, sanitize_text_field( $data[ $k ] ) );
		}
	}
	update_post_meta( $post_id, '_privat', empty( $data['privat'] ) ? '0' : '1' );
	if ( isset( $data['notizen'] ) ) {
		update_post_meta( $post_id, '_notizen', sanitize_textarea_field( $data['notizen'] ) );
	}
	if ( ! get_post_meta( $post_id, '_kundennr', true ) ) {
		$next = (int) get_option( 'kilic_kunde_next', 1 );
		update_post_meta( $post_id, '_kundennr', sprintf( 'K-%04d', $next ) );
		update_option( 'kilic_kunde_next', $next + 1 );
	}
}

/** Kunde per E-Mail finden oder neu anlegen. */
function kilic_kunde_finden_oder_anlegen( $name, $data ) {
	if ( ! empty( $data['email'] ) ) {
		$found = get_posts( array(
			'post_type'   => 'kilic_kunde',
			'numberposts' => 1,
			'meta_key'    => '_email',
			'meta_value'  => sanitize_email( $data['email'] ),
			'fields'      => 'ids',
		) );
		if ( $found ) {
			return (int) $found[0];
		}
	}
	$id = wp_insert_post( array(
		'post_type'   => 'kilic_kunde',
		'post_status' => 'publish',
		'post_title'  => $name ? $name : 'Neuer Kunde',
	) );
	if ( $id && ! is_wp_error( $id ) ) {
		if ( $name && empty( $data['nachname'] ) ) {
			$teile = preg_split( '/\s+/', trim( $name ) );
			$data['nachname'] = array_pop( $teile );
			$data['vorname']  = implode( ' ', $teile );
		}
		kilic_kunde_save_data( $id, $data );
		return (int) $id;
	}
	return 0;
}

/** Anschriftsblock eines Kunden. */
function kilic_kunde_adresse( $kunde_id ) {
	if ( ! $kunde_id ) {
		return array();
	}
	$anrede = get_post_meta( $kunde_id, '_anrede', true );
	$name   = get_the_title( $kunde_id );
	if ( $anrede && 'Firma' !== $anrede && $name !== get_post_meta( $kunde_id, '_firma', true ) ) {
		$name = $anrede . ' ' . $name;
	}
	$lines = array(
		get_post_meta( $kunde_id, '_firma', true ),
		$name,
		get_post_meta( $kunde_id, '_strasse', true ),
		get_post_meta( $kunde_id, '_plz_ort', true ),
	);
	$land = trim( (string) get_post_meta( $kunde_id, '_land', true ) );
	if ( $land && ! preg_match( '/^(deutschland|germany|de|d)$/i', $land ) ) {
		$lines[] = strtoupper( $land );
	}
	// Leere Zeilen und doppelte Angaben (z. B. Name = Firma) weglassen.
	$lines = array_values( array_unique( array_filter( array_map( 'trim', $lines ) ) ) );
	return $lines;
}

add_filter( 'manage_kilic_kunde_posts_columns', function ( $cols ) {
	return array(
		'cb'       => $cols['cb'],
		'title'    => 'Name',
		'kundennr' => 'Kd.-Nr.',
		'kontakt'  => 'Kontakt',
		'ort'      => 'Ort',
		'umsatz'   => 'Rechnungen (brutto)',
	);
} );

add_action( 'manage_kilic_kunde_posts_custom_column', function ( $col, $id ) {
	switch ( $col ) {
		case 'kundennr':
			echo esc_html( get_post_meta( $id, '_kundennr', true ) );
			break;
		case 'kontakt':
			echo esc_html( get_post_meta( $id, '_telefon', true ) ?: get_post_meta( $id, '_mobil', true ) ) . '<br>' . esc_html( get_post_meta( $id, '_email', true ) );
			$fehlt = kilic_kunde_fehlende( $id );
			if ( $fehlt ) {
				echo '<br><span class="kk-fehlt-badge" title="' . esc_attr( 'Fehlt: ' . implode( ', ', $fehlt ) ) . '">Angaben fehlen: ' . esc_html( implode( ', ', $fehlt ) ) . '</span>';
			}
			break;
		case 'ort':
			echo esc_html( get_post_meta( $id, '_plz_ort', true ) );
			break;
		case 'umsatz':
			$sum = 0;
			$ids = get_posts( array(
				'post_type'   => 'kilic_beleg',
				'numberposts' => -1,
				'fields'      => 'ids',
				'meta_query'  => array(
					array( 'key' => '_kunde', 'value' => $id ),
					array( 'key' => '_typ', 'value' => 'rechnung' ),
					array( 'key' => '_status', 'value' => array( 'offen', 'bezahlt' ), 'compare' => 'IN' ),
				),
			) );
			foreach ( $ids as $bid ) {
				$sum += kilic_beleg_summen( $bid )['brutto'];
			}
			echo esc_html( kilic_eur( $sum ) );
			break;
	}
}, 10, 2 );

/** Kunden ohne Namen nie als „(kein Titel)“ anzeigen. */
add_filter( 'the_title', function ( $title, $id = 0 ) {
	if ( '' === trim( (string) $title ) && $id && 'kilic_kunde' === get_post_type( $id ) ) {
		$f = get_post_meta( $id, '_firma', true );
		$e = get_post_meta( $id, '_email', true );
		return $f ? $f : ( $e ? $e : 'Kunde ' . get_post_meta( $id, '_kundennr', true ) );
	}
	return $title;
}, 10, 2 );

/** Bestehende Kunden ohne Namen nachträglich benennen (beim Update). */
function kilic_kunden_namen_reparieren() {
	$ids = get_posts( array( 'post_type' => 'kilic_kunde', 'numberposts' => -1, 'fields' => 'ids', 'post_status' => 'any' ) );
	foreach ( $ids as $id ) {
		if ( '' === trim( get_post_field( 'post_title', $id ) ) ) {
			$f = get_post_meta( $id, '_firma', true );
			$e = get_post_meta( $id, '_email', true );
			wp_update_post( array( 'ID' => $id, 'post_title' => $f ? $f : ( $e ? $e : 'Kunde ' . get_post_meta( $id, '_kundennr', true ) ) ) );
			if ( $f && ! get_post_meta( $id, '_anrede', true ) ) {
				update_post_meta( $id, '_anrede', 'Firma' );
			}
		}
	}
}

/** Beim Update: alte Kunden (Straße/PLZ in einem Feld) in Einzelfelder aufteilen. */
function kilic_kunden_adressen_teilen() {
	$ids = get_posts( array( 'post_type' => 'kilic_kunde', 'numberposts' => -1, 'fields' => 'ids', 'post_status' => 'any' ) );
	foreach ( $ids as $id ) {
		if ( '' !== get_post_meta( $id, '_str', true ) . get_post_meta( $id, '_plz', true ) . get_post_meta( $id, '_ort', true ) ) {
			continue;
		}
		$a = kilic_kunde_adressteile( $id );
		foreach ( $a as $k => $v ) {
			update_post_meta( $id, '_' . $k, $v );
		}
		update_post_meta( $id, '_strasse', trim( $a['str'] . ' ' . $a['hausnr'] ) );
		update_post_meta( $id, '_plz_ort', trim( $a['plz'] . ' ' . $a['ort'] ) );
	}
}
