<?php
/**
 * Startinhalte aller Seiten. Jede Sektion wird als eigener Divi-Abschnitt
 * (Abschnitt → Zeile → Text-Modul) gespeichert und ist im Divi Builder einzeln
 * bearbeitbar. Telefonnummern & Adresse stehen als Platzhalter ({{notdienst}})
 * im Text und kommen aus „Kilic Betrieb → Einstellungen“.
 */

defined( 'ABSPATH' ) || exit;

/** HTML-Abschnitte in Divi-Shortcodes verpacken. */
function kilic_divi( array $sections ) {
	$out = '';
	foreach ( $sections as $label => $html ) {
		$html  = trim( preg_replace( '/>\s+</', '><', preg_replace( '/\s*\n\s*/', ' ', $html ) ) );
		$admin = is_string( $label ) ? ' admin_label="' . esc_attr( $label ) . '"' : '';
		$out  .= '[et_pb_section fb_built="1"' . $admin . ' _builder_version="4.27.4" custom_padding="0px||0px||false|false"]'
			. '[et_pb_row _builder_version="4.27.4" width="100%" max_width="100%" custom_padding="0px||0px||false|false" custom_margin="0px||0px||false|false"]'
			. '[et_pb_column type="4_4" _builder_version="4.27.4"]'
			. '[et_pb_text' . $admin . ' _builder_version="4.27.4"]' . $html . '[/et_pb_text]'
			. '[/et_pb_column][/et_pb_row][/et_pb_section]';
	}
	return $out;
}

function kilic_img( $variant, $alt, $class = 'img-cover' ) {
	return '<img class="' . $class . '" src="{{assets}}/img/ph-' . $variant . '.svg" alt="' . esc_attr( $alt ) . '" loading="lazy">';
}

/* ---------- Bausteine ---------- */

function kilic_c_hero( $a ) {
	$a = wp_parse_args( $a, array(
		'crumbs'  => array(),
		'eyebrow' => '',
		'title'   => '',
		'lead'    => '',
		'buttons' => '',
		'img'     => 'dunkel',
		'rohr'    => false,
		'side'    => '',
	) );
	$crumb = '';
	if ( $a['crumbs'] ) {
		$parts = array( '<a href="{{home}}/">Start</a>' );
		foreach ( $a['crumbs'] as $label => $url ) {
			$parts[] = $url ? '<a href="' . $url . '">' . $label . '</a>' : $label;
		}
		$crumb = '<div class="breadcrumb">' . implode( '<span>/</span>', $parts ) . '</div>';
	}
	$eyebrow = $a['eyebrow'] ? '<div class="eyebrow ' . ( $a['rohr'] ? '" style="color:#6fb1ff' : 'light' ) . '">' . $a['eyebrow'] . '</div>' : '';
	$inner   = $crumb . $eyebrow . '<h1>' . $a['title'] . '</h1><p class="lead">' . $a['lead'] . '</p>' . ( $a['buttons'] ? '<div class="btn-row" style="margin-top:28px">' . $a['buttons'] . '</div>' : '' );
	$cls     = 'hero' . ( $a['side'] ? '' : ' hero-sub' ) . ( $a['rohr'] ? ' rohr-hero' : '' );
	$body    = $a['side'] ? '<div>' . $inner . '</div>' . $a['side'] : $inner;
	return '<section class="' . $cls . '">' . kilic_img( $a['img'], '', 'hero-img' ) . '<div class="wrap">' . $body . '</div></section>';
}

function kilic_c_notdienst( $title = 'Rohr verstopft? Wir sind 24/7 für Sie da.', $text = 'K &amp; K Rohrreinigung – rund um die Uhr erreichbar, auch sonntags und an Feiertagen. Schnell vor Ort in Mosbach und Umgebung.' ) {
	return '<section class="emergency"><div class="wrap"><div class="emergency-ic"><span class="ki ki-phone" style="font-size:40px"></span></div><div><h2>' . $title . '</h2><p>' . $text . '</p></div><a class="emergency-phone" href="{{notdienst_link}}"><small>Notdienst-Hotline · 24/7</small><strong>{{notdienst}}</strong></a></div></section>';
}

function kilic_c_cta( $title, $text, $btn = 'Angebot anfragen', $url = '{{home}}/angebot-anfragen/' ) {
	return '<section class="section-sm"><div class="wrap"><div class="cta-box"><div><div class="eyebrow light">Kostenlos &amp; unverbindlich</div><h2>' . $title . '</h2><p>' . $text . '</p></div><div class="btn-row"><a class="btn btn-accent" href="' . $url . '">' . $btn . '</a><a class="btn btn-ghost btn-ghost-light" href="{{telefon_link}}"><span class="ki ki-phone"></span> {{telefon}}</a></div></div></div></section>';
}

function kilic_c_faq( $items, $heading = 'Häufige Fragen', $eyebrow = 'FAQ', $aside = '' ) {
	$faq = '';
	foreach ( $items as $i => $qa ) {
		$faq .= '<details' . ( 0 === $i ? ' open' : '' ) . '><summary>' . $qa[0] . '</summary><p>' . $qa[1] . '</p></details>';
	}
	$aside = $aside ? $aside : '<aside class="summary" style="top:130px"><h4><span class="ki ki-calc"></span> Angebot in 2 Minuten</h4><p style="color:#b9bfc4;font-size:.92rem">Objekt, Fläche und Estrichart angeben – wir erstellen Ihr Angebot.</p><a class="btn btn-accent" style="width:100%" href="{{home}}/angebot-anfragen/">Zur Anfrage</a><div class="summary-help">Lieber persönlich?<a href="{{telefon_link}}">{{telefon}}</a></div></aside>';
	return '<section class="section bg-concrete texture"><div class="wrap split wide-left" style="align-items:start"><div><div class="eyebrow">' . $eyebrow . '</div><h2>' . $heading . '</h2><div class="faq">' . $faq . '</div></div>' . $aside . '</div></section>';
}

function kilic_c_related( $title, $links, $blue = false ) {
	$out = '';
	foreach ( $links as $label => $url ) {
		$out .= '<a href="' . $url . '">' . $label . ' <span class="ki ki-arrow"></span></a>';
	}
	return '<section class="section-sm"><div class="wrap"><div class="eyebrow' . ( $blue ? ' blue' : '' ) . '">Weitere Leistungen</div><h2 style="font-size:clamp(1.6rem,3vw,2.2rem)">' . $title . '</h2><div class="related' . ( $blue ? ' blue' : '' ) . '">' . $out . '</div></div></section>';
}

function kilic_c_checklist( $items, $blue = false ) {
	return '<ul class="checklist' . ( $blue ? ' blue' : '' ) . '"><li>' . implode( '</li><li>', $items ) . '</li></ul>';
}

function kilic_c_facts( $facts ) {
	$out = '';
	foreach ( $facts as $k => $v ) {
		$out .= '<div><dt>' . $k . '</dt><dd>' . $v . '</dd></div>';
	}
	return '<dl class="facts">' . $out . '</dl>';
}

/** Standard-Unterseite (z. B. Heizestrich). */
function kilic_c_unterseite( $d ) {
	$rohr   = ! empty( $d['rohr'] );
	$parent = $d['parent'];
	$s      = array();
	$s['Kopfbereich'] = kilic_c_hero( array(
		'crumbs'  => array( $parent[0] => $parent[1], $d['title'] => '' ),
		'eyebrow' => $d['eyebrow'],
		'title'   => $d['h1'],
		'lead'    => $d['lead'],
		'img'     => $d['img'] ?? ( $rohr ? 'blau' : 'grau' ),
		'rohr'    => $rohr,
		'buttons' => $rohr
			? '<a class="btn btn-red" href="{{notdienst_link}}"><span class="ki ki-phone"></span> Notdienst {{notdienst}}</a><a class="btn btn-ghost btn-ghost-light" href="{{home}}/angebot-anfragen/?leistung=Rohrreinigung">Termin anfragen</a>'
			: '<a class="btn btn-accent" href="{{home}}/angebot-anfragen/?leistung=' . ( $d['leistung'] ?? 'Estrich' ) . '">Angebot anfragen <span class="ki ki-arrow"></span></a><a class="btn btn-ghost btn-ghost-light" href="{{telefon_link}}"><span class="ki ki-phone"></span> {{telefon}}</a>',
	) );
	$s['Einleitung'] = '<section class="section"><div class="wrap split"><div><div class="eyebrow' . ( $rohr ? ' blue' : '' ) . '">' . $d['intro_eyebrow'] . '</div><h2>' . $d['intro_h2'] . '</h2>' . $d['intro'] . kilic_c_checklist( $d['check'], $rohr ) . '</div><div class="media">' . kilic_img( $d['img2'] ?? ( $rohr ? 'blau' : 'warm' ), $d['title'] ) . '</div></div></section>';
	if ( ! empty( $d['facts'] ) ) {
		$s['Eckdaten'] = '<section class="section-sm bg-concrete texture"><div class="wrap"><div class="eyebrow' . ( $rohr ? ' blue' : '' ) . '">Auf einen Blick</div><h2 style="font-size:clamp(1.6rem,3vw,2.2rem)">' . ( $d['facts_title'] ?? 'Eckdaten' ) . '</h2>' . kilic_c_facts( $d['facts'] ) . ( ! empty( $d['facts_note'] ) ? '<p class="muted" style="font-size:.82rem;margin-top:14px">' . $d['facts_note'] . '</p>' : '' ) . '</div></section>';
	}
	if ( ! empty( $d['extra'] ) ) {
		$s['Details'] = $d['extra'];
	}
	if ( $rohr ) {
		$s['Notdienst'] = kilic_c_notdienst( 'Notfall? Nicht warten – anrufen!', 'Je früher wir eingreifen, desto geringer der Schaden. Unser Notdienst ist 24 Stunden an 365 Tagen erreichbar.' );
	}
	if ( ! empty( $d['faq'] ) ) {
		$s['FAQ'] = kilic_c_faq( $d['faq'], 'Häufige Fragen: ' . $d['title'] );
	}
	if ( ! empty( $d['related'] ) ) {
		$s['Weitere Leistungen'] = kilic_c_related( $d['related_title'] ?? 'Das könnte Sie auch interessieren', $d['related'], $rohr );
	}
	$s['Abschluss'] = kilic_c_cta( $d['cta'] ?? 'Planen Sie ein Projekt?', 'Teilen Sie uns Objekt, Fläche und Wunschtermin mit – Sie erhalten ein transparentes Angebot.', 'Jetzt Angebot anfragen', '{{home}}/angebot-anfragen/?leistung=' . ( $rohr ? 'Rohrreinigung' : ( $d['leistung'] ?? 'Estrich' ) ) );
	return kilic_divi( $s );
}

/* ---------- Seitenverzeichnis ---------- */

/**
 * Seiten: slug => [Titel, Eltern-Slug, Reihenfolge, Inhalts-Funktion, SEO-Beschreibung]
 */
