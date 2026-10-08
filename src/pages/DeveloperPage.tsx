/*
 * "مبرمج تطبيق رسوخ": who made Rusookh, and where to find him.
 */
import { Icon } from '../components/Icon';
import { DEVELOPER } from '../config';
import { useDocumentTitle } from '../hooks/use-document-title';

export function DeveloperPage() {
  useDocumentTitle('مبرمج تطبيق رسوخ');
  const initial = DEVELOPER.name.trim().charAt(0);

  return (
    <div className="page developer">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">مبرمج تطبيق رسوخ</p>
          <h1 className="page-title">من صنع رسوخ؟</h1>
        </div>
      </header>

      <section className="developer__card" aria-labelledby="developer-name">
        <span className="developer__avatar" aria-hidden="true">
          {initial}
        </span>
        <div className="developer__body">
          <h2 className="developer__name" id="developer-name">
            {DEVELOPER.name}
          </h2>
          <p className="developer__role">{DEVELOPER.role}</p>
          <p className="developer__bio">
            صمّمت رسوخ وبرمجته ليكون أداة بسيطة تساعد الطلاب وكل من يتعلم على تثبيت ما يتعلمونه، بدل أن يضيع بعد أيام.
          </p>
          <div className="developer__links">
            <a className="btn btn--secondary" href={DEVELOPER.linkedin} target="_blank" rel="noopener noreferrer">
              <Icon name="linkedin" size={18} />
              لينكدإن
            </a>
            <a className="btn btn--secondary" href={DEVELOPER.instagram} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" size={18} />
              إنستغرام
            </a>
          </div>
        </div>
      </section>

      <section className="developer__dua" aria-label="دعوة">
        <Icon name="heart" size={22} />
        <p>
          إن نفعك رسوخ، <strong>ادعيلي دعوة حلوة</strong>.
        </p>
      </section>
    </div>
  );
}
