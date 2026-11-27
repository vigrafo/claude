<?php
/**
 * Büro-Cockpit: der komplette Ablauf Anfrage → Angebot → Auftrag → Rechnung
 * auf einer Seite, mit Aktionsknöpfen direkt an jeder Karte. Dazu ein
 * „App-Modus“ für Büro-Zugänge (ohne WordPress-Menüs) und die Anmeldung
 * unter /buero im Firmendesign.
 */

defined( 'ABSPATH' ) || exit;

/* ---------- Daten ---------- */

function kilic_cockpit_belege( $typ, $status, $extra = array() ) {
	$mq = array_merge( array(
		array( 'key' => '_typ', 'value' => $typ ),
		array( 'key' => '_status', 'value' => (array) $status, 'compare' => 'IN' ),
	), $extra );
	return get_posts( array(
		'post_type'   => 'kilic_beleg',
		'numberposts' => 30,
		'meta_query'  => $mq,
		'orderby'     => 'date',
		'order'       => 'DESC',
	) );
}

function kilic_aktion_url( $do, $id ) {
	return wp_nonce_url( admin_url( 'admin-post.php?action=kilic_aktion&do=' . $do . '&id=' . $id ), 'kilic_aktion_' . $do . '_' . $id );
}

function kilic_druck_url( $id, $art = '' ) {
	return wp_nonce_url( admin_url( 'admin-post.php?action=kilic_drucken&id=' . $id . ( $art ? '&art=' . $art : '' ) ), 'kilic_drucken_' . $id );
}

/* ---------- Schnellaktionen ---------- */