function kilic_seiten() {
	return array(
		'start'                     => array( 'Start', '', 0, 'kilic_inhalt_start' ),
		'estrich'                   => array( 'Estrich', '', 10, 'kilic_inhalt_estrich' ),
		'heizestrich'               => array( 'Heizestrich', 'estrich', 11, 'kilic_inhalt_heizestrich' ),
		'fliessestrich'             => array( 'Fließestrich', 'estrich', 12, 'kilic_inhalt_fliessestrich' ),
		'zementestrich'             => array( 'Zementestrich', 'estrich', 13, 'kilic_inhalt_zementestrich' ),
		'schnellestrich'            => array( 'Schnellestrich', 'estrich', 14, 'kilic_inhalt_schnellestrich' ),
		'trockenestrich'            => array( 'Trockenestrich', 'estrich', 15, 'kilic_inhalt_trockenestrich' ),
		'industrie-gefaelleestrich' => array( 'Industrie- & Gefälleestrich', 'estrich', 16, 'kilic_inhalt_industrie' ),
		'boden'                     => array( 'Boden', '', 20, 'kilic_inhalt_boden' ),
		'bodensanierung'            => array( 'Bodensanierung', 'boden', 21, 'kilic_inhalt_bodensanierung' ),
		'bodenverlegung'            => array( 'Bodenverlegung', 'boden', 22, 'kilic_inhalt_bodenverlegung' ),
		'ausgleichsmassen'          => array( 'Ausgleichsmassen & Nivellieren', 'boden', 23, 'kilic_inhalt_ausgleich' ),
		'rohrreinigung'             => array( 'Rohrreinigung', '', 30, 'kilic_inhalt_rohrreinigung' ),
		'notdienst'                 => array( '24/7 Notdienst', 'rohrreinigung', 31, 'kilic_inhalt_notdienst' ),
		'kanal-tv'                  => array( 'Kanal-TV-Inspektion', 'rohrreinigung', 32, 'kilic_inhalt_kanaltv' ),
		'wartung'                   => array( 'Wartung für Gewerbe', 'rohrreinigung', 33, 'kilic_inhalt_wartung' ),
		'referenzen'                => array( 'Referenzen', '', 40, 'kilic_inhalt_referenzen' ),
		'ueber-uns'                 => array( 'Über uns', '', 50, 'kilic_inhalt_ueber' ),
		'karriere'                  => array( 'Karriere', 'ueber-uns', 51, 'kilic_inhalt_karriere' ),
		'angebot-anfragen'          => array( 'Angebot anfragen', '', 60, 'kilic_inhalt_anfrage' ),
		'kontakt'                   => array( 'Kontakt', '', 70, 'kilic_inhalt_kontakt' ),
		'impressum'                 => array( 'Impressum', '', 90, 'kilic_inhalt_impressum' ),
		'datenschutz'               => array( 'Datenschutz', '', 91, 'kilic_inhalt_datenschutz' ),
	);
}

/* ---------- Startseite ---------- */

function kilic_inhalt_start() {
	$s = array();
	$s['Kopfbereich mit Schnellanfrage'] = kilic_c_hero( array(
		'eyebrow' => 'Estrich-Meisterbetrieb aus Mosbach',
		'title'   => 'Der perfekte Boden <span>beginnt darunter.</span>',
		'lead'    => 'Heizestrich, Fließestrich, Zementestrich und Bodensanierung – präzise geplant, sauber eingebracht und termingerecht übergeben. Für Neubau, Altbau und Gewerbe im gesamten Neckar-Odenwald-Kreis.',
		'buttons' => '<a class="btn btn-accent" href="{{home}}/angebot-anfragen/">Estrich-Angebot anfragen <span class="ki ki-arrow"></span></a><a class="btn btn-ghost btn-ghost-light" href="{{home}}/estrich/">Estricharten ansehen</a>',
		'side'    => '<div class="hero-card"><span class="tag">In 2 Minuten zum Angebot</span><h3>Schnellanfrage</h3><p>Leistung wählen – im nächsten Schritt geben Sie Objekt, Fläche und Estrichart an.</p><form class="quick-form" action="{{home}}/angebot-anfragen/" method="get"><label class="screen-reader-text" for="qf-leistung">Leistung</label><select id="qf-leistung" name="leistung"><option value="Estrich">Estrich verlegen</option><option value="Bodensanierung">Bodensanierung</option><option value="Bodenverlegung">Bodenverlegung</option><option value="Rohrreinigung">Rohrreinigung</option></select><button class="btn btn-accent" type="submit">Weiter zur Anfrage <span class="ki ki-arrow"></span></button></form><p class="muted small" style="margin:14px 0 0">Rohrreinigung-Notfall? <a href="{{notdienst_link}}"><strong>{{notdienst}}</strong></a></p></div>',
	) );
	$s['Kennzahlen'] = '<section class="trustbar"><div class="wrap"><div class="trust-item"><strong>Meister</strong><span>Meisterbetrieb<br>im Estrichhandwerk</span></div><div class="trust-item"><strong>DIN</strong><span>Ausführung nach<br>DIN 18560</span></div><div class="trust-item"><strong>1</strong><span>Ansprechpartner<br>vom Angebot bis zur Übergabe</span></div><div class="trust-item"><strong>24/7</strong><span>Rohrreinigung<br>Notdienst</span></div></div></section>';
	$s['Leistungen'] = '<section class="section bg-concrete texture"><div class="wrap"><div class="section-head center"><div class="eyebrow">Unsere Leistungen</div><h2>Alles für Ihren Boden – aus einer Hand</h2><p class="lead">Unser Kerngeschäft ist Estrich. Rund um den Boden sanieren, verlegen und nivellieren wir – und mit K&nbsp;&amp;&nbsp;K Rohrreinigung sind wir auch dann da, wenn es im Rohr klemmt.</p></div><div class="grid grid-4">'
		. '<a class="service-card" href="{{home}}/estrich/">' . kilic_img( 'grau', 'Estrich wird verteilt' ) . '<div class="body"><span class="tag">Kerngeschäft</span><h3>Estrich</h3><p>Heiz-, Fließ-, Zement- und Schnellestrich für Neubau und Sanierung – schwimmend, auf Trennlage oder im Verbund.</p><span class="more">Mehr erfahren <span class="ki ki-arrow"></span></span></div></a>'
		. '<a class="service-card" href="{{home}}/boden/bodensanierung/">' . kilic_img( 'warm', 'Altbausanierung' ) . '<div class="body"><span class="tag">Altbau &amp; Renovierung</span><h3>Bodensanierung</h3><p>Alten Estrich entfernen, Risse sanieren, Unebenheiten ausgleichen und Feuchteschäden fachgerecht beheben.</p><span class="more">Mehr erfahren <span class="ki ki-arrow"></span></span></div></a>'
		. '<a class="service-card" href="{{home}}/boden/bodenverlegung/">' . kilic_img( 'warm', 'Vinylboden' ) . '<div class="body"><span class="tag">Fertiger Boden</span><h3>Bodenverlegung</h3><p>Vinyl, Designbelag, Laminat und Parkett – wir verlegen den Oberbelag direkt auf unserem Estrich.</p><span class="more">Mehr erfahren <span class="ki ki-arrow"></span></span></div></a>'
		. '<a class="service-card rohr" href="{{home}}/rohrreinigung/">' . kilic_img( 'blau', 'Rohrreinigung' ) . '<div class="body"><span class="tag blue">K &amp; K Rohrreinigung</span><h3>Rohrreinigung</h3><p>Verstopfte Abflüsse, Kanal-TV und Hochdruckspülung – mit 24/7 Notdienst, auch sonntags und an Feiertagen.</p><span class="more">Mehr erfahren <span class="ki ki-arrow"></span></span></div></a>'
		. '</div></div></section>';
	$s['Über uns'] = '<section class="section"><div class="wrap split"><div class="media">' . kilic_img( 'grau', 'Fikret Kilic auf der Baustelle' ) . '<div class="media-badge"><strong>Meister</strong><span>Estrichleger-Handwerk</span></div></div><div><div class="eyebrow">Über Kilic Estrich</div><h2>Ein Meisterbetrieb. Ein Ansprechpartner. Ein Boden, der hält.</h2><p class="lead">Inhaber {{inhaber}} steht persönlich für jede Baustelle ein – von der ersten Beratung über die Feuchtemessung bis zur Übergabe an den Bodenleger.</p>'
		. kilic_c_checklist( array( 'Persönliche Beratung und Aufmaß vor Ort', 'Ausführung nach DIN 18560 und Herstellervorgaben', 'Eigene Estrichpumpen und Mischtechnik', 'Abstimmung mit Heizungsbauer, Architekt und Bodenleger', 'CM-Messung &amp; Belegreife-Protokoll' ) )
		. '<a class="btn btn-dark" href="{{home}}/ueber-uns/">Mehr über uns <span class="ki ki-arrow"></span></a></div></div></section>';
	$s['Notdienst-Banner'] = kilic_c_notdienst();
	$s['Ablauf'] = '<section class="section bg-dark"><div class="wrap"><div class="section-head"><div class="eyebrow light">So läuft es ab</div><h2 style="color:#fff">In 4 Schritten zum fertigen Estrich</h2></div><div class="steps"><div class="step"><h4 style="color:#fff">Anfrage</h4><p>Online-Anfrage mit Objekt, Fläche und Estrichart – oder einfach anrufen.</p></div><div class="step"><h4 style="color:#fff">Besichtigung</h4><p>Aufmaß und Prüfung des Untergrunds vor Ort, Klärung von Höhen und Aufbau.</p></div><div class="step"><h4 style="color:#fff">Angebot</h4><p>Transparentes Angebot mit Terminplanung und Trocknungszeiten.</p></div><div class="step"><h4 style="color:#fff">Ausführung</h4><p>Saubere, termingerechte Verlegung, Aufheizprotokoll und Übergabe.</p></div></div></div></section>';
	$s['Referenzen'] = '<section class="section"><div class="wrap"><div class="section-head" style="display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap"><div><div class="eyebrow">Referenzen</div><h2>Aktuelle Projekte</h2></div><a class="btn btn-ghost" href="{{home}}/referenzen/">Alle Projekte ansehen</a></div>[kilic_referenzen anzahl="3"]</div></section>';
	$s['Kundenstimmen'] = '<section class="section bg-concrete texture"><div class="wrap"><div class="section-head center"><div class="eyebrow">Kundenstimmen</div><h2>Was unsere Kunden sagen</h2><p><span class="todo">Platzhalter – echte Google-Bewertungen einfügen oder Abschnitt löschen</span></p></div><div class="grid grid-3"><blockquote class="quote"><div class="stars">★★★★★</div><p>„Hier steht später eine echte Bewertung eines Neubau-Kunden.“</p><footer><span class="avatar">A</span><div><strong>Kunde A.</strong><br><span class="muted">Neubau</span></div></footer></blockquote><blockquote class="quote"><div class="stars">★★★★★</div><p>„Hier steht später eine echte Bewertung zur Bodensanierung.“</p><footer><span class="avatar">B</span><div><strong>Kundin B.</strong><br><span class="muted">Sanierung</span></div></footer></blockquote><blockquote class="quote"><div class="stars">★★★★★</div><p>„Hier steht später eine echte Bewertung zum Rohrreinigungs-Notdienst.“</p><footer><span class="avatar">C</span><div><strong>Kunde C.</strong><br><span class="muted">Rohrreinigung</span></div></footer></blockquote></div></div></section>';
	$s['Abschluss'] = kilic_c_cta( 'Planen Sie ein Bauprojekt?', 'Teilen Sie uns Objekt, Fläche und gewünschte Estrichart mit – Sie erhalten ein transparentes Angebot.', 'Jetzt Angebot anfragen' );
	return kilic_divi( $s );
}

