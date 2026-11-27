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

/** Alle Bildplätze der Website: Schlüssel => [Bezeichnung, wo es erscheint]. */
function kilic_bild_plaetze() {
	return array(
		'hero-start'        => array( 'Startseite – großes Kopfbild', 'Startseite oben' ),
		'hero-estrich'      => array( 'Estrich – Kopfbild', 'Estrich, Referenzen' ),
		'hero-boden'        => array( 'Boden – Kopfbild', 'Boden und Unterseiten' ),
		'hero-rohr'         => array( 'Rohrreinigung – Kopfbild', 'Rohrreinigung und Unterseiten' ),
		'hero-kontakt'      => array( 'Kontakt / Anfrage – Kopfbild', 'Kontakt, Angebot anfragen' ),
		'estrich-verteilen' => array( 'Estrich wird verteilt', 'Startseite Leistungskarte Estrich' ),
		'heizestrich'       => array( 'Heizestrich', 'Seite Heizestrich' ),
		'fliessestrich'     => array( 'Fließestrich', 'Seite Fließestrich' ),
		'zementestrich'     => array( 'Zementestrich', 'Seite Zementestrich' ),
		'schnellestrich'    => array( 'Schnellestrich', 'Seite Schnellestrich' ),
		'trockenestrich'    => array( 'Trockenestrich', 'Seite Trockenestrich' ),
		'industrie'         => array( 'Industrie- & Gefälleestrich', 'Seite Industrieestrich' ),
		'sanierung-vorher'  => array( 'Sanierung – vorher', 'Vorher/Nachher-Vergleich' ),
		'sanierung-nachher' => array( 'Sanierung – nachher', 'Vorher/Nachher, Bodensanierung' ),
		'bodenverlegung'    => array( 'Bodenverlegung', 'Seite Bodenverlegung, Leistungskarte' ),
		'ausgleichsmasse'   => array( 'Ausgleichsmasse', 'Seite Ausgleichen & Nivellieren' ),
		'rohrreinigung'     => array( 'Rohrreinigung', 'Leistungskarte Rohrreinigung' ),
		'notdienst'         => array( 'Notdienst', 'Seite 24/7 Notdienst' ),
		'kanal-tv'          => array( 'Kanal-TV', 'Seite Kanal-TV-Inspektion' ),
		'wartung'           => array( 'Wartung', 'Seite Wartung für Gewerbe' ),
		'meister'           => array( 'Inhaber / Meister', 'Über uns, Startseite' ),
		'werkzeug-estrich'  => array( 'Team: Vorarbeiter Estrich', 'Über uns – Team' ),
		'werkzeug-boden'    => array( 'Team: Bodenleger', 'Über uns – Team' ),
		'werkzeug-rohr'     => array( 'Team: Rohrreinigung', 'Über uns – Team' ),
		'ref-neubau'        => array( 'Referenz ohne Foto: Neubau', 'Referenzen' ),
		'ref-sanierung'     => array( 'Referenz ohne Foto: Sanierung', 'Referenzen' ),
		'ref-gewerbe'       => array( 'Referenz ohne Foto: Gewerbe', 'Referenzen' ),
		'ref-boden'         => array( 'Referenz ohne Foto: Bodenverlegung', 'Referenzen' ),
		'ref-rohr'          => array( 'Referenz ohne Foto: Rohrreinigung', 'Referenzen' ),
	);
}

/** Eigene Zuordnung aus dem Backend (Mediathek-ID je Bildplatz). */
function kilic_bild_zuordnung() {
	$z = get_option( 'kilic_bilder', array() );
	return is_array( $z ) ? $z : array();
}

/** Eingebautes Bild (Datei im Plugin) – ohne eigene Zuordnung. */
function kilic_ph_datei_url( $motiv ) {
	$motiv = sanitize_file_name( $motiv );
	foreach ( array( 'jpg', 'jpeg', 'png', 'webp' ) as $ext ) {
		if ( file_exists( KILIC_DIR . 'assets/img/ph/' . $motiv . '.' . $ext ) ) {
			return KILIC_URL . 'assets/img/ph/' . $motiv . '.' . $ext;
		}
	}
	return '';
}

