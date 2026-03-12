import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Déjà",
  description: "How Déjà collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ep-bg text-text-primary">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link href="/" className="text-sm text-text-muted hover:text-accent transition mb-8 inline-block">
          &larr; Back to Déjà
        </Link>

        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-12">Last updated: March 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-text-secondary">

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">1. Who We Are</h2>
            <p>
              Déjà is operated by Miyamoto Labs, based in Tromsoe, Norway.
              Contact: <a href="mailto:hello@miyamotolabs.com" className="text-accent hover:underline">hello@miyamotolabs.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account data:</strong> Email address and wallet address (via Privy authentication)</li>
              <li><strong>Wallet data:</strong> Your Polymarket wallet address, used to enable copy-trading and portfolio tracking</li>
              <li><strong>Usage data:</strong> Pages visited, features used, pick interactions</li>
              <li><strong>Payment data:</strong> Subscription status. Payments are processed by Stripe — we do not store card details</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide the Déjà service (picks, copy-trading, portfolio management)</li>
              <li>To send product updates and notifications (where opted in)</li>
              <li>To improve our AI pick models using aggregated, anonymized usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">4. Data Sharing</h2>
            <p>
              We do not sell your personal data. We share data only with the service providers necessary
              to operate Déjà: Supabase (database), Stripe (payments), Vercel (hosting), Privy (authentication),
              and Telegram (bot notifications). All processors handle data in accordance with applicable privacy regulations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">5. Data Retention</h2>
            <p>
              We retain account data for as long as your account is active. If you request account deletion,
              your personal data will be removed within 30 days. Analytics data is retained in anonymized form only.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">6. Your Rights</h2>
            <p>
              You have the right to: access your data, correct inaccurate data, request deletion of your data,
              and withdraw consent at any time.
            </p>
            <p className="mt-2">
              To exercise these rights, contact us at{" "}
              <a href="mailto:hello@miyamotolabs.com" className="text-accent hover:underline">hello@miyamotolabs.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">7. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We may use optional analytics
              cookies to understand how Déjà is used. You can manage your cookie preferences at any time.
            </p>
          </section>

          <section className="pt-6 border-t border-ep-border">
            <p className="text-xs text-text-muted">
              Questions? Reach us at{" "}
              <a href="mailto:hello@miyamotolabs.com" className="text-accent hover:underline">hello@miyamotolabs.com</a>.
              Also see our <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
