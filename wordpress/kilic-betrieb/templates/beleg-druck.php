<?php
/**
 * Druckansicht für Angebote und Rechnungen (DIN A4, DIN 5008 Anschriftfeld).
 * Über „Drucken → Als PDF speichern“ entsteht das PDF für den Versand.
 *
 * @var int $id
 */

defined( 'ABSPATH' ) || exit;

$typ      = kilic_beleg_typ( $id );
$nummer   = get_post_meta( $id, '_nummer', true );
$status   = get_post_meta( $id, '_status', true );
$kunde    = (int) get_post_meta( $id, '_kunde', true );
$privat   = $kunde && '1' === get_post_meta( $kunde, '_privat', true );
$pos      = kilic_beleg_positionen( $id );
$sum      = kilic_beleg_summen( $id );
$lohn     = (int) get_post_meta( $id, '_lohn', true );
$pdf      = ! empty( $kilic_pdf );
$art      = isset( $kilic_art ) ? $kilic_art : sanitize_key( $_GET['art'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
$titel    = 'rechnung' === $typ ? kilic_rechnungsart_name( $id ) : 'Angebot';
$doktitel = $titel;
if ( 'ab' === $art && 'angebot' === $typ ) {
	$doktitel = 'Auftragsbestätigung';
} elseif ( 'mahnung' === $art && 'rechnung' === $typ ) {
	$doktitel = 'Zahlungserinnerung';
}
$entwurf  = ( ! $nummer || 'entwurf' === $status ) && ! $art;
$zeichen  = 'data:image/svg+xml;base64,' . base64_encode( str_replace( '<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ', kilic_logo_zeichen() ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions
$eigenes  = kilic_opt( 'logo' );
$wort     = explode( ' ', preg_replace( '/\s+Meisterbetrieb$/i', '', kilic_opt( 'firma' ) ), 2 );
$ort_kurz = trim( preg_replace( '/^\d+\s*/', '', explode( '-', kilic_opt( 'plz_ort' ) )[0] ) );
$firma    = kilic_opt( 'firma' );
$absender = trim( $firma . ' · ' . kilic_opt( 'strasse' ) . ' · ' . kilic_opt( 'plz_ort' ), ' ·' );
?><!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title><?php echo esc_html( $doktitel . ' ' . ( $nummer ? $nummer : 'Entwurf' ) ); ?></title>
<style>
	@page { size: A4; margin: 0; }
	* { box-sizing: border-box; }
	body { margin: 0; background: <?php echo $pdf ? '#fff' : '#e9e7e3'; ?>; font: 10pt/1.45 <?php echo $pdf ? 'Helvetica, sans-serif' : '"Helvetica Neue", Arial, sans-serif'; ?>; color: #1b1f23; }
	.sheet { width: 210mm; min-height: 297mm; <?php echo $pdf ? 'margin: 0;' : 'margin: 10mm auto; box-shadow: 0 10px 30px rgba(0,0,0,.12);'; ?> background: #fff; padding: 0 20mm 28mm 25mm; position: relative; }
	<?php if ( ! $pdf ) : ?>
	@font-face { font-family: "Kilic Barlow Condensed"; font-weight: 700; src: url(<?php echo esc_url( KILIC_URL . 'assets/fonts/barlow-condensed-latin-700-normal.woff2' ); ?>) format("woff2"); }
	@font-face { font-family: "Kilic Inter"; font-weight: 500; src: url(<?php echo esc_url( KILIC_URL . 'assets/fonts/inter-latin-500-normal.woff2' ); ?>) format("woff2"); }
	<?php endif; ?>
	table.head { width: 100%; height: 45mm; border-collapse: collapse; border-bottom: 3px solid #e8892b; }
	table.head td { vertical-align: bottom; padding: 0 0 5mm; }
	table.logo { border-collapse: collapse; }
	table.logo td { padding: 0; vertical-align: middle; }
	.mark { width: 16mm; height: 16mm; display: block; margin-right: 4mm; }
	.wort { font-family: "Kilic Barlow Condensed", "Arial Narrow", Helvetica, sans-serif; font-weight: 700; font-size: <?php echo $pdf ? '22pt' : '26pt'; ?>; line-height: 1; letter-spacing: .04em; text-transform: uppercase; color: #1b1f23; }
	.wort span { color: #e8892b; }
	.zusatz { font-family: "Kilic Inter", Helvetica, Arial, sans-serif; font-size: 7pt; letter-spacing: .24em; text-transform: uppercase; color: #6b7279; padding-top: 1.5mm; }
	.eigenes-logo { max-height: 20mm; max-width: 90mm; display: block; }
	.sub { display: block; margin-top: 3mm; font-size: 7pt; letter-spacing: .08em; text-transform: uppercase; color: #6b7279; }
	.kontakt { text-align: right; font-size: 8.5pt; color: #3b434b; }
	* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	.adresse { position: absolute; top: 50mm; left: 25mm; width: 85mm; }
	.adresse .absender { font-size: 7pt; color: #6b7279; border-bottom: 1px solid #ccc; padding-bottom: 1mm; margin-bottom: 3mm; }
	.meta { position: absolute; top: 50mm; right: 20mm; width: 70mm; font-size: 9pt; }
	.meta table { width: 100%; border-collapse: collapse; }
	.meta td { padding: 1mm 0; }
	.meta td.v { text-align: right; font-weight: bold; }
	.body { padding-top: 62mm; }
	h1 { font-size: 16pt; margin: 0 0 6mm; }
	table.pos { width: 100%; border-collapse: collapse; margin: 5mm 0; }
	.pos th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1.5px solid #1b1f23; padding: 2mm 1.5mm; }
	.pos td { padding: 2.5mm 1.5mm; border-bottom: 1px solid #ddd; vertical-align: top; }
	.pos .r { text-align: right; white-space: nowrap; }
	.pos .txt { white-space: pre-line; }
	table.summe { margin-left: 85mm; width: 80mm; border-collapse: collapse; }
	.summe td { padding: 1.5mm 1.5mm; }
	.summe td.v { text-align: right; white-space: nowrap; vertical-align: top; }
	.summe .total td { border-top: 1.5px solid #1b1f23; font-weight: bold; font-size: 11pt; }
	.quittung { margin-top: 4mm; padding: 3mm 4mm; border: 1.5px solid #1f9d55; color: #14653a; }
	.hinweis { margin-top: 6mm; font-size: 8.5pt; color: #3b434b; }
	table.foot { position: absolute; left: 25mm; bottom: 10mm; width: 165mm; border-collapse: collapse; border-top: 1px solid #ccc; font-size: 7pt; color: #6b7279; }
	table.foot td { padding: 3mm 3mm 0 0; vertical-align: top; width: 33%; }
	.wm { position: absolute; top: 120mm; left: 0; width: 210mm; text-align: center; font-size: 60pt; font-weight: bold; color: #f6d5d7; transform: rotate(-20deg); }
	.toolbar { position: sticky; top: 0; background: #1b1f23; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; justify-content: center; font-family: Arial, sans-serif; }
	.toolbar button { background: #e8892b; color: #fff; border: 0; padding: 10px 18px; font-weight: 700; border-radius: 5px; cursor: pointer; font-size: 14px; }
	@media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; } .toolbar { display: none; } }
	<?php if ( $pdf ) : ?>
	/* dompdf: ohne border-box – Breiten auf den Inhaltsbereich (210 − 25 − 20 mm) rechnen */
	.sheet { width: auto; min-height: 0; padding: 0 20mm 0 25mm; }
	table.head { height: auto; }
	table.head td { padding: 14mm 0 5mm; }
	.adresse { top: 52mm; }
	.meta { top: 52mm; }
	table.foot { position: fixed; bottom: 10mm; left: 25mm; width: 165mm; }
	.wm { left: 0; width: 210mm; }
	<?php endif; ?>
</style>
</head>
<body>
<?php if ( ! $pdf ) : ?>
<div class="toolbar">
	<span>Tipp: Im Druckdialog „Als PDF speichern“ wählen – oder im Backend „Per E-Mail senden“.</span>
	<button type="button" onclick="window.print()">Drucken / PDF</button>
</div>
<?php endif; ?>
<div class="sheet">
	<?php if ( $entwurf ) : ?><div class="wm">ENTWURF</div><?php endif; ?>
	<?php if ( 'storniert' === $status ) : ?><div class="wm">STORNIERT</div><?php endif; ?>
	<table class="head"><tr>
		<td>
			<?php if ( $eigenes ) : ?>
				<img class="eigenes-logo" src="<?php echo esc_url( $eigenes ); ?>" alt="">
			<?php else : ?>
				<table class="logo"><tr>
					<td><img class="mark" src="<?php echo esc_attr( $zeichen ); ?>" alt=""></td>
					<td><div class="wort"><?php echo esc_html( $wort[0] ); ?><?php if ( isset( $wort[1] ) ) : ?> <span><?php echo esc_html( $wort[1] ); ?></span><?php endif; ?></div><div class="zusatz">Meisterbetrieb · <?php echo esc_html( $ort_kurz ); ?></div></td>
				</tr></table>
			<?php endif; ?>
			<span class="sub"><?php echo esc_html( $firma ); ?> · <?php echo esc_html( kilic_opt( 'firma2' ) ); ?> · Inh. <?php echo esc_html( kilic_opt( 'inhaber' ) ); ?></span>
		</td>
		<td class="kontakt">
			<?php echo esc_html( kilic_opt( 'strasse' ) ); ?><br>
			<?php echo esc_html( kilic_opt( 'plz_ort' ) ); ?><br>
			Tel. <?php echo esc_html( kilic_opt( 'telefon' ) ); ?><br>
			<?php echo esc_html( kilic_opt( 'email' ) ); ?>
		</td>
	</tr></table>

	<div class="adresse">
		<div class="absender"><?php echo esc_html( $absender ); ?></div>
		<?php foreach ( kilic_kunde_adresse( $kunde ) as $line ) : ?>
			<?php echo esc_html( $line ); ?><br>
		<?php endforeach; ?>
	</div>

	<div class="meta">
		<table>
			<tr><td><?php echo esc_html( $titel ); ?>-Nr.</td><td class="v"><?php echo esc_html( $nummer ? $nummer : '—' ); ?></td></tr>
			<tr><td>Datum</td><td class="v"><?php echo esc_html( kilic_date( get_post_meta( $id, '_datum', true ) ) ); ?></td></tr>
			<?php if ( $kunde && get_post_meta( $kunde, '_kundennr', true ) ) : ?>
				<tr><td>Kunden-Nr.</td><td class="v"><?php echo esc_html( get_post_meta( $kunde, '_kundennr', true ) ); ?></td></tr>
			<?php endif; ?>
			<?php if ( $kunde && get_post_meta( $kunde, '_ust_id', true ) ) : ?>
				<tr><td>Ihre USt-IdNr.</td><td class="v"><?php echo esc_html( get_post_meta( $kunde, '_ust_id', true ) ); ?></td></tr>
			<?php elseif ( $kunde && get_post_meta( $kunde, '_steuernr', true ) ) : ?>
				<tr><td>Ihre St.-Nr.</td><td class="v"><?php echo esc_html( get_post_meta( $kunde, '_steuernr', true ) ); ?></td></tr>
			<?php endif; ?>
			<?php if ( 'rechnung' === $typ ) : ?>
				<tr><td>Fällig am</td><td class="v"><?php echo esc_html( kilic_date( kilic_beleg_faellig( $id ) ) ); ?></td></tr>
			<?php endif; ?>
		</table>
	</div>

	<div class="body">
		<h1><?php echo esc_html( $doktitel . ( 'mahnung' === $art ? ' zur Rechnung ' . $nummer : ( $nummer ? ' ' . $nummer : '' ) ) ); ?></h1>
		<?php if ( 'mahnung' === $art ) :
			$offen_rest = kilic_beleg_rest( $id );
			$neu_frist  = gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) . ' +7 days' ) );
			?>
			<p>Sehr geehrte Damen und Herren,</p>
			<p>sicher ist es Ihrer Aufmerksamkeit entgangen: Für die folgende Rechnung konnten wir bisher keinen vollständigen Zahlungseingang feststellen.</p>
			<table class="pos">
				<thead><tr><th>Rechnung</th><th>Datum</th><th>Fällig seit</th><th class="r">Betrag</th><th class="r">Bezahlt</th><th class="r">Offen</th></tr></thead>
				<tbody><tr>
					<td><?php echo esc_html( $nummer ); ?></td>
					<td><?php echo esc_html( kilic_date( get_post_meta( $id, '_datum', true ) ) ); ?></td>
					<td><?php echo esc_html( kilic_date( kilic_beleg_faellig( $id ) ) ); ?></td>
					<td class="r"><?php echo esc_html( kilic_eur( $sum['brutto'] ) ); ?></td>
					<td class="r"><?php echo esc_html( kilic_eur( kilic_beleg_bezahlt( $id ) ) ); ?></td>
					<td class="r"><strong><?php echo esc_html( kilic_eur( $offen_rest ) ); ?></strong></td>
				</tr></tbody>
			</table>
			<p>Bitte überweisen Sie den offenen Betrag von <strong><?php echo esc_html( kilic_eur( $offen_rest ) ); ?></strong> bis zum <strong><?php echo esc_html( kilic_date( $neu_frist ) ); ?></strong> unter Angabe der Rechnungsnummer auf das unten genannte Konto.</p>
			<p>Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.</p>
			<p>Mit freundlichen Grüßen<br><?php echo esc_html( $firma ); ?></p>
		<?php else : ?>
		<?php if ( get_post_meta( $id, '_leistung', true ) ) : ?>
			<p><strong><?php echo 'rechnung' === $typ ? 'Leistungszeitraum / Bauvorhaben' : 'Bauvorhaben'; ?>:</strong> <?php echo esc_html( get_post_meta( $id, '_leistung', true ) ); ?></p>
		<?php endif; ?>
		<?php if ( 'ab' === $art ) :
			$von = get_post_meta( $id, '_termin_von', true );
			$bis = get_post_meta( $id, '_termin_bis', true );
			?>
			<p>Vielen Dank für Ihren Auftrag! Hiermit bestätigen wir den Auftrag gemäß unserem Angebot <?php echo esc_html( $nummer ); ?> über folgende Leistungen.</p>
			<?php if ( $von ) : ?><p><strong>Ausführungstermin:</strong> <?php echo esc_html( kilic_date( $von ) . ( $bis && $bis !== $von ? ' – ' . kilic_date( $bis ) : '' ) ); ?></p><?php endif; ?>
		<?php else : ?>
			<p><?php echo nl2br( esc_html( get_post_meta( $id, '_text_oben', true ) ) ); ?></p>
		<?php endif; ?>

		<table class="pos">
			<?php $mit_rabatt = (bool) array_filter( wp_list_pluck( $pos, 'rabatt' ) ); ?>
			<thead><tr><th>Pos.</th><th>Beschreibung</th><th class="r">Menge</th><th>Einheit</th><th class="r">Einzelpreis</th><?php if ( $mit_rabatt ) : ?><th class="r">Rabatt</th><?php endif; ?><th class="r">Gesamt</th></tr></thead>
			<tbody>
			<?php foreach ( $pos as $i => $p ) : ?>
				<tr>
					<td><?php echo (int) $i + 1; ?></td>
					<td class="txt"><?php echo esc_html( $p['text'] ); ?></td>
					<td class="r"><?php echo esc_html( kilic_num( $p['menge'], 3 ) ); ?></td>
					<td><?php echo esc_html( $p['einheit'] ); ?></td>
					<td class="r"><?php echo esc_html( kilic_eur( $p['preis'] ) ); ?></td>
					<?php if ( $mit_rabatt ) : ?><td class="r"><?php echo ! empty( $p['rabatt'] ) ? esc_html( kilic_num( $p['rabatt'], 2 ) ) . ' %' : ''; ?></td><?php endif; ?>
					<td class="r"><?php echo esc_html( kilic_eur( kilic_pos_summe( $p ) ) ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<table class="summe">
			<?php if ( $sum['rabatt'] ) : ?>
				<tr><td>Zwischensumme netto</td><td class="v"><?php echo esc_html( kilic_eur( $sum['zwischen'] ) ); ?></td></tr>
				<tr><td>abzgl. <?php echo esc_html( get_post_meta( $id, '_rabatt_text', true ) ? get_post_meta( $id, '_rabatt_text', true ) : 'Rabatt' ); ?><?php echo 'prozent' === $sum['rabatt_art'] ? ' ' . esc_html( kilic_num( $sum['rabatt_wert'], 2 ) ) . ' %' : ''; ?></td><td class="v">– <?php echo esc_html( kilic_eur( $sum['rabatt'] ) ); ?></td></tr>
			<?php endif; ?>
			<tr><td>Summe netto</td><td class="v"><?php echo esc_html( kilic_eur( $sum['netto'] ) ); ?></td></tr>
			<tr><td>zzgl. <?php echo esc_html( kilic_num( $sum['satz'], 1 ) ); ?> % MwSt.</td><td class="v"><?php echo esc_html( kilic_eur( $sum['mwst'] ) ); ?></td></tr>
			<tr class="total"><td><?php echo 'rechnung' === $typ ? ( $sum['abzuege'] ? 'Gesamtbetrag' : 'Rechnungsbetrag' ) : ( 'ab' === $art ? 'Auftragssumme' : 'Angebotssumme' ); ?></td><td class="v"><?php echo esc_html( kilic_eur( $sum['brutto'] ) ); ?></td></tr>
			<?php foreach ( $sum['abzuege'] as $ab ) : ?>
				<tr><td>abzgl. <?php echo esc_html( kilic_beleg_label( $ab['id'] ) ); ?> vom <?php echo esc_html( kilic_date( get_post_meta( $ab['id'], '_datum', true ) ) ); ?><br><small>netto <?php echo esc_html( kilic_eur( $ab['netto'] ) ); ?> + MwSt. <?php echo esc_html( kilic_eur( $ab['mwst'] ) ); ?></small></td><td class="v">– <?php echo esc_html( kilic_eur( $ab['brutto'] ) ); ?></td></tr>
			<?php endforeach; ?>
			<?php if ( $sum['abzuege'] ) : ?>
				<tr class="total"><td>Verbleibender Rechnungsbetrag</td><td class="v"><?php echo esc_html( kilic_eur( $sum['zahlbetrag'] ) ); ?></td></tr>
			<?php endif; ?>
			<?php if ( 'rechnung' === $typ && kilic_beleg_bezahlt( $id ) > 0 && 'storniert' !== $status ) : ?>
				<tr><td>bereits bezahlt</td><td class="v">– <?php echo esc_html( kilic_eur( kilic_beleg_bezahlt( $id ) ) ); ?></td></tr>
				<tr class="total"><td>Noch offen</td><td class="v"><?php echo esc_html( kilic_eur( kilic_beleg_rest( $id ) ) ); ?></td></tr>
			<?php endif; ?>
		</table>

		<?php if ( 'ab' === $art ) : ?>
			<p>Wir freuen uns auf die Zusammenarbeit. Bei Fragen erreichen Sie uns unter <?php echo esc_html( kilic_opt( 'telefon' ) ); ?>.</p>
		<?php else :
			$za      = get_post_meta( $id, '_zahlungsart', true );
			$za      = $za ? $za : 'Überweisung';
			$bar     = in_array( $za, array( 'Bar', 'EC-Karte', 'Kreditkarte' ), true );
			$bezahlt = 'rechnung' === $typ && kilic_beleg_bezahlt( $id ) > 0 && kilic_beleg_rest( $id ) <= 0;
			?>
			<?php if ( 'rechnung' === $typ && $bezahlt && $bar ) : ?>
				<p class="quittung"><strong>Betrag dankend erhalten</strong> (<?php echo esc_html( $za ); ?>) am <?php echo esc_html( kilic_date( get_post_meta( $id, '_bezahlt_am', true ) ) ); ?>.</p>
			<?php elseif ( 'rechnung' === $typ && $bar ) : ?>
				<p>Zahlungsart: <strong><?php echo esc_html( $za ); ?></strong> – bitte bei Fertigstellung vor Ort begleichen.</p>
			<?php else : ?>
				<p><?php echo nl2br( esc_html( get_post_meta( $id, '_text_unten', true ) ) ); ?></p>
				<?php if ( 'Überweisung' !== $za && 0 !== strpos( $za, 'Auf Rechnung' ) ) : ?><p>Zahlungsart: <strong><?php echo esc_html( $za ); ?></strong></p><?php endif; ?>
			<?php endif; ?>
			<?php if ( $sum['skonto'] && ! $bezahlt ) : ?>
				<p>Bei Zahlung innerhalb von <?php echo (int) get_post_meta( $id, '_skonto_tage', true ); ?> Tagen gewähren wir <?php echo esc_html( kilic_num( get_post_meta( $id, '_skonto_prozent', true ), 2 ) ); ?> % Skonto (<?php echo esc_html( kilic_eur( $sum['skonto'] ) ); ?>) – Zahlbetrag dann <strong><?php echo esc_html( kilic_eur( $sum['zahlbetrag'] - $sum['skonto'] ) ); ?></strong>.</p>
			<?php endif; ?>
		<?php endif; ?>
		<?php endif; ?>

		<?php if ( 'rechnung' === $typ && 'mahnung' !== $art ) : ?>
			<?php if ( $privat && $lohn > 0 ) : ?>
				<p class="hinweis">In diesem Rechnungsbetrag sind Arbeitskosten in Höhe von <?php echo esc_html( kilic_eur( (int) round( $lohn * ( 1 + $sum['satz'] / 100 ) ) ) ); ?> (inkl. MwSt.) enthalten, die nach § 35a EStG steuerlich geltend gemacht werden können.</p>
			<?php endif; ?>
			<?php if ( $privat ) : ?>
				<p class="hinweis">Hinweis: Als Privatperson sind Sie gemäß § 14b Abs. 1 Satz 5 UStG verpflichtet, diese Rechnung zwei Jahre lang aufzubewahren.</p>
			<?php endif; ?>
		<?php endif; ?>
	</div>

	<table class="foot"><tr>
		<td><?php echo esc_html( $firma ); ?><br>Inh. <?php echo esc_html( kilic_opt( 'inhaber' ) ); ?><br><?php echo esc_html( kilic_opt( 'strasse' ) . ', ' . kilic_opt( 'plz_ort' ) ); ?></td>
		<td>
			<?php if ( kilic_opt( 'steuernr' ) ) : ?>Steuernummer: <?php echo esc_html( kilic_opt( 'steuernr' ) ); ?><br><?php endif; ?>
			<?php if ( kilic_opt( 'ust_id' ) ) : ?>USt-IdNr.: <?php echo esc_html( kilic_opt( 'ust_id' ) ); ?><br><?php endif; ?>
			Tel. <?php echo esc_html( kilic_opt( 'telefon' ) ); ?>
		</td>
		<td>
			<?php if ( kilic_opt( 'bank' ) ) : ?><?php echo esc_html( kilic_opt( 'bank' ) ); ?><br><?php endif; ?>
			<?php if ( kilic_opt( 'iban' ) ) : ?>IBAN: <?php echo esc_html( kilic_opt( 'iban' ) ); ?><br><?php endif; ?>
			<?php if ( kilic_opt( 'bic' ) ) : ?>BIC: <?php echo esc_html( kilic_opt( 'bic' ) ); ?><?php endif; ?>
		</td>
	</tr></table>
</div>
</body>
</html>