/* ---------- Estrich ---------- */

function kilic_inhalt_estrich() {
	$card = function ( $slug, $code, $title, $text, $dl ) {
		$d = '';
		foreach ( $dl as $k => $v ) {
			$d .= '<dt>' . $k . '</dt><dd>' . $v . '</dd>';
		}
		return '<article class="type-card"><span class="code">' . $code . '</span><h3>' . $title . '</h3><p>' . $text . '</p><dl>' . $d . '</dl><p style="margin-top:16px"><a class="more" href="{{home}}/estrich/' . $slug . '/">Mehr zu ' . $title . ' <span class="ki ki-arrow"></span></a></p></article>';
	};
	$dots = function ( $n ) {
		return '<span class="dots">' . str_repeat( '<i class="on"></i>', $n ) . str_repeat( '<i></i>', 5 - $n ) . '</span>';
	};
	$s = array();
	$s['Kopfbereich'] = kilic_c_hero( array(
		'crumbs'  => array( 'Estrich' => '' ),
		'eyebrow' => 'Unser Kerngeschäft',
		'title'   => 'Estrich vom <span>Meisterbetrieb</span>',
		'lead'    => 'Ob Neubau mit Fußbodenheizung, Altbausanierung oder Gewerbehalle – wir wählen den passenden Estrich für Ihr Objekt und bringen ihn eben, tragfähig und termingerecht ein.',
		'img'     => 'grau',
		'buttons' => '<a class="btn btn-accent" href="{{home}}/angebot-anfragen/?leistung=Estrich">Estrich anfragen <span class="ki ki-arrow"></span></a><a class="btn btn-ghost btn-ghost-light" href="#arten">Estricharten vergleichen</a>',
	) );
	$s['Was ist Estrich'] = '<section class="section"><div class="wrap split"><div><div class="eyebrow">Was ist Estrich?</div><h2>Die unsichtbare Basis für jeden Bodenbelag</h2><p class="lead">Estrich ist die Schicht zwischen Rohdecke und Bodenbelag. Er gleicht Höhen aus, verteilt Lasten, nimmt die Fußbodenheizung auf und sorgt dafür, dass Fliesen, Parkett oder Vinyl dauerhaft halten.</p><p>Wir beraten Sie bei der Wahl der richtigen Estrichart, der Dämmung und der Aufbauhöhe – abgestimmt auf Nutzung, Zeitplan und Budget.</p>'
		. kilic_c_checklist( array( 'Schwimmender Estrich auf Wärme- und Trittschalldämmung', 'Estrich auf Trennlage oder im Verbund', 'Heizestrich für Fußbodenheizung (Nass-System)', 'Gefälleestrich für Bäder, Balkone und Garagen' ) )
		. '</div><div><div class="layers" aria-label="Beispielhafter Bodenaufbau"><div class="layer l1">Bodenbelag <small>Parkett / Fliese / Vinyl</small></div><div class="layer l2">Heizestrich <small>mind. 45 mm über Rohr</small></div><div class="layer l3">PE-Folie / Abdeckung <small>&nbsp;</small></div><div class="layer l4">Wärme- &amp; Trittschalldämmung <small>z. B. EPS / PUR</small></div><div class="layer l5">Abdichtung / Feuchtigkeitssperre <small>&nbsp;</small></div><div class="layer l6">Rohdecke / Bodenplatte <small>Beton</small></div></div><p class="muted center" style="font-size:.85rem;margin-top:14px">Beispiel: schwimmender Heizestrich im Neubau</p></div></div></section>';
	$s['Estricharten'] = '<section class="section bg-concrete texture" id="arten"><div class="wrap"><div class="section-head center"><div class="eyebrow">Estricharten</div><h2>Welcher Estrich passt zu Ihrem Projekt?</h2><p class="lead">Jede Estrichart hat ihre Stärken. Hier ein Überblick – im Gespräch finden wir gemeinsam die beste Lösung.</p></div><div class="grid grid-3" style="margin-bottom:60px">'
		. $card( 'zementestrich', 'CT', 'Zementestrich', 'Der Allrounder: robust, feuchteunempfindlich und für nahezu alle Bereiche geeignet – auch Bad, Keller und Garage.', array( 'Ideal für' => 'Wohnbau, Nassräume, Gewerbe', 'Begehbar' => 'nach ca. 2–3 Tagen' ) )
		. $card( 'fliessestrich', 'CAF', 'Fließestrich', 'Calciumsulfat-Fließestrich: selbstnivellierend, sehr eben und großflächig fugenarm – ideal für Fußbodenheizung.', array( 'Ideal für' => 'Neubau, große Flächen, FBH', 'Begehbar' => 'nach ca. 1–2 Tagen' ) )
		. $card( 'heizestrich', 'FBH', 'Heizestrich', 'Zement- oder Fließestrich, der die Rohre Ihrer Fußbodenheizung umschließt – inklusive Aufheizprotokoll.', array( 'Ideal für' => 'Neubau, Sanierung mit FBH', 'Extra' => 'Messstellen &amp; Protokoll' ) )
		. $card( 'schnellestrich', 'SE', 'Schnellestrich', 'Wenn es eilt: Spezialbindemittel ermöglichen sehr kurze Trocknungszeiten – ideal bei Sanierung und engem Zeitplan.', array( 'Ideal für' => 'Sanierung, Termindruck', 'Belegreif' => 'je nach System nach wenigen Tagen' ) )
		. $card( 'trockenestrich', 'TE', 'Trockenestrich', 'Fertigteil-Platten ohne Baufeuchte – leicht, schnell und ideal für Holzbalkendecken und Dachgeschosse.', array( 'Ideal für' => 'Altbau, Holzdecken, DG', 'Belegreif' => 'nach Verlegung' ) )
		. $card( 'industrie-gefaelleestrich', 'GE', 'Industrie- &amp; Gefälleestrich', 'Gefälle für bodengleiche Duschen, Balkone und Garagen sowie hochbelastbare Böden für Hallen und Werkstätten.', array( 'Ideal für' => 'Bad, Balkon, Halle, Garage', 'Extra' => 'Oberfläche geglättet' ) )
		. '</div><div class="table-wrap"><table class="compare"><thead><tr><th>Estrichart</th><th>Trocknung</th><th>Ebenheit</th><th>Feuchteresistenz</th><th>Fußbodenheizung</th><th>Typische Einsätze</th></tr></thead><tbody>'
		. '<tr><th>Zementestrich<small>CT</small></th><td>' . $dots( 2 ) . '</td><td>' . $dots( 3 ) . '</td><td>' . $dots( 5 ) . '</td><td>✔ sehr gut</td><td>Wohnräume, Bad, Keller, Garage</td></tr>'
		. '<tr><th>Fließestrich<small>CAF</small></th><td>' . $dots( 3 ) . '</td><td>' . $dots( 5 ) . '</td><td>' . $dots( 2 ) . '</td><td>✔ optimal</td><td>Neubau, große Wohnflächen</td></tr>'
		. '<tr><th>Schnellestrich<small>SE</small></th><td>' . $dots( 5 ) . '</td><td>' . $dots( 3 ) . '</td><td>' . $dots( 4 ) . '</td><td>✔ gut</td><td>Sanierung, Termindruck</td></tr>'
		. '<tr><th>Trockenestrich<small>TE</small></th><td>' . $dots( 5 ) . '</td><td>' . $dots( 4 ) . '</td><td>' . $dots( 1 ) . '</td><td>bedingt (Systemplatten)</td><td>Altbau, Holzbalkendecken</td></tr>'
		. '</tbody></table></div><p class="muted" style="font-size:.8rem;margin-top:14px">Trocknungs- und Belegreifezeiten hängen von Estrichdicke, Raumklima und Lüftung ab. Die Belegreife wird vor dem Verlegen des Oberbelags per CM-Messung geprüft.</p></div></section>';
	$s['Vorteile'] = '<section class="section bg-dark"><div class="wrap"><div class="section-head center"><div class="eyebrow light">Warum Kilic Estrich</div><h2 style="color:#fff">Qualität, die man nicht sieht – aber spürt</h2></div><div class="grid grid-3">'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-medal"></span></div><h4 style="color:#fff">Meisterqualität</h4><p>Ausführung durch geschultes Fachpersonal unter Meisterleitung – nach DIN 18560.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-layers"></span></div><h4 style="color:#fff">Kompletter Aufbau</h4><p>Dämmung, Randstreifen, Folie, Estrich und Fugenplanung aus einer Hand.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-truck"></span></div><h4 style="color:#fff">Eigene Technik</h4><p>Estrichpumpen und Mischtechnik für kleine Wohnungen bis große Gewerbeflächen.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-flame"></span></div><h4 style="color:#fff">FBH-Kompetenz</h4><p>Abstimmung mit dem Heizungsbauer, Messstellen und Aufheizprotokoll.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-clock"></span></div><h4 style="color:#fff">Termintreue</h4><p>Verbindliche Termine – damit Ihr Bauzeitenplan hält und Folgegewerke planen können.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-euro"></span></div><h4 style="color:#fff">Faire Preise</h4><p>Transparentes Angebot nach Aufmaß – ohne versteckte Kosten.</p></div>'
		. '</div></div></section>';
	$s['Ablauf'] = '<section class="section" id="ablauf"><div class="wrap"><div class="section-head"><div class="eyebrow">Ablauf auf der Baustelle</div><h2>Von der Dämmung bis zur Belegreife</h2></div><div class="steps"><div class="step"><h4>Vorbereitung</h4><p>Untergrund prüfen, Höhen festlegen, Randdämmstreifen und Dämmung verlegen.</p></div><div class="step"><h4>Einbringen</h4><p>Estrich pumpen, verteilen, abziehen bzw. nivellieren und Bewegungsfugen setzen.</p></div><div class="step"><h4>Trocknung</h4><p>Richtig lüften und ggf. Aufheizen nach Protokoll – wir geben klare Hinweise.</p></div><div class="step"><h4>Belegreife</h4><p>CM-Messung und Freigabe für Fliesen-, Parkett- oder Bodenleger.</p></div></div></div></section>';
	$s['FAQ'] = kilic_c_faq( array(
		array( 'Wie lange muss Estrich trocknen?', 'Als Faustregel gilt bei Zementestrich etwa eine Woche pro Zentimeter Dicke bis 4 cm, darüber deutlich länger. Fließ- und Schnellestriche sind schneller. Entscheidend ist immer die CM-Messung vor dem Belegen.' ),
		array( 'Wann darf ich den Estrich betreten?', 'Zementestrich ist meist nach 2–3 Tagen begehbar, Fließestrich oft schon nach 24–48 Stunden. Belastet werden sollte er erst später.' ),
		array( 'Was kostet Estrich pro Quadratmeter?', 'Der Preis hängt von Estrichart, Dicke, Dämmung, Fläche und Zugänglichkeit ab. Nutzen Sie unser Anfrageformular – Sie erhalten ein konkretes Angebot für Ihr Objekt.' ),
		array( 'Welcher Estrich ist besser für Fußbodenheizung?', 'Beide Systeme eignen sich. Fließestrich umschließt die Rohre besonders gut und ist sehr eben, Zementestrich ist feuchteunempfindlicher. Wir beraten Sie objektbezogen.' ),
	), 'FAQ rund um Estrich' );
	$s['Abschluss'] = kilic_c_cta( 'Ihr Estrich-Projekt', 'Objekt, Fläche und Estrichart angeben – wir melden uns mit einem Angebot.', 'Estrich anfragen', '{{home}}/angebot-anfragen/?leistung=Estrich' );
	return kilic_divi( $s );
}

