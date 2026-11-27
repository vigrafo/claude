<?php
/**
 * Eigene Oberfläche im Firmendesign für alle Kilic-Bereiche im Backend:
 * WordPress-Leiste und -Menü werden ausgeblendet, stattdessen Kilic-Kopfleiste
 * mit eigener Navigation.
 */

defined( 'ABSPATH' ) || exit;

function kilic_ist_kilic_screen() {
	if ( ! is_admin() || ! function_exists( 'get_current_screen' ) ) {
		return false;
	}
	$s = get_current_screen();
	if ( ! $s ) {
		return false;
	}
	return in_array( $s->post_type, array( 'kilic_anfrage', 'kilic_kunde', 'kilic_beleg', 'kilic_referenz', 'kilic_leistung' ), true )
		|| false !== strpos( $s->id, 'kilic' )
		|| 'kilic_ref_kat' === $s->taxonomy;
}

/** Navigationspunkte: [Titel, URL, aktiv-wenn (post_type oder page)]. */
function kilic_nav_punkte() {
	$p = array(
		array( 'Cockpit', admin_url( 'admin.php?page=kilic' ), 'page:kilic', 'dashboard' ),
		array( 'Anfragen', admin_url( 'edit.php?post_type=kilic_anfrage' ), 'kilic_anfrage', 'email-alt' ),
		array( 'Angebote & Rechnungen', admin_url( 'edit.php?post_type=kilic_beleg' ), 'kilic_beleg', 'media-document' ),
		array( 'Kunden', admin_url( 'edit.php?post_type=kilic_kunde' ), 'kilic_kunde', 'groups' ),
		array( 'Leistungen', admin_url( 'edit.php?post_type=kilic_leistung' ), 'kilic_leistung', 'list-view' ),
		array( 'Fotos', admin_url( 'admin.php?page=kilic-fotos' ), 'page:kilic-fotos', 'camera' ),
		array( 'Referenzen', admin_url( 'edit.php?post_type=kilic_referenz' ), 'kilic_referenz', 'format-gallery' ),
	);
	if ( current_user_can( 'upload_files' ) ) {
		$p[] = array( 'Website-Bilder', admin_url( 'admin.php?page=kilic-bilder' ), 'page:kilic-bilder', 'format-image' );
	}
	if ( current_user_can( 'manage_options' ) ) {
		$p[] = array( 'Einstellungen', admin_url( 'admin.php?page=kilic-einstellungen' ), 'page:kilic-einstellungen', 'admin-generic' );
	}
	return $p;
}

add_filter( 'admin_body_class', function ( $c ) {
	return kilic_ist_kilic_screen() ? $c . ' kilic-ui' : $c;
} );

add_action( 'admin_enqueue_scripts', function () {
	if ( kilic_ist_kilic_screen() ) {
		wp_enqueue_style( 'kilic-ui', KILIC_URL . 'assets/css/kilic-ui.css', array(), KILIC_VERSION );
	}
}, 30 );

