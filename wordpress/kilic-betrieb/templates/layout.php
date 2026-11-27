<?php
/**
 * Seitenvorlage „Kilic Layout“: eigener Header/Footer, Inhalt aus WordPress bzw. Divi.
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php kilic_header(); ?>
<main id="kilic-main">
	<?php
	while ( have_posts() ) :
		the_post();
		if ( is_singular( 'kilic_referenz' ) ) :
			$ort = get_post_meta( get_the_ID(), '_ort', true );
			?>
			<section class="hero hero-sub">
				<img class="hero-img" src="<?php echo esc_url( kilic_ph_url( 'hero-start' ) ? kilic_ph_url( 'hero-start' ) : KILIC_URL . 'assets/img/ph-dunkel.svg' ); ?>" alt="">
				<div class="wrap">
					<div class="breadcrumb"><a href="<?php echo esc_url( home_url( '/' ) ); ?>">Start</a><span>/</span><a href="<?php echo esc_url( kilic_seite_url( 'referenzen' ) ); ?>">Referenzen</a><span>/</span><?php the_title(); ?></div>
					<div class="eyebrow light">Referenzprojekt<?php echo $ort ? ' · ' . esc_html( $ort ) : ''; ?></div>
					<h1><?php the_title(); ?></h1>
				</div>
			</section>
			<section class="section ref-single">
				<div class="wrap split wide-left" style="align-items:start">
					<div class="prose">
						<?php if ( has_post_thumbnail() ) : ?>
							<?php the_post_thumbnail( 'large', array( 'class' => 'img-cover' ) ); ?>
						<?php endif; ?>
						<?php the_content(); ?>
					</div>
					<dl class="facts">
						<?php foreach ( array( 'ort' => 'Ort', 'flaeche' => 'Fläche', 'material' => 'Estrich / Belag', 'dauer' => 'Ausführung' ) as $k => $l ) : ?>
							<?php $v = get_post_meta( get_the_ID(), '_' . $k, true ); ?>
							<?php if ( $v ) : ?><div><dt><?php echo esc_html( $l ); ?></dt><dd><?php echo esc_html( $v ); ?></dd></div><?php endif; ?>
						<?php endforeach; ?>
					</dl>
				</div>
			</section>
			<?php
		else :
			the_content();
		endif;
	endwhile;
	?>
</main>
<?php kilic_footer(); ?>
<?php wp_footer(); ?>
</body>
</html>