function kilic_estrich_related( $ohne ) {
	$all = array(
		'Heizestrich'      => '{{home}}/estrich/heizestrich/',
		'Fließestrich'     => '{{home}}/estrich/fliessestrich/',
		'Zementestrich'    => '{{home}}/estrich/zementestrich/',
		'Schnellestrich'   => '{{home}}/estrich/schnellestrich/',
		'Trockenestrich'   => '{{home}}/estrich/trockenestrich/',
		'Industrie & Gefälle' => '{{home}}/estrich/industrie-gefaelleestrich/',
	);
	unset( $all[ $ohne ] );
	return $all;
}

function kilic_inhalt_heizestrich() {
	return kilic_c_unterseite( array(
		'title'  => 'Heizestrich', 'parent' => array( 'Estrich', '{{home}}/estrich/' ),
		'eyebrow' => 'Estrich für Fußbodenheizung',
		'h1'     => 'Heizestrich – <span>Wärme, die trägt.</span>',
		'lead'   => 'Der Heizestrich umschließt die Rohre Ihrer Fußbodenheizung, verteilt die Wärme gleichmäßig und trägt den späteren Bodenbelag. Wir stimmen uns dafür direkt mit Ihrem Heizungsbauer ab.',
		'intro_eyebrow' => 'So bauen wir Heizestrich',
		'intro_h2' => 'Abgestimmt auf Heizsystem und Belag',
		'intro'  => '<p class="lead">Ob Zement- oder Calciumsulfat-Fließestrich: Entscheidend sind die richtige Überdeckung der Heizrohre, sauber gesetzte Bewegungsfugen und ein protokolliertes Aufheizen.</p>',
		'check'  => array( 'Randdämmstreifen und Abdeckung der Dämmung', 'Mindestüberdeckung der Heizrohre nach Norm', 'Fugenplan passend zu den Heizkreisen', 'Messstellen für die CM-Messung markiert', 'Funktions- und Belegreifheizen mit Protokoll' ),
		'facts'  => array( 'Überdeckung' => 'mind. 45 mm über Rohr', 'Estrich' => 'CT oder CAF', 'Funktionsheizen CT' => 'frühestens nach ca. 21 Tagen', 'Funktionsheizen CAF' => 'frühestens nach ca. 7 Tagen' ),
		'facts_note' => 'Richtwerte. Maßgeblich sind die Angaben des Estrich- und Heizsystemherstellers.',
		'faq'    => array(
			array( 'Was ist der Unterschied zwischen Funktions- und Belegreifheizen?', 'Das Funktionsheizen prüft die Heizungsanlage und den Estrich. Das Belegreifheizen trocknet den Estrich gezielt, bis die CM-Messung die Belegreife bestätigt.' ),
			array( 'Wer erstellt das Aufheizprotokoll?', 'Das Aufheizen übernimmt in der Regel der Heizungsbauer. Wir liefern die Vorgaben, markieren die Messstellen und führen die CM-Messung durch.' ),
			array( 'Fließ- oder Zementestrich für die Fußbodenheizung?', 'Fließestrich umschließt die Rohre sehr gut und ist schneller heizbar. Zementestrich ist robuster gegen Feuchte. Wir beraten Sie je nach Objekt.' ),
		),
		'related' => kilic_estrich_related( 'Heizestrich' ),
		'cta'    => 'Heizestrich für Ihr Projekt?',
	) );
}

function kilic_inhalt_fliessestrich() {
	return kilic_c_unterseite( array(
		'title'  => 'Fließestrich', 'parent' => array( 'Estrich', '{{home}}/estrich/' ),
		'eyebrow' => 'Calciumsulfat-Fließestrich (CAF)',
		'h1'     => 'Fließestrich – <span>eben wie ein Spiegel.</span>',
		'lead'   => 'Calciumsulfat-Fließestrich verteilt sich nahezu von selbst, wird sehr eben und eignet sich hervorragend für große Flächen und Fußbodenheizung.',
		'intro_eyebrow' => 'Vorteile',
		'intro_h2' => 'Schnell eingebracht, großflächig fugenarm',
		'intro'  => '<p class="lead">Mit der Pumpe bringen wir Fließestrich zügig ein – auch in mehreren Geschossen an einem Tag. Durch die hohe Ebenheit entfällt oft das Spachteln vor dem Belegen.</p>',
		'check'  => array( 'Sehr hohe Ebenheit', 'Großflächig mit wenigen Fugen', 'Umschließt Heizrohre vollständig', 'Geringere Schichtdicke möglich', 'Früh begehbar' ),
		'facts'  => array( 'Kurzzeichen' => 'CAF', 'Begehbar' => 'nach ca. 1–2 Tagen', 'Belegreife (Richtwert)' => '≤ 0,5 CM-% (beheizt ≤ 0,3)', 'Nicht geeignet' => 'dauerhaft nasse Bereiche' ),
		'facts_note' => 'Richtwerte. Maßgeblich sind Herstellerangaben und die Vorgaben des Oberbelags.',
		'faq'    => array(
			array( 'Darf Fließestrich ins Bad?', 'In häuslichen Bädern ja – mit Abdichtung nach Norm. In dauerhaft nassen Bereichen wie Duschanlagen in Gewerbe oder Garagen empfehlen wir Zementestrich.' ),
			array( 'Muss Fließestrich angeschliffen werden?', 'Je nach Produkt und Oberbelag ja. Wir klären das vorab mit Ihrem Bodenleger.' ),
		),
		'related' => kilic_estrich_related( 'Fließestrich' ),
	) );
}

function kilic_inhalt_zementestrich() {
	return kilic_c_unterseite( array(
		'title'  => 'Zementestrich', 'parent' => array( 'Estrich', '{{home}}/estrich/' ),
		'eyebrow' => 'Zementestrich (CT)',
		'h1'     => 'Zementestrich – <span>der robuste Allrounder.</span>',
		'lead'   => 'Zementestrich ist feuchteunempfindlich, belastbar und für fast alle Bereiche geeignet – vom Wohnzimmer über das Bad bis zu Keller und Garage.',
		'intro_eyebrow' => 'Einsatzbereiche',
		'intro_h2' => 'Bewährt in Wohnbau und Gewerbe',
		'intro'  => '<p class="lead">Wir mischen Zementestrich auf der Baustelle, fördern ihn mit der Estrichpumpe und verdichten und glätten ihn fachgerecht – schwimmend, auf Trennlage oder im Verbund.</p>',
		'check'  => array( 'Auch für Nassräume, Keller und Garagen', 'Als Heizestrich geeignet', 'Gefälle für Bäder und Balkone möglich', 'Verschiedene Festigkeitsklassen', 'Maschinell geglättete Oberfläche' ),
		'facts'  => array( 'Kurzzeichen' => 'CT', 'Begehbar' => 'nach ca. 2–3 Tagen', 'Belegreife (Richtwert)' => '≤ 2,0 CM-% (beheizt ≤ 1,8)', 'Trocknung (Faustregel)' => '1 Woche je cm bis 4 cm' ),
		'facts_note' => 'Richtwerte. Maßgeblich sind Herstellerangaben und die Vorgaben des Oberbelags.',
		'faq'    => array(
			array( 'Warum dauert die Trocknung so lange?', 'Zementestrich enthält viel Anmachwasser, das verdunsten muss. Gutes Lüften und ggf. Bautrockner beschleunigen den Prozess.' ),
			array( 'Kann ich Zementestrich beschleunigen?', 'Ja, mit Zusatzmitteln oder einem Schnellestrich-System. Wir beraten Sie bei engem Zeitplan.' ),
		),
		'related' => kilic_estrich_related( 'Zementestrich' ),
	) );
}

function kilic_inhalt_schnellestrich() {
	return kilic_c_unterseite( array(
		'title'  => 'Schnellestrich', 'parent' => array( 'Estrich', '{{home}}/estrich/' ),
		'eyebrow' => 'Wenn es schnell gehen muss',
		'h1'     => 'Schnellestrich – <span>früher belegen.</span>',
		'lead'   => 'Spezielle Bindemittel verkürzen die Wartezeit bis zum Oberbelag deutlich – ideal bei Sanierung in bewohnten Gebäuden oder engen Bauzeitenplänen.',
		'intro_eyebrow' => 'Für enge Zeitpläne',
		'intro_h2' => 'Weniger Wartezeit, gleiche Qualität',
		'intro'  => '<p class="lead">Wir wählen das Schnellestrich-System passend zu Belag und Termin und prüfen die Belegreife vor der Freigabe.</p>',
		'check'  => array( 'Belegreif je nach System nach wenigen Tagen', 'Ideal für Sanierung und Gewerbe', 'Weniger Baufeuchte im Gebäude', 'Auch als Heizestrich möglich' ),
		'facts'  => array( 'Begehbar' => 'oft nach wenigen Stunden', 'Belegreif' => 'je nach System nach Tagen', 'Ideal für' => 'Sanierung, Termindruck' ),
		'faq'    => array(
			array( 'Ist Schnellestrich teurer?', 'Das Material ist teurer, dafür sparen Sie Zeit, Mietausfall oder Hotelkosten. Wir rechnen beide Varianten gern gegeneinander.' ),
		),
		'related' => kilic_estrich_related( 'Schnellestrich' ),
		'leistung' => 'Estrich',
	) );
}

function kilic_inhalt_trockenestrich() {
	return kilic_c_unterseite( array(
		'title'  => 'Trockenestrich', 'parent' => array( 'Estrich', '{{home}}/estrich/' ),
		'eyebrow' => 'Estrich ohne Baufeuchte',
		'h1'     => 'Trockenestrich – <span>leicht und sofort weiter.</span>',
		'lead'   => 'Trockenestrich aus Gipsfaser- oder zementgebundenen Platten bringt keine Feuchtigkeit ins Haus. Ideal für Holzbalkendecken, Dachgeschosse und Altbauten.',
		'intro_eyebrow' => 'Typische Einsätze',
		'intro_h2' => 'Perfekt für Altbau und Dachausbau',
		'intro'  => '<p class="lead">Die Elemente werden verklebt und verschraubt – danach kann je nach System direkt weitergearbeitet werden.</p>',
		'check'  => array( 'Geringes Gewicht für Holzbalkendecken', 'Keine Trocknungszeit', 'Ausgleichsschüttung für unebene Untergründe', 'Systeme für Fußbodenheizung erhältlich' ),
		'facts'  => array( 'Material' => 'Gipsfaser / zementgebunden', 'Belegreif' => 'nach Verlegung', 'Ideal für' => 'Altbau, DG, Holzdecken' ),
		'faq'    => array(
			array( 'Ist Trockenestrich für Bäder geeignet?', 'Mit geeigneten Platten und Abdichtung ja. Für bodengleiche Duschen planen wir die Details individuell.' ),
		),
		'related' => kilic_estrich_related( 'Trockenestrich' ),
	) );
}