/** Kopfleiste mit Logo und Navigation. */
add_action( 'in_admin_header', function () {
	if ( ! kilic_ist_kilic_screen() ) {
		return;
	}
	$s      = get_current_screen();
	$aktiv  = $s->post_type ? $s->post_type : ( 'kilic_ref_kat' === $s->taxonomy ? 'kilic_referenz' : 'page:' . sanitize_key( $_GET['page'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( 'page:kilic-senden' === $aktiv ) {
		$aktiv = 'kilic_beleg';
	}
	$neu    = kilic_anzahl_neue_anfragen();
	$u      = wp_get_current_user();
	?>
	<header class="kui-bar">
		<a class="kui-brand" href="<?php echo esc_url( admin_url( 'admin.php?page=kilic' ) ); ?>"><?php echo kilic_logo_html( 'hell' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></a>
		<button type="button" class="kui-suche-knopf" data-ks-auf aria-label="Suchen (Strg+K)"><span class="dashicons dashicons-search"></span><span class="kui-suche-text">Kunde, Rechnung … suchen</span><kbd>Strg K</kbd></button>
		<button type="button" class="kui-burger" aria-label="Menü" onclick="document.body.classList.toggle('kui-nav-open')"><span class="dashicons dashicons-menu"></span></button>
		<nav class="kui-nav" aria-label="Kilic Betrieb">
			<?php foreach ( kilic_nav_punkte() as $n ) : ?>
				<a href="<?php echo esc_url( $n[1] ); ?>" class="<?php echo $aktiv === $n[2] ? 'is-active' : ''; ?>"><span class="dashicons dashicons-<?php echo esc_attr( $n[3] ); ?>"></span><?php echo esc_html( $n[0] ); ?><?php if ( 'kilic_anfrage' === $n[2] && $neu ) : ?><b class="kui-badge"><?php echo (int) $neu; ?></b><?php endif; ?></a>
			<?php endforeach; ?>
		</nav>
		<div class="kui-user">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>" target="_blank"><span class="dashicons dashicons-admin-site-alt3"></span>Website</a>
			<?php if ( current_user_can( 'manage_options' ) ) : ?>
				<a href="<?php echo esc_url( admin_url( 'index.php?wp=1' ) ); ?>" title="Seiten, Divi, Plugins"><span class="dashicons dashicons-wordpress"></span>WordPress</a>
			<?php endif; ?>
			<span class="kui-name"><?php echo esc_html( $u->display_name ); ?></span>
			<a href="<?php echo esc_url( wp_logout_url( home_url( '/buero' ) ) ); ?>"><span class="dashicons dashicons-exit"></span>Abmelden</a>
		</div>
	</header>
	<nav class="kui-tabbar" aria-label="Schnellnavigation">
		<?php
		$tabs = array(
			array( 'Cockpit', admin_url( 'admin.php?page=kilic' ), 'page:kilic', 'dashboard' ),
			array( 'Anfragen', admin_url( 'edit.php?post_type=kilic_anfrage' ), 'kilic_anfrage', 'email-alt' ),
			array( 'Belege', admin_url( 'edit.php?post_type=kilic_beleg' ), 'kilic_beleg', 'media-document' ),
			array( 'Kunden', admin_url( 'edit.php?post_type=kilic_kunde' ), 'kilic_kunde', 'groups' ),
			array( 'Fotos', admin_url( 'admin.php?page=kilic-fotos' ), 'page:kilic-fotos', 'camera' ),
		);
		foreach ( $tabs as $t ) :
			?>
			<a href="<?php echo esc_url( $t[1] ); ?>" class="<?php echo $aktiv === $t[2] ? 'is-active' : ''; ?>"><span class="dashicons dashicons-<?php echo esc_attr( $t[3] ); ?>"></span><?php echo esc_html( $t[0] ); ?><?php if ( 'kilic_anfrage' === $t[2] && $neu ) : ?><b class="kui-badge"><?php echo (int) $neu; ?></b><?php endif; ?></a>
		<?php endforeach; ?>
	</nav>
	<?php
} );

/** Überschrift „Neues Angebot / neue Rechnung“ passend zur Art. */
add_action( 'admin_head-post-new.php', function () {
	$s = get_current_screen();
	if ( $s && 'kilic_beleg' === $s->post_type ) {
		global $title;
		$title = ( isset( $_GET['kilic_typ'] ) && 'rechnung' === $_GET['kilic_typ'] ) ? 'Neue Rechnung' : 'Neues Angebot'; // phpcs:ignore WordPress.Security.NonceVerification, WordPress.WP.GlobalVariablesOverride
	}
} );
add_action( 'admin_head-post.php', function () {
	$s = get_current_screen();
	if ( $s && 'kilic_beleg' === $s->post_type && isset( $_GET['post'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		global $title;
		$title = kilic_beleg_label( absint( $_GET['post'] ) ); // phpcs:ignore WordPress.Security.NonceVerification, WordPress.WP.GlobalVariablesOverride
	}
} );

/** Fremde Hinweise (Plugins, Updates, Divi) auf Kilic-Seiten ausblenden. */
add_action( 'admin_head', function () {
	if ( kilic_ist_kilic_screen() ) {
		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );
	}
}, 1 );

/** Fußzeile im Kilic-Bereich. */
add_filter( 'admin_footer_text', function ( $t ) {
	return kilic_ist_kilic_screen() ? esc_html( kilic_opt( 'firma' ) ) . ' · ' . esc_html( kilic_opt( 'firma2' ) ) . ' · Büro' : $t;
}, 20 );
add_filter( 'update_footer', function ( $t ) {
	return kilic_ist_kilic_screen() ? '' : $t;
}, 100 );
