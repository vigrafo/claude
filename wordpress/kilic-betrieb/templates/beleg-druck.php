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
$titel    = 'rechnung' === $typ ? 'Rechnung' : 'Angebot';
$entwurf  = ! $nummer || 'entwurf' === $status;
$firma    = kilic_opt( 'firma' );
$absender = trim( $firma . ' · ' . kilic_opt( 'strasse' ) . ' · ' . kilic_opt( 'plz_ort' ), ' ·' );
?><!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title><?php echo esc_html( $titel . ' ' . ( $nummer ? $nummer : 'Entwurf' ) ); ?></title>
<style>
	@page { size: A4; margin: 0; }
	* { box-sizing: border-box; }
	body { margin: 0; background: #e9e7e3; font: 10pt/1.45 "Helvetica Neue", Arial, sans-serif; color: #1b1f23; }
	.sheet { width: 210mm; min-height: 297mm; margin: 10mm auto; background: #fff; padding: 0 20mm 28mm 25mm; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,.12); }
	.head { height: 45mm; display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 6mm; border-bottom: 3px solid #e8892b; }
	@font-face { font-family: "Kilic Barlow Condensed"; font-weight: 700; src: url(<?php echo esc_url( KILIC_URL . 'assets/fonts/barlow-condensed-latin-700-normal.woff2' ); ?>) format("woff2"); }
	@font-face { font-family: "Kilic Inter"; font-weight: 500; src: url(<?php echo esc_url( KILIC_URL . 'assets/fonts/inter-latin-500-normal.woff2' ); ?>) format("woff2"); }
	.kilic-logo { display: flex; align-items: center; gap: 4mm; }
	.kilic-logo .logo-mark { width: 16mm; height: 16mm; flex: none; }
	.kilic-logo-text { display: flex; flex-direction: column; line-height: 1; }
	.kilic-logo-text strong { font-family: "Kilic Barlow Condensed", "Arial Narrow", sans-serif; font-size: 26pt; letter-spacing: .05em; text-transform: uppercase; }
	.kilic-logo-text strong em { font-style: normal; color: #e8892b; }
	.kilic-logo-text small { font-family: "Kilic Inter", Arial, sans-serif; font-size: 7.5pt; letter-spacing: .26em; text-transform: uppercase; color: #6b7279; margin-top: 1.5mm; }
	.kilic-logo-img { max-height: 20mm; max-width: 90mm; display: block; }
	.brand .sub { display: block; margin-top: 3mm; font-size: 7.5pt; letter-spacing: .08em; text-transform: uppercase; color: #6b7279; }
	* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	.head .kontakt { text-align: right; font-size: 8.5pt; color: #3b434b; }
	.adresse { position: absolute; top: 50mm; left: 25mm; width: 85mm; }
	.adresse .absender { font-size: 7pt; color: #6b7279; border-bottom: 1px solid #ccc; padding-bottom: 1mm; margin-bottom: 3mm; }
	.meta { position: absolute; top: 50mm; right: 20mm; width: 70mm; font-size: 9pt; }
	.meta table { width: 100%; border-collapse: collapse; }
	.meta td { padding: 1mm 0; }
	.meta td:last-child { text-align: right; font-weight: 600; }
	.body { padding-top: 62mm; }
	h1 { font-size: 16pt; margin: 0 0 6mm; }
	table.pos { width: 100%; border-collapse: collapse; margin: 5mm 0; }
	.pos th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1.5px solid #1b1f23; padding: 2mm 1.5mm; }
	.pos td { padding: 2.5mm 1.5mm; border-bottom: 1px solid #ddd; vertical-align: top; }
	.pos .r { text-align: right; white-space: nowrap; }
	.pos .txt { white-space: pre-line; }
	.summe { margin-left: auto; width: 80mm; border-collapse: collapse; }
	.summe td { padding: 1.5mm 1.5mm; }
	.summe td:last-child { text-align: right; }
	.summe .total td { border-top: 1.5px solid #1b1f23; font-weight: 700; font-size: 11pt; }
	.hinweis { margin-top: 6mm; font-size: 8.5pt; color: #3b434b; }
	.foot { position: absolute; left: 25mm; right: 20mm; bottom: 10mm; border-top: 1px solid #ccc; padding-top: 3mm; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; font-size: 7pt; color: #6b7279; }
	.wm { position: absolute; top: 120mm; left: 0; right: 0; text-align: center; font-size: 60pt; font-weight: 800; color: rgba(215,38,47,.12); transform: rotate(-20deg); pointer-events: none; }
	.toolbar { position: sticky; top: 0; background: #1b1f23; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; justify-content: center; font-family: Arial, sans-serif; }
	.toolbar button { background: #e8892b; color: #fff; border: 0; padding: 10px 18px; font-weight: 700; border-radius: 5px; cursor: pointer; font-size: 14px; }
	@media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; } .toolbar { display: none; } }
</style>
</head>
<body>
<div class="toolbar">
	<span>Tipp: Im Druckdialog „Als PDF speichern“ wählen, um die Datei per E-Mail zu versenden.</span>
	<button type="button" onclick="window.print()">Drucken / PDF</button>
</div>
<div class="sheet">
	<?php if ( $entwurf ) : ?><div class="wm">ENTWURF</div><?php endif; ?>
	<?php if ( 'storniert' === $status ) : ?><div class="wm">STORNIERT</div><?php endif; ?>
	<div class="head">
		<div class="brand">
			<div class="kilic-logo"><?php echo kilic_logo_html(); // phpcs:ignore WordPress.Security.EscapeOutput ?></div>
			<span class="sub"><?php echo esc_html( kilic_opt( 'firma' ) ); ?> · <?php echo esc_html( kilic_opt( 'firma2' ) ); ?> · Inh. <?php echo esc_html( kilic_opt( 'inhaber' ) ); ?></span>
		</div>
		<div class="kontakt">
			<?php echo esc_html( kilic_opt( 'strasse' ) ); ?><br>
			<?php echo esc_html( kilic_opt( 'plz_ort' ) ); ?><br>
			Tel. <?php echo esc_html( kilic_opt( 'telefon' ) ); ?><br>
			<?php echo esc_html( kilic_opt( 'email' ) ); ?>
		</div>
	</div>

	<div class="adresse">
		<div class="absender"><?php echo esc_html( $absender ); ?></div>
		<?php foreach ( kilic_kunde_adresse( $kunde ) as $line ) : ?>
			<?php echo esc_html( $line ); ?><br>
		<?php endforeach; ?>
	</div>

	<div class="meta">
		<table>
			<tr><td><?php echo esc_html( $titel ); ?>-Nr.</td><td><?php echo esc_html( $nummer ? $nummer : '—' ); ?></td></tr>
			<tr><td>Datum</td><td><?php echo esc_html( kilic_date( get_post_meta( $id, '_datum', true ) ) ); ?></td></tr>
			<?php if ( $kunde && get_post_meta( $kunde, '_kundennr', true ) ) : ?>
				<tr><td>Kunden-Nr.</td><td><?php echo esc_html( get_post_meta( $kunde, '_kundennr', true ) ); ?></td></tr>
			<?php endif; ?>
			<?php if ( 'rechnung' === $typ ) : ?>
				<tr><td>Fällig am</td><td><?php echo esc_html( kilic_date( kilic_beleg_faellig( $id ) ) ); ?></td></tr>
			<?php endif; ?>
		</table>
	</div>

	<div class="body">
		<h1><?php echo esc_html( $titel . ( $nummer ? ' ' . $nummer : '' ) ); ?></h1>
		<?php if ( get_post_meta( $id, '_leistung', true ) ) : ?>
			<p><strong><?php echo 'rechnung' === $typ ? 'Leistungszeitraum / Bauvorhaben' : 'Bauvorhaben'; ?>:</strong> <?php echo esc_html( get_post_meta( $id, '_leistung', true ) ); ?></p>
		<?php endif; ?>
		<p><?php echo nl2br( esc_html( get_post_meta( $id, '_text_oben', true ) ) ); ?></p>

		<table class="pos">
			<thead><tr><th>Pos.</th><th>Beschreibung</th><th class="r">Menge</th><th>Einheit</th><th class="r">Einzelpreis</th><th class="r">Gesamt</th></tr></thead>
			<tbody>
			<?php foreach ( $pos as $i => $p ) : ?>
				<tr>
					<td><?php echo (int) $i + 1; ?></td>
					<td class="txt"><?php echo esc_html( $p['text'] ); ?></td>
					<td class="r"><?php echo esc_html( kilic_num( $p['menge'], 3 ) ); ?></td>
					<td><?php echo esc_html( $p['einheit'] ); ?></td>
					<td class="r"><?php echo esc_html( kilic_eur( $p['preis'] ) ); ?></td>
					<td class="r"><?php echo esc_html( kilic_eur( (int) round( (float) $p['menge'] * (int) $p['preis'] ) ) ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<table class="summe">
			<tr><td>Summe netto</td><td><?php echo esc_html( kilic_eur( $sum['netto'] ) ); ?></td></tr>
			<tr><td>zzgl. <?php echo esc_html( kilic_num( $sum['satz'], 1 ) ); ?> % MwSt.</td><td><?php echo esc_html( kilic_eur( $sum['mwst'] ) ); ?></td></tr>
			<tr class="total"><td><?php echo 'rechnung' === $typ ? 'Rechnungsbetrag' : 'Angebotssumme'; ?></td><td><?php echo esc_html( kilic_eur( $sum['brutto'] ) ); ?></td></tr>
		</table>

		<p><?php echo nl2br( esc_html( get_post_meta( $id, '_text_unten', true ) ) ); ?></p>

		<?php if ( 'rechnung' === $typ ) : ?>
			<?php if ( $privat && $lohn > 0 ) : ?>
				<p class="hinweis">In diesem Rechnungsbetrag sind Arbeitskosten in Höhe von <?php echo esc_html( kilic_eur( (int) round( $lohn * ( 1 + $sum['satz'] / 100 ) ) ) ); ?> (inkl. MwSt.) enthalten, die nach § 35a EStG steuerlich geltend gemacht werden können.</p>
			<?php endif; ?>
			<?php if ( $privat ) : ?>
				<p class="hinweis">Hinweis: Als Privatperson sind Sie gemäß § 14b Abs. 1 Satz 5 UStG verpflichtet, diese Rechnung zwei Jahre lang aufzubewahren.</p>
			<?php endif; ?>
		<?php endif; ?>
	</div>

	<div class="foot">
		<div><?php echo esc_html( $firma ); ?><br>Inh. <?php echo esc_html( kilic_opt( 'inhaber' ) ); ?><br><?php echo esc_html( kilic_opt( 'strasse' ) . ', ' . kilic_opt( 'plz_ort' ) ); ?></div>
		<div>
			<?php if ( kilic_opt( 'steuernr' ) ) : ?>Steuernummer: <?php echo esc_html( kilic_opt( 'steuernr' ) ); ?><br><?php endif; ?>
			<?php if ( kilic_opt( 'ust_id' ) ) : ?>USt-IdNr.: <?php echo esc_html( kilic_opt( 'ust_id' ) ); ?><br><?php endif; ?>
			Tel. <?php echo esc_html( kilic_opt( 'telefon' ) ); ?>
		</div>
		<div>
			<?php if ( kilic_opt( 'bank' ) ) : ?><?php echo esc_html( kilic_opt( 'bank' ) ); ?><br><?php endif; ?>
			<?php if ( kilic_opt( 'iban' ) ) : ?>IBAN: <?php echo esc_html( kilic_opt( 'iban' ) ); ?><br><?php endif; ?>
			<?php if ( kilic_opt( 'bic' ) ) : ?>BIC: <?php echo esc_html( kilic_opt( 'bic' ) ); ?><?php endif; ?>
		</div>
	</div>
</div>
</body>
</html>
