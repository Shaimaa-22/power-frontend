/**
 * Official Power logo (public/images/logo.webp — transparent background).
 * variant="dark"  -> dark wordmark, for light backgrounds (header)
 * variant="light" -> white wordmark, for dark backgrounds (footer)
 * The image is 900x637; only `height` needs to be given, the width follows the ratio.
 */
const RATIO = 900 / 637;

export default function Logo({ variant = 'dark', height = 64, className = '' }) {
  const src = variant === 'light' ? '/images/logo-light.webp' : '/images/logo.webp';
  return (
    <img
      className={`logo ${className}`.trim()}
      src={src}
      alt="Power — للهندسة الكهربائية والالكترونية"
      height={height}
      width={Math.round(height * RATIO)}
      style={{ display: 'block', height, width: 'auto' }}
    />
  );
}
