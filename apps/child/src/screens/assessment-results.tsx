import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ApiError, getPlayAssessment, listChildren } from "../api";
import { useSignedIn } from "../auth-context";
import type { Child, PlayAssessmentSkillResult } from "../types";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { CHILDREN_PATH } from "../play-views";
import "./assessment-results.css";

interface AssessmentResultsProps {
  child: Child;
  token: string;
  onAuthExpired: () => void;
}

/* Ring geometry lives in a 72×72 viewBox; radius 30 with an 8px stroke
   leaves a comfortable center for the fraction. */
const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Therapeutic tone by score: comfortable → green, growing → amber, fresh start → soft blue. Never red. */
function toneClassFor(correct: number, total: number): string {
  const percent = total > 0 ? (correct / total) * 100 : 0;
  if (percent >= 75) {
    return "tone-green";
  }
  if (percent >= 40) {
    return "tone-amber";
  }
  return "tone-blue";
}

/** Circular SVG score ring: the arc covers the correct share, the fraction sits in the middle. */
function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, correct / total)) : 0;
  const dash = RING_CIRCUMFERENCE * fraction;
  return (
    <div className="score-ring">
      <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false">
        <circle className="score-ring-track" cx="36" cy="36" r={RING_RADIUS} />
        {fraction > 0 ? (
          <circle
            className="score-ring-fill"
            cx="36"
            cy="36"
            r={RING_RADIUS}
            strokeDasharray={`${dash.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`}
          />
        ) : null}
      </svg>
      <span className="score-ring-label" dir="ltr">
        {correct}
        <small>/{total}</small>
      </span>
    </div>
  );
}

/** `/children/:childId/results`: resolves the child from the account's list; an unknown id goes back to the picker. */
export function AssessmentResultsRoute() {
  const { auth, expire } = useSignedIn();
  const { childId = "" } = useParams();
  const [child, setChild] = useState<Child | null | "missing">(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadChild = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const found = (await listChildren(auth.accessToken)).find((candidate) => candidate.id === childId);
      setChild(found ?? "missing");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expire();
        return;
      }
      setLoadError(error instanceof ApiError ? error.message : "تعذر تحميل نتائج التشخيص، حاول مرة أخرى");
    }
  }, [auth.accessToken, childId, expire]);

  useEffect(() => {
    void loadChild();
  }, [loadChild]);

  if (child === "missing") {
    return <Navigate to={CHILDREN_PATH} replace />;
  }
  if (child !== null) {
    return <AssessmentResults child={child} token={auth.accessToken} onAuthExpired={expire} />;
  }
  return (
    <main className="screen assessment-results">
      <PageHeader title="نتائج التشخيص" parent={CHILDREN_PATH} />
      {loadError === null ? <p className="status-text">جارٍ التحميل…</p> : null}
      {loadError !== null ? (
        <div className="card retry-card">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <button type="button" className="big-button" onClick={() => void loadChild()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}
    </main>
  );
}

/** Parent/specialist view of the child's latest diagnostic results per skill. */
function AssessmentResults({ child, token, onAuthExpired }: AssessmentResultsProps) {
  const [results, setResults] = useState<PlayAssessmentSkillResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadResults = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const assessment = await getPlayAssessment(token, child.id);
      setResults(assessment.lastResults);
      setLoading(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      setLoading(false);
      setLoadError(error instanceof ApiError ? error.message : "تعذر تحميل نتائج التشخيص، حاول مرة أخرى");
    }
  }, [token, child.id, onAuthExpired]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const totalCorrect =
    results?.reduce((sum, result) => sum + result.correct, 0) ?? 0;
  const totalItems = results?.reduce((sum, result) => sum + result.total, 0) ?? 0;

  return (
    <main className="screen assessment-results">
      <PageHeader title="نتائج التشخيص" parent={CHILDREN_PATH} />

      <section className="results-child">
        <div className="results-child-medal">
          <Avatar child={child} />
        </div>
        <div className="results-child-copy">
          <p className="results-child-name">{child.fullName}</p>
          <p className="results-child-caption">نتائج الاختبار التشخيصي</p>
        </div>
      </section>

      {loading ? <p className="status-text">جارٍ التحميل…</p> : null}
      {!loading && loadError !== null ? (
        <div className="card retry-card">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <button type="button" className="big-button" onClick={() => void loadResults()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {!loading && loadError === null && (results === null || results.length === 0) ? (
        <div className="card results-empty">
          <span className="results-empty-emoji" aria-hidden="true">
            🌱
          </span>
          <p className="status-text">لم يُجرِ الطفل الاختبار بعد</p>
          <p className="results-empty-hint">عند إجراء الاختبار التشخيصي ستظهر النتائج هنا</p>
        </div>
      ) : null}

      {!loading && loadError === null && results !== null && results.length > 0 ? (
        <div className="results-body">
          <section className="results-hero" aria-label="ملخص نتيجة الاختبار">
            <span className="results-hero-spark is-top" aria-hidden="true">
              ✦
            </span>
            <span className="results-hero-spark is-bottom" aria-hidden="true">
              ✨
            </span>
            <p className="results-hero-fraction">
              <span className="results-hero-correct">{totalCorrect}</span>
              <span className="results-hero-of">من</span>
              <span className="results-hero-total">{totalItems}</span>
            </p>
            <div className="results-hero-copy">
              <p className="results-hero-caption">إجابة صحيحة في الاختبار كامل</p>
              <p className="results-hero-note">
                هذه نقطة البداية لرحلة {child.fullName} — المستويات تتطور مع اللعب
              </p>
            </div>
          </section>

          <ul className="results-grid">
            {results.map((result, index) => (
              <li
                key={result.skillCode}
                className={`results-skill ${toneClassFor(result.correct, result.total)}`}
                style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}
              >
                <ScoreRing correct={result.correct} total={result.total} />
                <div className="results-skill-copy">
                  <h2 className="results-skill-name">{result.skillName}</h2>
                  <p className="level-badge">
                    <span className="level-badge-text">
                      المستوى الابتدائي: {result.startingLevel}
                    </span>
                    <span className="level-dots" aria-hidden="true">
                      {[1, 2, 3].map((step) => (
                        <span key={step} className={step <= result.startingLevel ? "level-dot is-on" : "level-dot"} />
                      ))}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="results-footnote">
            المستوى الابتدائي يحدد نقطة الانطلاق فقط — التقدم يقاس باللعب المنتظم
          </p>
        </div>
      ) : null}
    </main>
  );
}
