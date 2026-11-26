<?php
/**
 * Kundenakte: Verlauf (wer hat wann was gemacht) und Fotos/Dokumente vom
 * Objekt – auch direkt vom Handy hochladbar.
 */

defined( 'ABSPATH' ) || exit;

/* ---------- Verlauf ---------- */

/** Eintrag in den Verlauf eines Kunden schreiben. */
function kilic_log( $kunde_id, $text, $bezug = 0, $art = 'info' ) {
	$kunde_id = (int) $kunde_id;
	if ( ! $kunde_id || 'kilic_kunde' !== get_post_type( $kunde_id ) ) {
		return;
	}
	$v   = get_post_meta( $kunde_id, '_verlauf', true );
	$v   = is_array( $v ) ? $v : array();
	$u   = wp_get_current_user();
	$v[] = array(
		'zeit'  => current_time( 'mysql' ),
		'wer'   => $u && $u->exists() ? $u->display_name : 'Website',
		'text'  => wp_strip_all_tags( $text ),
		'bezug' => (int) $bezug,
		'art'   => $art,
	);
	update_post_meta( $kunde_id, '_verlauf', $v );
}

/** Verlaufseintrag zu einem Beleg (Kunde wird ermittelt). */
function kilic_log_beleg( $beleg_id, $text, $art = 'info' ) {
	kilic_log( (int) get_post_meta( $beleg_id, '_kunde', true ), kilic_beleg_label( $beleg_id ) . ': ' . $text, $beleg_id, $art );
}

function kilic_verlauf_icon( $art ) {
	$icons = array(
		'anfrage'  => 'email-alt',
		'angebot'  => 'media-document',
		'auftrag'  => 'hammer',
		'rechnung' => 'money-alt',
		'zahlung'  => 'yes-alt',
		'mahnung'  => 'warning',
		'foto'     => 'camera',
		'notiz'    => 'edit',
		'druck'    => 'printer',
	);
	return 'dashicons-' . ( $icons[ $art ] ?? 'info-outline' );
}

add_action( 'add_meta_boxes_kilic_kunde', function ( $post ) {
	if ( 'auto-draft' === $post->post_status ) {
		return;
	}
	add_meta_box( 'kilic_kunde_fotos', 'Fotos & Dokumente vom Objekt', 'kilic_kunde_fotos_box', 'kilic_kunde', 'normal', 'default' );
	add_meta_box( 'kilic_kunde_verlauf', 'Verlauf – alles, was bei diesem Kunden passiert ist', 'kilic_kunde_verlauf_box', 'kilic_kunde', 'normal', 'default' );
}, 20 );

function kilic_kunde_verlauf_box( $post ) {
	echo '<p><label for="kilic_notiz_neu"><strong>Notiz hinzufügen</strong> (z. B. Telefonat, Absprache auf der Baustelle)</label><br>';
	echo '<textarea id="kilic_notiz_neu" name="kilic_verlauf_notiz" rows="2" class="large-text" placeholder="Was wurde besprochen oder gemacht?"></textarea>';
	echo '<span class="description">Wird beim Speichern mit Datum und Ihrem Namen eingetragen.</span></p>';
	$v = get_post_meta( $post->ID, '_verlauf', true );
	$v = is_array( $v ) ? array_reverse( $v ) : array();
	if ( ! $v ) {
		echo '<p>Noch keine Einträge.</p>';
		return;
	}
	echo '<ul class="kilic-verlauf">';
	foreach ( $v as $e ) {
		$link = $e['bezug'] && get_post( $e['bezug'] ) ? ' <a href="' . esc_url( get_edit_post_link( $e['bezug'] ) ) . '">öffnen</a>' : '';
		printf(
			'<li class="art-%1$s"><span class="dashicons %2$s"></span><div><time>%3$s · %4$s</time><p>%5$s%6$s</p></div></li>',
			esc_attr( $e['art'] ),
			esc_attr( kilic_verlauf_icon( $e['art'] ) ),
			esc_html( mysql2date( 'd.m.Y H:i', $e['zeit'] ) ),
			esc_html( $e['wer'] ),
			esc_html( $e['text'] ),
			$link // phpcs:ignore WordPress.Security.EscapeOutput
		);
	}
	echo '</ul>';
}

