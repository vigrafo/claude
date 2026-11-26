<?php
/**
 * Anfragen aus dem Website-Formular: speichern, benachrichtigen, bearbeiten,
 * in Kunde + Angebot umwandeln.
 */

defined( 'ABSPATH' ) || exit;

/** Feldbeschriftungen in der Reihenfolge der Anzeige. */
function kilic_anfrage_felder() {
	return array(
		'leistung'    => 'Leistung',
		'anliegen'    => 'Anliegen',
		'objekt'      => 'Objekt',
		'bauvorhaben' => 'Bauvorhaben',
		'etage'       => 'Geschoss',
		'zufahrt'     => 'Zufahrt LKW/Pumpe',
		'bewohnt'     => 'Bewohnt',
		'problem'     => 'Problem (Rohr)',
		'flaeche'     => 'Fläche (m²)',
		'estrichart'  => 'Estrichart',
		'fbh'         => 'Fußbodenheizung',
		'staerke'     => 'Estrichdicke (mm)',
		'daemmung'    => 'Dämmung',
		'aufbau'      => 'Aufbauhöhe (mm)',
		'belag'       => 'Späterer Oberbelag',
		'schaden'     => 'Schaden',
		'belagart'    => 'Belagart',
		'material'    => 'Material',
		'termin'      => 'Wunschtermin',
		'datum'       => 'Konkretes Datum',
		'nachricht'   => 'Nachricht',
		'name'        => 'Name',
		'firma'       => 'Firma',
		'email'       => 'E-Mail',
		'tel'         => 'Telefon',
		'strasse'     => 'Straße (Objekt)',
		'plz'         => 'PLZ',
		'ort'         => 'Ort',
		'rueckruf'    => 'Kontaktwunsch',
	);
}

function kilic_anfrage_status_liste() {
	return array(
		'neu'         => 'Neu',
		'bearbeitung' => 'In Bearbeitung',
		'angebot'     => 'Angebot erstellt',
		'erledigt'    => 'Erledigt',
	);
}

add_action( 'admin_post_nopriv_kilic_anfrage', 'kilic_anfrage_empfangen' );
add_action( 'admin_post_kilic_anfrage', 'kilic_anfrage_empfangen' );

