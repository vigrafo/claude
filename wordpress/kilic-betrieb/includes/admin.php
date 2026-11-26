<?php
/**
 * Backend-Menü „Kilic Betrieb“ mit Übersicht, Assets und Hinweisen.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function () {
	$neu   = kilic_anzahl_neue_anfragen();
	$bubble = $neu ? ' <span class="awaiting-mod">' . (int) $neu . '</span>' : '';
	add_menu_page( 'Kilic Betrieb', 'Kilic Betrieb' . $bubble, 'kilic_buero', 'kilic', 'kilic_render_dashboard', 'dashicons-hammer', 3 );
	add_submenu_page( 'kilic', 'Übersicht', 'Übersicht', 'kilic_buero', 'kilic', 'kilic_render_dashboard', 0 );
	add_submenu_page( 'kilic', 'Projektarten', 'Projektarten', 'manage_categories', 'edit-tags.php?taxonomy=kilic_ref_kat&post_type=kilic_referenz' );
	add_submenu_page( 'kilic', 'Einstellungen', 'Einstellungen', 'manage_options', 'kilic-einstellungen', 'kilic_render_settings' );
} );

/** Untermenü sortieren: Übersicht, Anfragen, Belege, Kunden, Referenzen, Projektarten, Einstellungen. */
add_filter( 'custom_menu_order', '__return_true' );
add_action( 'admin_menu', function () {
	global $submenu;
	if ( empty( $submenu['kilic'] ) ) {
		return;
	}
	$order = array( 'kilic', 'edit.php?post_type=kilic_anfrage', 'edit.php?post_type=kilic_beleg', 'edit.php?post_type=kilic_kunde', 'edit.php?post_type=kilic_referenz', 'edit-tags.php?taxonomy=kilic_ref_kat&post_type=kilic_referenz', 'kilic-einstellungen' );
	usort( $submenu['kilic'], function ( $a, $b ) use ( $order ) {
		$ia = array_search( $a[2], $order, true );
		$ib = array_search( $b[2], $order, true );
		return ( false === $ia ? 99 : $ia ) <=> ( false === $ib ? 99 : $ib );
	} );
}, 999 );

/** Projektarten-Seite im richtigen Menü hervorheben. */
add_filter( 'parent_file', function ( $parent ) {
	global $current_screen;
	if ( $current_screen && 'kilic_ref_kat' === $current_screen->taxonomy ) {
		return 'kilic';
	}
	return $parent;
} );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
	$screen = get_current_screen();
	$ours   = $screen && ( in_array( $screen->post_type, array( 'kilic_anfrage', 'kilic_kunde', 'kilic_beleg', 'kilic_referenz' ), true ) || false !== strpos( (string) $hook, 'kilic' ) );
	if ( ! $ours ) {
		return;
	}
	wp_enqueue_style( 'kilic-admin', KILIC_URL . 'assets/css/admin.css', array(), KILIC_VERSION );
	wp_enqueue_script( 'kilic-admin', KILIC_URL . 'assets/js/admin.js', array(), KILIC_VERSION, true );
} );

