<?php
/**
 * Team & Zugänge: Büro-Zugänge anlegen und bestehenden Benutzern Zugriff geben –
 * immer mit der richtigen Rolle „Büro (Kilic)“.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function () {
	add_submenu_page( 'kilic', 'Team & Zugänge', 'Team & Zugänge', 'create_users', 'kilic-team', 'kilic_render_team' );
}, 30 );

function kilic_team_rolle( $u ) {
	if ( in_array( 'administrator', (array) $u->roles, true ) ) {
		return array( 'Inhaber / Admin', 'admin' );
	}
	if ( in_array( 'kilic_buero', (array) $u->roles, true ) ) {
		return array( 'Büro', 'buero' );
	}
	return array( 'Kein Zugriff auf die Büro-Software', 'kein' );
}

function kilic_render_team() {
	if ( ! current_user_can( 'create_users' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$msg  = sanitize_text_field( wp_unslash( $_GET['ok'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
	$err  = sanitize_text_field( wp_unslash( $_GET['fehler'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
	$pw   = get_transient( 'kilic_team_pw_' . get_current_user_id() );
	delete_transient( 'kilic_team_pw_' . get_current_user_id() );
	$users = get_users( array( 'orderby' => 'display_name' ) );
	?>
	<div class="wrap kilic-wrap kt">
		<h1>Team &amp; Zugänge</h1>
		<p class="kt-intro">Wer hier „Büro“ hat, sieht nach dem Anmelden direkt das Cockpit mit Anfragen, Angeboten, Rechnungen, Kunden und Fotos – aber keine WordPress-Einstellungen, Plugins oder Divi.</p>
		<?php if ( $msg ) : ?><div class="kt-hinweis ok" role="status"><?php echo esc_html( $msg ); ?></div><?php endif; ?>
		<?php if ( $err ) : ?><div class="kt-hinweis fehler" role="alert"><?php echo esc_html( $err ); ?></div><?php endif; ?>
		<?php if ( is_array( $pw ) ) : ?>
			<div class="kt-zugang" role="status">
				<h2>✓ Zugang angelegt – bitte diese Daten weitergeben</h2>
				<dl>
					<dt>Anmelden unter</dt><dd><code><?php echo esc_html( home_url( '/buero' ) ); ?></code></dd>
					<dt>Benutzername</dt><dd><code><?php echo esc_html( $pw['login'] ); ?></code></dd>
					<dt>Passwort</dt><dd><code class="kt-pw"><?php echo esc_html( $pw['pw'] ); ?></code></dd>
				</dl>
				<p class="description">Das Passwort wird nur jetzt angezeigt.<?php echo $pw['mail'] ? ' Zusätzlich wurde eine E-Mail mit dem Link zum Passwort-Festlegen an ' . esc_html( $pw['mail'] ) . ' geschickt.' : ''; ?></p>
			</div>
		<?php endif; ?>

		<div class="kt-raster">
			<section class="kt-karte">
				<h2>Neuen Büro-Zugang anlegen</h2>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kt-form">
					<input type="hidden" name="action" value="kilic_team_neu">
					<?php wp_nonce_field( 'kilic_team_neu' ); ?>
					<div class="kt-zwei">
						<label><span>Vorname <b class="kk-pflicht">*</b></span><input type="text" name="vorname" required autocomplete="off"></label>
						<label><span>Nachname</span><input type="text" name="nachname" autocomplete="off"></label>
					</div>
					<label><span>E-Mail <b class="kk-pflicht">*</b></span><input type="email" name="email" required autocomplete="off"></label>
					<label><span>Passwort <small>(leer = sicheres Passwort wird erzeugt)</small></span><input type="text" name="pw" autocomplete="new-password" minlength="8"></label>
					<label class="kt-check"><input type="checkbox" name="mail" value="1" checked> Zugangsdaten per E-Mail an den Mitarbeiter schicken</label>
					<button type="submit" class="kt-knopf">Büro-Zugang anlegen</button>
				</form>
			</section>

			<section class="kt-karte">
				<h2>Alle Benutzer</h2>
				<ul class="kt-liste">
					<?php foreach ( $users as $u ) :
						list( $rolle, $art ) = kilic_team_rolle( $u );
						$ich = get_current_user_id() === $u->ID;
						?>
						<li>
							<span class="kt-avatar"><?php echo esc_html( mb_strtoupper( mb_substr( $u->display_name, 0, 1 ) ) ); ?></span>
							<span class="kt-wer"><strong><?php echo esc_html( $u->display_name ); ?><?php echo $ich ? ' (Sie)' : ''; ?></strong><small><?php echo esc_html( $u->user_email ); ?> · <?php echo esc_html( $u->user_login ); ?></small></span>
							<span class="kt-rolle kt-<?php echo esc_attr( $art ); ?>"><?php echo esc_html( $rolle ); ?></span>
							<?php if ( 'admin' !== $art && ! $ich ) : ?>
								<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
									<input type="hidden" name="action" value="kilic_team_rolle">
									<input type="hidden" name="user" value="<?php echo (int) $u->ID; ?>">
									<input type="hidden" name="ziel" value="<?php echo 'buero' === $art ? 'kein' : 'buero'; ?>">
									<?php wp_nonce_field( 'kilic_team_rolle_' . $u->ID ); ?>
									<button type="submit" class="kt-mini <?php echo 'buero' === $art ? 'weg' : 'geben'; ?>"><?php echo 'buero' === $art ? 'Zugriff entziehen' : 'Büro-Zugang geben'; ?></button>
								</form>
							<?php endif; ?>
						</li>
					<?php endforeach; ?>
				</ul>
			</section>
		</div>
	</div>
	<?php
}

add_action( 'admin_post_kilic_team_neu', function () {
	check_admin_referer( 'kilic_team_neu' );
	if ( ! current_user_can( 'create_users' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$zur   = admin_url( 'admin.php?page=kilic-team' );
	$vn    = sanitize_text_field( wp_unslash( $_POST['vorname'] ?? '' ) );
	$nn    = sanitize_text_field( wp_unslash( $_POST['nachname'] ?? '' ) );
	$mail  = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
	$pw    = (string) wp_unslash( $_POST['pw'] ?? '' ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	if ( ! $vn || ! is_email( $mail ) ) {
		wp_safe_redirect( add_query_arg( 'fehler', rawurlencode( 'Bitte Vorname und eine gültige E-Mail angeben.' ), $zur ) );
		exit;
	}
	if ( email_exists( $mail ) ) {
		wp_safe_redirect( add_query_arg( 'fehler', rawurlencode( 'Diese E-Mail hat schon einen Zugang. Unten in der Liste auf „Büro-Zugang geben“ klicken.' ), $zur ) );
		exit;
	}
	if ( '' !== $pw && strlen( $pw ) < 8 ) {
		wp_safe_redirect( add_query_arg( 'fehler', rawurlencode( 'Das Passwort muss mindestens 8 Zeichen haben.' ), $zur ) );
		exit;
	}
	$pw    = '' === $pw ? wp_generate_password( 14, false ) : $pw;
	$basis = sanitize_user( strtolower( remove_accents( $vn . ( $nn ? '.' . $nn : '' ) ) ), true );
	$basis = $basis ? preg_replace( '/\s+/', '', $basis ) : 'buero';
	$login = $basis;
	for ( $i = 2; username_exists( $login ); $i++ ) {
		$login = $basis . $i;
	}
	$id = wp_insert_user( array(
		'user_login'   => $login,
		'user_pass'    => $pw,
		'user_email'   => $mail,
		'first_name'   => $vn,
		'last_name'    => $nn,
		'display_name' => trim( $vn . ' ' . $nn ),
		'role'         => 'kilic_buero',
	) );
	if ( is_wp_error( $id ) ) {
		wp_safe_redirect( add_query_arg( 'fehler', rawurlencode( $id->get_error_message() ), $zur ) );
		exit;
	}
	$geschickt = '';
	if ( ! empty( $_POST['mail'] ) ) {
		wp_new_user_notification( $id, null, 'user' );
		$geschickt = $mail;
	}
	set_transient( 'kilic_team_pw_' . get_current_user_id(), array( 'login' => $login, 'pw' => $pw, 'mail' => $geschickt ), 600 );
	wp_safe_redirect( $zur );
	exit;
} );

add_action( 'admin_post_kilic_team_rolle', function () {
	$uid = absint( $_POST['user'] ?? 0 );
	check_admin_referer( 'kilic_team_rolle_' . $uid );
	if ( ! current_user_can( 'promote_user', $uid ) || get_current_user_id() === $uid ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$u = get_userdata( $uid );
	if ( ! $u || in_array( 'administrator', (array) $u->roles, true ) ) {
		wp_die( 'Dieser Benutzer kann hier nicht geändert werden.' );
	}
	$ziel = 'buero' === ( $_POST['ziel'] ?? '' ) ? 'kilic_buero' : 'subscriber';
	$u->set_role( $ziel );
	$text = 'kilic_buero' === $ziel ? $u->display_name . ' hat jetzt den Büro-Zugang. Nach dem nächsten Anmelden erscheint das Cockpit.' : $u->display_name . ' hat keinen Zugriff mehr auf die Büro-Software.';
	wp_safe_redirect( add_query_arg( 'ok', rawurlencode( $text ), admin_url( 'admin.php?page=kilic-team' ) ) );
	exit;
} );

/** Beim Anlegen über WordPress direkt „Büro (Kilic)“ vorschlagen. */
add_filter( 'pre_option_default_role', function ( $v ) {
	global $pagenow;
	return ( is_admin() && 'user-new.php' === $pagenow ) ? 'kilic_buero' : $v;
} );
