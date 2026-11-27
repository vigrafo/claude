<?php
/**
 * Referenzprojekte: Kennzahlen und Ausgabe per Shortcode [kilic_referenzen].
 */

defined( 'ABSPATH' ) || exit;

function kilic_ref_fields() {
	return array(
		'ort'       => 'Ort',
		'flaeche'   => 'Fläche (z. B. 165 m²)',
		'material'  => 'Estrich / Belag (z. B. CAF)',
		'dauer'     => 'Ausführung (z. B. 2 Tage)',
		'kurz'      => 'Kurzbeschreibung (1–2 Sätze)',
	);
}

add_action( 'add_meta_boxes_kilic_referenz', function () {
	add_meta_box( 'kilic_ref', 'Projektdaten', function ( $post ) {
		wp_nonce_field( 'kilic_ref_save', 'kilic_ref_nonce' );
		echo '<table class="form-table kilic-form"><tbody>';
		foreach ( kilic_ref_fields() as $k => $label ) {
			$v = get_post_meta( $post->ID, '_' . $k, true );
			if ( 'kurz' === $k ) {
				echo '<tr><th>' . esc_html( $label ) . '</th><td><textarea name="kilic_ref[' . esc_attr( $k ) . ']" rows="2" class="large-text">' . esc_textarea( $v ) . '</textarea></td></tr>';
			} else {
				echo '<tr><th>' . esc_html( $label ) . '</th><td><input type="text" name="kilic_ref[' . esc_attr( $k ) . ']" value="' . esc_attr( $v ) . '" class="regular-text"></td></tr>';
			}
		}
		$bsp = get_post_meta( $post->ID, '_beispiel', true );
		echo '<tr><th>Beispielprojekt</th><td><label><input type="checkbox" name="kilic_ref[beispiel]" value="1" ' . checked( '1', $bsp, false ) . '> Als „Beispielprojekt“ kennzeichnen</label><p class="description">Vorlage aus der Einrichtung. Haken entfernen, sobald echte Projektdaten eingetragen sind.</p></td></tr>';
		echo '</tbody></table><p class="description">Das Projektfoto legen Sie rechts unter „Projektfoto“ fest. Die Projektart (Neubau, Sanierung …) steuert den Filter auf der Referenzen-Seite.</p>';
	}, 'kilic_referenz', 'normal', 'high' );
} );

add_action( 'save_post_kilic_referenz', function ( $post_id ) {
	if ( ! isset( $_POST['kilic_ref_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['kilic_ref_nonce'] ), 'kilic_ref_save' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$d = isset( $_POST['kilic_ref'] ) ? (array) wp_unslash( $_POST['kilic_ref'] ) : array();
	foreach ( array_keys( kilic_ref_fields() ) as $k ) {
		update_post_meta( $post_id, '_' . $k, 'kurz' === $k ? sanitize_textarea_field( $d[ $k ] ?? '' ) : sanitize_text_field( $d[ $k ] ?? '' ) );
	}
	update_post_meta( $post_id, '_beispiel', empty( $d['beispiel'] ) ? '0' : '1' );
} );

/**
 * [kilic_referenzen anzahl="6" filter="ja"]
 */
add_shortcode( 'kilic_referenzen', function ( $atts ) {
	$a = shortcode_atts( array( 'anzahl' => 6, 'filter' => 'nein', 'art' => '' ), $atts );
	$args = array(
		'post_type'   => 'kilic_referenz',
		'numberposts' => (int) $a['anzahl'],
		'post_status' => 'publish',
	);
	if ( $a['art'] ) {
		$args['tax_query'] = array( array( 'taxonomy' => 'kilic_ref_kat', 'field' => 'slug', 'terms' => array_map( 'trim', explode( ',', $a['art'] ) ) ) );
	}
	$refs = get_posts( $args );
	$hint = '';
	if ( current_user_can( 'edit_posts' ) ) {
		$hint = '<p class="kilic-edit-hint">Nur für Sie sichtbar: Diese Projekte und ihre Fotos pflegen Sie unter <a href="' . esc_url( admin_url( 'edit.php?post_type=kilic_referenz' ) ) . '">Kilic Betrieb → Referenzen</a> (Foto = „Projektfoto“ rechts im Projekt). Im Divi-Editor erscheint hier nur der Platzhalter &#91;kilic_referenzen&#93;.</p>';
	}
	if ( ! $refs ) {
		return $hint . '<p class="muted">Hier erscheinen in Kürze unsere aktuellen Projekte.</p>';
	}
	ob_start();
	echo $hint; // phpcs:ignore WordPress.Security.EscapeOutput
	if ( 'ja' === $a['filter'] ) {
		$terms = get_terms( array( 'taxonomy' => 'kilic_ref_kat', 'hide_empty' => true ) );
		echo '<div class="filter-bar"><button type="button" class="active" data-filter="all">Alle</button>';
		foreach ( $terms as $t ) {
			echo '<button type="button" data-filter="' . esc_attr( $t->slug ) . '">' . esc_html( $t->name ) . '</button>';
		}
		echo '</div>';
	}
	echo '<div class="grid grid-3">';
	foreach ( $refs as $r ) {
		$cats  = wp_get_post_terms( $r->ID, 'kilic_ref_kat' );
		$slugs = implode( ' ', wp_list_pluck( $cats, 'slug' ) );
		$names = implode( ' · ', wp_list_pluck( $cats, 'name' ) );
		$blue  = in_array( 'rohrreinigung', wp_list_pluck( $cats, 'slug' ), true );
		$m     = array();
		foreach ( array( 'flaeche' => 'Fläche', 'material' => 'Material', 'dauer' => 'Ausführung' ) as $k => $l ) {
			$v = get_post_meta( $r->ID, '_' . $k, true );
			if ( $v ) {
				$m[] = '<div><strong>' . esc_html( $v ) . '</strong>' . esc_html( $l ) . '</div>';
			}
		}
		echo '<article class="project" data-cat="' . esc_attr( $slugs ) . '">';
		if ( has_post_thumbnail( $r ) ) {
			echo get_the_post_thumbnail( $r, 'large', array( 'class' => 'project-img', 'loading' => 'lazy' ) );
		} else {
			$ph = kilic_ph_referenz( wp_list_pluck( $cats, 'slug' ) );
			echo '<img class="project-img" src="' . esc_url( $ph ? $ph : KILIC_URL . 'assets/img/' . ( $blue ? 'ph-blau.svg' : 'ph-grau.svg' ) ) . '" alt="" loading="lazy" width="1200" height="900">';
		}
		echo '<div class="body">';
		if ( $names ) {
			echo '<span class="tag' . ( $blue ? ' blue' : '' ) . '">' . esc_html( $names ) . '</span>';
		}
		if ( '1' === get_post_meta( $r->ID, '_beispiel', true ) ) {
			echo ' <span class="todo">Beispielprojekt</span>';
		}
		echo '<h3>' . esc_html( get_the_title( $r ) ) . '</h3>';
		$ort = get_post_meta( $r->ID, '_ort', true );
		if ( $ort ) {
			echo '<div class="loc"><span class="ki ki-pin"></span> ' . esc_html( $ort ) . '</div>';
		}
		$kurz = get_post_meta( $r->ID, '_kurz', true );
		if ( $kurz ) {
			echo '<p class="muted small">' . esc_html( $kurz ) . '</p>';
		}
		if ( $m ) {
			echo '<div class="meta">' . implode( '', $m ) . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput
		}
		echo '</div></article>';
	}
	echo '</div>';
	return ob_get_clean();
} );
