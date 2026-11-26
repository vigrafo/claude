<?php
/**
 * Gemeinsame Hilfsfunktionen: Firmendaten, Platzhalter, Geldbeträge, Icons.
 */

defined( 'ABSPATH' ) || exit;

/** Standardwerte der Einstellungen. */
function kilic_defaults() {
	return array(
		'firma'          => 'Kilic Estrich Meisterbetrieb',
		'firma2'         => 'K & K Rohrreinigung',
		'logo'           => '',
		'inhaber'        => 'Fikret Kilic',
		'strasse'        => 'Heidelberger Str. 57',
		'plz_ort'        => '74821 Mosbach-Diedesheim',
		'telefon'        => '+49 6261 670200',
		'notdienst'      => '+49 6261 670200',
		'email'          => 'info@kilic-estrich.de',
		'web'            => 'kilic.vigrafo.de',
		'oeffnungszeiten'=> 'Mo–Fr 7:00–17:00 Uhr',
		'ust_id'         => 'DE000000000 (Platzhalter)',
		'steuernr'       => '00000/00000 (Platzhalter)',
		'bank'           => 'Musterbank (Platzhalter)',
		'iban'           => 'DE00 0000 0000 0000 0000 00 (Platzhalter)',
		'bic'            => 'XXXXDEXXXXX (Platzhalter)',
		'mwst'           => '19',
		'zahlungsziel'   => '14',
		're_prefix'      => 'RE',
		'an_prefix'      => 'AN',
		're_next'        => '1',
		'an_next'        => '1',
		're_text_oben'   => 'Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Leistungen:',
		're_text_unten'  => 'Bitte überweisen Sie den Rechnungsbetrag ohne Abzug bis zum angegebenen Fälligkeitsdatum unter Angabe der Rechnungsnummer.',
		'an_text_oben'   => 'Vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen folgende Leistungen an:',
		'an_text_unten'  => 'Dieses Angebot ist 30 Tage gültig. Wir freuen uns auf Ihren Auftrag.',
		'empfaenger'     => '',
		'bestaetigung'   => '1',
	);
}

/** Einzelne Einstellung lesen. */
function kilic_opt( $key ) {
	$opts = get_option( 'kilic_settings', array() );
	$def  = kilic_defaults();
	if ( isset( $opts[ $key ] ) && '' !== $opts[ $key ] ) {
		return $opts[ $key ];
	}
	return $def[ $key ] ?? '';
}

/** Steht für dieses Feld noch der Platzhalter aus der Einrichtung drin? */
function kilic_ist_platzhalter( $key ) {
	return kilic_opt( $key ) === ( kilic_defaults()[ $key ] ?? null ) && in_array( $key, array( 'email', 'ust_id', 'steuernr', 'bank', 'iban', 'bic' ), true );
}

/** Telefonnummer für tel:-Links. */
function kilic_tel_href( $number ) {
	$n = preg_replace( '/[^0-9+]/', '', (string) $number );
	return 'tel:' . $n;
}

/** E-Mail-Empfänger für Anfragen. */
function kilic_empfaenger() {
	$e = kilic_opt( 'empfaenger' );
	if ( ! $e && ! kilic_ist_platzhalter( 'email' ) ) {
		$e = kilic_opt( 'email' );
	}
	return $e ? $e : get_option( 'admin_email' );
}

/**
 * Platzhalter in Seiteninhalten ersetzen. So pflegt der Kunde Telefonnummer &
 * Co. nur einmal unter „Kilic Betrieb → Einstellungen“.
 */
function kilic_tokens() {
	$home = untrailingslashit( home_url() );
	return array(
		'{{home}}'           => $home,
		'{{assets}}'         => KILIC_URL . 'assets',
		'{{firma}}'          => esc_html( kilic_opt( 'firma' ) ),
		'{{firma2}}'         => esc_html( kilic_opt( 'firma2' ) ),
		'{{inhaber}}'        => esc_html( kilic_opt( 'inhaber' ) ),
		'{{strasse}}'        => esc_html( kilic_opt( 'strasse' ) ),
		'{{plz_ort}}'        => esc_html( kilic_opt( 'plz_ort' ) ),
		'{{telefon}}'        => esc_html( kilic_opt( 'telefon' ) ),
		'{{telefon_link}}'   => esc_attr( kilic_tel_href( kilic_opt( 'telefon' ) ) ),
		'{{notdienst}}'      => esc_html( kilic_opt( 'notdienst' ) ),
		'{{notdienst_link}}' => esc_attr( kilic_tel_href( kilic_opt( 'notdienst' ) ) ),
		'{{email}}'          => esc_html( kilic_opt( 'email' ) ),
		'{{oeffnungszeiten}}'=> esc_html( kilic_opt( 'oeffnungszeiten' ) ),
		'{{jahr}}'           => gmdate( 'Y' ),
	);
}

function kilic_replace_tokens( $html ) {
	if ( false === strpos( (string) $html, '{{' ) ) {
		return $html;
	}
	$t = kilic_tokens();
	return strtr( $html, $t );
}

/** Cent-Betrag als Euro formatieren. */
function kilic_eur( $cents ) {
	return number_format( ( (int) $cents ) / 100, 2, ',', '.' ) . ' €';
}

/** Eingabe „1.234,56“ oder „1234.56“ in Cent umrechnen. */
function kilic_to_cents( $value ) {
	$v = trim( (string) $value );
	if ( '' === $v ) {
		return 0;
	}
	$v = str_replace( array( '€', ' ' ), '', $v );
	if ( false !== strpos( $v, ',' ) ) {
		$v = str_replace( '.', '', $v );
		$v = str_replace( ',', '.', $v );
	}
	return (int) round( (float) $v * 100 );
}