function kilic_inhalt_industrie() {
	return kilic_c_unterseite( array(
		'title'  => 'Industrie- & Gefälleestrich', 'parent' => array( 'Estrich', '{{home}}/estrich/' ),
		'eyebrow' => 'Belastbar &amp; mit Gefälle',
		'h1'     => 'Industrie- &amp; Gefälleestrich – <span>für hohe Ansprüche.</span>',
		'lead'   => 'Für Hallen, Werkstätten und Garagen bauen wir hochbelastbare Estriche. Gefälleestriche leiten Wasser bei Duschen, Balkonen und Garagen zuverlässig ab.',
		'img'    => 'dunkel', 'img2' => 'dunkel',
		'intro_eyebrow' => 'Leistungen',
		'intro_h2' => 'Robust für Gewerbe und Außenbereiche',
		'intro'  => '<p class="lead">Wir planen Festigkeitsklasse, Dicke und Oberfläche passend zur Nutzung – vom Staplerverkehr bis zur bodengleichen Dusche.</p>',
		'check'  => array( 'Hochbelastbare Zementestriche im Verbund', 'Maschinell geglättete Oberflächen', 'Gefälle zu Rinnen und Abläufen', 'Garagen, Werkstätten, Lagerhallen' ),
		'facts'  => array( 'Gefälle' => 'typ. 1,5–2 %', 'Festigkeit' => 'nach Nutzung, z. B. CT-C35', 'Oberfläche' => 'geglättet / beschichtungsfähig' ),
		'related' => kilic_estrich_related( 'Industrie & Gefälle' ),
	) );
}

/* ---------- Boden ---------- */

function kilic_inhalt_boden() {
	$s = array();
	$s['Kopfbereich'] = kilic_c_hero( array(
		'crumbs'  => array( 'Boden' => '' ),
		'eyebrow' => 'Sanierung &amp; Verlegung',
		'title'   => 'Aus alt wird <span>wieder eben.</span>',
		'lead'    => 'Wir sanieren beschädigte Böden, gleichen Unebenheiten aus und verlegen auf Wunsch gleich den fertigen Oberbelag – alles aus einer Hand.',
		'img'     => 'warm',
		'buttons' => '<a class="btn btn-accent" href="{{home}}/angebot-anfragen/?leistung=Bodensanierung">Sanierung anfragen <span class="ki ki-arrow"></span></a><a class="btn btn-ghost btn-ghost-light" href="{{home}}/boden/bodenverlegung/">Bodenverlegung</a>',
	) );
	$s['Leistungen'] = '<section class="section"><div class="wrap"><div class="section-head center"><div class="eyebrow">Unsere Bodenleistungen</div><h2>Die richtige Lösung für jeden Untergrund</h2></div><div class="grid grid-3">'
		. '<a class="service-card" href="{{home}}/boden/bodensanierung/">' . kilic_img( 'dunkel', 'Bodensanierung' ) . '<div class="body"><span class="tag">Altbau</span><h3>Bodensanierung</h3><p>Risse, Hohlstellen und Feuchteschäden fachgerecht beheben – oder den Altestrich komplett erneuern.</p><span class="more">Mehr erfahren <span class="ki ki-arrow"></span></span></div></a>'
		. '<a class="service-card" href="{{home}}/boden/bodenverlegung/">' . kilic_img( 'warm', 'Bodenverlegung' ) . '<div class="body"><span class="tag">Oberbelag</span><h3>Bodenverlegung</h3><p>Vinyl, Designbelag, Laminat und Parkett – verlegt auf unserem eigenen Estrich.</p><span class="more">Mehr erfahren <span class="ki ki-arrow"></span></span></div></a>'
		. '<a class="service-card" href="{{home}}/boden/ausgleichsmassen/">' . kilic_img( 'grau', 'Ausgleichsmasse' ) . '<div class="body"><span class="tag">Untergrund</span><h3>Ausgleichen &amp; Nivellieren</h3><p>Selbstverlaufende Massen, Schleifen und Feuchtemessung für einen perfekten Untergrund.</p><span class="more">Mehr erfahren <span class="ki ki-arrow"></span></span></div></a>'
		. '</div></div></section>';
	$s['Vorher Nachher'] = '<section class="section bg-concrete texture"><div class="wrap split"><div><div class="eyebrow">Vorher / Nachher</div><h2>Sanierung, die man sieht</h2><p class="lead">Ersetzen Sie die beiden Bilder durch eigene Fotos – vorher links, nachher rechts.</p></div><div class="ba">' . kilic_img( 'dunkel', 'Vorher' ) . kilic_img( 'grau', 'Nachher' ) . '</div></div></section>';
	$s['Abschluss'] = kilic_c_cta( 'Unsicher, was Ihr Boden braucht?', 'Wir schauen uns den Untergrund vor Ort an und beraten Sie ehrlich.', 'Besichtigung anfragen', '{{home}}/angebot-anfragen/?leistung=Bodensanierung' );
	return kilic_divi( $s );
}

function kilic_boden_related( $ohne ) {
	$all = array(
		'Bodensanierung'   => '{{home}}/boden/bodensanierung/',
		'Bodenverlegung'   => '{{home}}/boden/bodenverlegung/',
		'Ausgleichsmassen' => '{{home}}/boden/ausgleichsmassen/',
		'Estricharten'     => '{{home}}/estrich/',
	);
	unset( $all[ $ohne ] );
	return $all;
}

function kilic_inhalt_bodensanierung() {
	return kilic_c_unterseite( array(
		'title'  => 'Bodensanierung', 'parent' => array( 'Boden', '{{home}}/boden/' ), 'leistung' => 'Bodensanierung',
		'eyebrow' => 'Altbau &amp; Schäden',
		'h1'     => 'Bodensanierung – <span>wieder tragfähig.</span>',
		'lead'   => 'Gerade im Altbau sind Böden oft uneben, gerissen oder nicht mehr tragfähig. Wir analysieren den Schaden und wählen die wirtschaftlichste Lösung.',
		'img'    => 'dunkel',
		'intro_eyebrow' => 'Was wir sanieren',
		'intro_h2' => 'Risse, Hohlstellen, Feuchte? Wir sanieren fachgerecht.',
		'intro'  => '<p class="lead">Nicht jeder Schaden erfordert einen kompletten Neuaufbau. Oft reichen gezielte Maßnahmen – das spart Zeit und Geld.</p>',
		'check'  => array( 'Altestrich und alte Beläge entfernen &amp; entsorgen', 'Risse verharzen und kraftschlüssig verbinden', 'Hohlstellen und lose Bereiche sanieren', 'Feuchteschäden nach Wasserschaden beheben', 'Neuaufbau mit Schnell- oder Trockenestrich' ),
		'extra'  => '<section class="section-sm"><div class="wrap"><div class="ba">' . kilic_img( 'dunkel', 'Vorher' ) . kilic_img( 'grau', 'Nachher' ) . '</div></div></section>',
		'faq'    => array(
			array( 'Kann ich in der Wohnung bleiben?', 'Oft ja – wir arbeiten raumweise und setzen bei Bedarf Schnellestrich ein, damit die Räume schnell wieder nutzbar sind.' ),
			array( 'Was passiert nach einem Wasserschaden?', 'Wir prüfen Dämmung und Estrich auf Feuchte und entscheiden, ob Trocknung genügt oder ein Neuaufbau nötig ist.' ),
		),
		'related' => kilic_boden_related( 'Bodensanierung' ),
	) );
}

function kilic_inhalt_bodenverlegung() {
	return kilic_c_unterseite( array(
		'title'  => 'Bodenverlegung', 'parent' => array( 'Boden', '{{home}}/boden/' ), 'leistung' => 'Bodenverlegung',
		'eyebrow' => 'Fertiger Boden',
		'h1'     => 'Bodenverlegung – <span>vom Estrich bis zum Belag.</span>',
		'lead'   => 'Kein Abstimmungsaufwand zwischen Gewerken: Wir verlegen den Oberbelag direkt auf unserem eigenen Estrich.',
		'img'    => 'warm',
		'intro_eyebrow' => 'Beläge',
		'intro_h2' => 'Vinyl, Laminat und Parkett',
		'intro'  => '<p class="lead">Wir bereiten den Untergrund vor, prüfen die Belegreife und verlegen Ihren Wunschbelag – inklusive Sockelleisten und Übergangsprofilen.</p>',
		'check'  => array( 'Vinyl &amp; Designbelag (Klick oder geklebt)', 'Laminat für Wohn- und Schlafräume', 'Parkett – geklebt oder schwimmend', 'Sockelleisten und Übergangsprofile', 'Material auf Wunsch von uns' ),
		'related' => kilic_boden_related( 'Bodenverlegung' ),
	) );
}

function kilic_inhalt_ausgleich() {
	return kilic_c_unterseite( array(
		'title'  => 'Ausgleichsmassen & Nivellieren', 'parent' => array( 'Boden', '{{home}}/boden/' ), 'leistung' => 'Bodensanierung',
		'eyebrow' => 'Untergrundvorbereitung',
		'h1'     => 'Ausgleichen &amp; Nivellieren – <span>die perfekte Basis.</span>',
		'lead'   => 'Selbstverlaufende Spachtelmassen gleichen Unebenheiten aus und schaffen einen Untergrund, auf dem jeder Belag dauerhaft hält.',
		'intro_eyebrow' => 'Leistungen',
		'intro_h2' => 'Eben, sauber, belegreif',
		'intro'  => '<p class="lead">Wir schleifen, grundieren und nivellieren – abgestimmt auf den späteren Belag und die Ebenheitsanforderungen.</p>',
		'check'  => array( 'Selbstverlaufende Ausgleichsmassen', 'Schleifen und Fräsen, Kleberreste entfernen', 'Grundierung und Haftbrücken', 'CM-Messung und Restfeuchte-Protokoll' ),
		'related' => kilic_boden_related( 'Ausgleichsmassen' ),
	) );
}

/* ---------- Rohrreinigung ---------- */

