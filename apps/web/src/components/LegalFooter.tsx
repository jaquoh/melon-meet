import { Link } from "react-router-dom";

export function LegalFooter() {
  return (
    <footer className="legal-footer">
      <div className="legal-footer__inner">
        <p className="legal-footer__copy">
          Melon Meet is a Berlin-first community tool for discovering venues, groups, and outdoor sessions.
        </p>
        <nav aria-label="Legal and company links" className="legal-footer__links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/impressum">Impressum</Link>
        </nav>
      </div>
    </footer>
  );
}
