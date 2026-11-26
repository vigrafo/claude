<?php
/**
 * Website: Seitenvorlage „Kilic Layout“, Header/Footer, Assets, Shortcodes,
 * Platzhalter und Divi-Kompatibilität.
 */

defined( 'ABSPATH' ) || exit;

/* ---------- Seitenvorlage ---------- */

add_filter( 'theme_page_templates', function ( $templates ) {
	$templates[ KILIC_TEMPLATE ] = 'Kilic Layout (Header, Footer, Notdienst)';
	return $templates;
} );

function kilic_is_layout() {
	if ( is_singular( 'kilic_referenz' ) ) {
		return true;
	}
	if ( is_front_page() && 'page' === get_option( 'show_on_front' ) ) {
		return KILIC_TEMPLATE === get_page_template_slug( get_option( 'page_on_front' ) );
	}
	return is_page() && KILIC_TEMPLATE === get_page_template_slug( get_queried_object_id() );
}

add_filter( 'template_include', function ( $template ) {
	if ( kilic_is_layout() ) {
		return KILIC_DIR . 'templates/layout.php';
	}
	return $template;
}, 99 );

add_filter( 'body_class', function ( $classes ) {
	if ( kilic_is_layout() ) {
		$classes[] = 'kilic-site';
	}
	return $classes;
} );

add_action( 'after_setup_theme', function () {
	register_nav_menus( array(
		'kilic-haupt'        => 'Kilic: Hauptmenü',
		'kilic-footer'       => 'Kilic: Footer „Estrich & Boden“',
		'kilic-footer-2'     => 'Kilic: Footer „Unternehmen“',
		'kilic-rechtliches'  => 'Kilic: Impressum/Datenschutz',
	) );
	add_theme_support( 'post-thumbnails' );
} );

/* ---------- Assets ---------- */

add_action( 'wp_enqueue_scripts', function () {
	if ( ! kilic_is_layout() ) {
		return;
	}
	wp_enqueue_style( 'kilic', KILIC_URL . 'assets/css/kilic.css', array(), KILIC_VERSION );
	wp_add_inline_style( 'kilic', kilic_icon_css() );
	wp_enqueue_script( 'kilic', KILIC_URL . 'assets/js/kilic.js', array(), KILIC_VERSION, true );
}, 20 );

/* ---------- Inhalte: Platzhalter, Absätze, Divi-Fallback ---------- */

add_filter( 'the_content', function ( $content ) {
	return kilic_is_layout() ? kilic_replace_tokens( $content ) : $content;
}, 100 );

/**
 * Unsere Abschnitte sind fertiges HTML – automatische Absätze (wpautop) würden
 * leere <p> und Lücken erzeugen. Gilt auch mit Divi.
 */
add_action( 'wp', function () {
	if ( kilic_is_layout() ) {
		remove_filter( 'the_content', 'wpautop' );
		remove_filter( 'the_content', 'wptexturize' );
	}
}, 99 );

/** Zusätzlich direkt vor jedem Inhalts-Durchlauf, falls ein Builder wpautop wieder anmeldet. */
add_filter( 'the_content', function ( $content ) {
	if ( kilic_is_layout() ) {
		remove_filter( 'the_content', 'wpautop' );
	}
	return $content;
}, 1 );

function kilic_divi_aktiv() {
	return function_exists( 'et_setup_theme' ) || defined( 'ET_BUILDER_PLUGIN_VERSION' ) || class_exists( 'ET_Builder_Element' );
}

/**
 * Ohne Divi werden die Divi-Shortcodes der Seiteninhalte als einfache
 * Container ausgegeben. Mit Divi übernimmt der Divi Builder.
 */
add_action( 'init', function () {
	if ( kilic_divi_aktiv() ) {
		return;
	}
	foreach ( array( 'et_pb_section', 'et_pb_row', 'et_pb_column', 'et_pb_text', 'et_pb_code' ) as $tag ) {
		if ( ! shortcode_exists( $tag ) ) {
			add_shortcode( $tag, function ( $atts, $content = '' ) {
				return do_shortcode( (string) $content );
			} );
		}
	}
}, 20 );

/** Im Block-Editor würden die Abschnitte zerlegt – Kilic-Seiten nutzen den klassischen Editor bzw. Divi. */
add_filter( 'use_block_editor_for_post', function ( $use, $post ) {
	if ( $post && 'page' === $post->post_type && KILIC_TEMPLATE === get_page_template_slug( $post ) ) {
		return false;
	}
	return $use;
}, 10, 2 );