/** Ersatz, solange für einen Platz kein eigenes Foto da ist: thematisch passendes vorhandenes Foto. */
function kilic_ph_ersatz() {
	return array(
		'zementestrich'    => 'estrich-verteilen',
		'schnellestrich'   => 'hero-estrich',
		'trockenestrich'   => 'hero-kontakt',
		'sanierung-vorher' => 'hero-kontakt',
		'sanierung-nachher'=> 'hero-boden',
		'rohrreinigung'    => 'hero-rohr',
		'notdienst'        => 'hero-rohr',
		'kanal-tv'         => 'hero-rohr',
		'wartung'          => 'industrie',
		'meister'          => 'hero-start',
		'werkzeug-estrich' => 'estrich-verteilen',
		'werkzeug-boden'   => 'bodenverlegung',
		'werkzeug-rohr'    => 'hero-rohr',
		'ref-neubau'       => 'heizestrich',
		'ref-sanierung'    => 'hero-boden',
		'ref-gewerbe'      => 'industrie',
		'ref-boden'        => 'bodenverlegung',
		'ref-rohr'         => 'hero-rohr',
	);
}

/** Eigenes Bild (Mediathek-Zuordnung oder Datei im Plugin) für genau diesen Platz. */
function kilic_ph_eigen_url( $motiv ) {
	$z = kilic_bild_zuordnung();
	if ( ! empty( $z[ $motiv ] ) ) {
		$u = wp_get_attachment_image_url( (int) $z[ $motiv ], 'full' );
		if ( $u ) {
			return $u;
		}
	}
	return kilic_ph_datei_url( $motiv );
}

/** URL zu einem Motiv: eigenes Foto, sonst thematisch passender Ersatz, sonst ''. */
function kilic_ph_url( $motiv ) {
	$u = kilic_ph_eigen_url( $motiv );
	if ( ! $u ) {
		$e = kilic_ph_ersatz();
		if ( isset( $e[ $motiv ] ) ) {
			$u = kilic_ph_eigen_url( $e[ $motiv ] );
		}
	}
	return $u;
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

/* ---------- Backend: Seite „Website-Bilder“ ---------- */

add_action( 'admin_menu', function () {
	add_submenu_page( 'kilic', 'Website-Bilder', 'Website-Bilder', 'edit_kilic_webseiten', 'kilic-bilder', 'kilic_render_bilder_seite' );
}, 20 );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
	if ( false !== strpos( (string) $hook, 'kilic-bilder' ) ) {
		wp_enqueue_media();
	}
} );

/** Dateiname → Bildplatz (z. B. „Heizestrich-1.JPG“ → heizestrich). */
function kilic_bild_platz_aus_dateiname( $name ) {
	$n = strtolower( remove_accents( pathinfo( $name, PATHINFO_FILENAME ) ) );
	$n = str_replace( array( 'ae', 'oe', 'ue', ' ', '_' ), array( 'a', 'o', 'u', '-', '-' ), $n );
	$n = preg_replace( '/-(scaled|\d+x\d+|\d+|kopie|copy|final)$/', '', $n );
	$n = trim( preg_replace( '/[^a-z0-9-]+/', '-', $n ), '-' );
	$keys = array_keys( kilic_bild_plaetze() );
	$norm = function ( $k ) {
		return str_replace( array( 'ae', 'oe', 'ue' ), array( 'a', 'o', 'u' ), $k );
	};
	foreach ( $keys as $k ) {
		if ( $n === $norm( $k ) ) {
			return $k;
		}
	}
	// längster Schlüssel, der im Namen vorkommt (z. B. „kilic-heizestrich-v2“)
	usort( $keys, function ( $a, $b ) {
		return strlen( $b ) - strlen( $a );
	} );
	foreach ( $keys as $k ) {
		if ( false !== strpos( $n, $norm( $k ) ) ) {
			return $k;
		}
	}
	return '';
}

