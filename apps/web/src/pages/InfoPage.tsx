import { Link } from "react-router-dom";
import { PanelCard } from "../components/PanelCard";
import { LegalFooter } from "../components/LegalFooter";

const PAGE_CONTENT = {
  impressum: {
    description:
      "Public company/contact disclosure for Melon Meet.",
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
  privacy: {
    description:
      "How Melon Meet collects and uses account, group, and session data. This is a practical starter policy and should be reviewed before public launch.",
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

type InfoPageKey = keyof typeof PAGE_CONTENT;

export function InfoPage({ page }: { page: InfoPageKey }) {
  const content = PAGE_CONTENT[page];

  return (
    <div className="page-wrap info-page">
      <div className="info-page__inner">
        <PanelCard className="stack-md info-page__card">
          <div className="stack-sm">
            <p className="eyebrow">Public Info</p>
            <h1 className="section-title">{content.title}</h1>
            <p className="muted-copy">{content.description}</p>
          </div>

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

          <div className="workspace-button-row">
            <Link className="button-primary" to="/">
              Back to home
            </Link>
            <Link className="button-secondary" to="/map">
              Open app
            </Link>
          </div>
        </PanelCard>
      </div>

      <LegalFooter />
    </div>
  );
}
