<?php
/**
 * Inhaltstypen: Anfragen, Kunden, Belege (Angebote/Rechnungen), Referenzen.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'kilic_register_post_types' );

function kilic_register_post_types() {
	$intern = array(
		'public'              => false,
		'show_ui'             => true,
		'show_in_menu'        => 'kilic',
		'show_in_rest'        => false,
		'exclude_from_search' => true,
		'capability_type'     => array( 'kilic_vorgang', 'kilic_vorgaenge' ),
		'map_meta_cap'        => true,
		'supports'            => array( 'title' ),
	);

	register_post_type( 'kilic_anfrage', array_merge( $intern, array(
		'labels' => array(
			'name'          => 'Anfragen',
			'singular_name' => 'Anfrage',
			'menu_name'     => 'Anfragen',
			'all_items'     => 'Anfragen',
			'add_new'       => 'Anfrage erfassen',
			'add_new_item'  => 'Anfrage erfassen (z. B. Telefon)',
			'edit_item'     => 'Anfrage',
			'search_items'  => 'Anfragen durchsuchen',
			'not_found'     => 'Noch keine Anfragen.',
		),
	) ) );

	register_post_type( 'kilic_kunde', array_merge( $intern, array(
		'labels' => array(
			'name'          => 'Kunden',
			'singular_name' => 'Kunde',
			'all_items'     => 'Kunden',
			'add_new'       => 'Kunde anlegen',
			'add_new_item'  => 'Kunde anlegen',
			'edit_item'     => 'Kunde bearbeiten',
			'search_items'  => 'Kunden durchsuchen',
			'not_found'     => 'Noch keine Kunden.',
			'title_placeholder' => 'Name des Kunden (z. B. Max Mustermann)',
		),
	) ) );

	register_post_type( 'kilic_beleg', array_merge( $intern, array(
		'labels' => array(
			'name'          => 'Angebote & Rechnungen',
			'singular_name' => 'Beleg',
			'all_items'     => 'Angebote & Rechnungen',
			'add_new'       => 'Neuer Beleg',
			'add_new_item'  => 'Neues Angebot / neue Rechnung',
			'edit_item'     => 'Beleg bearbeiten',
			'search_items'  => 'Belege durchsuchen',
			'not_found'     => 'Noch keine Angebote oder Rechnungen.',
		),
		'supports' => array( 'title' ),
	) ) );

	register_post_type( 'kilic_referenz', array(
		'labels' => array(
			'name'          => 'Referenzen',
			'singular_name' => 'Referenz',
			'all_items'     => 'Referenzen',
			'add_new'       => 'Referenz hinzufügen',
			'add_new_item'  => 'Neues Referenzprojekt',
			'edit_item'     => 'Referenz bearbeiten',
			'featured_image'=> 'Projektfoto',
			'set_featured_image' => 'Projektfoto festlegen',
		),
		'public'       => true,
		'show_ui'      => true,
		'show_in_menu' => 'kilic',
		'show_in_rest' => true,
		'has_archive'  => false,
		'rewrite'      => array( 'slug' => 'projekt' ),
		'supports'     => array( 'title', 'editor', 'thumbnail' ),
		'capability_type' => array( 'kilic_webseite', 'kilic_webseiten' ),
		'map_meta_cap'    => true,
	) );

	register_taxonomy( 'kilic_ref_kat', 'kilic_referenz', array(
		'labels' => array(
			'name'          => 'Projektarten',
			'singular_name' => 'Projektart',
			'add_new_item'  => 'Projektart hinzufügen',
		),
		'public'            => false,
		'show_ui'           => true,
		'show_admin_column' => true,
		'show_in_rest'      => true,
		'hierarchical'      => true,
		'capabilities'      => array( 'manage_terms' => 'edit_kilic_webseiten', 'edit_terms' => 'edit_kilic_webseiten', 'delete_terms' => 'edit_kilic_webseiten', 'assign_terms' => 'edit_kilic_webseiten' ),
	) );
}

/** Rechte für Büro-Verwaltung. */
function kilic_caps() {
	return array(
		'edit_kilic_vorgang', 'read_kilic_vorgang', 'delete_kilic_vorgang',
		'edit_kilic_vorgaenge', 'edit_others_kilic_vorgaenge', 'publish_kilic_vorgaenge',
		'read_private_kilic_vorgaenge', 'delete_kilic_vorgaenge', 'delete_private_kilic_vorgaenge',
		'delete_published_kilic_vorgaenge', 'delete_others_kilic_vorgaenge',
		'edit_private_kilic_vorgaenge', 'edit_published_kilic_vorgaenge',
		'kilic_buero',
	);
}

/** Rechte für die Website (Referenzen, Website-Bilder) – nur Inhaber/Admin. */
function kilic_webseiten_caps() {
	return array(
		'edit_kilic_webseite', 'read_kilic_webseite', 'delete_kilic_webseite',
		'edit_kilic_webseiten', 'edit_others_kilic_webseiten', 'publish_kilic_webseiten',
		'read_private_kilic_webseiten', 'delete_kilic_webseiten', 'delete_private_kilic_webseiten',
		'delete_published_kilic_webseiten', 'delete_others_kilic_webseiten',
		'edit_private_kilic_webseiten', 'edit_published_kilic_webseiten',
	);
}

function kilic_install_roles() {
	$admin = get_role( 'administrator' );
	if ( $admin ) {
		foreach ( array_merge( kilic_caps(), kilic_webseiten_caps() ) as $cap ) {
			$admin->add_cap( $cap );
		}
	}
	// Rolle „Büro“: verwaltet Anfragen, Kunden, Belege und Referenzen, aber keine Plugins/Themes.
	remove_role( 'kilic_buero' );
	// Bewusst ohne Beitrags-/Seitenrechte: Büro ändert nichts an der Website.
	$caps = array(
		'read'         => true,
		'upload_files' => true,
	);
	foreach ( kilic_caps() as $cap ) {
		$caps[ $cap ] = true;
	}
	add_role( 'kilic_buero', 'Büro (Kilic)', $caps );
}
