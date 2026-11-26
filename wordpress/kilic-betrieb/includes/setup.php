<?php
/**
 * Einrichtung bei Aktivierung: Rollen, Seitenstruktur, Menüs, Startseite,
 * Projektarten und Beispiel-Referenzen. Vorhandene Seiten bleiben unverändert.
 */

defined( 'ABSPATH' ) || exit;

function kilic_activate() {
	kilic_register_post_types();
	kilic_install_roles();
	if ( ! get_option( 'kilic_settings' ) ) {
		add_option( 'kilic_settings', kilic_defaults() );
	}
	kilic_setup_pages();
	kilic_setup_referenzen();
	if ( ! get_option( 'permalink_structure' ) ) {
		update_option( 'permalink_structure', '/%postname%/' );
	}
	flush_rewrite_rules();
}

/** Legt fehlende Seiten an und gibt slug => ID zurück. */
function kilic_setup_pages() {
	$ids = array();
	// Die Abschnitte enthalten Formular-Elemente (<form>, <select>); der HTML-Filter
	// würde sie sonst entfernen, wenn die Einrichtung ohne „unfiltered_html“ läuft.
	kses_remove_filters();
	foreach ( kilic_seiten() as $slug => $def ) {
		list( $title, $parent, $order, $fn ) = $def;
		$parent_id = $parent ? ( $ids[ $parent ] ?? 0 ) : 0;
		$path      = $parent ? $parent . '/' . $slug : $slug;
		if ( $parent && ( $ids[ $parent ] ?? 0 ) ) {
			$path = get_page_uri( $ids[ $parent ] ) . '/' . $slug;
		}
		$existing = get_page_by_path( $path );
		if ( $existing ) {
			$ids[ $slug ] = $existing->ID;
			continue;
		}
		$id = wp_insert_post( array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_parent'  => $parent_id,
			'menu_order'   => $order,
			'post_content' => call_user_func( $fn ),
		), true );
		if ( is_wp_error( $id ) ) {
			continue;
		}
		update_post_meta( $id, '_wp_page_template', KILIC_TEMPLATE );
		// Divi: Seite als Builder-Seite markieren, damit sie direkt im Divi Builder öffnet.
		update_post_meta( $id, '_et_pb_use_builder', 'on' );
		update_post_meta( $id, '_et_pb_page_layout', 'et_full_width_page' );
		update_post_meta( $id, '_et_pb_side_nav', 'off' );
		$ids[ $slug ] = $id;
	}

	kses_init_filters();

	if ( ! empty( $ids['start'] ) && 'page' !== get_option( 'show_on_front' ) ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $ids['start'] );
	}
	kilic_setup_menus( $ids );
	return $ids;
}

function kilic_setup_menus( $ids ) {
	$locations = get_theme_mod( 'nav_menu_locations', array() );

	$menus = array(
		'kilic-haupt' => array(
			'name'  => 'Hauptmenü',
			'items' => array(
				array( 'start', 0, '' ),
				array( 'estrich', 0, '' ),
				array( 'heizestrich', 'estrich', '' ),
				array( 'fliessestrich', 'estrich', '' ),
				array( 'zementestrich', 'estrich', '' ),
				array( 'schnellestrich', 'estrich', '' ),
				array( 'trockenestrich', 'estrich', '' ),
				array( 'industrie-gefaelleestrich', 'estrich', '' ),
				array( 'boden', 0, '' ),
				array( 'bodensanierung', 'boden', '' ),
				array( 'bodenverlegung', 'boden', '' ),
				array( 'ausgleichsmassen', 'boden', '' ),
				array( 'rohrreinigung', 0, 'rohr' ),
				array( 'notdienst', 'rohrreinigung', '' ),
				array( 'kanal-tv', 'rohrreinigung', '' ),
				array( 'wartung', 'rohrreinigung', '' ),
				array( 'referenzen', 0, '' ),
				array( 'ueber-uns', 0, '' ),
				array( 'karriere', 'ueber-uns', '' ),
				array( 'kontakt', 0, '' ),
			),
		),
		'kilic-footer' => array(
			'name'  => 'Footer: Estrich & Boden',
			'items' => array( array( 'heizestrich', 0, '' ), array( 'fliessestrich', 0, '' ), array( 'zementestrich', 0, '' ), array( 'schnellestrich', 0, '' ), array( 'bodensanierung', 0, '' ), array( 'bodenverlegung', 0, '' ) ),
		),
		'kilic-footer-2' => array(
			'name'  => 'Footer: Unternehmen',
			'items' => array( array( 'rohrreinigung', 0, '' ), array( 'notdienst', 0, '' ), array( 'referenzen', 0, '' ), array( 'ueber-uns', 0, '' ), array( 'karriere', 0, '' ), array( 'angebot-anfragen', 0, '' ), array( 'kontakt', 0, '' ) ),
		),
		'kilic-rechtliches' => array(
			'name'  => 'Rechtliches',
			'items' => array( array( 'impressum', 0, '' ), array( 'datenschutz', 0, '' ) ),
		),
	);

	foreach ( $menus as $location => $m ) {
		if ( ! empty( $locations[ $location ] ) && wp_get_nav_menu_object( $locations[ $location ] ) ) {
			continue; // Bestehendes Menü nicht überschreiben.
		}
		$menu = wp_get_nav_menu_object( $m['name'] );
		$menu_id = $menu ? $menu->term_id : wp_create_nav_menu( $m['name'] );
		if ( is_wp_error( $menu_id ) ) {
			continue;
		}
		if ( ! $menu ) {
			$item_ids = array();
			foreach ( $m['items'] as $i => $it ) {
				list( $slug, $parent, $class ) = $it;
				if ( empty( $ids[ $slug ] ) ) {
					continue;
				}
				$item_ids[ $slug ] = wp_update_nav_menu_item( $menu_id, 0, array(
					'menu-item-object-id' => $ids[ $slug ],
					'menu-item-object'    => 'page',
					'menu-item-type'      => 'post_type',
					'menu-item-status'    => 'publish',
					'menu-item-position'  => $i + 1,
					'menu-item-classes'   => $class,
					'menu-item-parent-id' => $parent ? ( $item_ids[ $parent ] ?? 0 ) : 0,
				) );
			}
		}
		$locations[ $location ] = $menu_id;
	}
	set_theme_mod( 'nav_menu_locations', $locations );
}

