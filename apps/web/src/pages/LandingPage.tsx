import { Link } from "react-router-dom";
import watermelonMark from "../assets/watermelon-mark.svg";

export function LandingPage() {
  return (
    <div className="page-wrap landing-page landing-page--simple">
      <section className="landing-hero landing-hero--simple">
        <div className="landing-hero__copy">
          <p className="eyebrow">Berlin beach volleyball</p>
          <h1 className="landing-hero__title">Find Beachvolleyball courts, groups, and sessions.</h1>
          <p className="landing-hero__text">
            Browse the live map or jump straight into groups. Public discovery stays open, and the full workspace opens from there.
          </p>
          <div className="landing-entry-actions">
            <Link className="landing-entry-button" to="/map">
              <span className="landing-entry-button__eyebrow">Open workspace</span>
              <span className="landing-entry-button__title">Map</span>
              <span className="landing-entry-button__copy">Courts, venues, sessions, and public groups on one board.</span>
            </Link>
            <Link className="landing-entry-button" to="/groups">
              <span className="landing-entry-button__eyebrow">Open workspace</span>
              <span className="landing-entry-button__title">Groups</span>
              <span className="landing-entry-button__copy">Private groups first when signed in, then all public communities.</span>
            </Link>
          </div>
        </div>

        <div className="landing-hero__art">
          <img alt="Watermelon illustration" className="landing-hero__melon" src={watermelonMark} />
        </div>
      </section>
    </div>
  );
}
