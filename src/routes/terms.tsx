import { createFileRoute, Link } from "@tanstack/react-router";
import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · Haul" },
      { name: "description", content: "The terms for using Haul." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="24 October 2026"
      intro={
        <p>
          Haul is a free, independent side project. By signing in, you agree to these terms. They're
          short and written in plain language — please read them along with the{" "}
          <Link to="/privacy" className="font-medium text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      }
    >
      <LegalSection title="What Haul does">
        <p>
          Haul reads order-related emails in your Gmail (with your permission, read-only) and uses
          AI services to turn them into a list of your orders, with search and spending summaries.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>
            You sign in with your own Google account, and you may only connect a Gmail inbox that
            belongs to you.
          </li>
          <li>
            You can stop using Haul at any time, delete your data from Settings, and remove its
            Gmail access.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="The results aren't guaranteed">
        <p>
          Order emails come in many formats and the details are extracted automatically by AI, so
          amounts, dates, statuses or items can sometimes be wrong or missing. Your original emails
          are always the source of truth. Don't rely on Haul for financial, tax, legal or warranty
          records.
        </p>
      </LegalSection>

      <LegalSection title="Fair use">
        <ul>
          <li>
            Don't try to access other people's data or break, overload or reverse-engineer the
            service.
          </li>
          <li>Don't use Haul for anything unlawful.</li>
        </ul>
        <p>Accounts that misuse the service may be removed.</p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          Haul runs on free tiers of several services, so syncing can be slowed or paused by their
          usage limits, and features may change or stop. There's no promise that Haul will always be
          available.
        </p>
      </LegalSection>

      <LegalSection title="No warranty and limited liability">
        <p>
          Haul is provided "as is", without warranties of any kind. To the extent the law allows,
          the developer isn't liable for any loss or damage arising from using Haul, including
          incorrect order information or service interruptions.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          These terms may be updated; the date at the top will change when they are. Continuing to
          use Haul after a change means you accept the new terms. Questions:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