add_action( 'save_post_kilic_kunde', function ( $post_id ) {
	if ( ! isset( $_POST['kilic_kunde_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['kilic_kunde_nonce'] ), 'kilic_kunde_save' ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$notiz = sanitize_textarea_field( wp_unslash( $_POST['kilic_verlauf_notiz'] ?? '' ) );
	if ( '' !== trim( $notiz ) ) {
		kilic_log( $post_id, $notiz, 0, 'notiz' );
	}
	// Fotos zuordnen aufheben.
	foreach ( array_map( 'absint', (array) ( $_POST['kilic_foto_weg'] ?? array() ) ) as $att ) {
		delete_post_meta( $att, '_kilic_kunde' );
		if ( (int) get_post_field( 'post_parent', $att ) === $post_id ) {
			wp_update_post( array( 'ID' => $att, 'post_parent' => 0 ) );
		}
	}
	kilic_fotos_speichern( $post_id, sanitize_text_field( wp_unslash( $_POST['kilic_foto_notiz'] ?? '' ) ) );
}, 15 );

/* ---------- Fotos ---------- */

add_action( 'post_edit_form_tag', function ( $post ) {
	if ( $post && 'kilic_kunde' === $post->post_type ) {
		echo ' enctype="multipart/form-data"';
	}
} );

/** Hochgeladene Dateien (Feld kilic_fotos[]) dem Kunden zuordnen. Gibt die Anzahl zurück. */
function kilic_fotos_speichern( $kunde_id, $notiz = '', $beleg_id = 0 ) {
	if ( empty( $_FILES['kilic_fotos'] ) || ! is_array( $_FILES['kilic_fotos']['name'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		return 0;
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$files = $_FILES['kilic_fotos']; // phpcs:ignore WordPress.Security.NonceVerification, WordPress.Security.ValidatedSanitizedInput
	$n     = 0;
	foreach ( array_keys( $files['name'] ) as $i ) {
		if ( UPLOAD_ERR_OK !== $files['error'][ $i ] ) {
			continue;
		}
		$_FILES['kilic_foto'] = array(
			'name'     => $files['name'][ $i ],
			'type'     => $files['type'][ $i ],
			'tmp_name' => $files['tmp_name'][ $i ],
			'error'    => $files['error'][ $i ],
			'size'     => $files['size'][ $i ],
		);
		$att = media_handle_upload( 'kilic_foto', $kunde_id, array( 'post_excerpt' => $notiz ), array(
			'test_form' => false,
			'mimes'     => array(
				'jpg|jpeg|jpe' => 'image/jpeg',
				'png'          => 'image/png',
				'webp'         => 'image/webp',
				'heic'         => 'image/heic',
				'pdf'          => 'application/pdf',
			),
		) );
		if ( ! is_wp_error( $att ) ) {
			update_post_meta( $att, '_kilic_kunde', $kunde_id );
			if ( $beleg_id ) {
				update_post_meta( $att, '_kilic_beleg', $beleg_id );
			}
			$n++;
		}
	}
	unset( $_FILES['kilic_foto'] );
	if ( $n ) {
		kilic_log( $kunde_id, $n . ( 1 === $n ? ' Datei' : ' Dateien' ) . ' hochgeladen' . ( $notiz ? ': ' . $notiz : '' ), $beleg_id, 'foto' );
	}
	return $n;
}

function kilic_kunde_fotos( $kunde_id ) {
	return get_posts( array(
		'post_type'   => 'attachment',
		'post_status' => 'inherit',
		'numberposts' => -1,
		'meta_key'    => '_kilic_kunde',
		'meta_value'  => $kunde_id,
		'orderby'     => 'date',
		'order'       => 'DESC',
	) );
}

function kilic_kunde_fotos_box( $post ) {
	$fotos = kilic_kunde_fotos( $post->ID );
	echo '<div class="kilic-upload"><label class="kilic-upload-btn"><span class="dashicons dashicons-camera"></span> Fotos aufnehmen oder auswählen<input type="file" name="kilic_fotos[]" accept="image/*,application/pdf" multiple></label>';
	echo '<input type="text" name="kilic_foto_notiz" class="regular-text" placeholder="Notiz zu den Fotos, z. B. „Zustand vor Beginn“">';
	echo '<span class="kilic-upload-info description">Dann „Aktualisieren“ klicken. Am Handy öffnet sich die Kamera oder die Galerie.</span></div>';
	if ( ! $fotos ) {
		echo '<p>Noch keine Fotos. Auch Fotos aus Website-Anfragen erscheinen hier, sobald aus der Anfrage ein Angebot erstellt wurde.</p>';
		return;
	}
	echo '<div class="kilic-galerie">';
	foreach ( $fotos as $f ) {
		$url  = wp_get_attachment_url( $f->ID );
		$img  = wp_attachment_is_image( $f->ID ) ? wp_get_attachment_image( $f->ID, 'medium' ) : '<span class="dashicons dashicons-pdf"></span><span>' . esc_html( basename( $url ) ) . '</span>';
		$note = $f->post_excerpt;
		printf(
			'<figure><a href="%s" target="_blank">%s</a><figcaption>%s%s<label><input type="checkbox" name="kilic_foto_weg[]" value="%d"> entfernen</label></figcaption></figure>',
			esc_url( $url ),
			$img, // phpcs:ignore WordPress.Security.EscapeOutput
			esc_html( get_the_date( 'd.m.Y', $f ) ),
			$note ? ' · ' . esc_html( $note ) : '',
			(int) $f->ID
		);
	}
	echo '</div>';
}

/* ---------- Handy-Seite „Fotos hochladen“ ---------- */

add_action( 'admin_menu', function () {
	add_submenu_page( 'kilic', 'Fotos hochladen', 'Fotos hochladen', 'kilic_buero', 'kilic-fotos', 'kilic_render_fotos_seite' );
}, 20 );

function kilic_render_fotos_seite() {
	$kunden = get_posts( array( 'post_type' => 'kilic_kunde', 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC' ) );
	$belege = get_posts( array( 'post_type' => 'kilic_beleg', 'numberposts' => 200, 'meta_query' => array( array( 'key' => '_status', 'value' => array( 'entwurf', 'offen', 'angenommen' ), 'compare' => 'IN' ) ) ) );
	$vor    = absint( $_GET['kunde'] ?? 0 ); // phpcs:ignore WordPress.Security.NonceVerification
	$letzte = get_posts( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => 12, 'meta_key' => '_kilic_kunde', 'orderby' => 'date', 'order' => 'DESC' ) );
	?>
	<div class="wrap kilic-fotoseite">
		<h1>Fotos vom Objekt</h1>
		<p class="kf-intro">Fotos direkt auf der Baustelle aufnehmen und dem Kunden zuordnen – sie landen in der Kundenakte und im Verlauf.</p>
		<?php if ( isset( $_GET['ok'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="kf-ok" role="status"><span class="dashicons dashicons-yes-alt"></span> <?php echo (int) $_GET['ok']; // phpcs:ignore WordPress.Security.NonceVerification ?> Foto(s) gespeichert. <a href="<?php echo esc_url( get_edit_post_link( absint( $_GET['kunde'] ?? 0 ) ) . '#kilic_kunde_fotos' ); // phpcs:ignore WordPress.Security.NonceVerification ?>">Zur Kundenakte →</a></div>
		<?php endif; ?>
		<div class="kf-grid">
			<form method="post" enctype="multipart/form-data" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
				<input type="hidden" name="action" value="kilic_fotos_hochladen">
				<?php wp_nonce_field( 'kilic_fotos_hochladen' ); ?>

				<section class="kf-step">
					<h2><b>1</b> Kunde</h2>
					<select id="kf_kunde" name="kunde" required>
						<option value="">– Kunde wählen –</option>
						<option value="neu">+ Neuer Kunde</option>
						<?php foreach ( $kunden as $k ) : ?>
							<option value="<?php echo esc_attr( $k->ID ); ?>" <?php selected( $vor, $k->ID ); ?>><?php echo esc_html( kilic_kunde_label( $k->ID ) ); ?></option>
						<?php endforeach; ?>
					</select>
					<input type="text" name="neu_name" class="kf-neu" placeholder="Vor- und Nachname des neuen Kunden" hidden>
					<label for="kf_beleg" class="kf-sub">Zu einem Auftrag / Beleg (optional)</label>
					<select id="kf_beleg" name="beleg">
						<option value="">– ohne Zuordnung –</option>
						<?php foreach ( $belege as $b ) : ?>
							<option value="<?php echo esc_attr( $b->ID ); ?>" data-kunde="<?php echo esc_attr( get_post_meta( $b->ID, '_kunde', true ) ); ?>"><?php echo esc_html( kilic_beleg_label( $b->ID ) . ( get_post_meta( $b->ID, '_leistung', true ) ? ' · ' . get_post_meta( $b->ID, '_leistung', true ) : '' ) ); ?></option>
						<?php endforeach; ?>
					</select>
				</section>

				<section class="kf-step">
					<h2><b>2</b> Fotos</h2>
					<label class="kf-drop" for="kf_dateien">
						<span class="dashicons dashicons-camera"></span>
						<strong>Fotos aufnehmen oder auswählen</strong>
						<small>Am Handy öffnet sich Kamera oder Galerie · am PC Dateien hierher ziehen · JPG, PNG, PDF</small>
						<input type="file" id="kf_dateien" name="kilic_fotos[]" accept="image/*,application/pdf" multiple>
					</label>
					<div class="kf-previews" aria-live="polite"></div>
				</section>

				<section class="kf-step">
					<h2><b>3</b> Notiz <span>(optional)</span></h2>
					<input type="text" id="kf_notiz" name="notiz" placeholder="z. B. „Zustand vor Beginn“, „Riss im Flur“, „Abnahme“">
				</section>

				<button type="submit" class="button button-primary button-hero kf-submit" disabled>Fotos hochladen</button>
			</form>

			<aside class="kf-recent">
				<h2>Zuletzt hochgeladen</h2>
				<?php if ( ! $letzte ) : ?>
					<p class="description">Hier erscheinen die neuesten Fotos aller Kunden.</p>
				<?php else : ?>
					<div class="kf-recent-grid">
						<?php foreach ( $letzte as $f ) :
							$kid = (int) get_post_meta( $f->ID, '_kilic_kunde', true );
							?>
							<a href="<?php echo esc_url( get_edit_post_link( $kid ) . '#kilic_kunde_fotos' ); ?>" title="<?php echo esc_attr( $f->post_excerpt ); ?>">
								<?php echo wp_attachment_is_image( $f->ID ) ? wp_get_attachment_image( $f->ID, 'thumbnail' ) : '<span class="dashicons dashicons-pdf"></span>'; // phpcs:ignore WordPress.Security.EscapeOutput ?>
								<span><?php echo esc_html( get_the_title( $kid ) ); ?><br><small><?php echo esc_html( get_the_date( 'd.m.Y', $f ) ); ?></small></span>
							</a>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
			</aside>
		</div>
	</div>
	<?php
}

add_action( 'admin_post_kilic_fotos_hochladen', function () {
	check_admin_referer( 'kilic_fotos_hochladen' );
	if ( ! current_user_can( 'kilic_buero' ) || ! current_user_can( 'upload_files' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	$kunde = sanitize_text_field( wp_unslash( $_POST['kunde'] ?? '' ) );
	if ( 'neu' === $kunde ) {
		$kunde = kilic_kunde_finden_oder_anlegen( sanitize_text_field( wp_unslash( $_POST['neu_name'] ?? '' ) ), array( 'privat' => '1' ) );
	}
	$kunde = absint( $kunde );
	if ( ! $kunde ) {
		wp_die( 'Bitte einen Kunden wählen.', '', array( 'back_link' => true ) );
	}
	$n = kilic_fotos_speichern( $kunde, sanitize_text_field( wp_unslash( $_POST['notiz'] ?? '' ) ), absint( $_POST['beleg'] ?? 0 ) );
	wp_safe_redirect( admin_url( 'admin.php?page=kilic-fotos&ok=' . $n . '&kunde=' . $kunde ) );
	exit;
} );
