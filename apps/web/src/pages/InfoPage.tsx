import { useEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Sun, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { WorkspaceShell } from "../components/WorkspaceShell";
import landingHeroMelonDark from "../assets/landing-hero-melon-dark.png";
import landingHeroMelon from "../assets/landing-hero-melon.png";
import watermelonMark from "../assets/watermelon-mark.svg";

export const APP_DESCRIPTION = {
  body: [
    "Melon Meet is a Berlin-first community tool for discovering beach volleyball venues, public sessions, and small playing groups.",
    "The product keeps public discovery open while giving signed-in users tools to claim spots, manage groups, and organise sessions.",
  ],
  title: "About Melon Meet",
};

export const PAGE_CONTENT = {
  impressum: {
    description: "Public company/contact disclosure for Melon Meet.",
    eyebrow: "Company",
    sections: [
      {
        body: [
          "Operator: Melon Meet",
          "Responsible for content according to Section 5 TMG and Section 18 MStV:",
          "Jacob Otto",
          "Halskestr. 6",
          "12167 Berlin",
          "Germany",
          "Email: hello@melonmeet.example",
        ],
        title: "Provider Identification",
      },
      {
        body: [
          "This product is intended to help people discover public venues, groups, and sessions around beach volleyball and related outdoor games.",
        ],
        title: "Notes",
      },
    ],
    title: "Impressum",
  },
  info: {
    description: "What Melon Meet is for, who it helps, and how public discovery and lightweight coordination fit together inside the app.",
    eyebrow: "About",
    sections: [
      {
        body: [
          ...APP_DESCRIPTION.body,
          "Melon Meet started as a way to make Berlin beach volleyball easier to navigate without forcing every useful place into the same giant chat thread.",
          "The app brings venues, groups, and sessions into one map-first board so people can move from discovering a court to understanding who plays there and when.",
          "Public browsing stays lightweight on purpose. You should be able to open the app, scan the city, and get oriented before deciding whether you want an account.",
        ],
        title: "What It Is",
      },
      {
        body: [
          "Venues are the stable places: courts, clubs, and spots worth knowing. Sessions are the time-based layer on top, so a place can feel alive instead of static.",
          "Groups help recurring crews organise themselves without losing the public discovery flow. Some can stay open and visible, others can remain private for smaller circles.",
          "The map is meant to be the orienting surface: browse first, open details when something looks promising, and move between location, group, and session context without losing your sense of place.",
          "Legal and company pages stay inside the same shell so the app still feels coherent when you step out of the map and into the informational side.",
        ],
        title: "How It Works",
      },
    ],
    title: "About",
  },
  privacy: {
    description:
      "How Melon Meet collects and uses account, group, and session data. This is a practical starter policy and should be reviewed before public launch.",
    eyebrow: "Privacy",
    sections: [
      {
        body: [
          "Melon Meet stores the information needed to provide the service, including account details, profile fields, group membership, meetings, posts, and session claims.",
          "Authentication sessions are stored so users can stay signed in across visits.",
        ],
        title: "Data We Store",
      },
      {
        body: [
          "We use this data to operate the product, show public and private community content, let organisers manage groups and sessions, and secure accounts against abuse.",
          "Authentication attempts may be rate limited and logged in aggregate to protect the service.",
        ],
        title: "Why We Use It",
      },
      {
        body: [
          "Private groups and member-only content are only shown to authorised members.",
          "Users can update their profile visibility settings inside the app and can delete their profile/account from the service.",
        ],
        title: "Visibility and Control",
      },
      {
        body: [
          "Before public launch, add your real retention periods, support contact, and lawful-basis language if you operate in the EU.",
        ],
        title: "Before Launch",
      },
    ],
    title: "Privacy Policy",
  },
  terms: {
    description:
      "Rules for using Melon Meet. This is a launch-ready starter draft, but it should be reviewed and tailored before opening the product broadly.",
    eyebrow: "Terms",
    sections: [
      {
        body: [
          "Melon Meet helps users discover venues, create groups, publish sessions, and coordinate outdoor games.",
          "You must provide accurate account information and keep your login credentials secure.",
        ],
        title: "Using the Service",
      },
      {
        body: [
          "Do not use the service for harassment, spam, fraud, illegal activity, or content that invades another person's privacy.",
          "Do not upload or share content unless you have the right to do so.",
        ],
        title: "Acceptable Use",
      },
      {
        body: [
          "You remain responsible for the content you post and for the sessions or groups you organise.",
          "Melon Meet may remove content or suspend access to protect the community and the service.",
        ],
        title: "Content and Moderation",
      },
      {
        body: [
          "Outdoor sports carry inherent risk. Participants are responsible for their own safety, insurance, travel, and participation decisions.",
        ],
        title: "Events and Liability",
      },
    ],
    title: "Terms of Use",
  },
} as const;

export type InfoPageKey = keyof typeof PAGE_CONTENT;

export const INFO_LINKS: Array<{ key: InfoPageKey; label: string; to: string }> = [
  { key: "info", label: "About", to: "/about" },
  { key: "privacy", label: "Privacy", to: "/privacy" },
  { key: "terms", label: "Terms", to: "/terms" },
  { key: "impressum", label: "Impressum", to: "/impressum" },
];

export function InfoPage({
  activePage,
  page,
  theme,
  toggleTheme,
  viewer,
}: {
  activePage?: InfoPageKey | null;
  page: InfoPageKey;
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const location = useLocation();
  const content = PAGE_CONTENT[page];
  const locationState =
    location.state && typeof location.state === "object"
      ? (location.state as { infoReturnTo?: string })
      : {};
  const closeTo = locationState.infoReturnTo ?? "/map";
  const landingBackgroundImage = theme === "dark" ? landingHeroMelonDark : landingHeroMelon;
  const [isDesktopInfoLayout, setIsDesktopInfoLayout] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 901px)").matches,
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  const infoShellRef = useRef<HTMLDivElement | null>(null);
  const infoContentRef = useRef<HTMLElement | null>(null);
  const infoLinkState = { infoReturnTo: closeTo };
  const renderHeaderControls = () => (
    <div className="landing-shell__right-header">
      <button
        aria-label="Toggle theme"
        className="landing-theme-toggle"
        onClick={toggleTheme}
        type="button"
      >
        {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
      <Link className="landing-header-button landing-header-button--label" to={closeTo}>
        <X size={16} strokeWidth={2} />
        <span>Close</span>
      </Link>
    </div>
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 901px)");
    const updateLayout = () => setIsDesktopInfoLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (activePage !== undefined) {
      return;
    }

    const mobileQuery = window.matchMedia("(max-width: 1120px)");
    let scrollElement: HTMLElement | null = null;

    const updateScrollElement = () => {
      scrollElement?.removeEventListener("scroll", updateScrollState);
      scrollElement = mobileQuery.matches ? infoShellRef.current : infoContentRef.current;
      scrollElement?.addEventListener("scroll", updateScrollState, { passive: true });
      updateScrollState();
    };

    const updateScrollState = () => {
      setShowScrollTop((scrollElement?.scrollTop ?? 0) > 12);
    };

    updateScrollElement();
    mobileQuery.addEventListener("change", updateScrollElement);

    return () => {
      scrollElement?.removeEventListener("scroll", updateScrollState);
      mobileQuery.removeEventListener("change", updateScrollElement);
    };
  }, [activePage]);

  function scrollInfoPageToTop() {
    const scrollElement = window.matchMedia("(max-width: 1120px)").matches ? infoShellRef.current : infoContentRef.current;
    scrollElement?.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (activePage === undefined) {
    return (
      <div className="workspace-page landing-workspace-page info-landing-page">
        <div className="workspace-frame landing-shell-frame info-landing-frame">
          <div className="landing-scene" aria-hidden="true">
            <img alt="" className="landing-scene__image" src={landingBackgroundImage} />
          </div>
          <div className="landing-shell landing-shell--info-page" ref={infoShellRef}>
            <section className="landing-shell__center landing-shell__center--welcome" ref={infoContentRef}>
              <div className="landing-mobile-header">
                <div className="landing-brand-lockup landing-brand-lockup--stacked">
                  <img alt="Melon Meet" className="landing-shell__logo" src={watermelonMark} />
                  <div className="landing-brand-lockup__copy">
                    <h1 className="landing-brand-lockup__title">Melon Meet</h1>
                    <p className="landing-brand-lockup__meta">Berlin Beachvolleyball</p>
                  </div>
                </div>
                <div className="landing-mobile-actions">{renderHeaderControls()}</div>
              </div>

              <div className="landing-info-content landing-info-content--page">
                <div className="stack-sm">
                  <h2 className="landing-info-content__title">{content.title}</h2>
                  <p className="landing-hero__text">{content.description}</p>
                </div>
                {content.sections.map((section) => (
                  <section className="stack-sm" key={section.title}>
                    <h3 className="column-title">{section.title}</h3>
                    {section.body.map((paragraph) => (
                      <p className="muted-copy" key={paragraph}>
                        {paragraph}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            </section>

            <section className="landing-shell__right">
              {renderHeaderControls()}
            </section>
          </div>
          <div className="landing-legal-links landing-legal-links--floating" aria-label="Legal pages">
            {INFO_LINKS.map((link) => (
              <Link
                className={page === link.key ? "is-active" : undefined}
                key={link.key}
                state={infoLinkState}
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <button
            aria-label="Scroll to top"
            className={`info-scroll-top ${showScrollTop ? "is-visible" : ""}`}
            onClick={scrollInfoPageToTop}
            type="button"
          >
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  const selectedPage = activePage === undefined ? page : activePage === null && isDesktopInfoLayout ? page : activePage;
  const isDetailPage = selectedPage !== null;

  const infoNavigation = (
    <div className="stack-md info-nav">
      <div className="info-rail-header">
        <Link aria-label="Back to map" className="button-secondary info-rail-close" to="/map">
          <X size={18} strokeWidth={2} />
        </Link>
      </div>

      <div className="stack-sm">
        <p className="eyebrow">Melon Meet</p>
        <h2 className="column-title">{APP_DESCRIPTION.title}</h2>
        {APP_DESCRIPTION.body.map((paragraph) => (
          <p className="muted-copy" key={paragraph}>
            {paragraph}
          </p>
        ))}
      </div>

      <nav aria-label="Info and legal pages" className="info-nav__links">
        {INFO_LINKS.map((link) => (
          <Link className={`info-nav__link ${selectedPage === link.key ? "is-active" : ""}`} key={link.key} to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );

  const center = (
    <div className="workspace-detail-scroll info-shell-main">
      <div className="stack-md info-page__content">
        {isDetailPage ? (
          <div className="info-page__mobile-close">
            <Link className="button-secondary button-inline" to="/about">
              <X size={14} strokeWidth={2} />
              <span>Close</span>
            </Link>
          </div>
        ) : null}
        {page !== "info" ? (
          <div className="stack-sm">
            <h1 className="section-title">{content.title}</h1>
            <p className="muted-copy">{content.description}</p>
          </div>
        ) : null}

        {content.sections.map((section) => (
          <section className="stack-sm" key={section.title}>
            <h2 className="column-title">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p className="muted-copy" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );

  return (
    <WorkspaceShell
      centerHeader={<div aria-hidden="true" />}
      center={center}
      layoutVariant={isDetailPage ? "info-detail" : "info-index"}
      left={null}
      leftHeader={null}
      profileLinkState={{ from: "Info" }}
      right={infoNavigation}
      rightHeader={undefined}
      theme={theme}
      toggleTheme={toggleTheme}
      utilityNavigation="map"
      viewer={viewer}
    />
  );
}
