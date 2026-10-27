import { useEffect, useRef } from "react";
import { toArabicIndic } from "../arabic";
import { Mascot } from "../components/Mascot";
import "./landing.css";

interface LandingPageProps {
  onLogin: () => void;
}

type SectionId = "idea" | "how" | "programs" | "family";

const NAV_LINKS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: "idea", label: "الفكرة" },
  { id: "how", label: "كيف تعمل" },
  { id: "programs", label: "البرامج" },
  { id: "family", label: "للأسرة والمختص" },
];

const HERO_POINTS = ["برامج مبنية على دراسة متأنية من المختصين", "بالعربية وبالصوت", "بلا إحباط ولا مقارنة"];

interface IconCard {
  icon: string;
  title: string;
  text: string;
}

const IDEA_CARDS: ReadonlyArray<IconCard> = [
  { icon: "🎯", title: "يبدأ من مستوى طفلك", text: "اختبار قصير يحدّد نقطة البداية في كل مهارة." },
  { icon: "🎮", title: "يتعلّم وهو يلعب", text: "أنشطة قصيرة ومحطات ونجوم تجعل التدريب اليومي ممتعًا." },
  { icon: "📈", title: "تقدّم يمكن قياسه", text: "مستوى لكل مهارة يتحسّن مع كل نشاط ينجح فيه الطفل." },
];

const STEPS: ReadonlyArray<{ title: string; text: string }> = [
  { title: "اختبار تشخيصي قصير", text: "لعبة قصيرة بلا علامات خطأ تحدّد نقطة البداية." },
  { title: "خطة مناسبة لكل طفل", text: "مستوى خاص لكل مهارة يتكيّف تلقائيًا مع تقدّمه." },
  { title: "رحلات وأنشطة متدرّجة", text: "جزر ومحطات ونجوم وأوسمة في كل خطوة." },
  { title: "متابعة مستمرة", text: "تقارير للأسرة والمختص تُظهر التقدّم وتساعد على تعديل الخطة." },
];

const PROGRAM_POINTS: ReadonlyArray<{ icon: string; text: string }> = [
  { icon: "📚", text: "تسع مهارات أساسية للقراءة" },
  { icon: "🪜", text: "تدرّج مدروس في الصعوبة" },
  { icon: "✅", text: "شروط إتقان لكل مرحلة" },
  { icon: "🩺", text: "متابعة وتعديل من المختص" },
];

const SKILLS: ReadonlyArray<{ icon: string; name: string }> = [
  { icon: "👂", name: "تنمية الإدراك السمعي" },
  { icon: "👁️", name: "الإدراك البصري" },
  { icon: "🔍", name: "التمييز بين الحروف المتشابهة" },
  { icon: "🧩", name: "فك الرموز القرائية" },
  { icon: "🗣️", name: "الوعي الصوتي" },
  { icon: "🧱", name: "تكوين المفردات" },
  { icon: "✏️", name: "التهجئة" },
  { icon: "📖", name: "الاسترسال القرائي" },
  { icon: "💡", name: "الفهم القرائي" },
];

const SAFE_CARDS: ReadonlyArray<IconCard> = [
  { icon: "🌱", title: "بلا علامات خطأ حمراء", text: "تُسجَّل الأخطاء بهدوء للمتابعة فقط، ويسمع الطفل التشجيع دائمًا." },
  { icon: "🤝", title: "بلا مقارنة بين الأطفال", text: "يقارن الطفل نفسه بنفسه فقط." },
  { icon: "🔊", title: "بالعربية وبالصوت", text: "تعليمات مسموعة وأيقونات واضحة، لأن القراءة هي التحدّي." },
  { icon: "⏰", title: "وقت شاشة متوازن", text: "يحدّد الأهل وقتًا يوميًا، وتنتهي الجلسة بلطف." },
];