function kilic_render_dashboard() {
	if ( ! current_user_can( 'kilic_buero' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$heute  = current_time( 'Y-m-d' );
	$jahr   = current_time( 'Y' );
	$offen  = get_posts( array(
		'post_type'   => 'kilic_beleg',
		'numberposts' => -1,
		'fields'      => 'ids',
		'meta_query'  => array(
			array( 'key' => '_typ', 'value' => 'rechnung' ),
			array( 'key' => '_status', 'value' => 'offen' ),
		),
	) );
	$offen_sum = 0;
	$ueber     = array();
	foreach ( $offen as $id ) {
		$offen_sum += kilic_beleg_summen( $id )['brutto'];
		if ( kilic_beleg_faellig( $id ) < $heute ) {
			$ueber[] = $id;
		}
	}
	$bezahlt = get_posts( array(
		'post_type'   => 'kilic_beleg',
		'numberposts' => -1,
		'fields'      => 'ids',
		'meta_query'  => array(
			array( 'key' => '_typ', 'value' => 'rechnung' ),
			array( 'key' => '_status', 'value' => 'bezahlt' ),
			array( 'key' => '_datum', 'value' => array( $jahr . '-01-01', $jahr . '-12-31' ), 'compare' => 'BETWEEN', 'type' => 'DATE' ),
		),
	) );
	$umsatz = 0;
	foreach ( $bezahlt as $id ) {
		$umsatz += kilic_beleg_summen( $id )['netto'];
	}
	$angebote = get_posts( array(
		'post_type'   => 'kilic_beleg',
		'numberposts' => -1,
		'fields'      => 'ids',
		'meta_query'  => array(
			array( 'key' => '_typ', 'value' => 'angebot' ),
			array( 'key' => '_status', 'value' => 'offen' ),
		),
	) );
	$anfragen = get_posts( array( 'post_type' => 'kilic_anfrage', 'numberposts' => 8 ) );
	?>
	<div class="wrap kilic-admin kilic-dash">
		<h1>Kilic Betrieb – Übersicht</h1>

		<div class="kilic-kpis">
			<a class="kilic-kpi" href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_anfrage' ) ); ?>"><strong><?php echo (int) kilic_anzahl_neue_anfragen(); ?></strong><span>neue Anfragen</span></a>
			<a class="kilic-kpi" href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_beleg&kilic_typ=angebot' ) ); ?>"><strong><?php echo count( $angebote ); ?></strong><span>versendete Angebote ohne Antwort</span></a>
			<a class="kilic-kpi" href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_beleg&kilic_typ=rechnung' ) ); ?>"><strong><?php echo esc_html( kilic_eur( $offen_sum ) ); ?></strong><span><?php echo count( $offen ); ?> offene Rechnungen</span></a>
			<a class="kilic-kpi<?php echo $ueber ? ' warn' : ''; ?>" href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_beleg&kilic_typ=rechnung' ) ); ?>"><strong><?php echo count( $ueber ); ?></strong><span>überfällige Rechnungen</span></a>
			<div class="kilic-kpi"><strong><?php echo esc_html( kilic_eur( $umsatz ) ); ?></strong><span>bezahlt <?php echo esc_html( $jahr ); ?> (netto)</span></div>
		</div>

		<p class="kilic-quick">
			<a class="button button-primary" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_beleg&kilic_typ=angebot' ) ); ?>">Neues Angebot</a>
			<a class="button button-primary" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_beleg&kilic_typ=rechnung' ) ); ?>">Neue Rechnung</a>
			<a class="button" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_kunde' ) ); ?>">Kunde anlegen</a>
			<a class="button" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_anfrage' ) ); ?>">Telefonanfrage erfassen</a>
			<a class="button" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_referenz' ) ); ?>">Referenz hinzufügen</a>
		</p>

		<div class="kilic-cols">
			<div class="postbox"><div class="inside">
				<h2>Neueste Anfragen</h2>
				<?php if ( ! $anfragen ) : ?>
					<p>Noch keine Anfragen. Sie erscheinen hier, sobald jemand das Formular auf der Website absendet.</p>
				<?php else : ?>
					<table class="widefat striped"><tbody>
					<?php foreach ( $anfragen as $a ) : ?>
						<tr>
							<td><a href="<?php echo esc_url( get_edit_post_link( $a->ID ) ); ?>"><?php echo esc_html( $a->post_title ); ?></a></td>
							<td><?php echo kilic_status_badge( get_post_meta( $a->ID, '_status', true ) ); // phpcs:ignore WordPress.Security.EscapeOutput ?></td>
							<td><?php echo esc_html( get_the_date( 'd.m.Y', $a ) ); ?></td>
						</tr>
					<?php endforeach; ?>
					</tbody></table>
				<?php endif; ?>
			</div></div>

			<div class="postbox"><div class="inside">
				<h2>Überfällige Rechnungen</h2>
				<?php if ( ! $ueber ) : ?>
					<p>Keine – alles im grünen Bereich.</p>
				<?php else : ?>
					<table class="widefat striped"><tbody>
					<?php foreach ( $ueber as $id ) : ?>
						<tr>
							<td><a href="<?php echo esc_url( get_edit_post_link( $id ) ); ?>"><?php echo esc_html( get_the_title( $id ) ); ?></a></td>
							<td>fällig <?php echo esc_html( kilic_date( kilic_beleg_faellig( $id ) ) ); ?></td>
							<td style="text-align:right"><?php echo esc_html( kilic_eur( kilic_beleg_summen( $id )['brutto'] ) ); ?></td>
						</tr>
					<?php endforeach; ?>
					</tbody></table>
				<?php endif; ?>

				<h2>Export für den Steuerberater</h2>
				<form method="get" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="kilic_export">
					<?php wp_nonce_field( 'kilic_export', '_wpnonce', false ); ?>
					<label for="kilic_jahr">Rechnungen des Jahres</label>
					<input type="number" id="kilic_jahr" name="jahr" value="<?php echo esc_attr( $jahr ); ?>" class="small-text">
					<button class="button" type="submit">als CSV herunterladen</button>
				</form>
			</div></div>
		</div>

		<div class="postbox"><div class="inside">
			<h2>So pflegen Sie die Website</h2>
			<ul class="ul-disc">
				<li><strong>Texte und Bilder</strong>: unter <em>Seiten</em> die gewünschte Seite öffnen und mit dem Divi Builder bearbeiten. Jeder Abschnitt ist ein eigenes Divi-Modul.</li>
				<li><strong>Telefon, Notdienst-Nummer, Adresse</strong>: nur unter <a href="<?php echo esc_url( admin_url( 'admin.php?page=kilic-einstellungen' ) ); ?>">Einstellungen</a> ändern. In den Seitentexten stehen dafür Platzhalter wie <code>{{notdienst}}</code>.</li>
				<li><strong>Menü</strong>: unter <em>Design → Menüs</em> (Menü „Hauptmenü“).</li>
				<li><strong>Referenzen</strong>: unter <em>Kilic Betrieb → Referenzen</em> mit Foto anlegen; sie erscheinen automatisch auf der Website.</li>
			</ul>
		</div></div>
	</div>
	<?php
}
