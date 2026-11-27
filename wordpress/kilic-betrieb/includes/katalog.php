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

/* ---------- Katalog-Editor: alles direkt in der Liste ändern ---------- */

add_action( 'admin_menu', function () {
	add_submenu_page( 'kilic', 'Leistungskatalog', 'Leistungskatalog', 'edit_kilic_vorgaenge', 'kilic-katalog', 'kilic_render_katalog' );
}, 15 );

/** Die alte WordPress-Liste auf den neuen Editor umleiten. */
add_action( 'load-edit.php', function () {
	if ( 'kilic_leistung' === ( $_GET['post_type'] ?? '' ) && empty( $_GET['liste'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		wp_safe_redirect( admin_url( 'admin.php?page=kilic-katalog' ) );
		exit;
	}
} );

function kilic_katalog_zeile( $p ) {
	$b     = get_post_meta( $p->ID, '_bereich', true );
	$e     = get_post_meta( $p->ID, '_einheit', true );
	$preis = (int) get_post_meta( $p->ID, '_preis', true );
	$text  = (string) get_post_meta( $p->ID, '_text', true );
	ob_start();
	?>
	<div class="kk-zeile<?php echo $preis ? '' : ' ohne-preis'; ?>" data-id="<?php echo (int) $p->ID; ?>" data-bereich="<?php echo esc_attr( $b ); ?>">
		<div class="kk-haupt">
			<label class="kk-f kk-name"><span>Leistung</span><input type="text" data-feld="titel" value="<?php echo esc_attr( $p->post_title ); ?>" placeholder="Bezeichnung, z. B. Heizestrich CAF"></label>
			<label class="kk-f kk-bereich"><span>Bereich</span><select data-feld="bereich">
				<?php foreach ( kilic_katalog_bereiche() as $k => $l ) : ?><option value="<?php echo esc_attr( $k ); ?>" <?php selected( $b, $k ); ?>><?php echo esc_html( $l ); ?></option><?php endforeach; ?>
			</select></label>
			<label class="kk-f kk-einheit"><span>Einheit</span><select data-feld="einheit">
				<?php foreach ( kilic_einheiten() as $x ) : ?><option <?php selected( $e, $x ); ?>><?php echo esc_html( $x ); ?></option><?php endforeach; ?>
			</select></label>
			<label class="kk-f kk-preis"><span>Preis netto</span><span class="kk-euro"><input type="text" inputmode="decimal" data-feld="preis" value="<?php echo $preis ? esc_attr( number_format( $preis / 100, 2, ',', '.' ) ) : ''; ?>" placeholder="Preis"><b>€</b></span></label>
			<div class="kk-knoepfe">
				<button type="button" class="kk-btn kk-text-auf" aria-expanded="false" title="Text für Angebot/Rechnung"><span class="dashicons dashicons-text-page"></span><span class="kk-lbl">Text</span></button>
				<button type="button" class="kk-btn kk-weg" title="Leistung löschen" aria-label="Leistung löschen"><span class="dashicons dashicons-trash"></span></button>
				<span class="kk-status" aria-live="polite"></span>
			</div>
		</div>
		<div class="kk-textfeld" hidden>
			<label class="kk-f"><span>So steht die Position auf Angebot und Rechnung (leer = Bezeichnung)</span><textarea data-feld="text" rows="3" placeholder="z. B. Calciumsulfat-Fließestrich CAF-C25-F5 als Heizestrich, ca. 45 mm über Rohr …"><?php echo esc_textarea( $text ); ?></textarea></label>
		</div>
	</div>
	<?php
	return ob_get_clean();
}

function kilic_render_katalog() {
	$alle = get_posts( array( 'post_type' => 'kilic_leistung', 'numberposts' => -1, 'post_status' => 'publish', 'orderby' => array( 'menu_order' => 'ASC', 'title' => 'ASC' ) ) );
	$gr   = array();
	foreach ( kilic_katalog_bereiche() as $k => $l ) {
		$gr[ $k ] = array();
	}
	foreach ( $alle as $p ) {
		$b = get_post_meta( $p->ID, '_bereich', true );
		$gr[ isset( $gr[ $b ] ) ? $b : 'sonstige' ][] = $p;
	}
	$ohne = count( array_filter( $alle, function ( $p ) { return ! (int) get_post_meta( $p->ID, '_preis', true ); } ) );
	?>
	<div class="wrap kilic-wrap kk-wrap" data-ajax="<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>" data-nonce="<?php echo esc_attr( wp_create_nonce( 'kilic_katalog' ) ); ?>">
		<div class="kk-kopf">
			<div>
				<h1>Leistungskatalog</h1>
				<p class="kk-intro">Alles direkt hier ändern – wird automatisch gespeichert. Diese Leistungen stehen in jedem Angebot und jeder Rechnung zur Auswahl.</p>
			</div>
			<button type="button" class="kk-neu-knopf" data-bereich="estrich"><span class="dashicons dashicons-plus-alt2"></span> Neue Leistung</button>
		</div>
		<div class="kk-werkzeuge">
			<div class="kk-chips" role="tablist">
				<button type="button" class="kk-chip is-aktiv" data-filter="">Alle <b><?php echo count( $alle ); ?></b></button>
				<?php foreach ( kilic_katalog_bereiche() as $k => $l ) : ?>
					<button type="button" class="kk-chip" data-filter="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $l ); ?> <b><?php echo count( $gr[ $k ] ); ?></b></button>
				<?php endforeach; ?>
				<?php if ( $ohne ) : ?><button type="button" class="kk-chip kk-chip-warn" data-filter="ohne-preis">Ohne Preis <b><?php echo (int) $ohne; ?></b></button><?php endif; ?>
			</div>
			<label class="kk-suche"><span class="dashicons dashicons-search"></span><input type="search" placeholder="Im Katalog suchen …" aria-label="Im Katalog suchen"></label>
		</div>
		<?php foreach ( kilic_katalog_bereiche() as $k => $l ) : ?>
			<section class="kk-gruppe" data-bereich="<?php echo esc_attr( $k ); ?>">
				<div class="kk-gruppe-kopf"><h2><?php echo esc_html( $l ); ?></h2><button type="button" class="kk-neu-mini" data-bereich="<?php echo esc_attr( $k ); ?>">+ Leistung in „<?php echo esc_html( $l ); ?>“</button></div>
				<div class="kk-liste">
					<?php foreach ( $gr[ $k ] as $p ) { echo kilic_katalog_zeile( $p ); } // phpcs:ignore WordPress.Security.EscapeOutput ?>
				</div>
				<p class="kk-leer"<?php echo $gr[ $k ] ? ' hidden' : ''; ?>>Noch keine Leistungen in diesem Bereich.</p>
			</section>
		<?php endforeach; ?>
	</div>
	<?php
}

add_action( 'wp_ajax_kilic_katalog', function () {
	check_ajax_referer( 'kilic_katalog', 'n' );
	$tun = sanitize_key( $_POST['tun'] ?? '' );
	if ( 'neu' === $tun ) {
		if ( ! current_user_can( get_post_type_object( 'kilic_leistung' )->cap->create_posts ) ) {
			wp_send_json_error( array( 'text' => 'Keine Berechtigung.' ), 403 );
		}
		$b  = sanitize_key( $_POST['bereich'] ?? 'sonstige' );
		$b  = isset( kilic_katalog_bereiche()[ $b ] ) ? $b : 'sonstige';
		$id = wp_insert_post( array( 'post_type' => 'kilic_leistung', 'post_status' => 'publish', 'post_title' => 'Neue Leistung' ) );
		update_post_meta( $id, '_bereich', $b );
		update_post_meta( $id, '_einheit', 'rohr' === $b ? 'pauschal' : 'm²' );
		update_post_meta( $id, '_preis', 0 );
		wp_send_json_success( array( 'html' => kilic_katalog_zeile( get_post( $id ) ) ) );
	}
	$id = absint( $_POST['id'] ?? 0 );
	if ( ! $id || 'kilic_leistung' !== get_post_type( $id ) || ! current_user_can( 'edit_post', $id ) ) {
		wp_send_json_error( array( 'text' => 'Keine Berechtigung.' ), 403 );
	}
	if ( 'loeschen' === $tun ) {
		if ( ! current_user_can( 'delete_post', $id ) ) {
			wp_send_json_error( array( 'text' => 'Keine Berechtigung.' ), 403 );
		}
		wp_trash_post( $id );
		wp_send_json_success();
	}
	$feld = sanitize_key( $_POST['feld'] ?? '' );
	$wert = wp_unslash( (string) ( $_POST['wert'] ?? '' ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	switch ( $feld ) {
		case 'titel':
			$t = sanitize_text_field( $wert );
			wp_update_post( array( 'ID' => $id, 'post_title' => '' !== $t ? $t : 'Leistung' ) );
			break;
		case 'bereich':
			$b = sanitize_key( $wert );
			update_post_meta( $id, '_bereich', isset( kilic_katalog_bereiche()[ $b ] ) ? $b : 'sonstige' );
			break;
		case 'einheit':
			update_post_meta( $id, '_einheit', in_array( $wert, kilic_einheiten(), true ) ? $wert : 'Stk.' );
			break;
		case 'preis':
			update_post_meta( $id, '_preis', kilic_to_cents( $wert ) );
			break;
		case 'text':
			update_post_meta( $id, '_text', sanitize_textarea_field( $wert ) );
			break;
		default:
			wp_send_json_error( array( 'text' => 'Unbekanntes Feld.' ) );
	}
	$p = (int) get_post_meta( $id, '_preis', true );
	wp_send_json_success( array( 'preis' => $p ? number_format( $p / 100, 2, ',', '.' ) : '' ) );
} );