function kilic_inhalt_rohrreinigung() {
	$s = array();
	$s['Kopfbereich'] = kilic_c_hero( array(
		'crumbs'  => array( 'K &amp; K Rohrreinigung' => '' ),
		'eyebrow' => 'K &amp; K Rohrreinigung · Mosbach',
		'title'   => 'Abfluss verstopft? <span>Wir kommen sofort.</span>',
		'lead'    => 'Rund um die Uhr, 7 Tage die Woche – auch sonntags und an Feiertagen. Schnelle Hilfe bei Verstopfung, Rückstau und Wasserschaden in Mosbach und Umgebung.',
		'img'     => 'blau',
		'rohr'    => true,
		'buttons' => '<a class="btn btn-red" href="{{notdienst_link}}"><span class="ki ki-phone"></span> Notdienst anrufen</a><a class="btn btn-ghost btn-ghost-light" href="{{home}}/angebot-anfragen/?leistung=Rohrreinigung">Termin online anfragen</a>',
		'side'    => '<div class="hero-card" style="text-align:center;border-top:6px solid var(--red)"><span class="tag red"><i class="pulse" style="background:var(--red);display:inline-block;margin-right:6px"></i> Jetzt erreichbar</span><h3>24/7 Notdienst</h3><p>Auch Sonntag, nachts &amp; an Feiertagen</p><a href="{{notdienst_link}}" style="display:block;font-family:var(--font-head);font-size:2.6rem;font-weight:700;color:var(--red);text-decoration:none;margin:14px 0 6px">{{notdienst}}</a><p class="muted" style="font-size:.85rem">Bitte nennen Sie am Telefon Adresse, Problem und Rückrufnummer.</p><table class="hours" style="margin-top:10px;text-align:left"><tr><td>Montag – Freitag</td><td>0–24 Uhr</td></tr><tr><td>Samstag</td><td>0–24 Uhr</td></tr><tr class="em"><td>Sonntag &amp; Feiertag</td><td>0–24 Uhr</td></tr></table></div>',
	) );
	$box = function ( $icon, $t, $p, $url = '' ) {
		$h = '<h4>' . $t . '</h4><p>' . $p . '</p>';
		if ( $url ) {
			$h .= '<p style="margin-top:12px"><a class="more" style="color:var(--blue)" href="' . $url . '">Mehr erfahren <span class="ki ki-arrow"></span></a></p>';
		}
		return '<div class="icon-box blue"><div class="ic"><span class="ki ki-' . $icon . '"></span></div>' . $h . '</div>';
	};
	$s['Leistungen'] = '<section class="section" id="leistungen"><div class="wrap"><div class="section-head center"><div class="eyebrow blue">Leistungen</div><h2>Professionelle Rohr- und Kanalreinigung</h2><p class="lead">Moderne Technik, erfahrene Monteure und saubere Arbeit – vom verstopften Waschbecken bis zum Hauptkanal.</p></div><div class="grid grid-3">'
		. $box( 'drop', 'Abflussreinigung', 'Waschbecken, Dusche, Badewanne, WC und Küchenspüle – schnell und schonend frei.' )
		. $box( 'pipe', 'Rohrreinigung', 'Mechanische Reinigung mit Spiralmaschine bei Fett, Kalk, Haaren und Fremdkörpern.' )
		. $box( 'wrench', 'Hochdruckspülung', 'Gründliche Reinigung von Grund- und Kanalleitungen mit Hochdrucktechnik.' )
		. $box( 'camera', 'Kanal-TV-Inspektion', 'Kamerabefahrung zur Ursachenfindung, mit Dokumentation für Versicherung oder Kauf.', '{{home}}/rohrreinigung/kanal-tv/' )
		. $box( 'alert', 'Rückstau &amp; Wasserschaden', 'Soforthilfe bei Rückstau im Keller und Unterstützung bei der Schadensbehebung.', '{{home}}/rohrreinigung/notdienst/' )
		. $box( 'shield', 'Wartung &amp; Vorsorge', 'Regelmäßige Wartung für Gewerbe, Gastronomie und Hausverwaltungen.', '{{home}}/rohrreinigung/wartung/' )
		. '</div></div></section>';
	$s['Notdienst-Banner'] = kilic_c_notdienst( 'Notfall? Nicht warten – anrufen!', 'Je früher wir eingreifen, desto geringer der Schaden. Unser Notdienst ist 24 Stunden an 365 Tagen erreichbar.' );
	$s['Einsatzarten'] = '<section class="section bg-concrete texture" id="preise"><div class="wrap"><div class="section-head center"><div class="eyebrow blue">Einsatzarten</div><h2>Klar geregelt – ohne böse Überraschungen</h2><p class="lead">Vor Beginn der Arbeiten nennen wir Ihnen die Kosten. Keine versteckten Gebühren.</p></div><div class="grid grid-3">'
		. '<div class="price-card"><span class="tag blue">Werktags</span><h3>Regulärer Einsatz</h3><p class="muted">Mo–Fr während der Geschäftszeiten, Terminvereinbarung möglich.</p>' . kilic_c_checklist( array( 'Anfahrt im Einsatzgebiet', 'Diagnose vor Ort', 'Kosten-Info vor Beginn' ), true ) . '<a class="btn btn-ghost" href="{{home}}/angebot-anfragen/?leistung=Rohrreinigung">Termin anfragen</a></div>'
		. '<div class="price-card featured"><span class="tag red">Sofort</span><h3>Notdienst 24/7</h3><p class="muted">Nachts, am Wochenende, sonntags und an Feiertagen.</p>' . kilic_c_checklist( array( 'Schnellstmögliche Anfahrt', 'Sofortige Beseitigung', 'Erste Schadensbegrenzung' ), true ) . '<a class="btn btn-red" href="{{notdienst_link}}"><span class="ki ki-phone"></span> Jetzt anrufen</a></div>'
		. '<div class="price-card"><span class="tag blue">Gewerbe</span><h3>Wartungsvertrag</h3><p class="muted">Für Gastronomie, Hausverwaltungen und Gewerbebetriebe.</p>' . kilic_c_checklist( array( 'Regelmäßige Spülung', 'Kamera-Dokumentation', 'Bevorzugte Einsätze' ), true ) . '<a class="btn btn-ghost" href="{{home}}/rohrreinigung/wartung/">Mehr zur Wartung</a></div>'
		. '</div></div></section>';
	$s['Einsatzgebiet & FAQ'] = kilic_c_faq(
		array(
			array( 'Sind Sie wirklich auch sonntags erreichbar?', 'Ja. Unser Rohrreinigungs-Notdienst ist 24 Stunden an 7 Tagen erreichbar – auch sonntags, nachts und an Feiertagen.' ),
			array( 'Was kann ich bis zur Ankunft tun?', 'Wasserzufuhr stoppen, betroffene Abflüsse nicht weiter benutzen und keine chemischen Rohrreiniger verwenden – diese können Rohre beschädigen.' ),
			array( 'Übernimmt die Versicherung die Kosten?', 'Bei Wasserschäden oft ja. Wir dokumentieren den Einsatz auf Wunsch mit Kanal-TV für Ihre Versicherung.' ),
			array( 'Wo sind Sie im Einsatz?', 'Mosbach, Neckarelz, Diedesheim, Obrigheim, Haßmersheim, Neckarzimmern, Elztal, Billigheim, Schefflenz, Neckargerach, Aglasterhausen und Umgebung.' ),
		),
		'Schnell vor Ort in der Region',
		'Einsatzgebiet &amp; FAQ',
		'<aside class="summary" style="top:130px;background:linear-gradient(135deg,#0f2c52,#17467f)"><h4><span class="ki ki-phone"></span> Notdienst-Hotline</h4><a href="{{notdienst_link}}" class="big" style="color:#fff;text-decoration:none;display:block;margin:12px 0">{{notdienst}}</a><p style="color:#c8d6ea;font-size:.9rem">24/7 · auch sonntags &amp; feiertags</p><a class="btn btn-red" style="width:100%;margin-top:10px" href="{{notdienst_link}}">Jetzt anrufen</a><div class="summary-help" style="background:rgba(255,255,255,.08)">Kein Notfall?<br><a href="{{home}}/angebot-anfragen/?leistung=Rohrreinigung" style="font-size:1.1rem">Termin online anfragen →</a></div></aside>'
	);
	return kilic_divi( $s );
}

function kilic_rohr_related( $ohne ) {
	$all = array(
		'24/7 Notdienst' => '{{home}}/rohrreinigung/notdienst/',
		'Kanal-TV'       => '{{home}}/rohrreinigung/kanal-tv/',
		'Wartung'        => '{{home}}/rohrreinigung/wartung/',
		'Alle Leistungen'=> '{{home}}/rohrreinigung/',
	);
	unset( $all[ $ohne ] );
	return $all;
}

function kilic_inhalt_notdienst() {
	return kilic_c_unterseite( array(
		'rohr' => true, 'title' => '24/7 Notdienst', 'parent' => array( 'Rohrreinigung', '{{home}}/rohrreinigung/' ),
		'eyebrow' => 'Rund um die Uhr · auch sonntags',
		'h1'     => 'Rohrreinigung Notdienst – <span>24/7 erreichbar.</span>',
		'lead'   => 'Verstopfung am Sonntagabend? Rückstau in der Nacht? Rufen Sie an: {{notdienst}}. Wir sind 365 Tage im Jahr für Sie da.',
		'intro_eyebrow' => 'Im Notfall',
		'intro_h2' => 'So helfen wir sofort',
		'intro'  => '<p class="lead">Nennen Sie uns am Telefon Adresse, Problem und Rückrufnummer. Wir sagen Ihnen, wann wir vor Ort sind – und was Sie bis dahin tun können.</p>',
		'check'  => array( 'Erreichbar 24 Stunden, 7 Tage die Woche', 'Auch an Sonn- und Feiertagen', 'Kosten-Info vor Beginn der Arbeiten', 'Dokumentation für Ihre Versicherung' ),
		'facts'  => array( 'Hotline' => '{{notdienst}}', 'Erreichbar' => '24/7', 'Sonntag &amp; Feiertag' => 'Ja' ),
		'faq'    => array(
			array( 'Was kostet der Notdienst?', 'Nachts, an Wochenenden und Feiertagen fällt ein Zuschlag an. Wir nennen Ihnen die Kosten vor Beginn der Arbeiten.' ),
			array( 'Was mache ich bis zur Ankunft?', 'Wasser abstellen, Abfluss nicht weiter nutzen, keine chemischen Reiniger einsetzen und Wertgegenstände aus dem Keller bringen.' ),
		),
		'related' => kilic_rohr_related( '24/7 Notdienst' ),
	) );
}

function kilic_inhalt_kanaltv() {
	return kilic_c_unterseite( array(
		'rohr' => true, 'title' => 'Kanal-TV-Inspektion', 'parent' => array( 'Rohrreinigung', '{{home}}/rohrreinigung/' ),
		'eyebrow' => 'Kamerabefahrung',
		'h1'     => 'Kanal-TV – <span>Ursachen sichtbar machen.</span>',
		'lead'   => 'Mit der Kamera sehen wir, was im Rohr los ist: Wurzeleinwuchs, Risse, Versatz oder Ablagerungen – dokumentiert für Sie, Ihre Versicherung oder den Hauskauf.',
		'intro_eyebrow' => 'Wann sinnvoll?',
		'intro_h2' => 'Wiederkehrende Verstopfung? Erst prüfen, dann handeln.',
		'intro'  => '<p class="lead">Eine Kamerabefahrung zeigt, ob Reinigung genügt oder eine Sanierung nötig ist – das spart unnötige Kosten.</p>',
		'check'  => array( 'Ursachenfindung bei wiederkehrender Verstopfung', 'Zustandsprüfung vor Haus- oder Wohnungskauf', 'Dokumentation für Versicherungen', 'Ortung von Schäden und Leitungsverlauf' ),
		'related' => kilic_rohr_related( 'Kanal-TV' ),
	) );
}

function kilic_inhalt_wartung() {
	return kilic_c_unterseite( array(
		'rohr' => true, 'title' => 'Wartung für Gewerbe', 'parent' => array( 'Rohrreinigung', '{{home}}/rohrreinigung/' ),
		'eyebrow' => 'Vorsorge statt Notfall',
		'h1'     => 'Wartung – <span>damit nichts stillsteht.</span>',
		'lead'   => 'Für Gastronomie, Hausverwaltungen und Gewerbebetriebe: regelmäßige Spülung und Kontrolle Ihrer Leitungen nach festem Plan.',
		'intro_eyebrow' => 'Wartungsvertrag',
		'intro_h2' => 'Planbar, dokumentiert, bevorzugt',
		'intro'  => '<p class="lead">Wir legen gemeinsam Intervalle fest, spülen Ihre Leitungen vorbeugend und dokumentieren jeden Einsatz.</p>',
		'check'  => array( 'Feste Wartungsintervalle', 'Hochdruckspülung und Kamera-Kontrolle', 'Dokumentation für Betreiberpflichten', 'Bevorzugte Einsätze im Notfall' ),
		'related' => kilic_rohr_related( 'Wartung' ),
		'cta'    => 'Wartung für Ihren Betrieb?',
	) );
}