/** Menge „12,5“ → 12.5 */
function kilic_to_float( $value ) {
	$v = str_replace( ' ', '', (string) $value );
	if ( false !== strpos( $v, ',' ) ) {
		$v = str_replace( array( '.', ',' ), array( '', '.' ), $v );
	}
	return (float) $v;
}

function kilic_num( $value, $dec = 2 ) {
	$s = number_format( (float) $value, $dec, ',', '.' );
	return rtrim( rtrim( $s, '0' ), ',' );
}

function kilic_date( $ymd ) {
	if ( ! $ymd ) {
		return '';
	}
	$ts = strtotime( $ymd );
	return $ts ? gmdate( 'd.m.Y', $ts ) : '';
}

/** Icon-Pfade (Feather-Stil, Strichstärke 2). */
function kilic_icon_paths() {
	return array(
		'phone'     => '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
		'mail'      => '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
		'pin'       => '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
		'clock'     => '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
		'check'     => '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14l-3-3"/>',
		'arrow'     => '<path d="M5 12h14M13 5l7 7-7 7"/>',
		'up'        => '<path d="M12 19V5M5 12l7-7 7 7"/>',
		'medal'     => '<circle cx="12" cy="9" r="6"/><path d="m8.2 13.8-1.7 8.2 5.5-3 5.5 3-1.7-8.2"/>',
		'layers'    => '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
		'flame'     => '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.5 2.8 2.5 2.8z"/>',
		'tool'      => '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
		'grid'      => '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
		'drop'      => '<path d="M12 2.7 5.6 9.1a9 9 0 1 0 12.8 0z"/>',
		'pipe'      => '<path d="M3 7h8v4h10"/><path d="M3 11h4v6"/><path d="M21 7v8"/><path d="M11 7V3"/><path d="M7 17H3"/>',
		'camera'    => '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
		'home'      => '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
		'building'  => '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
		'warehouse' => '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><path d="M6 18h12M6 14h12M6 22V10h12v12"/>',
		'apartment' => '<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>',
		'garage'    => '<path d="M2 20V9l10-6 10 6v11"/><path d="M6 20v-8h12v8M6 15h12M6 18h12"/>',
		'wrench'    => '<path d="M2 22 12 12"/><path d="M15 3a6 6 0 0 0-3 8.6l9.4 9.4"/><path d="M15 3a6 6 0 0 1 6 6"/>',
		'alert'     => '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
		'upload'    => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
		'calc'      => '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h4"/>',
		'shield'    => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
		'truck'     => '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
		'euro'      => '<path d="M4 10h12M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
	);
}

/** Inline-SVG-Icon für PHP-Templates. */
function kilic_icon( $name ) {
	$p = kilic_icon_paths();
	if ( ! isset( $p[ $name ] ) ) {
		return '';
	}
	return '<svg class="ki-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $p[ $name ] . '</svg>';
}

/**
 * Icons in Seiteninhalten werden als <span class="ki ki-NAME"></span> notiert
 * und per CSS-Maske gezeichnet – so bleiben sie im Divi-Texteditor erhalten.
 */
function kilic_icon_css() {
	$css = '';
	foreach ( kilic_icon_paths() as $name => $path ) {
		$svg  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . $path . '</svg>';
		$css .= '.ki-' . $name . '{--ki:url("data:image/svg+xml,' . rawurlencode( $svg ) . '")}';
	}
	return $css;
}

/** Leistungen des Anfrage-Assistenten. */
function kilic_leistungen() {
	return array( 'Estrich', 'Bodensanierung', 'Bodenverlegung', 'Rohrreinigung', 'Kontakt' );
}

/**
 * Logo im Firmendesign (Zeichen + Wortmarke) – oder ein eigenes Logo aus den
 * Einstellungen. $variante: 'hell' für helle, 'dunkel' für dunkle Hintergründe.
 */
function kilic_logo_html( $variante = 'hell' ) {
	$eigen = kilic_opt( 'logo' );
	if ( $eigen ) {
		return '<img class="kilic-logo-img" src="' . esc_url( $eigen ) . '" alt="' . esc_attr( kilic_opt( 'firma' ) ) . '">';
	}
	$name  = preg_replace( '/\s+Meisterbetrieb$/i', '', kilic_opt( 'firma' ) );
	$parts = explode( ' ', $name, 2 );
	$ort   = trim( preg_replace( '/^\d+\s*/', '', explode( '-', kilic_opt( 'plz_ort' ) )[0] ) );
	$farbe = 'dunkel' === $variante ? '#ffffff' : '#1b1f23';
	return kilic_logo_zeichen() . '<span class="kilic-logo-text"><strong style="color:' . $farbe . '">' . esc_html( $parts[0] ) . ( isset( $parts[1] ) ? ' <em>' . esc_html( $parts[1] ) . '</em>' : '' ) . '</strong><small>Meisterbetrieb · ' . esc_html( $ort ) . '</small></span>';
}

/** Bildzeichen: drei Estrichschichten mit „K K“. */
function kilic_logo_zeichen( $class = 'logo-mark' ) {
	return '<svg class="' . esc_attr( $class ) . '" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="8" fill="#1b1f23"/><rect x="8" y="30" width="32" height="6" rx="1" fill="#e8892b"/><rect x="8" y="22" width="32" height="5" rx="1" fill="#8f8c87"/><rect x="8" y="15" width="32" height="4" rx="1" fill="#c9c5bd"/><path d="M14 8v6M14 11l6-3M14 11l6 3" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M26 8v6M26 11l6-3M26 11l6 3" stroke="#e8892b" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>';
}
