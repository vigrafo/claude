<?php
/**
 * Thematische Platzhalterbilder (assets/img/ph/*.webp|jpg|png).
 *
 * Seiteninhalte enthalten noch die alten einfarbigen SVG-Platzhalter
 * (assets/img/ph-<dunkel|grau|warm|blau>.svg). Ein Inhaltsfilter tauscht sie
 * anhand von Seite und Alt-Text gegen das passende Motiv. Eigene Bilder aus der
 * Mediathek bleiben unberührt. Zum Austauschen eine Datei gleichen Namens
 * (webp, jpg oder png) in assets/img/ph/ ablegen.
 */

defined( 'ABSPATH' ) || exit;

/** URL zu einem Motiv – bevorzugt jpg/png (eigene Fotos), sonst webp. '' wenn keine Datei existiert. */
function kilic_ph_url( $motiv ) {
	$motiv = sanitize_file_name( $motiv );
	foreach ( array( 'jpg', 'jpeg', 'png', 'webp' ) as $ext ) {
		if ( file_exists( KILIC_DIR . 'assets/img/ph/' . $motiv . '.' . $ext ) ) {
			return KILIC_URL . 'assets/img/ph/' . $motiv . '.' . $ext;
		}
	}
	return '';
}

/** Hero-Motiv je Seite (Unterseiten erben vom Bereich). */
function kilic_ph_hero( $slug, $parent = '' ) {
	$map = array(
		'start'            => 'hero-start',
		'estrich'          => 'hero-estrich',
		'boden'            => 'hero-boden',
		'rohrreinigung'    => 'hero-rohr',
		'referenzen'       => 'hero-estrich',
		'ueber-uns'        => 'meister',
		'karriere'         => 'meister',
		'angebot-anfragen' => 'hero-kontakt',
		'kontakt'          => 'hero-kontakt',
	);
	if ( isset( $map[ $slug ] ) ) {
		return $map[ $slug ];
	}
	if ( isset( $map[ $parent ] ) ) {
		return $map[ $parent ];
	}
	return 'hero-kontakt';
}

/** Motiv für ein Inhaltsbild anhand Alt-Text, Seite und alter Farbvariante. */
function kilic_ph_motiv( $slug, $alt, $variante ) {
	$alt = trim( html_entity_decode( wp_strip_all_tags( $alt ), ENT_QUOTES, 'UTF-8' ) );
	$alt_map = array(
		'Estrich wird verteilt'          => 'estrich-verteilen',
		'Altbausanierung'                => 'sanierung-nachher',
		'Bodensanierung'                 => 'sanierung-nachher',
		'Vinylboden'                     => 'bodenverlegung',
		'Bodenverlegung'                 => 'bodenverlegung',
		'Rohrreinigung'                  => 'rohrreinigung',
		'Ausgleichsmasse'                => 'ausgleichsmasse',
		'Ausgleichsmassen & Nivellieren' => 'ausgleichsmasse',
		'Vorher'                         => 'sanierung-vorher',
		'Nachher'                        => 'sanierung-nachher',
		'Fikret Kilic auf der Baustelle' => 'meister',
		'Fikret Kilic'                   => 'meister',
		'Heizestrich'                    => 'heizestrich',
		'Fließestrich'                   => 'fliessestrich',
		'Zementestrich'                  => 'zementestrich',
		'Schnellestrich'                 => 'schnellestrich',
		'Trockenestrich'                 => 'trockenestrich',
		'Industrie- & Gefälleestrich'    => 'industrie',
		'24/7 Notdienst'                 => 'notdienst',
		'Kanal-TV-Inspektion'            => 'kanal-tv',
		'Wartung für Gewerbe'            => 'wartung',
	);
	if ( isset( $alt_map[ $alt ] ) ) {
		return $alt_map[ $alt ];
	}
	if ( 'Teammitglied' === $alt ) {
		return 'blau' === $variante ? 'werkzeug-rohr' : ( 'warm' === $variante ? 'werkzeug-boden' : 'werkzeug-estrich' );
	}
	$fallback = array( 'grau' => 'estrich-verteilen', 'warm' => 'sanierung-nachher', 'blau' => 'rohrreinigung', 'dunkel' => 'industrie' );
	return $fallback[ $variante ] ?? 'estrich-verteilen';
}

/** Sachliche Alt-Texte für die Motive (falls das Bild keinen eigenen hat). */
function kilic_ph_alt( $motiv ) {
	$alt = array(
		'hero-start' => 'Estrichleger zieht frischen Estrich ab', 'hero-estrich' => 'Frisch abgezogene Estrichfläche im Neubau',
		'hero-boden' => 'Neu verlegter Boden', 'hero-rohr' => 'Rohrreinigung am Abwasserschacht', 'hero-kontakt' => 'Fertiger Estrich im Rohbau',
		'meister' => 'Handwerksmeister mit Wasserwaage',
	);
	return $alt[ $motiv ] ?? '';
}

/** Alte SVG-Platzhalter in Seiteninhalten gegen Motive tauschen. */
add_filter( 'the_content', function ( $html ) {
	if ( false === strpos( $html, '/img/ph-' ) ) {
		return $html;
	}
	$post   = get_post();
	$slug   = $post ? $post->post_name : '';
	$parent = ( $post && $post->post_parent ) ? get_post_field( 'post_name', $post->post_parent ) : '';
	return preg_replace_callback(
		'#<img\b[^>]*?/assets/img/ph-(dunkel|grau|warm|blau)\.svg[^>]*>#i',
		function ( $m ) use ( $slug, $parent ) {
			$tag  = $m[0];
			preg_match( '#alt="([^"]*)"#', $tag, $a );
			$alt  = $a[1] ?? '';
			$hero = false !== strpos( $tag, 'hero-img' );
			$motiv = $hero ? kilic_ph_hero( $slug, $parent ) : kilic_ph_motiv( $slug, $alt, strtolower( $m[1] ) );
			$url   = kilic_ph_url( $motiv );
			if ( ! $url ) {
				return $tag;
			}
			$tag = preg_replace( '#src="[^"]*"#', 'src="' . esc_url( $url ) . '"', $tag );
			if ( $hero ) {
				$tag = str_replace( ' loading="lazy"', '', $tag );
				$tag = str_replace( '<img ', '<img fetchpriority="high" ', $tag );
			}
			if ( '' === $alt && ! $hero && kilic_ph_alt( $motiv ) ) {
				$tag = str_replace( 'alt=""', 'alt="' . esc_attr( kilic_ph_alt( $motiv ) ) . '"', $tag );
			}
			return $tag;
		},
		$html
	);
}, 101 );

/** Ersatzbild für Referenzen ohne Projektfoto, passend zur Projektart. */
function kilic_ph_referenz( $kat_slugs ) {
	$map = array( 'rohrreinigung' => 'ref-rohr', 'sanierung' => 'ref-sanierung', 'gewerbe' => 'ref-gewerbe', 'bodenverlegung' => 'ref-boden', 'neubau' => 'ref-neubau' );
	foreach ( $map as $kat => $motiv ) {
		if ( in_array( $kat, (array) $kat_slugs, true ) && kilic_ph_url( $motiv ) ) {
			return kilic_ph_url( $motiv );
		}
	}
	return kilic_ph_url( 'ref-neubau' );
}
