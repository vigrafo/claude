<?php
/**
 * Kunden: Stammdaten, Liste, Belege je Kunde.
 */

defined( 'ABSPATH' ) || exit;

function kilic_kunde_fields() {
	return array(
		'firma'    => 'Firma (optional)',
		'strasse'  => 'Straße, Nr.',
		'plz_ort'  => 'PLZ, Ort',
		'email'    => 'E-Mail',
		'telefon'  => 'Telefon',
	);
}

add_action( 'add_meta_boxes_kilic_kunde', function () {
	add_meta_box( 'kilic_kunde_daten', 'Kundendaten', 'kilic_kunde_box', 'kilic_kunde', 'normal', 'high' );
	add_meta_box( 'kilic_kunde_belege', 'Angebote & Rechnungen', 'kilic_kunde_belege_box', 'kilic_kunde', 'normal', 'default' );
} );

function kilic_kunde_box( $post ) {
	wp_nonce_field( 'kilic_kunde_save', 'kilic_kunde_nonce' );
	$nr = get_post_meta( $post->ID, '_kundennr', true );
	echo '<table class="form-table kilic-form"><tbody>';
	if ( $nr ) {
		echo '<tr><th>Kundennummer</th><td><strong>' . esc_html( $nr ) . '</strong></td></tr>';
	}
	foreach ( kilic_kunde_fields() as $key => $label ) {
		$val = get_post_meta( $post->ID, '_' . $key, true );
		$type = 'email' === $key ? 'email' : 'text';
		printf(
			'<tr><th><label for="kk_%1$s">%2$s</label></th><td><input type="%3$s" id="kk_%1$s" name="kilic_kunde[%1$s]" value="%4$s" class="regular-text"></td></tr>',
			esc_attr( $key ),
			esc_html( $label ),
			esc_attr( $type ),
			esc_attr( $val )
		);
	}
	$privat = get_post_meta( $post->ID, '_privat', true );
	echo '<tr><th>Kundenart</th><td><label><input type="checkbox" name="kilic_kunde[privat]" value="1" ' . checked( '1', $privat, false ) . '> Privatkunde</label><p class="description">Bei Privatkunden wird auf Rechnungen der Hinweis zur Aufbewahrungspflicht (§ 14 UStG) und der Lohnanteil für § 35a EStG ausgewiesen.</p></td></tr>';
	echo '<tr><th><label for="kk_notizen">Notizen</label></th><td><textarea id="kk_notizen" name="kilic_kunde[notizen]" rows="4" class="large-text">' . esc_textarea( get_post_meta( $post->ID, '_notizen', true ) ) . '</textarea></td></tr>';
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
	foreach ( array_keys( kilic_kunde_fields() ) as $key ) {
		$v = $data[ $key ] ?? '';
		update_post_meta( $post_id, '_' . $key, 'email' === $key ? sanitize_email( $v ) : sanitize_text_field( $v ) );
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
	$lines = array();
	$firma = get_post_meta( $kunde_id, '_firma', true );
	if ( $firma ) {
		$lines[] = $firma;
	}
	$lines[] = get_the_title( $kunde_id );
	foreach ( array( '_strasse', '_plz_ort' ) as $k ) {
		$v = get_post_meta( $kunde_id, $k, true );
		if ( $v ) {
			$lines[] = $v;
		}
	}
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
			echo esc_html( get_post_meta( $id, '_telefon', true ) ) . '<br>' . esc_html( get_post_meta( $id, '_email', true ) );
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