/* ---------- Header & Footer ---------- */

function kilic_logo( $footer = false ) {
	$mark = '<svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="8" fill="#1b1f23"/><rect x="8" y="30" width="32" height="6" rx="1" fill="#e8892b"/><rect x="8" y="22" width="32" height="5" rx="1" fill="#8f8c87"/><rect x="8" y="15" width="32" height="4" rx="1" fill="#c9c5bd"/><path d="M14 8v6M14 11l6-3M14 11l6 3" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M26 8v6M26 11l6-3M26 11l6 3" stroke="#e8892b" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>';
	$name  = kilic_opt( 'firma' );
	$parts = explode( ' ', preg_replace( '/\s+Meisterbetrieb$/i', '', $name ), 2 );
	$word1 = $parts[0];
	$word2 = $parts[1] ?? '';
	$ort   = trim( preg_replace( '/^\d+\s*/', '', explode( '-', kilic_opt( 'plz_ort' ) )[0] ) );
	return '<a class="logo" href="' . esc_url( home_url( '/' ) ) . '" aria-label="' . esc_attr( $name ) . ' – Startseite">' . $mark . '<span class="logo-text"><strong>' . esc_html( $word1 ) . ( $word2 ? ' <em>' . esc_html( $word2 ) . '</em>' : '' ) . '</strong><small>Meisterbetrieb · ' . esc_html( $ort ) . '</small></span></a>';
}

function kilic_seite_url( $pfad ) {
	$p = get_page_by_path( $pfad );
	return $p ? get_permalink( $p ) : home_url( '/' . $pfad . '/' );
}

function kilic_header() {
	$notdienst = kilic_opt( 'notdienst' );
	?>
	<a class="screen-reader-text skip-link" href="#kilic-main">Zum Inhalt springen</a>
	<div class="topbar">
		<div class="wrap">
			<div class="topbar-info">
				<span><span class="ki ki-pin"></span> <?php echo esc_html( kilic_opt( 'strasse' ) . ', ' . kilic_opt( 'plz_ort' ) ); ?></span>
				<span><span class="ki ki-clock"></span> <?php echo esc_html( kilic_opt( 'oeffnungszeiten' ) ); ?></span>
				<span><span class="ki ki-medal"></span> Meisterbetrieb</span>
			</div>
			<a class="topbar-emergency" href="<?php echo esc_attr( kilic_tel_href( $notdienst ) ); ?>"><i class="pulse"></i> Rohrreinigung 24/7 Notdienst: <?php echo esc_html( $notdienst ); ?></a>
		</div>
	</div>
	<header class="site-header">
		<div class="wrap">
			<?php echo kilic_logo(); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			<nav class="main-nav" aria-label="Hauptmenü">
				<?php
				wp_nav_menu( array(
					'theme_location' => 'kilic-haupt',
					'container'      => false,
					'menu_class'     => 'menu',
					'depth'          => 2,
					'fallback_cb'    => 'kilic_menu_fallback',
				) );
				?>
			</nav>
			<div class="header-cta">
				<a class="header-phone" href="<?php echo esc_attr( kilic_tel_href( kilic_opt( 'telefon' ) ) ); ?>"><small>Rufen Sie uns an</small><strong><?php echo esc_html( kilic_opt( 'telefon' ) ); ?></strong></a>
				<a class="btn btn-accent" href="<?php echo esc_url( kilic_seite_url( 'angebot-anfragen' ) ); ?>">Angebot anfragen</a>
				<button class="nav-toggle" type="button" aria-label="Menü öffnen" aria-expanded="false"><span></span><span></span><span></span></button>
			</div>
		</div>
	</header>
	<?php
}

function kilic_menu_fallback() {
	echo '<ul class="menu">';
	wp_list_pages( array( 'title_li' => '', 'depth' => 2, 'sort_column' => 'menu_order', 'exclude' => implode( ',', array_filter( array( kilic_page_id( 'impressum' ), kilic_page_id( 'datenschutz' ), kilic_page_id( 'angebot-anfragen' ) ) ) ) ) );
	echo '</ul>';
}

function kilic_page_id( $path ) {
	$p = get_page_by_path( $path );
	return $p ? $p->ID : 0;
}

