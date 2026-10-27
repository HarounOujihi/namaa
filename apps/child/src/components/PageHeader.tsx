import type { ReactNode } from "react";
import { useBack } from "../navigation";
import { BackButton } from "./BackButton";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** The screen's fixed logical parent path; the back button leads there. */
  parent: string;
  /** Tail controls at the RTL end (e.g. 🎁, 🔊). */
  actions?: ReactNode;
  /** Extra class for the sticky bar (e.g. a wider row on library pages). */
  className?: string;
}

/** The one screen header: back at the RTL start, a one-line title (+ subtitle), optional actions at the end. */
export function PageHeader({ title, subtitle, parent, actions, className }: PageHeaderProps) {
  const back = useBack(parent);
  return (
    <header className={className === undefined ? "page-header" : `page-header ${className}`}>
      <div className="page-header-row">
        <BackButton onClick={back} />
        <div className="page-header-copy">
          <h1 className="page-header-title">{title}</h1>
          {subtitle !== undefined ? <p className="page-header-sub">{subtitle}</p> : null}
        </div>
        {actions !== undefined ? <div className="page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
