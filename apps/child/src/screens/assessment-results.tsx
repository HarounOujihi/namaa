import { useCallback, useEffect, useState } from "react";
import { ApiError, getPlayAssessment } from "../api";
import type { Child, PlayAssessmentSkillResult } from "../types";
import { Avatar } from "../components/Avatar";
import { toArabicIndic } from "../arabic";

interface AssessmentResultsProps {
  child: Child;
  token: string;
  onAuthExpired: () => void;
  onBack: () => void;
}

/** Parent/specialist view of the child's latest diagnostic results per skill. */
export function AssessmentResults({ child, token, onAuthExpired, onBack }: AssessmentResultsProps) {
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

  return (
    <main className="screen assessment-results">
      <header className="play-header">
        <button type="button" className="text-button" onClick={onBack}>
          رجوع
        </button>
        <h1 className="screen-title">نتائج التشخيص</h1>
      </header>

      <div className="assessment-results-child">
        <Avatar child={child} />
        <span className="child-name">{child.fullName}</span>
      </div>

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
        <p className="status-text">لم يُجرِ الطفل الاختبار بعد</p>
      ) : null}

      {!loading && loadError === null && results !== null && results.length > 0 ? (
        <ul className="assessment-results-list">
          {results.map((result) => (
            <li key={result.skillCode} className="card assessment-result-card">
              <h2 className="assessment-result-skill">{result.skillName}</h2>
              <p className="assessment-result-line">
                أجاب بشكل صحيح على {toArabicIndic(result.correct)} من {toArabicIndic(result.total)}
              </p>
              <p className="assessment-result-line">
                المستوى الابتدائي: {toArabicIndic(result.startingLevel)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