const AUDIENCES: ReadonlyArray<{ icon: string; title: string; items: ReadonlyArray<string> }> = [
  {
    icon: "👪",
    title: "للأسرة",
    items: ["ملف خاص لكل طفل", "ملخص أسبوعي للتقدّم", "تحديد وقت اللعب اليومي", "ربط الطفل بمختصه برمز دعوة"],
  },
  {
    icon: "🩺",
    title: "للمختص",
    items: ["متابعة الحالات في لوحة واحدة", "منحنى تقدّم لكل مهارة", "سجل الأنشطة والمحاولات", "تعديل خطة كل طفل ومستواه"],
  },
];

/** Decorative letters drifting around the owl's island. */
const FLOATING_LETTERS = ["أ", "ب", "ت", "ج", "د", "س"];

/**
 * In-page navigation without touching location.hash: the hash is reserved for
 * play deep links (`#/r/...`). Focus follows the scroll so keyboard and screen
 * reader users land on the section too.
 */
function scrollToSection(id: SectionId): void {
  const section = document.getElementById(id);
  if (section === null) {
    return;
  }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  section.focus({ preventScroll: true });
}

/** Public landing page: explains the product; the header pill is its only way in. */
export function LandingPage({ onLogin }: LandingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Sections fade up as they enter the viewport (CSS skips the effect under reduced motion).
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".landing-reveal"));
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const year = toArabicIndic(new Date().getFullYear());

  return (
    <div className="landing" ref={rootRef}>
      <header className="landing-header">
        <div className="landing-container landing-header-row">
          <span className="landing-logo">
            <span className="landing-logo-owl" aria-hidden="true">
              <Mascot />
            </span>
            <span className="landing-logo-text">رحلتي</span>
          </span>
          <nav className="landing-nav" aria-label="أقسام الصفحة">
            {NAV_LINKS.map((link) => (
              <button key={link.id} type="button" className="landing-nav-link" onClick={() => scrollToSection(link.id)}>
                {link.label}
              </button>
            ))}
          </nav>
          <button type="button" className="landing-login" onClick={onLogin}>
            تسجيل الدخول
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-chip">لصعوبات القراءة عند الأطفال</span>
              <h1 id="landing-title" className="landing-title">
                رحلة ممتعة نحو <span className="landing-title-mark">قراءة أسهل</span>
              </h1>
              <p className="landing-lead">
                رحلتي تطبيق عربي يساعد الأطفال الذين يواجهون صعوبات في القراءة (عُسر القراءة) على التقدّم خطوة بخطوة،
                من خلال ألعاب وأنشطة ممتعة، بمتابعة الأسرة والمختص.
              </p>
              <ul className="landing-checks">
                {HERO_POINTS.map((point) => (
                  <li key={point}>
                    <span className="landing-check-mark" aria-hidden="true">
                      ✓
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <button type="button" className="landing-text-link" onClick={() => scrollToSection("how")}>
                اكتشف كيف تعمل
                <span aria-hidden="true">←</span>
              </button>
            </div>

            <div className="landing-hero-visual" aria-hidden="true">
              <div className="landing-sky" />
              {FLOATING_LETTERS.map((letter, index) => (
                <span key={letter} className={`landing-letter landing-letter-${index + 1}`}>
                  {letter}
                </span>
              ))}
              <div className="landing-island">
                <span className="landing-palm">🌴</span>
                <div className="landing-island-owl">
                  <Mascot />
                </div>
                <div className="landing-island-ground" />
              </div>
              <span className="landing-float-chip landing-float-chip-stars">⭐ ٣ نجوم</span>
              <span className="landing-float-chip landing-float-chip-badge">🏅 وسام جديد</span>
            </div>
          </div>
        </section>

        <section id="idea" className="landing-section" aria-labelledby="idea-title" tabIndex={-1}>
          <div className="landing-container landing-reveal">
            <h2 id="idea-title" className="landing-h2">
              كل طفل يستطيع أن يقرأ… بطريقته
            </h2>
            <p className="landing-section-lead">
              صعوبات القراءة لا تعني ضعف الذكاء. يحتاج الطفل إلى تدريب مناسب لمستواه، يتكرّر بلطف ويُشعره بالنجاح؛ لذلك
              حوّلنا التدريب العلاجي إلى رحلة يلعبها الطفل كل يوم، ويتابعها الكبار بوضوح.
            </p>
            <ul className="landing-grid landing-grid-3">
              {IDEA_CARDS.map((card) => (
                <li key={card.title} className="landing-card">
                  <span className="landing-card-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <h3 className="landing-card-title">{card.title}</h3>
                  <p className="landing-card-text">{card.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="landing-section is-tinted" aria-labelledby="how-title" tabIndex={-1}>
          <div className="landing-container landing-reveal">
            <h2 id="how-title" className="landing-h2">
              كيف تعمل رحلتي؟
            </h2>
            <ol className="landing-grid landing-grid-4 landing-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="landing-card landing-step">
                  <span className="landing-step-number" aria-hidden="true">
                    {toArabicIndic(index + 1)}
                  </span>
                  <h3 className="landing-card-title">{step.title}</h3>
                  <p className="landing-card-text">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="programs" className="landing-section landing-programs" aria-labelledby="programs-title" tabIndex={-1}>
          <div className="landing-container landing-reveal">
            <h2 id="programs-title" className="landing-h2">
              برامج مبنية على دراسة متأنية من المختصين
            </h2>
            <p className="landing-section-lead">
              لم تُصمَّم الأنشطة عشوائيًا: كل برنامج في رحلتي أُعدّ بعد دراسة متأنية من مختصين في صعوبات التعلّم والقراءة،
              ورُتّبت مهاراته من الأسهل إلى الأصعب، ولكل مرحلة شروط إتقان واضحة قبل الانتقال إلى ما بعدها.
            </p>
            <ul className="landing-grid landing-grid-4 landing-points">
              {PROGRAM_POINTS.map((point) => (
                <li key={point.text} className="landing-point">
                  <span className="landing-point-icon" aria-hidden="true">
                    {point.icon}
                  </span>
                  {point.text}
                </li>
              ))}
            </ul>
            <ol className="landing-grid landing-grid-3 landing-skills" aria-label="المهارات التسع">
              {SKILLS.map((skill, index) => (
                <li key={skill.name} className="landing-skill">
                  <span className="landing-skill-icon" aria-hidden="true">
                    {skill.icon}
                  </span>
                  <span className="landing-skill-name">{skill.name}</span>
                  <span className="landing-skill-number" aria-hidden="true">
                    {toArabicIndic(index + 1)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="safe-title">
          <div className="landing-container landing-reveal">
            <h2 id="safe-title" className="landing-h2">
              مصمَّم ليشعر الطفل بالنجاح
            </h2>
            <ul className="landing-grid landing-grid-4">
              {SAFE_CARDS.map((card) => (
                <li key={card.title} className="landing-card">
                  <span className="landing-card-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <h3 className="landing-card-title">{card.title}</h3>
                  <p className="landing-card-text">{card.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="family" className="landing-section is-mint" aria-labelledby="family-title" tabIndex={-1}>
          <div className="landing-container landing-reveal">
            <h2 id="family-title" className="landing-h2">
              للأسرة والمختص
            </h2>
            <div className="landing-grid landing-grid-2">
              {AUDIENCES.map((audience) => (
                <article key={audience.title} className="landing-card landing-audience">
                  <h3 className="landing-audience-title">
                    <span className="landing-card-icon" aria-hidden="true">
                      {audience.icon}
                    </span>
                    {audience.title}
                  </h3>
                  <ul className="landing-checks">
                    {audience.items.map((item) => (
                      <li key={item}>
                        <span className="landing-check-mark" aria-hidden="true">
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-closing" aria-labelledby="closing-title">
          <div className="landing-container landing-closing-box landing-reveal">
            <span className="landing-closing-owl" aria-hidden="true">
              <Mascot />
            </span>
            <div>
              <h2 id="closing-title" className="landing-h2">
                ابدأ رحلة طفلك اليوم
              </h2>
              <p className="landing-section-lead">سجّل الدخول، اختر ملف طفلك، وانطلقا معًا إلى أول محطة.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-row">
          <p>رحلتي — منصة عربية لتشخيص صعوبات القراءة وعلاجها</p>
          <p>© {year}</p>
        </div>
      </footer>
    </div>
  );
}