/* ---------- Referenzen, Über uns, Karriere ---------- */

function kilic_inhalt_referenzen() {
	$s = array();
	$s['Kopfbereich'] = kilic_c_hero( array(
		'crumbs'  => array( 'Referenzen' => '' ),
		'eyebrow' => 'Unsere Arbeit',
		'title'   => 'Projekte, die <span>tragen.</span>',
		'lead'    => 'Ein Auszug aus unseren Projekten in Mosbach und dem Neckar-Odenwald-Kreis – vom Einfamilienhaus bis zur Gewerbehalle.',
		'img'     => 'grau',
	) );
	$s['Projekte'] = '<section class="section bg-concrete texture"><div class="wrap">[kilic_referenzen anzahl="-1" filter="ja"]</div></section>';
	$s['Abschluss'] = kilic_c_cta( 'Ihr Projekt als nächste Referenz?', 'Erzählen Sie uns von Ihrem Vorhaben.' );
	return kilic_divi( $s );
}

function kilic_inhalt_ueber() {
	$s = array();
	$s['Kopfbereich'] = kilic_c_hero( array(
		'crumbs'  => array( 'Über uns' => '' ),
		'eyebrow' => 'Kilic Estrich Meisterbetrieb',
		'title'   => 'Handwerk mit <span>Verantwortung.</span>',
		'lead'    => 'Ein regionaler Meisterbetrieb aus Mosbach-Diedesheim – mit kurzen Wegen, festen Ansprechpartnern und dem Anspruch, jeden Boden so zu bauen, als wäre es der eigene.',
	) );
	$s['Inhaber'] = '<section class="section"><div class="wrap split"><div class="media">' . kilic_img( 'grau', 'Fikret Kilic' ) . '<div class="media-badge"><strong>F. Kilic</strong><span>Inhaber &amp; Meister</span></div></div><div><div class="eyebrow">Der Inhaber</div><h2>{{inhaber}}</h2><p class="lead">„Ein guter Estrich ist die Grundlage für alles, was danach kommt. Deshalb nehmen wir uns Zeit für Beratung, Planung und eine saubere Ausführung.“</p><p>Als Inhaber von Kilic Estrich und K&nbsp;&amp;&nbsp;K Rohrreinigung ist {{inhaber}} Ihr direkter Ansprechpartner – vom ersten Telefonat bis zur Abnahme. <span class="todo">Text mit Inhaber abstimmen</span></p>'
		. kilic_c_checklist( array( 'Meisterbetrieb im Estrichleger-Handwerk', 'Zwei Unternehmen – ein Ansprechpartner', 'Regional verwurzelt in Mosbach' ) ) . '</div></div></section>';
	$s['Werte'] = '<section class="section bg-concrete texture"><div class="wrap"><div class="section-head center"><div class="eyebrow">Unsere Werte</div><h2>Darauf können Sie sich verlassen</h2></div><div class="grid grid-4">'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-clock"></span></div><h4>Pünktlich</h4><p>Termine, die halten – für Sie und alle Folgegewerke.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-shield"></span></div><h4>Gründlich</h4><p>Ausführung nach Norm, mit Messprotokoll und Dokumentation.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-euro"></span></div><h4>Fair</h4><p>Ehrliche Beratung und transparente Angebote.</p></div>'
		. '<div class="icon-box"><div class="ic"><span class="ki ki-home"></span></div><h4>Sauber</h4><p>Wir hinterlassen die Baustelle so, wie wir sie vorfinden möchten.</p></div>'
		. '</div></div></section>';
	$s['Team'] = '<section class="section"><div class="wrap"><div class="section-head center"><div class="eyebrow">Team</div><h2>Die Menschen hinter Ihrem Boden</h2><p><span class="todo">Fotos und Namen ergänzen</span></p></div><div class="grid grid-4">'
		. '<div class="team-card">' . kilic_img( 'grau', 'Fikret Kilic' ) . '<h4>{{inhaber}}</h4><p>Inhaber · Meister</p></div>'
		. '<div class="team-card">' . kilic_img( 'grau', 'Teammitglied' ) . '<h4>Name</h4><p>Vorarbeiter Estrich</p></div>'
		. '<div class="team-card">' . kilic_img( 'warm', 'Teammitglied' ) . '<h4>Name</h4><p>Bodenleger</p></div>'
		. '<div class="team-card">' . kilic_img( 'blau', 'Teammitglied' ) . '<h4>Name</h4><p>Rohrreinigung · Notdienst</p></div>'
		. '</div></div></section>';
	$s['Karriere-Hinweis'] = '<section class="section bg-dark"><div class="wrap split"><div><div class="eyebrow light">Karriere</div><h2 style="color:#fff">Werde Teil unseres Teams</h2><p class="lead">Wir suchen Estrichleger, Helfer (m/w/d) und Auszubildende.</p><a class="btn btn-accent" href="{{home}}/ueber-uns/karriere/">Offene Stellen</a></div><div class="grid grid-2"><div class="icon-box"><div class="ic"><span class="ki ki-layers"></span></div><h4 style="color:#fff">Estrichleger (m/w/d)</h4><p>Vollzeit · Mosbach</p></div><div class="icon-box"><div class="ic"><span class="ki ki-medal"></span></div><h4 style="color:#fff">Ausbildung</h4><p>Estrichleger/in</p></div></div></div></section>';
	return kilic_divi( $s );
}

function kilic_inhalt_karriere() {
	$job = function ( $t, $meta, $aufgaben, $profil ) {
		return '<article class="price-card"><span class="tag">' . $meta . '</span><h3>' . $t . '</h3><h4 style="margin-top:10px">Ihre Aufgaben</h4>' . kilic_c_checklist( $aufgaben ) . '<h4>Ihr Profil</h4>' . kilic_c_checklist( $profil ) . '<a class="btn btn-accent" href="{{home}}/kontakt/">Jetzt bewerben</a></article>';
	};
	$s = array();
	$s['Kopfbereich'] = kilic_c_hero( array(
		'crumbs'  => array( 'Über uns' => '{{home}}/ueber-uns/', 'Karriere' => '' ),
		'eyebrow' => 'Jobs bei Kilic Estrich',
		'title'   => 'Anpacken mit <span>Perspektive.</span>',
		'lead'    => 'Faire Bezahlung, moderne Maschinen und ein Team, das zusammenhält. Bewerben Sie sich – gern auch formlos per Telefon.',
		'buttons' => '<a class="btn btn-accent" href="{{home}}/kontakt/">Bewerbung senden</a><a class="btn btn-ghost btn-ghost-light" href="{{telefon_link}}"><span class="ki ki-phone"></span> {{telefon}}</a>',
	) );
	$s['Stellen'] = '<section class="section bg-concrete texture"><div class="wrap"><div class="section-head"><div class="eyebrow">Offene Stellen</div><h2>Aktuell suchen wir</h2><p><span class="todo">Stellen bitte bestätigen</span></p></div><div class="grid grid-3">'
		. $job( 'Estrichleger (m/w/d)', 'Vollzeit', array( 'Einbau von Zement- und Fließestrich', 'Verlegen von Dämmung und Randstreifen', 'Bedienung von Estrichpumpe und Mischtechnik' ), array( 'Erfahrung im Estrich- oder Bauhandwerk', 'Führerschein Klasse B (C1E von Vorteil)', 'Zuverlässigkeit und Teamgeist' ) )
		. $job( 'Bauhelfer (m/w/d)', 'Vollzeit', array( 'Unterstützung auf der Baustelle', 'Material- und Baustellenlogistik', 'Vorbereitung von Untergründen' ), array( 'Handwerkliches Geschick', 'Körperliche Belastbarkeit', 'Gute Deutschkenntnisse' ) )
		. $job( 'Ausbildung Estrichleger/in', 'Ausbildung', array( 'Alle Estricharten von Grund auf', 'Messen, Planen, Einbauen', 'Arbeiten mit modernen Maschinen' ), array( 'Schulabschluss', 'Interesse am Handwerk', 'Motivation und Pünktlichkeit' ) )
		. '</div></div></section>';
	return kilic_divi( $s );
}

/* ---------- Anfrage & Kontakt ---------- */

