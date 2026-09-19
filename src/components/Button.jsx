import { Link } from '../router';
import '../styles/button.css';

/**
 * <Button to="/contact">      internal link (client-side navigation)
 * <Button href="https://…">   external link
 * <Button onClick={…}>        real <button>
 * variant: primary | outline-light | outline-dark      size: md | sm
 * `icon` renders before the label, `iconEnd` after it.
 */
export default function Button({
  to,
  href,
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  className = '',
  children,
  ...rest
}) {
  const cls = `btn btn--${variant} btn--${size} ${className}`.trim();
  const content = (
    <>
      {icon}
      <span>{children}</span>
      {iconEnd}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    const external = /^https?:/.test(href);
    return (
      <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {content}
    </button>
  );
}
