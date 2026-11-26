<?php
/**
 * Leistungskatalog: wiederkehrende Leistungen mit Text, Einheit und Preis,
 * die in Angeboten und Rechnungen per Auswahl übernommen werden.
 */

defined( 'ABSPATH' ) || exit;

function kilic_katalog_bereiche() {
	return array(
		'estrich'  => 'Estrich',
		'boden'    => 'Boden',
		'rohr'     => 'Rohrreinigung',
		'sonstige' => 'Sonstiges',
	);
}

add_action( 'init', function () {
	register_post_type( 'kilic_leistung', array(
		'labels' => array(
			'name'               => 'Leistungskatalog',
			'singular_name'      => 'Leistung',
			'all_items'          => 'Leistungskatalog',
			'add_new'            => 'Leistung hinzufügen',
			'add_new_item'       => 'Leistung zum Katalog hinzufügen',
			'edit_item'          => 'Leistung bearbeiten',
			'search_items'       => 'Leistungen durchsuchen',
			'not_found'          => 'Noch keine Leistungen im Katalog.',
		),
		'public'          => false,
		'show_ui'         => true,
		'show_in_menu'    => 'kilic',
		'show_in_rest'    => false,
		'capability_type' => array( 'kilic_vorgang', 'kilic_vorgaenge' ),
		'map_meta_cap'    => true,
		'supports'        => array( 'title' ),
	) );
} );

add_filter( 'enter_title_here', function ( $text, $post ) {
	return 'kilic_leistung' === $post->post_type ? 'Kurzbezeichnung, z. B. „Heizestrich CAF“' : $text;
}, 10, 2 );

add_action( 'add_meta_boxes_kilic_leistung', function () {
	add_meta_box( 'kilic_leistung_daten', 'Leistung', function ( $post ) {
		wp_nonce_field( 'kilic_leistung_save', 'kilic_leistung_nonce' );
		$bereich = get_post_meta( $post->ID, '_bereich', true );
		$einheit = get_post_meta( $post->ID, '_einheit', true );
		$preis   = (int) get_post_meta( $post->ID, '_preis', true );
		?>
		<table class="form-table kilic-form"><tbody>
			<tr><th><label for="kl_bereich">Bereich</label></th><td><select id="kl_bereich" name="kilic_leistung[bereich]">
				<?php foreach ( kilic_katalog_bereiche() as $k => $l ) : ?>
					<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $bereich, $k ); ?>><?php echo esc_html( $l ); ?></option>
				<?php endforeach; ?>
			</select></td></tr>
			<tr><th><label for="kl_text">Text auf Angebot/Rechnung</label></th><td><textarea id="kl_text" name="kilic_leistung[text]" rows="4" class="large-text"><?php echo esc_textarea( get_post_meta( $post->ID, '_text', true ) ); ?></textarea><p class="description">So erscheint die Position auf dem Beleg. Leer = Kurzbezeichnung.</p></td></tr>
			<tr><th><label for="kl_einheit">Einheit</label></th><td><select id="kl_einheit" name="kilic_leistung[einheit]">
				<?php foreach ( kilic_einheiten() as $e ) : ?>
					<option <?php selected( $einheit, $e ); ?>><?php echo esc_html( $e ); ?></option>
				<?php endforeach; ?>
			</select></td></tr>
			<tr><th><label for="kl_preis">Einzelpreis netto</label></th><td><input type="text" id="kl_preis" name="kilic_leistung[preis]" value="<?php echo esc_attr( number_format( $preis / 100, 2, ',', '' ) ); ?>" class="small-text" style="width:110px"> €</td></tr>
		</tbody></table>
		<?php
	}, 'kilic_leistung', 'normal', 'high' );
} );