function kilic_render_bilder_seite() {
	if ( ! current_user_can( 'edit_kilic_webseiten' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$z      = kilic_bild_zuordnung();
	$plaetze = kilic_bild_plaetze();
	$eigene = count( array_filter( array_intersect_key( $z, $plaetze ) ) );
	?>
	<div class="wrap kilic-wrap kb-bilder">
		<h1>Website-Bilder</h1>
		<p class="kb-intro">Hier legst du fest, welches Foto an welcher Stelle der Website erscheint. Eigene Bilder bleiben bei Plugin-Updates erhalten. <strong><?php echo (int) $eigene; ?> von <?php echo count( $plaetze ); ?></strong> Plätzen haben ein eigenes Bild.</p>
		<?php if ( isset( $_GET['ok'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="notice notice-success inline" role="status"><p><?php echo esc_html( sanitize_text_field( wp_unslash( $_GET['ok'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification ?></p></div>
		<?php endif; ?>
		<?php if ( ! empty( $_GET['offen'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="notice notice-warning inline"><p>Nicht automatisch zugeordnet (liegen in der Mediathek, unten per „Bild wählen“ zuweisen): <?php echo esc_html( sanitize_text_field( wp_unslash( $_GET['offen'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification ?></p></div>
		<?php endif; ?>

		<form class="kb-upload" data-ajax="<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>" method="post" enctype="multipart/form-data" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="kilic_bilder_upload">
			<?php wp_nonce_field( 'kilic_bilder_upload' ); ?>
			<label class="kb-drop" for="kb_dateien">
				<span class="dashicons dashicons-images-alt2"></span>
				<strong>Viele Bilder auf einmal hochladen</strong>
				<span>Alle Bilder aus deinem Ordner markieren (Strg + A) und hierher ziehen – oder tippen zum Auswählen.<br>Heißt eine Datei wie ein Bildplatz (z. B. <code>heizestrich.jpg</code>, <code>hero-start.png</code>), wird sie automatisch zugeordnet.</span>
				<input type="file" id="kb_dateien" name="kb_dateien[]" accept="image/jpeg,image/png,image/webp" multiple>
				<em class="kb-anzahl" aria-live="polite"></em>
			</label>
			<button type="submit" class="button button-primary button-hero kb-senden">Hochladen &amp; zuordnen</button>
			<div class="kb-fortschritt" hidden><div class="kb-balken"><span></span></div><p class="kb-status" aria-live="polite"></p></div>
		</form>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kb-scan">
			<input type="hidden" name="action" value="kilic_bilder_scan">
			<?php wp_nonce_field( 'kilic_bilder_scan' ); ?>
			<button type="submit" class="button">Bilder aus der Mediathek automatisch zuordnen</button>
			<span class="description">Für Bilder, die schon in der Mediathek liegen (z. B. nach einem abgebrochenen Upload).</span>
		</form>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kb-form">
			<input type="hidden" name="action" value="kilic_bilder_speichern">
			<?php wp_nonce_field( 'kilic_bilder_speichern' ); ?>
			<div class="kb-grid">
				<?php foreach ( $plaetze as $k => $info ) :
					$id  = (int) ( $z[ $k ] ?? 0 );
					$url = $id ? wp_get_attachment_image_url( $id, 'medium_large' ) : '';
					$def = kilic_ph_url( $k );
					?>
					<div class="kb-karte<?php echo $url ? ' is-eigen' : ''; ?>">
						<div class="kb-bild" style="background-image:url('<?php echo esc_url( $url ? $url : $def ); ?>')">
							<span class="kb-tag"><?php echo $url ? 'Eigenes Bild' : 'Platzhalter'; ?></span>
						</div>
						<div class="kb-text">
							<strong><?php echo esc_html( $info[0] ); ?></strong>
							<small><?php echo esc_html( $info[1] ); ?> · Dateiname: <code><?php echo esc_html( $k ); ?></code></small>
						</div>
						<input type="hidden" name="kilic_bild[<?php echo esc_attr( $k ); ?>]" value="<?php echo $id ? (int) $id : ''; ?>">
						<div class="kb-knoepfe">
							<button type="button" class="button kb-waehlen" data-label="<?php echo esc_attr( $info[0] ); ?>">Bild wählen</button>
							<?php if ( $id ) : ?><button type="button" class="button-link kb-weg">Platzhalter verwenden</button><?php endif; ?>
						</div>
					</div>
				<?php endforeach; ?>
			</div>
		</form>
	</div>
	<?php
}

add_action( 'admin_post_kilic_bilder_upload', function () {
	check_admin_referer( 'kilic_bilder_upload' );
	if ( ! current_user_can( 'edit_kilic_webseiten' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$z     = kilic_bild_zuordnung();
	$files = $_FILES['kb_dateien'] ?? null; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$ok    = 0;
	$neu   = 0;
	$offen = array();
	if ( $files && is_array( $files['name'] ) ) {
		$n = count( $files['name'] );
		for ( $i = 0; $i < $n; $i++ ) {
			if ( UPLOAD_ERR_OK !== $files['error'][ $i ] ) {
				continue;
			}
			$typ = wp_check_filetype_and_ext( $files['tmp_name'][ $i ], $files['name'][ $i ] );
			if ( ! in_array( $typ['type'], array( 'image/jpeg', 'image/png', 'image/webp' ), true ) ) {
				continue;
			}
			$file = array(
				'name'     => sanitize_file_name( $files['name'][ $i ] ),
				'type'     => $typ['type'],
				'tmp_name' => $files['tmp_name'][ $i ],
				'error'    => 0,
				'size'     => $files['size'][ $i ],
			);
			$id = media_handle_sideload( $file, 0, pathinfo( $files['name'][ $i ], PATHINFO_FILENAME ) );
			if ( is_wp_error( $id ) ) {
				continue;
			}
			$neu++;
			$platz = kilic_bild_platz_aus_dateiname( $files['name'][ $i ] );
			if ( $platz ) {
				$z[ $platz ] = (int) $id;
				$ok++;
			} else {
				$offen[] = sanitize_file_name( $files['name'][ $i ] );
			}
		}
	}
	update_option( 'kilic_bilder', $z, false );
	$args = array( 'page' => 'kilic-bilder', 'ok' => sprintf( '%d Bilder hochgeladen, %d automatisch zugeordnet.', $neu, $ok ) );
	if ( $offen ) {
		$args['offen'] = implode( ', ', array_slice( $offen, 0, 30 ) );
	}
	wp_safe_redirect( add_query_arg( array_map( 'rawurlencode', $args ), admin_url( 'admin.php' ) ) );
	exit;
} );

add_action( 'admin_post_kilic_bilder_speichern', function () {
	check_admin_referer( 'kilic_bilder_speichern' );
	if ( ! current_user_can( 'edit_kilic_webseiten' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$in = isset( $_POST['kilic_bild'] ) ? (array) wp_unslash( $_POST['kilic_bild'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$z  = array();
	foreach ( kilic_bild_plaetze() as $k => $info ) {
		$id = absint( $in[ $k ] ?? 0 );
		if ( $id && wp_attachment_is_image( $id ) ) {
			$z[ $k ] = $id;
		}
	}
	update_option( 'kilic_bilder', $z, false );
	wp_safe_redirect( add_query_arg( array( 'page' => 'kilic-bilder', 'ok' => rawurlencode( 'Gespeichert.' ) ), admin_url( 'admin.php' ) ) );
	exit;
} );

/** Weniger Vorschaugrößen beim Hochladen hier – schneller, kein Server-Timeout. */
function kilic_bilder_schnell( $sizes ) {
	return array_intersect_key( $sizes, array_flip( array( 'thumbnail', 'medium', 'medium_large' ) ) );
}

/** Vorhandenes Bild gleichen Namens in der Mediathek finden (verhindert Doppel-Uploads). */
function kilic_bild_in_mediathek( $dateiname ) {
	$titel = sanitize_title( pathinfo( $dateiname, PATHINFO_FILENAME ) );
	$q = get_posts( array( 'post_type' => 'attachment', 'post_mime_type' => 'image', 'name' => $titel, 'numberposts' => 1, 'fields' => 'ids', 'post_status' => 'inherit' ) );
	return $q ? (int) $q[0] : 0;
}

/** Ein Bild hochladen (per JavaScript einzeln nacheinander aufgerufen). */
add_action( 'wp_ajax_kilic_bild_einzeln', function () {
	check_ajax_referer( 'kilic_bilder_upload' );
	if ( ! current_user_can( 'edit_kilic_webseiten' ) ) {
		wp_send_json_error( array( 'text' => 'Keine Berechtigung.' ), 403 );
	}
	if ( empty( $_FILES['datei'] ) || UPLOAD_ERR_OK !== $_FILES['datei']['error'] ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		wp_send_json_error( array( 'text' => 'Datei zu groß oder fehlerhaft.' ) );
	}
	$name  = sanitize_file_name( wp_unslash( $_FILES['datei']['name'] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$platz = kilic_bild_platz_aus_dateiname( $name );
	$id    = kilic_bild_in_mediathek( $name );
	$neu   = false;
	if ( ! $id ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		$typ = wp_check_filetype_and_ext( $_FILES['datei']['tmp_name'], $name ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		if ( ! in_array( $typ['type'], array( 'image/jpeg', 'image/png', 'image/webp' ), true ) ) {
			wp_send_json_error( array( 'text' => $name . ': kein JPG/PNG/WebP.' ) );
		}
		add_filter( 'intermediate_image_sizes_advanced', 'kilic_bilder_schnell' );
		$id = media_handle_upload( 'datei', 0, array( 'post_title' => pathinfo( $name, PATHINFO_FILENAME ) ) );
		remove_filter( 'intermediate_image_sizes_advanced', 'kilic_bilder_schnell' );
		if ( is_wp_error( $id ) ) {
			wp_send_json_error( array( 'text' => $name . ': ' . $id->get_error_message() ) );
		}
		$neu = true;
	}
	if ( $platz ) {
		$z           = kilic_bild_zuordnung();
		$z[ $platz ] = (int) $id;
		update_option( 'kilic_bilder', $z, false );
	}
	wp_send_json_success( array( 'name' => $name, 'platz' => $platz, 'neu' => $neu ) );
} );

/** Bereits hochgeladene Bilder aus der Mediathek den Plätzen zuordnen (nach Dateiname). */
add_action( 'admin_post_kilic_bilder_scan', function () {
	check_admin_referer( 'kilic_bilder_scan' );
	if ( ! current_user_can( 'edit_kilic_webseiten' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$z   = kilic_bild_zuordnung();
	$ids = get_posts( array( 'post_type' => 'attachment', 'post_mime_type' => 'image', 'numberposts' => 500, 'fields' => 'ids', 'post_status' => 'inherit', 'orderby' => 'date', 'order' => 'ASC' ) );
	$n   = 0;
	foreach ( $ids as $id ) {
		$platz = kilic_bild_platz_aus_dateiname( basename( (string) get_attached_file( $id ) ) );
		if ( $platz ) {
			$z[ $platz ] = (int) $id;
			$n++;
		}
	}
	update_option( 'kilic_bilder', $z, false );
	wp_safe_redirect( add_query_arg( array( 'page' => 'kilic-bilder', 'ok' => rawurlencode( $n . ' Bilder aus der Mediathek zugeordnet.' ) ), admin_url( 'admin.php' ) ) );
	exit;
} );
