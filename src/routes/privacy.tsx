import { createFileRoute } from "@tanstack/react-router";
import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Haul" },
      {
        name: "description",
        content: "What Haul reads from your Gmail, what it stores, and how to delete it.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="24 October 2026"
      intro={
        <p>
          Haul turns the order emails in your Gmail into one list of everything you've bought. To do
          that it needs to read some of your email, so this page explains exactly what it reads,
          what it keeps, who else sees it, and how to delete it. In short: read-only access, only
          order-related emails, only the order details are kept, and nothing is sold.
        </p>
      }
    >
      <LegalSection title="What Haul accesses">
        <p>
          When you sign in with Google, you're asked to give Haul <strong>read-only</strong> access
          to Gmail (the
          <code className="mx-1 rounded bg-surface px-1.5 py-0.5 text-[14px]">gmail.readonly</code>
          permission). Haul can't send, delete, archive or change any email.
        </p>
        <p>When you sync, Haul only looks at emails that:</p>
        <ul>
          <li>Gmail has filed under Purchases or Reservations, or</li>
          <li>
            have a subject mentioning an order, receipt, invoice, purchase, shipment, delivery or
            booking.
          </li>
        </ul>
        <p>It doesn't read the rest of your inbox.</p>
      </LegalSection>

      <LegalSection title="What Haul stores">
        <ul>
          <li>
            <strong>Your Google profile basics</strong> — name, email address and profile picture,
            so you can sign in.
          </li>
          <li>
            <strong>A Google access token</strong> (a "refresh token"), so Haul can sync your inbox
            without asking you to sign in every hour. It only works for read-only Gmail access, and
            you can cancel it at any time (see below).
          </li>
          <li>
            <strong>Order details</strong> found in your emails — shop, items, prices, total, order
            number, status, dates, tracking number and payment method.
          </li>
          <li>
            <strong>The first 500 characters of each order email</strong>, kept with the order to
            help check and fix mistakes.
          </li>
          <li>
            <strong>For emails that turned out not to be orders</strong> — only the email's ID, its
            subject line and why it was skipped, so Haul doesn't read it again on the next sync.
          </li>
          <li>When you last synced and how many emails have been checked.</li>
        </ul>
        <p>Haul doesn't store full emails, attachments, or anything from emails it doesn't open.</p>
      </LegalSection>

      <LegalSection title="Who else handles your data">
        <p>Haul is built on a few services that process data on its behalf:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — stores your account and orders, and runs the sync. (
            <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
              privacy policy
            </a>
            )
          </li>
          <li>
            <strong>Vercel</strong> — hosts the website. (
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
              privacy policy
            </a>
            )
          </li>
          <li>
            <strong>Google Gemini API and Groq</strong> — AI services that read the text of matching
            emails (up to 3,000 characters of each) and return the order details. (
            <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">
              Gemini API terms
            </a>
            ,{" "}
            <a href="https://groq.com/privacy-policy" target="_blank" rel="noreferrer">
              Groq privacy policy
            </a>
            )
          </li>
        </ul>
        <p>
          Each service handles data under its own terms. Haul currently uses the free plans of the
          AI services; on free plans, a provider's terms may allow it to use submitted content to
          improve its services. If that isn't acceptable to you, please don't sync.
        </p>
        <p>Haul doesn't sell your data, show ads, or share your data with anyone else.</p>
      </LegalSection>

      <LegalSection title="How your data is protected">
        <ul>
          <li>All traffic uses HTTPS.</li>
          <li>
            Your orders are stored with database rules that only let your own signed-in account read
            them — not other users.
          </li>
          <li>
            The keys used to talk to Gmail and the AI services stay on the server and never reach
            your browser.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <p>
          Haul uses your browser's local storage to keep you signed in and to remember light or dark
          theme. It doesn't use advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <ul>
          <li>
            <strong>Delete your orders and sync data:</strong> in Haul, go to Settings →{" "}
            <em>Delete my data</em>. This removes your orders, skipped-email records, sync history
            and the stored Google token.
          </li>
          <li>
            <strong>Cancel Haul's Gmail access:</strong> remove Haul at{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              myaccount.google.com/permissions
            </a>
            . After that, Haul can't read anything in your inbox.
          </li>
          <li>
            <strong>Delete your sign-in account too:</strong> email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and it will be removed.
          </li>
        </ul>
        <p>Otherwise, your data is kept for as long as you use Haul.</p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Haul isn't meant for children under 13 and doesn't knowingly collect their data.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If this policy changes, the date at the top will change too. Questions or requests:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