function kilic_inhalt_anfrage() {
	$ex = function ( $tag, $title, $rows, $quote, $data, $blue = false ) {
		$li = '';
		foreach ( $rows as $k => $v ) {
			$li .= '<li><span>' . $k . '</span><b>' . $v . '</b></li>';
		}
		return '<article class="example"><span class="tag' . ( $blue ? ' blue' : '' ) . '">' . $tag . '</span><h4>' . $title . '</h4><ul>' . $li . '</ul><blockquote>' . $quote . '</blockquote><button type="button" class="btn ' . ( $blue ? 'btn-blue' : 'btn-dark' ) . '" data-example="' . str_replace( array( '[', ']' ), array( '&#91;', '&#93;' ), esc_attr( wp_json_encode( $data, JSON_UNESCAPED_UNICODE ) ) ) . '">Beispiel übernehmen</button></article>';
	};
	$s = array();
	$s['Kopfbereich'] = '<section class="hero hero-sub" style="padding:70px 0 80px">' . kilic_img( 'dunkel', '', 'hero-img' ) . '<div class="wrap"><div class="breadcrumb"><a href="{{home}}/">Start</a><span>/</span>Angebot anfragen</div><div class="eyebrow light">Kostenlos &amp; unverbindlich</div><h1>Ihr Angebot – <span>in 5 Schritten.</span></h1><p class="lead">Je genauer Ihre Angaben zu Objekt, Fläche und Estrichart, desto schneller und präziser unser Angebot. Unsicher? Wählen Sie einfach „Weiß nicht – Beratung gewünscht“.</p></div></section>';
	$s['Anfrage-Assistent'] = '<section class="section bg-concrete texture" style="padding-top:60px">[kilic_anfrage]</section>';
	$s['Beispiel-Anfragen'] = '<section class="section"><div class="wrap"><div class="section-head center"><div class="eyebrow">Beispiel-Anfragen</div><h2>So könnte Ihre Anfrage aussehen</h2><p class="lead">Typische Projekte – mit einem Klick übernehmen Sie das Beispiel ins Formular und passen es an.</p></div><div class="examples">'
		. $ex( 'Neubau · Heizestrich', 'Einfamilienhaus mit Fußbodenheizung', array( 'Objekt' => 'Einfamilienhaus, Neubau', 'Fläche' => '145 m² (EG + OG)', 'Estrichart' => 'Fließestrich CAF', 'Fußbodenheizung' => 'Ja, Nass-System', 'Dicke' => 'ca. 50 mm über Rohr', 'Oberbelag' => 'Parkett &amp; Fliesen' ), '„Bodenplatte ist gedämmt, Heizungsbauer verlegt FBH bis KW 14. Estrich danach bitte im EG und OG.“',
			array( 'leistung' => 'Estrich', 'objekt' => 'Einfamilienhaus', 'bauvorhaben' => 'Neubau', 'flaeche' => 145, 'estrichart' => 'Fließestrich (CAF)', 'fbh' => 'Ja, Nass-System', 'staerke' => 50, 'belag' => 'Parkett', 'termin' => 'In 1–3 Monaten', 'nachricht' => 'Bodenplatte ist gedämmt, Heizungsbauer verlegt FBH bis KW 14. Estrich danach bitte im EG und OG.' ) )
		. $ex( 'Altbau · Schnellestrich', 'Wohnung sanieren – schnell belegreif', array( 'Objekt' => 'Wohnung, 2. OG', 'Fläche' => '78 m²', 'Estrichart' => 'Schnellestrich', 'Fußbodenheizung' => 'Nein', 'Besonderheit' => 'Altestrich entfernen', 'Oberbelag' => 'Vinyl' ), '„Alter Estrich hat Risse und Hohlstellen. Wohnung soll in 3 Wochen wieder bezogen werden.“',
			array( 'leistung' => 'Estrich', 'objekt' => 'Wohnung', 'bauvorhaben' => 'Altbau / Sanierung', 'flaeche' => 78, 'estrichart' => 'Schnellestrich', 'fbh' => 'Nein', 'belag' => 'Vinyl / Designbelag', 'termin' => 'So schnell wie möglich', 'etage' => 'Obergeschoss (ohne Aufzug)', 'bewohnt' => 'Ja', 'nachricht' => 'Alter Estrich hat Risse und Hohlstellen. Wohnung soll in 3 Wochen wieder bezogen werden.' ) )
		. $ex( 'Gewerbe · Zementestrich', 'Lager- &amp; Werkhalle', array( 'Objekt' => 'Gewerbe / Halle', 'Fläche' => '520 m²', 'Estrichart' => 'Zementestrich CT-C35', 'Fußbodenheizung' => 'Nein', 'Dicke' => 'ca. 80 mm, Verbund', 'Nutzung' => 'Stapler, hohe Lasten' ), '„Estrich soll befahrbar sein (Gabelstapler), Oberfläche geglättet, Fertigstellung vor Inbetriebnahme im Herbst.“',
			array( 'leistung' => 'Estrich', 'objekt' => 'Gewerbe / Halle', 'bauvorhaben' => 'Neubau', 'flaeche' => 520, 'estrichart' => 'Industrie-/Gefälleestrich', 'fbh' => 'Nein', 'staerke' => 80, 'termin' => 'In 1–3 Monaten', 'zufahrt' => 'Direkt am Gebäude', 'nachricht' => 'Estrich soll befahrbar sein (Gabelstapler), Oberfläche geglättet, Fertigstellung vor Inbetriebnahme im Herbst.' ) )
		. $ex( 'Dachgeschoss · Trockenestrich', 'Dachausbau auf Holzbalkendecke', array( 'Objekt' => 'Einfamilienhaus, DG', 'Fläche' => '55 m²', 'Estrichart' => 'Trockenestrich', 'Fußbodenheizung' => 'Ja, Trockensystem', 'Besonderheit' => 'Geringes Gewicht', 'Oberbelag' => 'Laminat' ), '„Holzbalkendecke im Altbau, möglichst wenig Feuchtigkeit und geringe Aufbauhöhe.“',
			array( 'leistung' => 'Estrich', 'objekt' => 'Einfamilienhaus', 'bauvorhaben' => 'Anbau / Umbau', 'flaeche' => 55, 'estrichart' => 'Trockenestrich', 'fbh' => 'Ja, Trockensystem', 'belag' => 'Laminat', 'termin' => 'In 2–4 Wochen', 'nachricht' => 'Holzbalkendecke im Altbau, möglichst wenig Feuchtigkeit und geringe Aufbauhöhe.' ) )
		. $ex( 'Garage · Gefälleestrich', 'Doppelgarage mit Gefälle', array( 'Objekt' => 'Garage / Keller', 'Fläche' => '36 m²', 'Estrichart' => 'Zement-Gefälleestrich', 'Fußbodenheizung' => 'Nein', 'Gefälle' => '1,5 % zur Rinne', 'Oberbelag' => 'Beschichtung' ), '„Neubau-Doppelgarage, Gefälle zum Tor/Entwässerungsrinne, später Bodenbeschichtung.“',
			array( 'leistung' => 'Estrich', 'objekt' => 'Garage / Keller', 'bauvorhaben' => 'Neubau', 'flaeche' => 36, 'estrichart' => 'Industrie-/Gefälleestrich', 'fbh' => 'Nein', 'termin' => 'In 2–4 Wochen', 'nachricht' => 'Neubau-Doppelgarage, Gefälle zum Tor/Entwässerungsrinne, später Bodenbeschichtung.' ) )
		. $ex( 'Rohrreinigung', 'Wiederkehrende Verstopfung', array( 'Objekt' => 'Mehrfamilienhaus', 'Problem' => 'Rückstau im Keller', 'Leistung' => 'Spülung + Kanal-TV', 'Dringlichkeit' => 'Diese Woche', 'Auftraggeber' => 'Hausverwaltung', 'Doku' => 'Für Versicherung' ), '„Im Keller drückt bei Starkregen Wasser hoch. Bitte Ursache per Kamera prüfen.“',
			array( 'leistung' => 'Rohrreinigung', 'objekt' => 'Mehrfamilienhaus', 'problem' => array( 'Rückstau Keller', 'Kanal-TV' ), 'termin' => 'So schnell wie möglich', 'nachricht' => 'Im Keller drückt bei Starkregen Wasser hoch. Bitte Ursache per Kamera prüfen.' ), true )
		. '</div></div></section>';
	return kilic_divi( $s );
}

function kilic_inhalt_kontakt() {
	$s = array();
	$s['Kopfbereich'] = '<section class="hero hero-sub" style="padding:70px 0 80px">' . kilic_img( 'dunkel', '', 'hero-img' ) . '<div class="wrap"><div class="breadcrumb"><a href="{{home}}/">Start</a><span>/</span>Kontakt</div><div class="eyebrow light">Wir sind für Sie da</div><h1>Kontakt</h1><p class="lead">Rufen Sie an, schreiben Sie uns oder besuchen Sie uns in Mosbach-Diedesheim. Für ein Estrich-Angebot nutzen Sie am besten unsere <a href="{{home}}/angebot-anfragen/" style="color:#ffb469">Detailanfrage</a>.</p></div></section>';
	$s['Kontaktdaten & Formular'] = '<section class="section bg-concrete texture"><div class="wrap split" style="align-items:start"><div class="contact-cards">'
		. '<a class="contact-card red" href="{{notdienst_link}}"><span class="ic"><span class="ki ki-phone"></span></span><span><small>Rohrreinigung Notdienst · 24/7 · auch sonntags</small><strong>{{notdienst}}</strong></span></a>'
		. '<a class="contact-card" href="{{telefon_link}}"><span class="ic"><span class="ki ki-phone"></span></span><span><small>Telefon Büro</small><strong>{{telefon}}</strong></span></a>'
		. '<div class="contact-card"><span class="ic"><span class="ki ki-mail"></span></span><span><small>E-Mail</small><strong>{{email}}</strong></span></div>'
		. '<div class="contact-card"><span class="ic"><span class="ki ki-pin"></span></span><span><small>Adresse</small><strong>{{strasse}}<br>{{plz_ort}}</strong></span></div>'
		. '<div class="contact-card" style="display:block"><small style="margin-bottom:8px">Öffnungszeiten</small><table class="hours"><tr><td>Büro</td><td>{{oeffnungszeiten}}</td></tr><tr class="em"><td>Rohrreinigung Notdienst</td><td>24/7 · auch So.</td></tr></table></div>'
		. '</div>[kilic_kontakt]</div></section>';
	$s['Anfahrt'] = '<section class="section-sm"><div class="wrap"><div class="map"><div class="map-pin"><strong>{{firma}}</strong>{{strasse}}, {{plz_ort}}</div><span class="map-note">Karte: Google Maps / OpenStreetMap mit Zwei-Klick-Lösung einbinden</span></div><p style="margin-top:14px"><a class="btn btn-ghost" href="https://www.openstreetmap.org/search?query=Heidelberger%20Str.%2057%2C%2074821%20Mosbach" target="_blank" rel="noopener">Route planen (OpenStreetMap)</a></p></div></section>';
	return kilic_divi( $s );
}

/* ---------- Rechtliches (Vorlagen, bitte prüfen lassen) ---------- */

function kilic_inhalt_impressum() {
	return kilic_divi( array(
		'Impressum' => '<section class="section"><div class="wrap prose"><h1>Impressum</h1><p><span class="todo">Vorlage – bitte vollständig prüfen und ergänzen</span></p>'
			. '<h2>Angaben gemäß § 5 DDG</h2><p>{{firma}}<br>{{firma2}}<br>Inhaber: {{inhaber}}<br>{{strasse}}<br>{{plz_ort}}</p>'
			. '<h2>Kontakt</h2><p>Telefon: {{telefon}}<br>E-Mail: {{email}}</p>'
			. '<h2>Umsatzsteuer</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: <span class="todo">ergänzen</span></p>'
			. '<h2>Berufsbezeichnung und berufsrechtliche Regelungen</h2><p>Berufsbezeichnung: <span class="todo">z. B. Estrichlegermeister (verliehen in Deutschland)</span><br>Zuständige Kammer: <span class="todo">Handwerkskammer – bitte eintragen</span><br>Eintragung in der Handwerksrolle: <span class="todo">ergänzen</span><br>Berufsrechtliche Regelungen: Handwerksordnung (HwO)</p>'
			. '<h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>'
			. '</div></section>',
	) );
}

function kilic_inhalt_datenschutz() {
	return kilic_divi( array(
		'Datenschutz' => '<section class="section"><div class="wrap prose"><h1>Datenschutzerklärung</h1><p><span class="todo">Vorlage – bitte rechtlich prüfen lassen (z. B. Datenschutz-Generator)</span></p>'
			. '<h2>1. Verantwortlicher</h2><p>{{firma}}, Inhaber {{inhaber}}, {{strasse}}, {{plz_ort}}, Telefon {{telefon}}, E-Mail {{email}}</p>'
			. '<h2>2. Hosting und Server-Logfiles</h2><p>Beim Aufruf der Website verarbeitet unser Hoster technisch notwendige Daten (z. B. IP-Adresse, Datum, Uhrzeit, aufgerufene Seite) zur Bereitstellung und Sicherheit der Website (Art. 6 Abs. 1 lit. f DSGVO).</p>'
			. '<h2>3. Anfrage- und Kontaktformular</h2><p>Wenn Sie uns über das Formular eine Anfrage senden, verarbeiten wir Ihre Angaben (z. B. Name, Kontaktdaten, Objektdaten, hochgeladene Fotos) zur Bearbeitung der Anfrage und zur Erstellung eines Angebots (Art. 6 Abs. 1 lit. b DSGVO). Die Daten werden gelöscht, sobald sie nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.</p>'
			. '<h2>4. Schriftarten</h2><p>Die verwendeten Schriftarten sind lokal auf unserem Server gespeichert. Es findet keine Verbindung zu Servern von Google oder anderen Anbietern statt.</p>'
			. '<h2>5. Cookies</h2><p>Diese Website setzt nur technisch notwendige Cookies, z. B. für die Anmeldung im Verwaltungsbereich.</p>'
			. '<h2>6. Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde.</p>'
			. '</div></section>',
	) );
}
