<?php
/**
 * Anfrage-Assistent (Shortcode [kilic_anfrage]).
 */

defined( 'ABSPATH' ) || exit;

$danke     = 'danke' === ( $_GET['anfrage'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
$vorwahl   = sanitize_text_field( wp_unslash( $_GET['leistung'] ?? 'Estrich' ) ); // phpcs:ignore WordPress.Security.NonceVerification
$notdienst = kilic_opt( 'notdienst' );

$choice = function ( $name, $id, $value, $title, $text = '', $icon = '', $checked = false, $rohr = false, $type = 'radio' ) {
	printf(
		'<div class="choice%1$s"><input type="%2$s" name="%3$s" id="%4$s" value="%5$s"%6$s><label for="%4$s">%7$s<strong>%8$s</strong>%9$s</label></div>',
		$rohr ? ' rohr' : '',
		esc_attr( $type ),
		esc_attr( $name ),
		esc_attr( $id ),
		esc_attr( $value ),
		$checked ? ' checked' : '',
		$icon ? '<span class="ki ki-' . esc_attr( $icon ) . '"></span>' : '',
		esc_html( $title ),
		$text ? '<small>' . wp_kses( $text, array( 'b' => array( 'style' => array() ) ) ) . '</small>' : ''
	);
};
?>
<div class="wrap wizard" id="anfrage">
<?php if ( $danke ) : ?>
	<div class="wizard-main">
		<div class="wizard-step active center" style="padding:70px 40px" role="status">
			<div class="emergency-ic" style="margin:0 auto 24px;background:var(--accent);color:#fff;box-shadow:0 0 0 10px var(--accent-soft)"><span class="ki ki-check" style="font-size:40px"></span></div>
			<h3>Vielen Dank für Ihre Anfrage!</h3>
			<p class="lead">Wir prüfen Ihre Angaben und melden uns in der Regel innerhalb von 24 Stunden (werktags) mit einem unverbindlichen Angebot oder einem Terminvorschlag zur Besichtigung.</p>
			<p class="muted">Rohrreinigung-Notfall? Rufen Sie direkt an: <a href="<?php echo esc_attr( kilic_tel_href( $notdienst ) ); ?>"><strong><?php echo esc_html( $notdienst ); ?></strong></a></p>
		</div>
	</div>
<?php else : ?>
	<form class="wizard-main" id="wizard" method="post" enctype="multipart/form-data" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" novalidate>
		<?php echo kilic_form_hidden( 'anfrage' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
		<ol class="progress">
			<li><b>1</b>Leistung</li>
			<li><b>2</b>Objekt</li>
			<li><b>3</b>Fläche &amp; Estrich</li>
			<li><b>4</b>Termin &amp; Fotos</li>
			<li><b>5</b>Kontakt</li>
		</ol>

		<div class="wizard-steps">
			<div class="wizard-step">
				<?php echo kilic_form_meldung( 'anfrage' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				<h3>Was dürfen wir für Sie tun?</h3>
				<p>Wählen Sie die gewünschte Leistung.</p>
				<div class="choice-grid wide">
					<?php
					$choice( 'leistung', 'l1', 'Estrich', 'Estrich verlegen', 'Heiz-, Fließ-, Zement- oder Schnellestrich für Neubau &amp; Sanierung', 'layers', 'Estrich' === $vorwahl );
					$choice( 'leistung', 'l2', 'Bodensanierung', 'Bodensanierung', 'Risse, Hohlstellen, Feuchteschäden, Altestrich entfernen', 'tool', 'Bodensanierung' === $vorwahl );
					$choice( 'leistung', 'l3', 'Bodenverlegung', 'Bodenverlegung', 'Vinyl, Laminat, Parkett inkl. Untergrundvorbereitung', 'grid', 'Bodenverlegung' === $vorwahl );
					$choice( 'leistung', 'l4', 'Rohrreinigung', 'Rohrreinigung', 'Verstopfung, Kanal-TV, Wartung – <b style="color:var(--red)">Notfall? Bitte anrufen!</b>', 'pipe', 'Rohrreinigung' === $vorwahl, true );
					?>
				</div>
			</div>

			<div class="wizard-step">
				<h3>Um welches Objekt geht es?</h3>
				<p>Art des Gebäudes und des Bauvorhabens.</p>
				<label>Objektart</label>
				<div class="choice-grid">
					<?php
					$choice( 'objekt', 'o1', 'Einfamilienhaus', 'Einfamilienhaus', '', 'home' );
					$choice( 'objekt', 'o2', 'Mehrfamilienhaus', 'Mehrfamilienhaus', '', 'apartment' );
					$choice( 'objekt', 'o3', 'Wohnung', 'Wohnung', '', 'building' );
					$choice( 'objekt', 'o4', 'Gewerbe / Halle', 'Gewerbe / Halle', '', 'warehouse' );
					$choice( 'objekt', 'o5', 'Garage / Keller', 'Garage / Keller', '', 'garage' );
					?>
				</div>
				<div class="conditional" data-show-if="Estrich,Bodensanierung,Bodenverlegung">
					<label>Bauvorhaben</label>
					<div class="choice-grid">
						<?php
						$choice( 'bauvorhaben', 'b1', 'Neubau', 'Neubau', 'Rohbau, Bodenplatte / Decke vorhanden' );
						$choice( 'bauvorhaben', 'b2', 'Altbau / Sanierung', 'Altbau / Sanierung', 'Bestehender Boden wird erneuert' );
						$choice( 'bauvorhaben', 'b3', 'Anbau / Umbau', 'Anbau / Umbau', 'Erweiterung, Aufstockung, Dachausbau' );
						?>
					</div>
					<div class="field-row three">
						<div class="field"><label for="etage">Geschoss(e)</label><select id="etage" name="etage"><option>Erdgeschoss</option><option>EG + OG</option><option>EG + OG + DG</option><option>Keller</option><option>Obergeschoss (ohne Aufzug)</option></select></div>
						<div class="field"><label for="zufahrt">Zufahrt für LKW / Pumpe</label><select id="zufahrt" name="zufahrt"><option>Direkt am Gebäude</option><option>bis 30 m entfernt</option><option>über 30 m / schwierig</option></select></div>
						<div class="field"><label for="bewohnt">Gebäude bewohnt?</label><select id="bewohnt" name="bewohnt"><option>Nein</option><option>Ja</option></select></div>
					</div>
				</div>
				<div class="conditional" data-show-if="Rohrreinigung">
					<label>Was ist das Problem?</label>
					<div class="choice-grid">
						<?php
						$choice( 'problem[]', 'p1', 'WC verstopft', 'WC verstopft', '', '', false, true, 'checkbox' );
						$choice( 'problem[]', 'p2', 'Abfluss Küche/Bad', 'Abfluss Küche / Bad', '', '', false, true, 'checkbox' );
						$choice( 'problem[]', 'p3', 'Rückstau Keller', 'Rückstau Keller', '', '', false, true, 'checkbox' );
						$choice( 'problem[]', 'p4', 'Kanal-TV', 'Kanal-TV / Prüfung', '', '', false, true, 'checkbox' );
						?>
					</div>
				</div>
			</div>

			<div class="wizard-step">
				<h3>Fläche &amp; Ausführung</h3>
				<p>Wie viele Quadratmeter – und welche Ausführung wünschen Sie?</p>
				<div class="field-row">
					<div class="field">
						<label for="flaeche">Gesamtfläche</label>
						<div class="area-input"><input type="number" id="flaeche" name="flaeche" min="1" step="0.1" placeholder="z. B. 120" inputmode="decimal"><span>m²</span></div>
						<input type="range" id="flaeche_range" min="0" max="1000" step="5" value="0" aria-label="Fläche Schieberegler">
						<div class="range-scale"><span>0</span><span>250</span><span>500</span><span>750</span><span>1000+ m²</span></div>
					</div>
					<div class="field">
						<label>Fläche berechnen <small class="muted" style="font-weight:400">(optional, Länge × Breite)</small></label>
						<div class="rooms" id="rooms"></div>
						<button type="button" class="link-btn" id="add-room">+ Raum hinzufügen</button>
					</div>
				</div>
				<div class="conditional" data-show-if="Estrich">
					<label>Gewünschte Estrichart</label>
					<div class="choice-grid">
						<?php
						$choice( 'estrichart', 'e1', 'Fließestrich (CAF)', 'Fließestrich', 'Calciumsulfat, sehr eben, ideal für FBH' );
						$choice( 'estrichart', 'e2', 'Zementestrich (CT)', 'Zementestrich', 'Robust, auch für Bad, Keller, Garage' );
						$choice( 'estrichart', 'e3', 'Schnellestrich', 'Schnellestrich', 'Kurze Trocknung bei Termindruck' );
						$choice( 'estrichart', 'e4', 'Trockenestrich', 'Trockenestrich', 'Platten, ideal für Holzdecken' );
						$choice( 'estrichart', 'e5', 'Industrie-/Gefälleestrich', 'Industrie / Gefälle', 'Hallen, Garagen, Balkone, Duschen' );
						$choice( 'estrichart', 'e6', 'Beratung gewünscht', 'Weiß nicht', 'Beratung gewünscht' );
						?>
					</div>
					<div class="field-row three">
						<div class="field"><label for="fbh">Fußbodenheizung?</label><select id="fbh" name="fbh"><option value="">Bitte wählen</option><option>Ja, Nass-System</option><option>Ja, Trockensystem</option><option>Nein</option><option>Noch unklar</option></select></div>
						<div class="field"><label for="staerke">Estrichdicke (falls bekannt)</label><div class="area-input"><input type="number" id="staerke" name="staerke" placeholder="z. B. 65"><span>mm</span></div></div>
						<div class="field"><label for="daemmung">Dämmung mitliefern?</label><select id="daemmung" name="daemmung"><option>Ja, inkl. Dämmung</option><option>Nein, Dämmung vorhanden</option><option>Noch unklar</option></select></div>
					</div>
					<div class="field-row">
						<div class="field"><label for="aufbau">Gesamt-Aufbauhöhe (falls bekannt)</label><div class="area-input"><input type="number" id="aufbau" name="aufbau" placeholder="z. B. 140"><span>mm</span></div><p class="hint">Von Rohdecke bis Oberkante Fertigfußboden</p></div>
						<div class="field"><label for="belag">Späterer Oberbelag</label><select id="belag" name="belag"><option>Fliesen</option><option>Parkett</option><option>Vinyl / Designbelag</option><option>Laminat</option><option>Teppich</option><option>Noch offen</option></select></div>
					</div>
				</div>
				<div class="conditional" data-show-if="Bodensanierung">
					<label>Art des Schadens</label>
					<div class="choice-grid">
						<?php
						$choice( 'schaden[]', 's1', 'Risse', 'Risse', '', '', false, false, 'checkbox' );
						$choice( 'schaden[]', 's2', 'Hohlstellen', 'Hohlstellen', '', '', false, false, 'checkbox' );
						$choice( 'schaden[]', 's3', 'Unebenheiten', 'Unebenheiten', '', '', false, false, 'checkbox' );
						$choice( 'schaden[]', 's4', 'Wasserschaden', 'Wasserschaden', '', '', false, false, 'checkbox' );
						$choice( 'schaden[]', 's5', 'Altestrich entfernen', 'Altestrich raus', '', '', false, false, 'checkbox' );
						?>
					</div>
				</div>
				<div class="conditional" data-show-if="Bodenverlegung">
					<div class="field-row">
						<div class="field"><label for="belagart">Belagart</label><select id="belagart" name="belagart"><option>Vinyl Klick</option><option>Vinyl geklebt</option><option>Laminat</option><option>Parkett</option></select></div>
						<div class="field"><label for="material">Material</label><select id="material" name="material"><option>Bitte von uns liefern</option><option>Material ist vorhanden</option></select></div>
					</div>
				</div>
			</div>

			<div class="wizard-step">
				<h3>Termin, Details &amp; Fotos</h3>
				<p>Wann soll es losgehen? Pläne oder Fotos helfen uns bei der Kalkulation.</p>
				<div class="field-row">
					<div class="field"><label for="termin">Wunschtermin</label><select id="termin" name="termin"><option value="">Bitte wählen</option><option>So schnell wie möglich</option><option>In 2–4 Wochen</option><option>In 1–3 Monaten</option><option>Später / noch offen</option></select></div>
					<div class="field"><label for="datum">Konkretes Datum (optional)</label><input type="date" id="datum" name="datum"></div>
				</div>
				<div class="field"><label for="nachricht">Beschreibung Ihres Vorhabens</label><textarea id="nachricht" name="nachricht" placeholder="z. B. Neubau EFH, Bodenplatte gedämmt, Fußbodenheizung wird vom Heizungsbauer verlegt, Estrich in EG und OG …"></textarea></div>
				<label for="dateien">Fotos, Grundriss oder Pläne</label>
				<div class="upload">
					<span class="ki ki-upload" style="font-size:40px;color:var(--accent)"></span><br>
					<strong>Dateien auswählen</strong> oder hierher ziehen<br><small>JPG, PNG, PDF · bis zu 5 Dateien · max. 10 MB je Datei</small>
					<input type="file" id="dateien" name="dateien[]" accept=".jpg,.jpeg,.png,.pdf" multiple>
					<div class="upload-list" aria-live="polite"></div>
				</div>
			</div>

			<div class="wizard-step">
				<h3>Ihre Kontaktdaten</h3>
				<p>Damit wir Ihnen das Angebot zusenden können.</p>
				<div class="field-row">
					<div class="field"><label for="name">Vor- und Nachname <span class="req">*</span></label><input type="text" id="name" name="name" autocomplete="name" data-required="1"></div>
					<div class="field"><label for="firma">Firma (optional)</label><input type="text" id="firma" name="firma" placeholder="z. B. Bauträger, Architekt" autocomplete="organization"></div>
				</div>
				<div class="field-row">
					<div class="field"><label for="email">E-Mail <span class="req">*</span></label><input type="email" id="email" name="email" autocomplete="email"></div>
					<div class="field"><label for="tel">Telefon <span class="req">*</span></label><input type="tel" id="tel" name="tel" autocomplete="tel"></div>
				</div>
				<p class="hint" style="margin-top:-8px;margin-bottom:16px">E-Mail oder Telefon genügt.</p>
				<label>Adresse des Objekts</label>
				<div class="field-row three">
					<div class="field"><input type="text" name="strasse" placeholder="Straße, Nr." aria-label="Straße, Nr." autocomplete="street-address"></div>
					<div class="field"><input type="text" name="plz" placeholder="PLZ" aria-label="PLZ" autocomplete="postal-code" inputmode="numeric"></div>
					<div class="field"><input type="text" name="ort" placeholder="Ort" aria-label="Ort" autocomplete="address-level2"></div>
				</div>
				<div class="field"><label for="rueckruf">Bevorzugte Kontaktaufnahme</label><select id="rueckruf" name="rueckruf"><option>Per E-Mail</option><option>Rückruf vormittags</option><option>Rückruf nachmittags</option><option>WhatsApp</option></select></div>
				<label class="check"><input type="checkbox" name="dsgvo" value="1" data-required="1"> <span>Ich habe die <a href="<?php echo esc_url( kilic_datenschutz_link() ); ?>" target="_blank">Datenschutzerklärung</a> gelesen und bin mit der Verarbeitung meiner Angaben zur Bearbeitung der Anfrage einverstanden. <span class="req">*</span></span></label>
				<div class="form-msg err wizard-error" role="alert" hidden></div>
			</div>
		</div>

		<div class="wizard-nav">
			<button type="button" class="btn btn-ghost" data-prev>Zurück</button>
			<span class="step-info" aria-live="polite"></span>
			<button type="button" class="btn btn-accent" data-next>Weiter <span class="ki ki-arrow"></span></button>
			<button type="submit" class="btn btn-accent" data-submit hidden>Anfrage absenden <span class="ki ki-arrow"></span></button>
		</div>
	</form>
<?php endif; ?>

	<aside class="summary">
		<h4><span class="ki ki-calc"></span> Ihre Anfrage</h4>
		<div class="big" id="s-flaeche">– m²</div>
		<dl>
			<div><dt>Leistung</dt><dd id="s-leistung" class="empty">–</dd></div>
			<div><dt>Objekt</dt><dd id="s-objekt" class="empty">–</dd></div>
			<div><dt>Bauvorhaben</dt><dd id="s-bau" class="empty">–</dd></div>
			<div><dt>Estrichart</dt><dd id="s-estrich" class="empty">–</dd></div>
			<div><dt>Fußbodenheizung</dt><dd id="s-fbh" class="empty">–</dd></div>
			<div><dt>Estrichdicke</dt><dd id="s-staerke" class="empty">–</dd></div>
			<div><dt>Termin</dt><dd id="s-termin" class="empty">–</dd></div>
			<div><dt>Ort</dt><dd id="s-ort" class="empty">–</dd></div>
		</dl>
		<p class="summary-note">Ihre Angaben sind unverbindlich. Das finale Angebot erstellen wir nach Prüfung bzw. Aufmaß vor Ort.</p>
		<div class="summary-help" style="border-left:3px solid var(--red)">Rohrreinigung-Notfall?<a href="<?php echo esc_attr( kilic_tel_href( $notdienst ) ); ?>"><?php echo esc_html( $notdienst ); ?></a><small style="color:#9aa1a8">24/7 · auch sonntags</small></div>
	</aside>
</div>
