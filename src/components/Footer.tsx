import { Link } from 'react-router';
import { AUTHOR_SITE_URL } from '../config';
import { Icon } from './Icon';

/** Site-wide footer: what Rusookh is, and a link to the author's site. */
export function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p className="app-footer__brand">رسوخ</p>
        <nav aria-label="روابط إضافية">
          <ul className="app-footer__links" role="list">
            <li>
              <Link className="app-footer__link" to="/about">
                <Icon name="info" size={16} />
                ما هو رسوخ؟
              </Link>
            </li>
            <li>
              {AUTHOR_SITE_URL ? (
                <a className="app-footer__link" href={AUTHOR_SITE_URL} target="_blank" rel="noopener noreferrer">
                  <Icon name="heart" size={16} />
                  ادعيلي دعوة حلوة
                </a>
              ) : (
                <span className="app-footer__link is-pending">
                  <Icon name="heart" size={16} />
                  ادعيلي دعوة حلوة
                  <span className="app-footer__soon">قريبًا</span>
                </span>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