/** Projektarten und gekennzeichnete Beispiel-Referenzen (nur beim ersten Mal). */
function kilic_setup_referenzen() {
	if ( get_option( 'kilic_referenzen_angelegt' ) ) {
		return;
	}
	$terms = array( 'neubau' => 'Neubau', 'sanierung' => 'Sanierung', 'gewerbe' => 'Gewerbe', 'bodenverlegung' => 'Bodenverlegung', 'rohrreinigung' => 'Rohrreinigung' );
	foreach ( $terms as $slug => $name ) {
		if ( ! term_exists( $slug, 'kilic_ref_kat' ) ) {
			wp_insert_term( $name, 'kilic_ref_kat', array( 'slug' => $slug ) );
		}
	}
	$refs = array(
		array( 'Einfamilienhaus mit Fußbodenheizung', 'neubau', 'Mosbach', '165 m²', 'CAF', '2 Tage', 'Fließestrich auf Fußbodenheizung in EG und OG, inkl. Dämmung und Aufheizprotokoll.' ),
		array( 'Altbauwohnung saniert', 'sanierung', 'Neckar-Odenwald-Kreis', '92 m²', 'Schnellestrich', '3 Tage', 'Altestrich entfernt, Neuaufbau mit Schnellestrich – schnell belegreif.' ),
		array( 'Werkhalle mit Industrieestrich', 'gewerbe', 'Neckar-Odenwald-Kreis', '640 m²', 'CT-C35', '5 Tage', 'Hochbelastbarer Zementestrich im Verbund, maschinell geglättet.' ),
		array( 'Mehrfamilienhaus', 'neubau', 'Neckar-Odenwald-Kreis', '720 m²', 'CT', '6 Tage', 'Heizestrich auf Trittschalldämmung, Gefälleestrich in den Bädern.' ),
		array( 'Wohnung mit Vinylboden', 'bodenverlegung', 'Mosbach', '68 m²', 'Vinyl', '2 Tage', 'Ausgleichsmasse und Klick-Vinyl inkl. Sockelleisten.' ),
		array( 'Rückstau im Keller beseitigt', 'rohrreinigung', 'Mosbach und Umgebung', '', 'Kanal-TV', 'Notdienst', 'Sonntagseinsatz: Rückstau beseitigt, Ursache per Kamera dokumentiert.' ),
	);
	foreach ( $refs as $i => $r ) {
		$id = wp_insert_post( array(
			'post_type'    => 'kilic_referenz',
			'post_status'  => 'publish',
			'post_title'   => $r[0],
			'post_content' => '<p>' . $r[6] . '</p>',
			'menu_order'   => $i,
		) );
		if ( ! $id || is_wp_error( $id ) ) {
			continue;
		}
		wp_set_object_terms( $id, $r[1], 'kilic_ref_kat' );
		update_post_meta( $id, '_ort', $r[2] );
		update_post_meta( $id, '_flaeche', $r[3] );
		update_post_meta( $id, '_material', $r[4] );
		update_post_meta( $id, '_dauer', $r[5] );
		update_post_meta( $id, '_kurz', $r[6] );
		update_post_meta( $id, '_beispiel', '1' );
	}
	update_option( 'kilic_referenzen_angelegt', 1 );
}

add_action( 'admin_post_kilic_setup_pages', function () {
	check_admin_referer( 'kilic_setup_pages' );
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	kilic_setup_pages();
	flush_rewrite_rules();
	wp_safe_redirect( admin_url( 'admin.php?page=kilic-einstellungen&kilic_seiten=1' ) );
	exit;
} );

/** Versionswechsel: Rollen aktualisieren. */
add_action( 'admin_init', function () {
	if ( get_option( 'kilic_version' ) !== KILIC_VERSION ) {
		kilic_install_roles();
		update_option( 'kilic_version', KILIC_VERSION );
	}
} );