function kilic_anfrage_empfangen() {
	$back = wp_get_referer() ? wp_get_referer() : home_url( '/' );
	$back = remove_query_arg( array( 'anfrage', 'grund' ), $back );
	$form = isset( $_POST['kilic_form'] ) && 'kontakt' === $_POST['kilic_form'] ? 'kontakt' : 'anfrage'; // phpcs:ignore WordPress.Security.NonceVerification
	$fail = function ( $grund ) use ( $back, $form ) {
		wp_safe_redirect( add_query_arg( array( 'anfrage' => 'fehler', 'grund' => $grund ), $back ) . '#' . $form );
		exit;
	};

	if ( ! isset( $_POST['kilic_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['kilic_nonce'] ), 'kilic_anfrage' ) ) {
		$fail( 'sitzung' );
	}
	// Spam-Schutz: verstecktes Feld muss leer sein, Formular nicht in unter 3 Sekunden ausgefüllt.
	if ( ! empty( $_POST['website'] ) ) {
		$fail( 'spam' );
	}
	$start = absint( $_POST['kilic_t'] ?? 0 );
	if ( $start && time() - $start < 3 ) {
		$fail( 'spam' );
	}

	$data = array();
	foreach ( array_keys( kilic_anfrage_felder() ) as $key ) {
		if ( ! isset( $_POST[ $key ] ) ) {
			continue;
		}
		$raw = wp_unslash( $_POST[ $key ] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		if ( is_array( $raw ) ) {
			$val = implode( ', ', array_map( 'sanitize_text_field', $raw ) );
		} elseif ( 'nachricht' === $key ) {
			$val = sanitize_textarea_field( $raw );
		} elseif ( 'email' === $key ) {
			$val = sanitize_email( $raw );
		} else {
			$val = sanitize_text_field( $raw );
		}
		if ( '' !== $val ) {
			$data[ $key ] = mb_substr( $val, 0, 'nachricht' === $key ? 5000 : 300 );
		}
	}

	if ( empty( $data['name'] ) || ( empty( $data['email'] ) && empty( $data['tel'] ) ) ) {
		$fail( 'pflicht' );
	}
	if ( empty( $_POST['dsgvo'] ) ) {
		$fail( 'datenschutz' );
	}
	if ( 'kontakt' === $form ) {
		$data['leistung'] = 'Kontakt';
	}

	$titel = array( $data['leistung'] ?? 'Anfrage' );
	if ( ! empty( $data['flaeche'] ) ) {
		$titel[] = $data['flaeche'] . ' m²';
	}
	$titel[] = $data['name'];

	$id = wp_insert_post( array(
		'post_type'   => 'kilic_anfrage',
		'post_status' => 'publish',
		'post_title'  => implode( ' · ', $titel ),
	) );
	if ( ! $id || is_wp_error( $id ) ) {
		$fail( 'speichern' );
	}
	update_post_meta( $id, '_daten', $data );
	update_post_meta( $id, '_status', 'neu' );
	update_post_meta( $id, '_leistung', $data['leistung'] ?? '' );
	update_post_meta( $id, '_quelle', esc_url_raw( $back ) );

	$dateien = kilic_anfrage_uploads( $id );

	kilic_anfrage_mails_html( $id, $data, $dateien );

	wp_safe_redirect( add_query_arg( 'anfrage', 'danke', $back ) . '#' . $form );
	exit;
}

/** Fotos/Pläne speichern (max. 5 Dateien, je 10 MB, JPG/PNG/PDF). */
function kilic_anfrage_uploads( $anfrage_id ) {
	if ( empty( $_FILES['dateien'] ) || ! is_array( $_FILES['dateien']['name'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		return array();
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$files   = $_FILES['dateien']; // phpcs:ignore WordPress.Security.NonceVerification, WordPress.Security.ValidatedSanitizedInput
	$erlaubt = array(
		'jpg|jpeg|jpe' => 'image/jpeg',
		'png'          => 'image/png',
		'pdf'          => 'application/pdf',
	);
	$ids = array();
	$n   = min( 5, count( $files['name'] ) );
	for ( $i = 0; $i < $n; $i++ ) {
		if ( UPLOAD_ERR_OK !== $files['error'][ $i ] || $files['size'][ $i ] > 10 * MB_IN_BYTES ) {
			continue;
		}
		$_FILES['kilic_datei'] = array(
			'name'     => $files['name'][ $i ],
			'type'     => $files['type'][ $i ],
			'tmp_name' => $files['tmp_name'][ $i ],
			'error'    => $files['error'][ $i ],
			'size'     => $files['size'][ $i ],
		);
		$att = media_handle_upload( 'kilic_datei', $anfrage_id, array(), array(
			'test_form' => false,
			'mimes'     => $erlaubt,
		) );
		if ( ! is_wp_error( $att ) ) {
			$ids[] = $att;
		}
	}
	unset( $_FILES['kilic_datei'] );
	update_post_meta( $anfrage_id, '_dateien', $ids );
	return $ids;
}

/* ---------- Backend ---------- */

add_action( 'add_meta_boxes_kilic_anfrage', function () {
	add_meta_box( 'kilic_anfrage_daten', 'Angaben des Kunden', 'kilic_anfrage_box', 'kilic_anfrage', 'normal', 'high' );
	add_meta_box( 'kilic_anfrage_status', 'Bearbeitung', 'kilic_anfrage_status_box', 'kilic_anfrage', 'side', 'high' );
} );

function kilic_anfrage_box( $post ) {
	wp_nonce_field( 'kilic_anfrage_save', 'kilic_anfrage_nonce' );
	$data   = (array) get_post_meta( $post->ID, '_daten', true );
	$felder = kilic_anfrage_felder();
	if ( 'auto-draft' === $post->post_status || ! $data ) {
		// Manuelle Erfassung (z. B. Telefonanruf).
		echo '<p>Anfrage manuell erfassen, z. B. nach einem Anruf:</p><table class="form-table kilic-form"><tbody>';
		foreach ( array( 'leistung', 'objekt', 'flaeche', 'estrichart', 'name', 'email', 'tel', 'strasse', 'plz', 'ort', 'nachricht' ) as $k ) {
			$v = $data[ $k ] ?? '';
			if ( 'nachricht' === $k ) {
				echo '<tr><th>' . esc_html( $felder[ $k ] ) . '</th><td><textarea name="kilic_daten[' . esc_attr( $k ) . ']" rows="4" class="large-text">' . esc_textarea( $v ) . '</textarea></td></tr>';
			} else {
				echo '<tr><th>' . esc_html( $felder[ $k ] ) . '</th><td><input type="text" name="kilic_daten[' . esc_attr( $k ) . ']" value="' . esc_attr( $v ) . '" class="regular-text"></td></tr>';
			}
		}
		echo '</tbody></table>';
		return;
	}
	echo '<table class="widefat striped kilic-daten"><tbody>';
	foreach ( $felder as $k => $label ) {
		if ( empty( $data[ $k ] ) ) {
			continue;
		}
		$v = $data[ $k ];
		if ( 'email' === $k ) {
			$v = '<a href="mailto:' . esc_attr( $v ) . '">' . esc_html( $v ) . '</a>';
		} elseif ( 'tel' === $k ) {
			$v = '<a href="' . esc_attr( kilic_tel_href( $v ) ) . '">' . esc_html( $v ) . '</a>';
		} else {
			$v = nl2br( esc_html( $v ) );
		}
		echo '<tr><th style="width:200px">' . esc_html( $label ) . '</th><td>' . $v . '</td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput
	}
	echo '</tbody></table>';

	$dateien = (array) get_post_meta( $post->ID, '_dateien', true );
	$dateien = array_filter( $dateien );
	if ( $dateien ) {
		echo '<h4>Fotos & Pläne</h4><div class="kilic-dateien">';
		foreach ( $dateien as $att ) {
			$url = wp_get_attachment_url( $att );
			if ( wp_attachment_is_image( $att ) ) {
				echo '<a href="' . esc_url( $url ) . '" target="_blank">' . wp_get_attachment_image( $att, 'thumbnail' ) . '</a>';
			} else {
				echo '<a class="button" href="' . esc_url( $url ) . '" target="_blank">' . esc_html( basename( $url ) ) . '</a>';
			}
		}
		echo '</div>';
	}
	echo '<p class="description">Eingegangen am ' . esc_html( get_the_date( 'd.m.Y H:i', $post ) ) . ' Uhr</p>';
}

function kilic_anfrage_status_box( $post ) {
	$status = get_post_meta( $post->ID, '_status', true );
	$status = $status ? $status : 'neu';
	echo '<p><label for="ka_status"><strong>Status</strong></label><br><select id="ka_status" name="kilic_anfrage_status" style="width:100%">';
	foreach ( kilic_anfrage_status_liste() as $k => $l ) {
		echo '<option value="' . esc_attr( $k ) . '" ' . selected( $status, $k, false ) . '>' . esc_html( $l ) . '</option>';
	}
	echo '</select></p>';
	echo '<p><label for="ka_notiz"><strong>Interne Notiz</strong></label><textarea id="ka_notiz" name="kilic_anfrage_notiz" rows="4" style="width:100%">' . esc_textarea( get_post_meta( $post->ID, '_notiz', true ) ) . '</textarea></p>';
	if ( 'auto-draft' !== $post->post_status ) {
		$url = wp_nonce_url( admin_url( 'admin-post.php?action=kilic_anfrage_angebot&id=' . $post->ID ), 'kilic_anfrage_angebot_' . $post->ID );
		echo '<p><a class="button button-primary" style="width:100%;text-align:center" href="' . esc_url( $url ) . '">Kunde anlegen &amp; Angebot erstellen</a></p>';
		$belege = get_posts( array( 'post_type' => 'kilic_beleg', 'numberposts' => 10, 'meta_key' => '_anfrage', 'meta_value' => $post->ID ) );
		foreach ( $belege as $b ) {
			echo '<p>→ <a href="' . esc_url( get_edit_post_link( $b->ID ) ) . '">' . esc_html( kilic_beleg_label( $b->ID ) ) . '</a></p>';
		}
	}
}

add_action( 'save_post_kilic_anfrage', function ( $post_id ) {
	if ( ! isset( $_POST['kilic_anfrage_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['kilic_anfrage_nonce'] ), 'kilic_anfrage_save' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$status = sanitize_key( $_POST['kilic_anfrage_status'] ?? 'neu' );
	if ( isset( kilic_anfrage_status_liste()[ $status ] ) ) {
		update_post_meta( $post_id, '_status', $status );
	}
	update_post_meta( $post_id, '_notiz', sanitize_textarea_field( wp_unslash( $_POST['kilic_anfrage_notiz'] ?? '' ) ) );

	if ( isset( $_POST['kilic_daten'] ) ) {
		$in   = (array) wp_unslash( $_POST['kilic_daten'] );
		$data = array();
		foreach ( $in as $k => $v ) {
			if ( isset( kilic_anfrage_felder()[ $k ] ) && '' !== trim( $v ) ) {
				$data[ $k ] = 'nachricht' === $k ? sanitize_textarea_field( $v ) : sanitize_text_field( $v );
			}
		}
		update_post_meta( $post_id, '_daten', $data );
		update_post_meta( $post_id, '_leistung', $data['leistung'] ?? '' );
	}
} );

add_filter( 'wp_insert_post_data', function ( $post ) {
	if ( 'kilic_anfrage' === $post['post_type'] && '' === trim( $post['post_title'] ) && ! empty( $_POST['kilic_daten'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		$d = (array) wp_unslash( $_POST['kilic_daten'] ); // phpcs:ignore WordPress.Security.NonceVerification
		$post['post_title'] = sanitize_text_field( trim( ( $d['leistung'] ?? 'Anfrage' ) . ' · ' . ( $d['name'] ?? '' ), ' ·' ) );
	}
	return $post;
} );

/** Aus der Anfrage einen Kunden und einen Angebotsentwurf erzeugen. */
add_action( 'admin_post_kilic_anfrage_angebot', function () {
	$id = absint( $_GET['id'] ?? 0 );
	check_admin_referer( 'kilic_anfrage_angebot_' . $id );
	if ( ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$d     = (array) get_post_meta( $id, '_daten', true );
	$kunde = kilic_kunde_finden_oder_anlegen( $d['name'] ?? '', array(
		'firma'   => $d['firma'] ?? '',
		'strasse' => $d['strasse'] ?? '',
		'plz_ort' => trim( ( $d['plz'] ?? '' ) . ' ' . ( $d['ort'] ?? '' ) ),
		'email'   => $d['email'] ?? '',
		'telefon' => $d['tel'] ?? '',
		'privat'  => empty( $d['firma'] ) ? '1' : '0',
	) );

	$pos  = array();
	$text = trim( ( $d['estrichart'] ?? ( $d['leistung'] ?? 'Leistung' ) ) . ( ! empty( $d['staerke'] ) ? ', Dicke ca. ' . $d['staerke'] . ' mm' : '' ) . ( ! empty( $d['fbh'] ) && 0 === strpos( $d['fbh'], 'Ja' ) ? ', als Heizestrich' : '' ) );
	$pos[] = array(
		'text'    => $text,
		'menge'   => ! empty( $d['flaeche'] ) ? kilic_to_float( $d['flaeche'] ) : 1,
		'einheit' => ! empty( $d['flaeche'] ) ? 'm²' : 'pauschal',
		'preis'   => 0,
	);
	if ( ! empty( $d['daemmung'] ) && 0 === strpos( $d['daemmung'], 'Ja' ) ) {
		$pos[] = array( 'text' => 'Wärme- und Trittschalldämmung liefern und verlegen', 'menge' => $pos[0]['menge'], 'einheit' => 'm²', 'preis' => 0 );
	}

	$b = wp_insert_post( array( 'post_type' => 'kilic_beleg', 'post_status' => 'publish', 'post_title' => 'Entwurf' ) );
	update_post_meta( $b, '_typ', 'angebot' );
	update_post_meta( $b, '_status', 'entwurf' );
	update_post_meta( $b, '_kunde', $kunde );
	update_post_meta( $b, '_anfrage', $id );
	update_post_meta( $b, '_datum', current_time( 'Y-m-d' ) );
	update_post_meta( $b, '_ziel', kilic_opt( 'zahlungsziel' ) );
	update_post_meta( $b, '_mwst', kilic_opt( 'mwst' ) );
	update_post_meta( $b, '_positionen', $pos );
	update_post_meta( $b, '_leistung', trim( ( $d['objekt'] ?? '' ) . ' ' . ( $d['strasse'] ?? '' ) . ' ' . ( $d['ort'] ?? '' ) ) );
	update_post_meta( $b, '_text_oben', kilic_opt( 'an_text_oben' ) );
	update_post_meta( $b, '_text_unten', kilic_opt( 'an_text_unten' ) );
	kilic_beleg_titel_setzen( $b );
	update_post_meta( $id, '_status', 'angebot' );
	update_post_meta( $id, '_kunde', $kunde );
	// Fotos aus der Anfrage in die Kundenakte übernehmen.
	foreach ( array_filter( (array) get_post_meta( $id, '_dateien', true ) ) as $att ) {
		update_post_meta( $att, '_kilic_kunde', $kunde );
	}
	kilic_log( $kunde, 'Anfrage vom ' . get_the_date( 'd.m.Y', $id ) . ' übernommen: ' . get_the_title( $id ), $id, 'anfrage' );
	kilic_log_beleg( $b, 'Entwurf aus der Anfrage erstellt', 'angebot' );

	wp_safe_redirect( get_edit_post_link( $b, 'url' ) );
	exit;
} );

add_filter( 'manage_kilic_anfrage_posts_columns', function ( $cols ) {
	return array(
		'cb'       => $cols['cb'],
		'title'    => 'Anfrage',
		'status'   => 'Status',
		'kontakt'  => 'Kontakt',
		'ort'      => 'Ort',
		'eingang'  => 'Eingang',
	);
} );

add_action( 'manage_kilic_anfrage_posts_custom_column', function ( $col, $id ) {
	$d = (array) get_post_meta( $id, '_daten', true );
	switch ( $col ) {
		case 'status':
			echo kilic_status_badge( get_post_meta( $id, '_status', true ) ); // phpcs:ignore WordPress.Security.EscapeOutput
			break;
		case 'kontakt':
			echo esc_html( $d['tel'] ?? '' ) . '<br>' . esc_html( $d['email'] ?? '' );
			break;
		case 'ort':
			echo esc_html( trim( ( $d['plz'] ?? '' ) . ' ' . ( $d['ort'] ?? '' ) ) );
			break;
		case 'eingang':
			echo esc_html( get_the_date( 'd.m.Y H:i', $id ) );
			break;
	}
}, 10, 2 );

function kilic_anzahl_neue_anfragen() {
	$q = new WP_Query( array(
		'post_type'      => 'kilic_anfrage',
		'posts_per_page' => 1,
		'fields'         => 'ids',
		'meta_key'       => '_status',
		'meta_value'     => 'neu',
	) );
	return (int) $q->found_posts;
}
