<?php
/**
 * Umsatz-Übersicht im Cockpit: Zahlungseingang und gestellte Rechnungen
 * nach Tag, Woche, Monat, Jahr oder freiem Zeitraum, mit Balkendiagramm.
 */

defined( 'ABSPATH' ) || exit;

/** Zeitraum aus der Adresse lesen: [art, von, bis, beschriftung, zurück, vor]. */
function kilic_umsatz_zeitraum() {
	$art = sanitize_key( $_GET['u'] ?? 'monat' ); // phpcs:ignore WordPress.Security.NonceVerification
	$art = in_array( $art, array( 'tag', 'woche', 'monat', 'jahr', 'frei' ), true ) ? $art : 'monat';
	$tz  = wp_timezone();
	$heute = new DateTimeImmutable( 'today', $tz );
	$d     = sanitize_text_field( wp_unslash( $_GET['ud'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
	$basis = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $d ) ? new DateTimeImmutable( $d, $tz ) : $heute;
	$monate = array( 1 => 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember' );

	switch ( $art ) {
		case 'tag':
			$von = $basis; $bis = $basis;
			$tage_de = array( 1 => 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag' );
			$name = ( $basis == $heute ? 'Heute, ' : '' ) . $tage_de[ (int) $basis->format( 'N' ) ] . ', ' . $basis->format( 'd.m.Y' );
			$zur = $basis->modify( '-1 day' ); $vor = $basis->modify( '+1 day' );
			break;
		case 'woche':
			$von = $basis->modify( 'monday this week' ); $bis = $von->modify( '+6 days' );
			$name = 'KW ' . $von->format( 'W' ) . ' · ' . $von->format( 'd.m.' ) . '–' . $bis->format( 'd.m.Y' );
			$zur = $von->modify( '-7 days' ); $vor = $von->modify( '+7 days' );
			break;
		case 'jahr':
			$von = $basis->setDate( (int) $basis->format( 'Y' ), 1, 1 ); $bis = $von->setDate( (int) $von->format( 'Y' ), 12, 31 );
			$name = 'Jahr ' . $von->format( 'Y' );
			$zur = $von->modify( '-1 year' ); $vor = $von->modify( '+1 year' );
			break;
		case 'frei':
			$v = sanitize_text_field( wp_unslash( $_GET['uv'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
			$b = sanitize_text_field( wp_unslash( $_GET['ub'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
			$von = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? new DateTimeImmutable( $v, $tz ) : $heute->modify( 'first day of this month' );
			$bis = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $b ) ? new DateTimeImmutable( $b, $tz ) : $heute;
			if ( $bis < $von ) {
				list( $von, $bis ) = array( $bis, $von );
			}
			$name = $von->format( 'd.m.Y' ) . ' – ' . $bis->format( 'd.m.Y' );
			$zur = null; $vor = null;
			break;
		default:
			$von = $basis->modify( 'first day of this month' ); $bis = $basis->modify( 'last day of this month' );
			$name = $monate[ (int) $von->format( 'n' ) ] . ' ' . $von->format( 'Y' );
			$zur = $von->modify( '-1 month' ); $vor = $von->modify( '+1 month' );
	}
	return array( 'art' => $art, 'von' => $von, 'bis' => $bis, 'name' => $name, 'zur' => $zur, 'vor' => $vor );
}

/** Kennzahlen und Diagramm-Reihen für einen Zeitraum. */
function kilic_umsatz_daten( $z ) {
	$von = $z['von']->format( 'Y-m-d' );
	$bis = $z['bis']->format( 'Y-m-d' );
	$tage = (int) $z['von']->diff( $z['bis'] )->days + 1;
	$nach_monat = 'jahr' === $z['art'] || ( 'frei' === $z['art'] && $tage > 62 );
	$schluessel = function ( $datum ) use ( $nach_monat ) {
		return $nach_monat ? substr( $datum, 0, 7 ) : substr( $datum, 0, 10 );
	};
	// Leere Balken für jeden Tag bzw. Monat.
	$reihe = array();
	if ( 'tag' !== $z['art'] ) {
		$i = $nach_monat ? $z['von']->modify( 'first day of this month' ) : $z['von'];
		while ( $i <= $z['bis'] ) {
			$reihe[ $schluessel( $i->format( 'Y-m-d' ) ) ] = array( 'ein' => 0, 'rech' => 0 );
			$i = $nach_monat ? $i->modify( '+1 month' ) : $i->modify( '+1 day' );
		}
	}
	$d = array( 'eingang' => 0, 'rech_brutto' => 0, 'rech_netto' => 0, 'rech_anzahl' => 0, 'offen' => 0, 'ang_anzahl' => 0, 'ang_summe' => 0, 'ang_ja' => 0, 'arten' => array(), 'kunden' => array(), 'reihe' => $reihe, 'nach_monat' => $nach_monat );

	$ids = get_posts( array( 'post_type' => 'kilic_beleg', 'numberposts' => -1, 'fields' => 'ids', 'post_status' => 'any' ) );
	foreach ( $ids as $id ) {
		$status = get_post_meta( $id, '_status', true );
		if ( 'storniert' === $status || in_array( get_post_status( $id ), array( 'trash', 'auto-draft' ), true ) ) {
			continue;
		}
		$datum = (string) get_post_meta( $id, '_datum', true );
		$typ   = kilic_beleg_typ( $id );
		// Eingegangenes Geld zählt immer (auch wenn die Rechnung noch als Entwurf markiert ist).
		foreach ( kilic_zahlungen( $id ) as $zahl ) {
				$zd = (string) ( $zahl['datum'] ?? '' );
				if ( $zd >= $von && $zd <= $bis ) {
					$b = (int) ( $zahl['betrag'] ?? 0 );
					$d['eingang'] += $b;
					$art = $zahl['art'] ?? 'Sonstiges';
					$d['arten'][ $art ] = ( $d['arten'][ $art ] ?? 0 ) + $b;
					$k = $schluessel( $zd );
					if ( isset( $d['reihe'][ $k ] ) ) {
						$d['reihe'][ $k ]['ein'] += $b;
					}
				}
		}
		if ( 'entwurf' === $status ) {
			continue;
		}
		if ( 'rechnung' === $typ ) {
			if ( $datum >= $von && $datum <= $bis ) {
				$s = kilic_beleg_summen( $id );
				$d['rech_brutto'] += (int) $s['zahlbetrag'];
				$d['rech_netto']  += (int) $s['netto'] - (int) ( $s['abz_netto'] ?? 0 );
				$d['rech_anzahl']++;
				$d['offen']       += max( 0, (int) kilic_beleg_rest( $id ) );
				$k = $schluessel( $datum );
				if ( isset( $d['reihe'][ $k ] ) ) {
					$d['reihe'][ $k ]['rech'] += (int) $s['zahlbetrag'];
				}
				$kunde = (int) get_post_meta( $id, '_kunde', true );
				if ( $kunde ) {
					$d['kunden'][ $kunde ] = ( $d['kunden'][ $kunde ] ?? 0 ) + (int) $s['zahlbetrag'];
				}
			}
		} elseif ( $datum >= $von && $datum <= $bis ) {
			$d['ang_anzahl']++;
			$d['ang_summe'] += (int) kilic_beleg_summen( $id )['brutto'];
			if ( in_array( $status, array( 'angenommen', 'abgerechnet' ), true ) || get_post_meta( $id, '_rechnung', true ) ) {
				$d['ang_ja']++;
			}
		}
	}
	arsort( $d['arten'] );
	arsort( $d['kunden'] );
	return $d;
}

function kilic_umsatz_url( $args ) {
	return add_query_arg( array_merge( array( 'page' => 'kilic' ), $args ), admin_url( 'admin.php' ) ) . '#umsatz';
}

/** Ausgabe im Cockpit. */
function kilic_umsatz_panel() {
	$z = kilic_umsatz_zeitraum();
	$d = kilic_umsatz_daten( $z );
	$arten = array( 'tag' => 'Tag', 'woche' => 'Woche', 'monat' => 'Monat', 'jahr' => 'Jahr', 'frei' => 'Zeitraum' );
	$heute = current_time( 'Y-m-d' );
	$max = 1;
	foreach ( $d['reihe'] as $r ) {
		$max = max( $max, $r['ein'], $r['rech'] );
	}
	$kurz = function ( $c ) {
		$e = $c / 100;
		return $e >= 10000 ? number_format_i18n( $e / 1000, 0 ) . ' T€' : ( $e >= 1000 ? number_format_i18n( $e / 1000, 1 ) . ' T€' : number_format_i18n( $e, 0 ) . ' €' );
	};
	$wt = array( 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So' );
	$mn = array( 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez' );
	?>
	<section class="ku" id="umsatz" aria-labelledby="ku-titel">
		<div class="ku-kopf">
			<h2 id="ku-titel">Umsatz</h2>
			<nav class="ku-seg" aria-label="Zeitraum wählen">
				<?php foreach ( $arten as $k => $l ) : ?>
					<a href="<?php echo esc_url( kilic_umsatz_url( array( 'u' => $k ) ) ); ?>" class="<?php echo $z['art'] === $k ? 'is-aktiv' : ''; ?>" <?php echo $z['art'] === $k ? 'aria-current="true"' : ''; ?>><?php echo esc_html( $l ); ?></a>
				<?php endforeach; ?>
			</nav>
		</div>
		<div class="ku-zeit">
			<?php if ( 'frei' === $z['art'] ) : ?>
				<form class="ku-frei" method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>#umsatz">
					<input type="hidden" name="page" value="kilic"><input type="hidden" name="u" value="frei">
					<label>Von <input type="date" name="uv" value="<?php echo esc_attr( $z['von']->format( 'Y-m-d' ) ); ?>"></label>
					<label>Bis <input type="date" name="ub" value="<?php echo esc_attr( $z['bis']->format( 'Y-m-d' ) ); ?>"></label>
					<button type="submit">Anzeigen</button>
				</form>
			<?php else : ?>
				<a class="ku-pfeil" href="<?php echo esc_url( kilic_umsatz_url( array( 'u' => $z['art'], 'ud' => $z['zur']->format( 'Y-m-d' ) ) ) ); ?>" aria-label="Zurück">‹</a>
				<strong class="ku-name"><?php echo esc_html( $z['name'] ); ?></strong>
				<a class="ku-pfeil" href="<?php echo esc_url( kilic_umsatz_url( array( 'u' => $z['art'], 'ud' => $z['vor']->format( 'Y-m-d' ) ) ) ); ?>" aria-label="Weiter">›</a>
				<?php if ( ! ( $z['von']->format( 'Y-m-d' ) <= $heute && $z['bis']->format( 'Y-m-d' ) >= $heute ) ) : ?>
					<a class="ku-heute" href="<?php echo esc_url( kilic_umsatz_url( array( 'u' => $z['art'] ) ) ); ?>">Aktuell</a>
				<?php endif; ?>
			<?php endif; ?>
		</div>

		<div class="ku-zahlen">
			<div class="ku-z ku-gruen"><span>Zahlungseingang</span><strong><?php echo esc_html( kilic_eur( $d['eingang'] ) ); ?></strong><small>tatsächlich eingegangen</small></div>
			<div class="ku-z ku-orange"><span>Rechnungen gestellt</span><strong><?php echo esc_html( kilic_eur( $d['rech_brutto'] ) ); ?></strong><small><?php echo esc_html( $d['rech_anzahl'] . ' Rechnung' . ( 1 === $d['rech_anzahl'] ? '' : 'en' ) . ' · netto ' . kilic_eur( $d['rech_netto'] ) ); ?></small></div>
			<div class="ku-z<?php echo $d['offen'] ? ' ku-rot' : ''; ?>"><span>Davon noch offen</span><strong><?php echo esc_html( kilic_eur( $d['offen'] ) ); ?></strong><small>aus Rechnungen dieses Zeitraums</small></div>
			<div class="ku-z"><span>Angebote</span><strong><?php echo (int) $d['ang_anzahl']; ?></strong><small><?php echo esc_html( kilic_eur( $d['ang_summe'] ) . ' · ' . $d['ang_ja'] . ' angenommen' . ( $d['ang_anzahl'] ? ' (' . round( $d['ang_ja'] / $d['ang_anzahl'] * 100 ) . ' %)' : '' ) ); ?></small></div>
		</div>

		<?php if ( $d['reihe'] ) : ?>
			<div class="ku-diagramm-box">
				<div class="ku-legende"><span class="ku-l-ein">Zahlungseingang</span><span class="ku-l-rech">Rechnungen gestellt</span></div>
				<div class="ku-diagramm<?php echo count( $d['reihe'] ) > 16 ? ' ku-eng' : ''; ?>" role="img" aria-label="Balkendiagramm Zahlungseingang und Rechnungen">
					<?php foreach ( $d['reihe'] as $k => $r ) :
						$ts   = strtotime( strlen( $k ) === 7 ? $k . '-01' : $k );
						$lab  = $d['nach_monat'] ? $mn[ (int) gmdate( 'n', $ts ) - 1 ] : ( 'woche' === $z['art'] ? $wt[ (int) gmdate( 'N', $ts ) - 1 ] : gmdate( 'j', $ts ) );
						$ist_heute = ( $d['nach_monat'] ? substr( $heute, 0, 7 ) : $heute ) === $k;
						$link = $d['nach_monat'] ? kilic_umsatz_url( array( 'u' => 'monat', 'ud' => $k . '-01' ) ) : kilic_umsatz_url( array( 'u' => 'tag', 'ud' => $k ) );
						$tip  = ( $d['nach_monat'] ? $mn[ (int) gmdate( 'n', $ts ) - 1 ] . ' ' . gmdate( 'Y', $ts ) : gmdate( 'd.m.Y', $ts ) ) . ' – Eingang ' . kilic_eur( $r['ein'] ) . ', Rechnungen ' . kilic_eur( $r['rech'] );
						?>
						<a class="ku-spalte<?php echo $ist_heute ? ' ist-heute' : ''; ?>" href="<?php echo esc_url( $link ); ?>" title="<?php echo esc_attr( $tip ); ?>">
							<span class="ku-wert"><?php echo $r['ein'] ? esc_html( $kurz( $r['ein'] ) ) : ''; ?></span>
							<span class="ku-balken">
								<i class="ku-b-ein" style="height:<?php echo esc_attr( round( $r['ein'] / $max * 100, 1 ) ); ?>%"></i>
								<i class="ku-b-rech" style="height:<?php echo esc_attr( round( $r['rech'] / $max * 100, 1 ) ); ?>%"></i>
							</span>
							<span class="ku-x"><?php echo esc_html( $lab ); ?></span>
						</a>
					<?php endforeach; ?>
				</div>
			</div>
		<?php endif; ?>

		<div class="ku-unten">
			<div class="ku-liste">
				<h3>Eingang nach Zahlungsart</h3>
				<?php if ( $d['arten'] ) : ?>
					<?php foreach ( $d['arten'] as $art => $b ) : ?>
						<div class="ku-zeile"><span><?php echo esc_html( $art ); ?></span><i><b style="width:<?php echo esc_attr( max( 2, round( $b / max( 1, $d['eingang'] ) * 100 ) ) ); ?>%"></b></i><strong><?php echo esc_html( kilic_eur( $b ) ); ?></strong></div>
					<?php endforeach; ?>
				<?php else : ?><p class="ku-leer">In diesem Zeitraum ist nichts eingegangen.</p><?php endif; ?>
			</div>
			<div class="ku-liste">
				<h3>Größte Kunden im Zeitraum</h3>
				<?php if ( $d['kunden'] ) : ?>
					<?php foreach ( array_slice( $d['kunden'], 0, 5, true ) as $kid => $b ) : ?>
						<div class="ku-zeile"><a href="<?php echo esc_url( get_edit_post_link( $kid ) ); ?>"><?php echo esc_html( get_the_title( $kid ) ); ?></a><i><b style="width:<?php echo esc_attr( max( 2, round( $b / max( 1, $d['rech_brutto'] ) * 100 ) ) ); ?>%"></b></i><strong><?php echo esc_html( kilic_eur( $b ) ); ?></strong></div>
					<?php endforeach; ?>
				<?php else : ?><p class="ku-leer">Keine Rechnungen in diesem Zeitraum.</p><?php endif; ?>
			</div>
		</div>
	</section>
	<?php
}
