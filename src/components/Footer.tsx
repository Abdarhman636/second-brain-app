import { Link } from 'react-router';
import { Icon } from './Icon';

/** Site-wide footer: the guide, the mobile app, plans, and who made Rusookh. */
export function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p className="app-footer__brand">رسوخ</p>
        <nav aria-label="روابط إضافية">
          <ul className="app-footer__links" role="list">
            <li>
              <Link className="app-footer__link" to="/guide">
                <Icon name="book" size={16} />
                طريقة استخدام رسوخ
              </Link>
            </li>
            <li>
              <Link className="app-footer__link" to="/app">
                <Icon name="phone" size={16} />
                تطبيق الجوال
              </Link>
            </li>
            <li>
              <Link className="app-footer__link" to="/pricing">
                <Icon name="gem" size={16} />
                الباقات والأسعار
              </Link>
            </li>
            <li>
              <Link className="app-footer__link" to="/developer">
                <Icon name="code" size={16} />
                مبرمج تطبيق رسوخ
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
