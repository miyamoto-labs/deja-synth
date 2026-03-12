import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Déjà",
  description: "Terms governing your use of Déjà.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-ep-bg text-text-primary">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Link href="/" className="text-sm text-text-muted hover:text-accent transition mb-8 inline-block">
          &larr; Back to Déjà
        </Link>

        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-12">Last updated: March 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-text-secondary">

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">1. Acceptance</h2>
            <p>
              By creating an account or using Déjà, you agree to these Terms.
              If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">2. What Déjà Is</h2>
            <p>
              Déjà is an informational tool that provides AI-generated analysis of Polymarket prediction
              markets and facilitates copy-trading functionality. Déjà is not a licensed financial advisor,
              broker, exchange, or investment service. We do not hold, manage, or custody any funds on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">3. Eligibility</h2>
            <p>
              You must be 18 years or older to use Déjà. By using the platform, you confirm you are
              of legal age and that prediction market participation is legal in your jurisdiction.
              Déjà may restrict access from jurisdictions where such activity is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">4. Subscriptions & Payments</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Free tier:</strong> Access to limited AI picks and basic features</li>
              <li><strong>Pro tier ($29/month):</strong> Full access to AI picks, copy-trading, and priority features</li>
              <li>Cancellations take effect at the end of the billing period. We do not offer refunds for partial months</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">5. Risk Disclosure</h2>
            <p>
              Trading on prediction markets involves substantial financial risk. You may lose all funds
              you deposit or trade with. Déjà&apos;s AI-generated picks are provided for informational
              and entertainment purposes only and do not constitute financial advice, investment
              recommendations, or endorsements of any particular market position.
            </p>
            <p className="mt-3">
              Past performance of any pick, trader, or model does not guarantee future results.
              All trading decisions are made solely at your own risk. Only trade with funds you can afford to lose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">6. Copy Trading</h2>
            <p>
              When you use Déjà&apos;s copy-trading feature, you are instructing your own Polymarket wallet
              to replicate trades. Déjà does not execute trades on your behalf — it facilitates the
              instruction. You bear full responsibility for all trades made through copy-trading,
              including any financial losses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Déjà, its founders, and affiliates shall not be
              liable for any direct, indirect, incidental, or consequential damages arising from your use
              of the platform, including losses from trading activity, AI pick inaccuracies, or platform downtime.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">8. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Norway. Disputes shall be subject to the jurisdiction
              of Norwegian courts, without prejudice to any mandatory consumer protection rights you may
              have under your local law.
            </p>
          </section>

          <section className="pt-6 border-t border-ep-border">
            <p className="text-xs text-text-muted">
              Questions? Reach us at{" "}
              <a href="mailto:hello@miyamotolabs.com" className="text-accent hover:underline">hello@miyamotolabs.com</a>.
              Also see our <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