function kilic_footer() {
	$notdienst = kilic_opt( 'notdienst' );
	?>
	<footer class="site-footer">
		<div class="wrap footer-top">
			<div class="footer-brand">
				<?php echo kilic_logo( true ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				<p>Ihr Meisterbetrieb für Estrich, Bodensanierung und Bodenverlegung im Neckar-Odenwald-Kreis – plus <?php echo esc_html( kilic_opt( 'firma2' ) ); ?> mit 24/7 Notdienst.</p>
				<div class="footer-emergency"><small>Rohrreinigung Notdienst · 24/7 · auch sonntags</small><a href="<?php echo esc_attr( kilic_tel_href( $notdienst ) ); ?>"><?php echo esc_html( $notdienst ); ?></a></div>
			</div>
			<div>
				<h5>Estrich &amp; Boden</h5>
				<?php wp_nav_menu( array( 'theme_location' => 'kilic-footer', 'container' => false, 'depth' => 1, 'fallback_cb' => '__return_false' ) ); ?>
			</div>
			<div>
				<h5>Unternehmen</h5>
				<?php wp_nav_menu( array( 'theme_location' => 'kilic-footer-2', 'container' => false, 'depth' => 1, 'fallback_cb' => '__return_false' ) ); ?>
			</div>
			<div>
				<h5>Kontakt</h5>
				<ul>
					<li><?php echo esc_html( kilic_opt( 'firma' ) ); ?><br><?php echo esc_html( kilic_opt( 'firma2' ) ); ?><br>Inh. <?php echo esc_html( kilic_opt( 'inhaber' ) ); ?></li>
					<li><?php echo esc_html( kilic_opt( 'strasse' ) ); ?><br><?php echo esc_html( kilic_opt( 'plz_ort' ) ); ?></li>
					<li><a href="<?php echo esc_attr( kilic_tel_href( kilic_opt( 'telefon' ) ) ); ?>">Tel. <?php echo esc_html( kilic_opt( 'telefon' ) ); ?></a></li>
					<?php if ( kilic_opt( 'email' ) ) : ?>
						<li><a href="mailto:<?php echo esc_attr( kilic_opt( 'email' ) ); ?>"><?php echo esc_html( kilic_opt( 'email' ) ); ?></a></li>
					<?php endif; ?>
				</ul>
			</div>
		</div>
		<div class="wrap footer-bottom">
			<span>© <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php echo esc_html( kilic_opt( 'firma' ) ); ?> · <?php echo esc_html( kilic_opt( 'firma2' ) ); ?></span>
			<nav aria-label="Rechtliches">
				<?php
				wp_nav_menu( array(
					'theme_location' => 'kilic-rechtliches',
					'container'      => false,
					'items_wrap'     => '%3$s',
					'depth'          => 1,
					'fallback_cb'    => '__return_false',
					'walker'         => new Kilic_Flat_Walker(),
				) );
				?>
			</nav>
		</div>
	</footer>
	<div class="mobile-bar">
		<a href="<?php echo esc_url( kilic_seite_url( 'angebot-anfragen' ) ); ?>"><span class="ki ki-calc"></span> Anfrage</a>
		<a href="<?php echo esc_attr( kilic_tel_href( $notdienst ) ); ?>"><span class="ki ki-phone"></span> Notdienst 24/7</a>
	</div>
	<button class="to-top" type="button" aria-label="Nach oben"><span class="ki ki-up"></span></button>
	<?php
}

/** Menü als einfache Linkliste (Footer unten). */
class Kilic_Flat_Walker extends Walker_Nav_Menu {
	public function start_el( &$output, $item, $depth = 0, $args = null, $id = 0 ) {
		$output .= '<a href="' . esc_url( $item->url ) . '">' . esc_html( $item->title ) . '</a>';
	}
	public function end_el( &$output, $item, $depth = 0, $args = null ) {}
}

/* ---------- Shortcodes ---------- */

/** [kilic feld="telefon"] – Firmendaten aus den Einstellungen. */
add_shortcode( 'kilic', function ( $atts ) {
	$a = shortcode_atts( array( 'feld' => 'telefon' ), $atts );
	return esc_html( kilic_opt( sanitize_key( $a['feld'] ) ) );
} );

function kilic_form_meldung( $form ) {
	$status = sanitize_key( $_GET['anfrage'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( 'danke' === $status ) {
		return '';
	}
	if ( 'fehler' !== $status ) {
		return '';
	}
	$grund = sanitize_key( $_GET['grund'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
	$texte = array(
		'pflicht'     => 'Bitte geben Sie Ihren Namen und eine E-Mail-Adresse oder Telefonnummer an.',
		'datenschutz' => 'Bitte bestätigen Sie die Datenschutzerklärung.',
		'sitzung'     => 'Die Sitzung ist abgelaufen. Bitte laden Sie die Seite neu und senden Sie das Formular erneut.',
		'spam'        => 'Das Formular wurde zu schnell abgeschickt. Bitte versuchen Sie es noch einmal.',
		'speichern'   => 'Die Anfrage konnte nicht gespeichert werden. Bitte rufen Sie uns an.',
	);
	return '<div class="form-msg err" role="alert">' . esc_html( $texte[ $grund ] ?? 'Die Anfrage konnte nicht gesendet werden.' ) . ' Telefon: ' . esc_html( kilic_opt( 'telefon' ) ) . '</div>';
}

function kilic_form_hidden( $form ) {
	return '<input type="hidden" name="action" value="kilic_anfrage">'
		. '<input type="hidden" name="kilic_form" value="' . esc_attr( $form ) . '">'
		. '<input type="hidden" name="kilic_t" value="' . esc_attr( time() ) . '">'
		. wp_nonce_field( 'kilic_anfrage', 'kilic_nonce', false, false )
		. '<div class="hp-field" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>';
}

function kilic_datenschutz_link() {
	$id = kilic_page_id( 'datenschutz' );
	return $id ? get_permalink( $id ) : home_url( '/datenschutz/' );
}

/** [kilic_kontakt] – einfaches Kontaktformular. */
add_shortcode( 'kilic_kontakt', function () {
	if ( 'danke' === ( $_GET['anfrage'] ?? '' ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		return '<div class="wizard-main" id="kontakt" style="padding:40px"><div class="form-msg ok" role="status">Vielen Dank! Ihre Nachricht ist bei uns eingegangen. Wir melden uns schnellstmöglich.</div></div>';
	}
	ob_start();
	?>
	<form class="wizard-main" id="kontakt" style="padding:40px" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<?php echo kilic_form_meldung( 'kontakt' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
		<?php echo kilic_form_hidden( 'kontakt' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
		<h3 style="text-transform:uppercase;font-size:1.9rem">Nachricht senden</h3>
		<p class="muted">Für allgemeine Fragen, Bewerbungen oder Rückrufwünsche.</p>
		<div class="field-row">
			<div class="field"><label for="kk-name">Name <span class="req">*</span></label><input type="text" id="kk-name" name="name" required autocomplete="name"></div>
			<div class="field"><label for="kk-tel">Telefon</label><input type="tel" id="kk-tel" name="tel" autocomplete="tel"></div>
		</div>
		<div class="field"><label for="kk-email">E-Mail <span class="req">*</span></label><input type="email" id="kk-email" name="email" required autocomplete="email"></div>
		<div class="field"><label for="kk-anliegen">Anliegen</label><select id="kk-anliegen" name="anliegen"><option>Estrich</option><option>Bodensanierung</option><option>Bodenverlegung</option><option>Rohrreinigung</option><option>Bewerbung</option><option>Sonstiges</option></select></div>
		<div class="field"><label for="kk-nachricht">Nachricht <span class="req">*</span></label><textarea id="kk-nachricht" name="nachricht" required></textarea></div>
		<label class="check" style="margin-bottom:20px"><input type="checkbox" name="dsgvo" value="1" required> <span>Ich stimme der Verarbeitung meiner Daten gemäß <a href="<?php echo esc_url( kilic_datenschutz_link() ); ?>">Datenschutzerklärung</a> zu. <span class="req">*</span></span></label>
		<button class="btn btn-accent" type="submit">Nachricht senden <span class="ki ki-arrow"></span></button>
	</form>
	<?php
	return ob_get_clean();
} );

/** [kilic_anfrage] – Anfrage-Assistent in 5 Schritten. */
add_shortcode( 'kilic_anfrage', function () {
	ob_start();
	include KILIC_DIR . 'templates/anfrage-formular.php';
	return ob_get_clean();
} );