add_action( 'save_post_kilic_leistung', function ( $post_id ) {
	if ( ! isset( $_POST['kilic_leistung_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['kilic_leistung_nonce'] ), 'kilic_leistung_save' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$d = isset( $_POST['kilic_leistung'] ) ? (array) wp_unslash( $_POST['kilic_leistung'] ) : array();
	$bereich = sanitize_key( $d['bereich'] ?? 'sonstige' );
	$einheit = sanitize_text_field( $d['einheit'] ?? 'Stk.' );
	update_post_meta( $post_id, '_bereich', isset( kilic_katalog_bereiche()[ $bereich ] ) ? $bereich : 'sonstige' );
	update_post_meta( $post_id, '_text', sanitize_textarea_field( $d['text'] ?? '' ) );
	update_post_meta( $post_id, '_einheit', in_array( $einheit, kilic_einheiten(), true ) ? $einheit : 'Stk.' );
	update_post_meta( $post_id, '_preis', kilic_to_cents( $d['preis'] ?? '' ) );
} );

add_filter( 'manage_kilic_leistung_posts_columns', function ( $cols ) {
	return array(
		'cb'      => $cols['cb'],
		'title'   => 'Leistung',
		'bereich' => 'Bereich',
		'einheit' => 'Einheit',
		'preis'   => 'Einzelpreis netto',
	);
} );

add_action( 'manage_kilic_leistung_posts_custom_column', function ( $col, $id ) {
	switch ( $col ) {
		case 'bereich':
			echo esc_html( kilic_katalog_bereiche()[ get_post_meta( $id, '_bereich', true ) ] ?? '' );
			break;
		case 'einheit':
			echo esc_html( get_post_meta( $id, '_einheit', true ) );
			break;
		case 'preis':
			$p = (int) get_post_meta( $id, '_preis', true );
			echo $p ? esc_html( kilic_eur( $p ) ) : '<span class="kilic-ueberfaellig">Preis eintragen</span>';
			break;
	}
}, 10, 2 );

add_action( 'pre_get_posts', function ( $q ) {
	if ( is_admin() && $q->is_main_query() && 'kilic_leistung' === $q->get( 'post_type' ) && ! $q->get( 'orderby' ) ) {
		$q->set( 'orderby', array( 'menu_order' => 'ASC', 'title' => 'ASC' ) );
	}
} );

/** Katalog für die Auswahl in Belegen, nach Bereich gruppiert. */
function kilic_katalog() {
	$out = array();
	foreach ( kilic_katalog_bereiche() as $k => $l ) {
		$out[ $k ] = array();
	}
	$items = get_posts( array(
		'post_type'   => 'kilic_leistung',
		'numberposts' => -1,
		'post_status' => 'publish',
		'orderby'     => array( 'menu_order' => 'ASC', 'title' => 'ASC' ),
	) );
	foreach ( $items as $it ) {
		$b = get_post_meta( $it->ID, '_bereich', true );
		$b = isset( $out[ $b ] ) ? $b : 'sonstige';
		$text = get_post_meta( $it->ID, '_text', true );
		$out[ $b ][] = array(
			'titel'   => $it->post_title,
			'text'    => $text ? $text : $it->post_title,
			'einheit' => get_post_meta( $it->ID, '_einheit', true ),
			'preis'   => (int) get_post_meta( $it->ID, '_preis', true ),
		);
	}
	return array_filter( $out );
}

/** Startkatalog (einmalig). Preise bitte eintragen. */
function kilic_setup_katalog() {
	if ( get_option( 'kilic_katalog_angelegt' ) ) {
		return;
	}
	$items = array(
		array( 'estrich', 'Zementestrich CT schwimmend', 'Zementestrich CT-C25-F4 als schwimmender Estrich, Nenndicke ca. 50 mm, inkl. Randdämmstreifen und PE-Folie, liefern und einbauen', 'm²' ),
		array( 'estrich', 'Heizestrich CAF (Fließestrich)', 'Calciumsulfat-Fließestrich CAF-C25-F5 als Heizestrich, ca. 45 mm über Rohr, inkl. Randdämmstreifen, liefern und einbauen', 'm²' ),
		array( 'estrich', 'Heizestrich CT (Zement)', 'Zementestrich CT-C25-F4 als Heizestrich, mind. 45 mm über Rohr, inkl. Randdämmstreifen, liefern und einbauen', 'm²' ),
		array( 'estrich', 'Schnellestrich', 'Schnellestrich, belegreif nach Herstellerangabe, Nenndicke ca. 50 mm, liefern und einbauen', 'm²' ),
		array( 'estrich', 'Trockenestrich-Elemente', 'Trockenestrich-Elemente (Gipsfaser), verklebt und verschraubt, inkl. Randstreifen, liefern und verlegen', 'm²' ),
		array( 'estrich', 'Gefälleestrich', 'Zement-Gefälleestrich, Gefälle ca. 1,5–2 % zu Ablauf/Rinne, liefern und einbauen', 'm²' ),
		array( 'estrich', 'Industrieestrich CT-C35 im Verbund', 'Zementestrich CT-C35 im Verbund, maschinell geglättet, inkl. Haftbrücke, liefern und einbauen', 'm²' ),
		array( 'estrich', 'Wärmedämmung EPS 035', 'Wärmedämmung EPS 035 DEO, Dicke nach Vorgabe, liefern und verlegen', 'm²' ),
		array( 'estrich', 'Trittschalldämmung EPS-T', 'Trittschalldämmung EPS-T 30-2, liefern und verlegen', 'm²' ),
		array( 'estrich', 'Randdämmstreifen', 'Randdämmstreifen mit Folienlasche, liefern und anbringen', 'lfm' ),
		array( 'estrich', 'Baustelleneinrichtung Estrichpumpe', 'Baustelleneinrichtung, An- und Abfahrt Estrichpumpe und Mischtechnik', 'pauschal' ),
		array( 'estrich', 'CM-Messung mit Protokoll', 'CM-Messung zur Prüfung der Belegreife inkl. Protokoll', 'Stk.' ),
		array( 'boden', 'Altestrich abbrechen und entsorgen', 'Vorhandenen Estrich abbrechen, laden und fachgerecht entsorgen', 'm²' ),
		array( 'boden', 'Ausgleichsmasse bis 10 mm', 'Untergrund grundieren und mit selbstverlaufender Ausgleichsmasse nivellieren, Schichtdicke bis 10 mm', 'm²' ),
		array( 'boden', 'Risse verharzen', 'Risse im Estrich aufschneiden, verklammern und kraftschlüssig verharzen', 'lfm' ),
		array( 'boden', 'Untergrund schleifen', 'Untergrund anschleifen, Kleberreste entfernen und absaugen', 'm²' ),
		array( 'boden', 'Vinyl-Designbelag verlegen', 'Vinyl-Designbelag liefern und verlegen (Klick oder geklebt)', 'm²' ),
		array( 'boden', 'Laminat verlegen', 'Laminat inkl. Trittschallunterlage liefern und schwimmend verlegen', 'm²' ),
		array( 'boden', 'Parkett verlegen', 'Parkett liefern und verlegen (geklebt oder schwimmend)', 'm²' ),
		array( 'boden', 'Sockelleisten', 'Sockelleisten liefern und montieren', 'lfm' ),
		array( 'rohr', 'Rohrreinigung (Monteur + Maschine)', 'Rohrreinigung mit Spiralmaschine, Monteur inkl. Maschine', 'Std.' ),
		array( 'rohr', 'Hochdruckspülung', 'Hochdruckspülung von Grund- und Kanalleitungen', 'Std.' ),
		array( 'rohr', 'Kanal-TV-Inspektion', 'Kanal-TV-Inspektion inkl. Dokumentation', 'pauschal' ),
		array( 'rohr', 'Notdienst-Zuschlag', 'Zuschlag Notdienst (Nacht, Sonn- und Feiertag)', 'pauschal' ),
		array( 'sonstige', 'Anfahrt', 'Anfahrt im Einsatzgebiet', 'pauschal' ),
		array( 'sonstige', 'Regiestunde', 'Arbeiten nach Aufwand (Regiestunde)', 'Std.' ),
	);
	foreach ( $items as $i => $it ) {
		$id = wp_insert_post( array(
			'post_type'   => 'kilic_leistung',
			'post_status' => 'publish',
			'post_title'  => $it[1],
			'menu_order'  => $i,
		) );
		if ( $id && ! is_wp_error( $id ) ) {
			update_post_meta( $id, '_bereich', $it[0] );
			update_post_meta( $id, '_text', $it[2] );
			update_post_meta( $id, '_einheit', $it[3] );
			update_post_meta( $id, '_preis', 0 );
		}
	}
	update_option( 'kilic_katalog_angelegt', 1 );
}