add_action( 'admin_post_kilic_aktion', function () {
	$id = absint( $_GET['id'] ?? 0 );
	$do = sanitize_key( $_GET['do'] ?? '' );
	check_admin_referer( 'kilic_aktion_' . $do . '_' . $id );
	if ( ! current_user_can( 'edit_post', $id ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$msg = '';
	switch ( $do ) {
		case 'versendet':
		case 'angenommen':
		case 'abgelehnt':
			update_post_meta( $id, '_status', 'versendet' === $do ? 'offen' : $do );
			if ( ! get_post_meta( $id, '_nummer', true ) ) {
				update_post_meta( $id, '_nummer', kilic_naechste_nummer( kilic_beleg_typ( $id ) ) );
			}
			kilic_beleg_titel_setzen( $id );
			$msg = array( 'versendet' => 'Angebot als versendet markiert.', 'angenommen' => 'Auftrag erteilt – steht jetzt unter „Aufträge“.', 'abgelehnt' => 'Angebot als abgelehnt markiert.' )[ $do ];
			break;
		case 'bezahlt':
			$rest = kilic_beleg_rest( $id );
			if ( $rest > 0 ) {
				kilic_zahlung_hinzufuegen( $id, $rest, current_time( 'Y-m-d' ), 'Überweisung', 'im Cockpit erfasst' );
			}
			$msg = 'Zahlungseingang über ' . kilic_eur( $rest ) . ' erfasst – Rechnung ist bezahlt.';
			break;
		case 'gemahnt':
			update_post_meta( $id, '_mahnung', current_time( 'Y-m-d' ) );
			wp_safe_redirect( kilic_druck_url( $id, 'mahnung' ) );
			exit;
		case 'rechnung_offen':
			update_post_meta( $id, '_status', 'offen' );
			if ( ! get_post_meta( $id, '_nummer', true ) ) {
				update_post_meta( $id, '_nummer', kilic_naechste_nummer( 'rechnung' ) );
			}
			kilic_beleg_titel_setzen( $id );
			$msg = 'Rechnung abgeschlossen und nummeriert – jetzt drucken bzw. als PDF versenden.';
			break;
		case 'anfrage_erledigt':
			update_post_meta( $id, '_status', 'erledigt' );
			$msg = 'Anfrage erledigt.';
			break;
	}
	if ( $msg && 'kilic_beleg' === get_post_type( $id ) && 'bezahlt' !== $do ) {
		kilic_log_beleg( $id, $msg, 'angenommen' === $do ? 'auftrag' : kilic_beleg_typ( $id ) );
	}
	wp_safe_redirect( add_query_arg( 'kilic_msg', rawurlencode( $msg ), admin_url( 'admin.php?page=kilic' ) ) );
	exit;
} );

/* ---------- Ausgabe ---------- */

function kilic_karte( $titel, $zeilen, $knoepfe, $link = '', $klasse = '' ) {
	echo '<div class="kc-card ' . esc_attr( $klasse ) . '">';
	echo '<div class="kc-card-title">' . ( $link ? '<a href="' . esc_url( $link ) . '">' . esc_html( $titel ) . '</a>' : esc_html( $titel ) ) . '</div>';
	foreach ( array_filter( $zeilen ) as $z ) {
		echo '<div class="kc-card-line">' . wp_kses_post( $z ) . '</div>';
	}
	if ( $knoepfe ) {
		echo '<div class="kc-card-actions">';
		foreach ( $knoepfe as $k ) {
			printf( '<a class="kc-btn %s" href="%s"%s>%s</a>', esc_attr( $k[2] ?? '' ), esc_url( $k[1] ), ! empty( $k[3] ) ? ' target="_blank"' : '', esc_html( $k[0] ) );
		}
		echo '</div>';
	}
	echo '</div>';
}

function kilic_kunde_name( $beleg_id ) {
	$k = (int) get_post_meta( $beleg_id, '_kunde', true );
	return $k ? get_the_title( $k ) : 'ohne Kunde';
}

function kilic_render_cockpit() {
	$heute = current_time( 'Y-m-d' );

	$anfragen = get_posts( array(
		'post_type'   => 'kilic_anfrage',
		'numberposts' => 30,
		'meta_query'  => array( array( 'key' => '_status', 'value' => array( 'neu', 'bearbeitung' ), 'compare' => 'IN' ) ),
	) );
	$angebote  = kilic_cockpit_belege( 'angebot', array( 'entwurf', 'offen' ) );
	$auftraege = kilic_cockpit_belege( 'angebot', 'angenommen', array( array( 'key' => '_rechnung', 'compare' => 'NOT EXISTS' ) ) );
	$rechnungen = kilic_cockpit_belege( 'rechnung', array( 'entwurf', 'offen' ) );
	$offen_sum = 0;
	foreach ( $rechnungen as $r ) {
		if ( 'offen' === get_post_meta( $r->ID, '_status', true ) ) {
			$offen_sum += kilic_beleg_rest( $r->ID );
		}
	}
	// Zahlen für die Kennzahlen-Leiste.
	$alle_offen = kilic_cockpit_belege( 'rechnung', 'offen' );
	$k_offen = 0;
	$k_ueber = 0;
	foreach ( $alle_offen as $r ) {
		$rest = kilic_beleg_rest( $r->ID );
		$k_offen += $rest;
		if ( kilic_beleg_faellig( $r->ID ) < $heute ) {
			$k_ueber += $rest;
		}
	}
	$monat = current_time( 'Y-m' );
	$jahr  = current_time( 'Y' );
	$k_monat = 0;
	$k_jahr  = 0;
	$letzte  = array();
	$mit_zahlung = get_posts( array( 'post_type' => 'kilic_beleg', 'numberposts' => -1, 'fields' => 'ids', 'meta_key' => '_zahlungen' ) );
	foreach ( $mit_zahlung as $rid ) {
		foreach ( kilic_zahlungen( $rid ) as $z ) {
			if ( 0 === strpos( $z['datum'], $monat ) ) {
				$k_monat += (int) $z['betrag'];
			}
			if ( 0 === strpos( $z['datum'], $jahr ) ) {
				$k_jahr += (int) $z['betrag'];
			}
			$letzte[] = array( $z['datum'], $rid, $z );
		}
	}
	usort( $letzte, function ( $a, $b ) {
		return strcmp( $b[0], $a[0] );
	} );
	$letzte = array_slice( $letzte, 0, 5 );

	$msg = isset( $_GET['kilic_msg'] ) ? sanitize_text_field( wp_unslash( $_GET['kilic_msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
	?>
	<div class="kc">
		<div class="kc-head">
			<div class="kc-brand"><?php echo kilic_logo_html(); // phpcs:ignore WordPress.Security.EscapeOutput ?></div>
			<div class="kc-new">
				<a class="kc-big" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_anfrage' ) ); ?>"><span class="dashicons dashicons-phone"></span>Anfrage erfassen<small>z. B. nach einem Anruf</small></a>
				<a class="kc-big" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_beleg&kilic_typ=angebot' ) ); ?>"><span class="dashicons dashicons-media-document"></span>Neues Angebot<small>mit Leistungskatalog</small></a>
				<a class="kc-big" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_beleg&kilic_typ=rechnung' ) ); ?>"><span class="dashicons dashicons-money-alt"></span>Neue Rechnung<small>auch ohne Angebot</small></a>
				<a class="kc-big" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=kilic_kunde' ) ); ?>"><span class="dashicons dashicons-groups"></span>Neuer Kunde<small>Kundendaten anlegen</small></a>
				<a class="kc-big" href="<?php echo esc_url( admin_url( 'admin.php?page=kilic-fotos' ) ); ?>"><span class="dashicons dashicons-camera"></span>Fotos hochladen<small>vom Handy, zum Kunden</small></a>
			</div>
		</div>

		<?php if ( $msg ) : ?><div class="kc-msg" role="status"><?php echo esc_html( $msg ); ?></div><?php endif; ?>

		<?php kilic_erste_schritte(); ?>

		<div class="kc-kpis">
			<div class="kc-kpi"><span>Offen (alle Rechnungen)</span><strong><?php echo esc_html( kilic_eur( $k_offen ) ); ?></strong></div>
			<div class="kc-kpi<?php echo $k_ueber ? ' warn' : ''; ?>"><span>davon überfällig</span><strong><?php echo esc_html( kilic_eur( $k_ueber ) ); ?></strong></div>
			<div class="kc-kpi ok"><span>Zahlungseingang <?php echo esc_html( date_i18n( 'F', current_time( 'timestamp' ) ) ); ?></span><strong><?php echo esc_html( kilic_eur( $k_monat ) ); ?></strong></div>
			<div class="kc-kpi"><span>Zahlungseingang <?php echo esc_html( $jahr ); ?></span><strong><?php echo esc_html( kilic_eur( $k_jahr ) ); ?></strong></div>
		</div>

		<?php kilic_umsatz_panel(); ?>

		<ol class="kc-flow">
			<li><b>1</b> Anfrage kommt rein <span>(Website oder Telefon)</span></li>
			<li><b>2</b> Angebot schreiben &amp; drucken</li>
			<li><b>3</b> Kunde sagt zu → <strong>Auftrag</strong></li>
			<li><b>4</b> Rechnung erstellen &amp; drucken</li>
			<li><b>5</b> Geld da → <strong>bezahlt</strong></li>
		</ol>

		<div class="kc-board">
			<section class="kc-col">
				<h2>1 · Anfragen <span class="kc-count"><?php echo count( $anfragen ); ?></span></h2>
				<?php if ( ! $anfragen ) : ?><p class="kc-empty">Keine offenen Anfragen. Neue Anfragen von der Website erscheinen hier automatisch.</p><?php endif; ?>
				<?php
				foreach ( $anfragen as $a ) {
					$d = (array) get_post_meta( $a->ID, '_daten', true );
					kilic_karte(
						$a->post_title,
						array(
							trim( ( $d['plz'] ?? '' ) . ' ' . ( $d['ort'] ?? '' ) ),
							! empty( $d['tel'] ) ? '☎ ' . esc_html( $d['tel'] ) : '',
							'Eingang ' . get_the_date( 'd.m.Y', $a ),
						),
						array(
							array( 'Angebot erstellen', wp_nonce_url( admin_url( 'admin-post.php?action=kilic_anfrage_angebot&id=' . $a->ID ), 'kilic_anfrage_angebot_' . $a->ID ), 'primary' ),
							array( 'Ansehen', get_edit_post_link( $a->ID, 'url' ) ),
							array( 'Erledigt', kilic_aktion_url( 'anfrage_erledigt', $a->ID ), 'ghost' ),
						),
						get_edit_post_link( $a->ID, 'url' ),
						'neu' === get_post_meta( $a->ID, '_status', true ) ? 'is-new' : ''
					);
				}
				?>
			</section>

			<section class="kc-col">
				<h2>2 · Angebote <span class="kc-count"><?php echo count( $angebote ); ?></span></h2>
				<?php if ( ! $angebote ) : ?><p class="kc-empty">Keine offenen Angebote.</p><?php endif; ?>
				<?php
				foreach ( $angebote as $b ) {
					$st = get_post_meta( $b->ID, '_status', true );
					$k  = array( array( 'Per E-Mail senden', kilic_senden_url( $b->ID ), 'primary' ), array( 'Drucken / PDF', kilic_druck_url( $b->ID ), '', true ), array( 'Bearbeiten', get_edit_post_link( $b->ID, 'url' ) ) );
					$k[] = array( 'Auftrag erteilt', kilic_aktion_url( 'angenommen', $b->ID ), 'ok' );
					$k[] = array( 'Abgelehnt', kilic_aktion_url( 'abgelehnt', $b->ID ), 'ghost' );
					kilic_karte(
						kilic_beleg_label( $b->ID ),
						array( esc_html( kilic_kunde_name( $b->ID ) ), '<strong>' . esc_html( kilic_eur( kilic_beleg_summen( $b->ID )['brutto'] ) ) . '</strong> · ' . kilic_status_badge( 'entwurf' === $st ? 'entwurf' : 'offen' ) ),
						$k,
						get_edit_post_link( $b->ID, 'url' )
					);
				}
				?>
			</section>

			<section class="kc-col">
				<h2>3 · Aufträge <span class="kc-count"><?php echo count( $auftraege ); ?></span></h2>
				<?php if ( ! $auftraege ) : ?><p class="kc-empty">Keine laufenden Aufträge. Klicken Sie bei einem Angebot auf „Auftrag erteilt“.</p><?php endif; ?>
				<?php
				foreach ( $auftraege as $b ) {
					$von = get_post_meta( $b->ID, '_termin_von', true );
					$bis = get_post_meta( $b->ID, '_termin_bis', true );
					$termin = $von ? 'Termin: ' . kilic_date( $von ) . ( $bis && $bis !== $von ? ' – ' . kilic_date( $bis ) : '' ) : '<span class="kc-warn">Termin noch offen</span>';
					kilic_karte(
						kilic_kunde_name( $b->ID ),
						array( $termin, esc_html( get_post_meta( $b->ID, '_leistung', true ) ), esc_html( kilic_beleg_label( $b->ID ) ) . ' · ' . esc_html( kilic_eur( kilic_beleg_summen( $b->ID )['brutto'] ) ), kilic_abschlaege( $b->ID ) ? count( kilic_abschlaege( $b->ID ) ) . ' Abschlagsrechnung(en) gestellt' : '' ),
						array(
							array( kilic_abschlaege( $b->ID ) ? 'Schlussrechnung' : 'Rechnung erstellen', wp_nonce_url( admin_url( 'admin-post.php?action=kilic_umwandeln&id=' . $b->ID ), 'kilic_umwandeln_' . $b->ID ), 'primary' ),
							array( 'Abschlagsrechnung', admin_url( 'admin.php?page=kilic-abschlag&id=' . $b->ID ) ),
							array( 'Termin eintragen', get_edit_post_link( $b->ID, 'url' ) . '#kb_termin_von' ),
							array( 'Auftragsbestätigung senden', kilic_senden_url( $b->ID, 'ab' ) ),
						),
						get_edit_post_link( $b->ID, 'url' ),
						'is-job'
					);
				}
				?>
			</section>

			<section class="kc-col">
				<h2>4 · Rechnungen offen <span class="kc-count"><?php echo esc_html( kilic_eur( $offen_sum ) ); ?></span></h2>
				<?php if ( ! $rechnungen ) : ?><p class="kc-empty">Keine offenen Rechnungen.</p><?php endif; ?>
				<?php
				foreach ( $rechnungen as $r ) {
					$st   = get_post_meta( $r->ID, '_status', true );
					$f    = kilic_beleg_faellig( $r->ID );
					$over = 'offen' === $st && $f && $f < $heute;
					$k    = array();
					if ( 'entwurf' === $st ) {
						$k[] = array( 'Per E-Mail senden', kilic_senden_url( $r->ID ), 'primary' );
						$k[] = array( 'Bearbeiten', get_edit_post_link( $r->ID, 'url' ) );
						$k[] = array( 'Drucken / PDF', kilic_druck_url( $r->ID ), '', true );
					} else {
						$k[] = array( 'Bezahlt', kilic_aktion_url( 'bezahlt', $r->ID ), 'ok' );
						$k[] = array( 'Teilzahlung', get_edit_post_link( $r->ID, 'url' ) . '#kilic_beleg_zahlungen' );
						$k[] = array( 'Erneut senden', kilic_senden_url( $r->ID ) );
						$k[] = array( 'Drucken / PDF', kilic_druck_url( $r->ID ), '', true );
						if ( $over ) {
							$k[] = array( 'Zahlungserinnerung senden', kilic_senden_url( $r->ID, 'mahnung' ), 'warn' );
						}
					}
					$bez = kilic_beleg_bezahlt( $r->ID );
					kilic_karte(
						kilic_beleg_label( $r->ID ),
						array(
							esc_html( kilic_kunde_name( $r->ID ) ),
							$bez ? 'bezahlt ' . esc_html( kilic_eur( $bez ) ) . ' · <strong>offen ' . esc_html( kilic_eur( kilic_beleg_rest( $r->ID ) ) ) . '</strong>' : '',
							get_post_meta( $r->ID, '_mahnung', true ) ? 'erinnert am ' . esc_html( kilic_date( get_post_meta( $r->ID, '_mahnung', true ) ) ) : '',
							'<strong>' . esc_html( kilic_eur( kilic_beleg_summen( $r->ID )['brutto'] ) ) . '</strong> · ' . ( 'entwurf' === $st ? kilic_status_badge( 'entwurf' ) : ( $over ? '<span class="kc-warn">überfällig seit ' . esc_html( kilic_date( $f ) ) . '</span>' : 'fällig ' . esc_html( kilic_date( $f ) ) ) ),
						),
						$k,
						get_edit_post_link( $r->ID, 'url' ),
						$over ? 'is-over' : ''
					);
				}
				?>
			</section>
		</div>

		<?php if ( $letzte ) : ?>
		<div class="kc-payments">
			<h2>Letzte Zahlungseingänge</h2>
			<table>
				<?php foreach ( $letzte as $l ) : ?>
					<tr><td><?php echo esc_html( kilic_date( $l[0] ) ); ?></td><td><a href="<?php echo esc_url( get_edit_post_link( $l[1], 'url' ) ); ?>"><?php echo esc_html( kilic_beleg_label( $l[1] ) ); ?></a> · <?php echo esc_html( kilic_kunde_name( $l[1] ) ); ?></td><td><?php echo esc_html( $l[2]['art'] ); ?></td><td class="r"><?php echo esc_html( kilic_eur( $l[2]['betrag'] ) ); ?></td></tr>
				<?php endforeach; ?>
			</table>
		</div>
		<?php endif; ?>

		<div class="kc-foot">
			<nav class="kc-schnell" aria-label="Schnellzugriff">
				<a href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_kunde' ) ); ?>"><span class="dashicons dashicons-groups"></span><span>Alle Kunden</span></a>
				<a href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_beleg' ) ); ?>"><span class="dashicons dashicons-media-document"></span><span>Angebote &amp; Rechnungen</span></a>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=kilic-katalog' ) ); ?>"><span class="dashicons dashicons-list-view"></span><span>Leistungen &amp; Preise</span></a>
				<?php if ( current_user_can( 'edit_kilic_webseiten' ) ) : ?>
					<a href="<?php echo esc_url( admin_url( 'edit.php?post_type=kilic_referenz' ) ); ?>"><span class="dashicons dashicons-format-gallery"></span><span>Referenzen</span></a>
				<?php endif; ?>
				<?php if ( current_user_can( 'manage_options' ) ) : ?>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=kilic-einstellungen' ) ); ?>"><span class="dashicons dashicons-admin-generic"></span><span>Einstellungen</span></a>
				<?php endif; ?>
			</nav>
			<form method="get" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kc-export">
				<input type="hidden" name="action" value="kilic_export">
				<?php wp_nonce_field( 'kilic_export', '_wpnonce', false ); ?>
				<div class="kc-export-txt"><strong><span class="dashicons dashicons-download"></span> Export für den Steuerberater</strong><small>Alle Rechnungen und Zahlungen eines Jahres als Tabelle (CSV, für Excel)</small></div>
				<label class="kc-export-jahr"><span class="screen-reader-text">Jahr</span>
					<select name="jahr">
						<?php for ( $j = (int) current_time( 'Y' ); $j >= (int) current_time( 'Y' ) - 6; $j-- ) : ?>
							<option value="<?php echo (int) $j; ?>"><?php echo (int) $j; ?></option>
						<?php endfor; ?>
					</select>
				</label>
				<button type="submit" class="kc-export-knopf">Herunterladen</button>
			</form>
		</div>
	</div>
	<?php
}

/* ---------- WordPress-Dashboard → Cockpit ---------- */

/** Nach der Anmeldung und beim Aufruf des Dashboards direkt ins Cockpit. */
add_action( 'load-index.php', function () {
	if ( current_user_can( 'kilic_buero' ) && empty( $_GET['wp'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		wp_safe_redirect( admin_url( 'admin.php?page=kilic' ) );
		exit;
	}
} );

add_filter( 'login_redirect', function ( $url, $requested, $user ) {
	if ( $user instanceof WP_User && $user->has_cap( 'kilic_buero' ) && ( ! $requested || false !== strpos( $requested, 'wp-admin' ) && false === strpos( $requested, 'post' ) ) ) {
		return admin_url( 'admin.php?page=kilic' );
	}
	return $url;
}, 10, 3 );

/* ---------- App-Modus für Büro-Zugänge ---------- */

function kilic_app_modus() {
	return is_user_logged_in() && current_user_can( 'kilic_buero' ) && ! current_user_can( 'manage_options' );
}

add_action( 'admin_menu', function () {
	if ( ! kilic_app_modus() ) {
		return;
	}
	foreach ( array( 'index.php', 'edit.php', 'upload.php', 'edit.php?post_type=page', 'edit-comments.php', 'tools.php', 'profile.php', 'edit.php?post_type=project' ) as $slug ) {
		remove_menu_page( $slug );
	}
}, 1000 );

add_action( 'admin_bar_menu', function ( $bar ) {
	if ( ! kilic_app_modus() ) {
		return;
	}
	foreach ( array( 'wp-logo', 'comments', 'new-content', 'updates', 'search', 'customize', 'et-use-visual-builder', 'et-disable-visual-builder' ) as $node ) {
		$bar->remove_node( $node );
	}
	$bar->add_node( array( 'id' => 'kilic-cockpit', 'title' => 'Cockpit', 'href' => admin_url( 'admin.php?page=kilic' ) ) );
}, 999 );

add_filter( 'admin_body_class', function ( $c ) {
	return $c . ( kilic_app_modus() ? ' kilic-app' : '' ) . ' kilic-admin-body';
} );

add_filter( 'admin_footer_text', function ( $t ) {
	return kilic_app_modus() ? esc_html( kilic_opt( 'firma' ) ) . ' · Büro' : $t;
} );
add_filter( 'update_footer', function ( $t ) {
	return kilic_app_modus() ? '' : $t;
}, 99 );

/* ---------- Anmeldung unter /buero im Firmendesign ---------- */

add_action( 'init', function () {
	add_rewrite_rule( '^buero/?$', 'index.php?kilic_buero=1', 'top' );
} );
add_filter( 'query_vars', function ( $v ) {
	$v[] = 'kilic_buero';
	return $v;
} );
add_action( 'template_redirect', function () {
	if ( get_query_var( 'kilic_buero' ) ) {
		wp_safe_redirect( is_user_logged_in() ? admin_url( 'admin.php?page=kilic' ) : wp_login_url( admin_url( 'admin.php?page=kilic' ) ) );
		exit;
	}
} );

add_action( 'login_enqueue_scripts', function () {
	?>
	<style>
		body.login { background: #1b1f23; }
		body.login #login h1 a { background: none; width: auto; height: auto; text-indent: 0; font: 700 34px/1 "Arial Narrow", Arial, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #fff; display: block; }
		body.login #login h1 a span { color: #e8892b; }
		body.login #login h1 a small { display: block; font: 500 11px/1.4 Arial, sans-serif; letter-spacing: .24em; color: #aab0b6; margin-top: 8px; }
		body.login form { border: 0; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,.35); }
		body.login .button-primary { background: #e8892b; border-color: #e8892b; }
		body.login .button-primary:hover { background: #c96f17; border-color: #c96f17; }
		body.login #nav a, body.login #backtoblog a { color: #cfd3d7 !important; }
		body.login input:focus { border-color: #e8892b; box-shadow: 0 0 0 1px #e8892b; }
		.language-switcher { display: none; }
	</style>
	<?php
} );
add_filter( 'login_headerurl', function () {
	return home_url( '/' );
} );
add_filter( 'login_headertext', function () {
	$name  = preg_replace( '/\s+Meisterbetrieb$/i', '', kilic_opt( 'firma' ) );
	$parts = explode( ' ', $name, 2 );
	return esc_html( $parts[0] ) . ( isset( $parts[1] ) ? ' <span>' . esc_html( $parts[1] ) . '</span>' : '' ) . '<small>Büro · Anmeldung</small>';
} );


/* ---------- Erste Schritte (Einrichtungs-Checkliste) ---------- */

function kilic_erste_schritte() {
	if ( get_option( 'kilic_start_ausgeblendet' ) ) {
		return;
	}
	$preise = get_posts( array( 'post_type' => 'kilic_leistung', 'numberposts' => 1, 'fields' => 'ids', 'meta_query' => array( array( 'key' => '_preis', 'value' => 0, 'compare' => '>', 'type' => 'NUMERIC' ) ) ) );
	$kunden = get_posts( array( 'post_type' => 'kilic_kunde', 'numberposts' => 1, 'fields' => 'ids' ) );
	$send   = get_posts( array( 'post_type' => 'kilic_beleg', 'numberposts' => 1, 'fields' => 'ids', 'meta_key' => '_versand' ) );
	$buero  = get_users( array( 'role' => 'kilic_buero', 'number' => 1, 'fields' => 'ID' ) );
	$schritte = array(
		array( ! kilic_ist_platzhalter( 'steuernr' ) && ! kilic_ist_platzhalter( 'iban' ) && ! kilic_ist_platzhalter( 'email' ), 'Firmendaten eintragen', 'Steuernummer, Bankverbindung und E-Mail – erscheinen auf jeder Rechnung.', 'Zu den Einstellungen', admin_url( 'admin.php?page=kilic-einstellungen' ), 'manage_options' ),
		array( (bool) $preise, 'Preise im Leistungskatalog', 'Einmal Ihre Preise eintragen – danach sind Angebote in Sekunden fertig.', 'Katalog öffnen', admin_url( 'edit.php?post_type=kilic_leistung' ), '' ),
		array( (bool) $kunden, 'Ersten Kunden anlegen', 'Name, Adresse und Telefon – oder einfach aus einer Anfrage übernehmen.', 'Kunde anlegen', admin_url( 'post-new.php?post_type=kilic_kunde' ), '' ),
		array( (bool) $send, 'Erstes Angebot senden', 'Angebot erstellen und per Knopf als PDF an den Kunden mailen.', 'Angebot erstellen', admin_url( 'post-new.php?post_type=kilic_beleg&kilic_typ=angebot' ), '' ),
		array( (bool) $buero, 'Büro-Zugang anlegen', 'Eigener Zugang für Mitarbeiter – sieht nur diese Büro-Software.', 'Zugang anlegen', admin_url( 'admin.php?page=kilic-team' ), 'create_users' ),
	);
	$schritte = array_values( array_filter( $schritte, function ( $x ) {
		return ! $x[5] || current_user_can( $x[5] );
	} ) );
	$fertig = count( array_filter( wp_list_pluck( $schritte, 0 ) ) );
	if ( $fertig === count( $schritte ) ) {
		return;
	}
	$weg = wp_nonce_url( admin_url( 'admin-post.php?action=kilic_start_aus' ), 'kilic_start_aus' );
	echo '<section class="kc-start"><div class="kc-start-head"><h2>Erste Schritte – ' . (int) $fertig . ' von ' . count( $schritte ) . ' erledigt</h2>';
	echo '<div class="kc-start-bar" aria-hidden="true"><span style="width:' . (int) round( $fertig / max( 1, count( $schritte ) ) * 100 ) . '%"></span></div>';
	echo '<a href="' . esc_url( $weg ) . '" class="kc-btn ghost">Ausblenden</a></div><ol>';
	foreach ( $schritte as $x ) {
		printf(
			'<li class="%s"><span class="ck">%s</span><div><strong>%s</strong><small>%s</small>%s</div></li>',
			$x[0] ? 'done' : '',
			$x[0] ? '✓' : '',
			esc_html( $x[1] ),
			esc_html( $x[2] ),
			$x[0] ? '<span class="kc-ok">Erledigt</span>' : '<a href="' . esc_url( $x[4] ) . '">' . esc_html( $x[3] ) . ' →</a>'
		);
	}
	echo '</ol></section>';
}

add_action( 'admin_post_kilic_start_aus', function () {
	check_admin_referer( 'kilic_start_aus' );
	update_option( 'kilic_start_ausgeblendet', 1 );
	wp_safe_redirect( admin_url( 'admin.php?page=kilic' ) );
	exit;
} );
