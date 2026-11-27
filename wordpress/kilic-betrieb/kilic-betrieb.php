<?php
/**
 * Plugin Name: Kilic Betrieb
 * Description: Website und Büro-Verwaltung für Kilic Estrich Meisterbetrieb / K & K Rohrreinigung: mehrstufige Seiten, Anfrage-Assistent, Anfragen, Kunden, Angebote und Rechnungen (druckbar), Referenzen. Kompatibel mit dem Divi Builder.
 * Version: 1.9.2
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * Author: Kilic Estrich
 * Text Domain: kilic-betrieb
 */

defined( 'ABSPATH' ) || exit;

define( 'KILIC_VERSION', '1.9.2' );
define( 'KILIC_FILE', __FILE__ );
define( 'KILIC_DIR', plugin_dir_path( __FILE__ ) );
define( 'KILIC_URL', plugin_dir_url( __FILE__ ) );
define( 'KILIC_TEMPLATE', 'kilic-layout' );

require_once KILIC_DIR . 'includes/helpers.php';
require_once KILIC_DIR . 'includes/settings.php';
require_once KILIC_DIR . 'includes/post-types.php';
require_once KILIC_DIR . 'includes/kunden.php';
require_once KILIC_DIR . 'includes/belege.php';
require_once KILIC_DIR . 'includes/katalog.php';
require_once KILIC_DIR . 'includes/anfragen.php';
require_once KILIC_DIR . 'includes/referenzen.php';
require_once KILIC_DIR . 'includes/admin.php';
require_once KILIC_DIR . 'includes/cockpit.php';
require_once KILIC_DIR . 'includes/verlauf.php';
require_once KILIC_DIR . 'includes/mail.php';
require_once KILIC_DIR . 'includes/design.php';
require_once KILIC_DIR . 'includes/frontend.php';
require_once KILIC_DIR . 'includes/bilder.php';
require_once KILIC_DIR . 'includes/content.php';
require_once KILIC_DIR . 'includes/setup.php';

register_activation_hook( __FILE__, 'kilic_activate' );
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );
