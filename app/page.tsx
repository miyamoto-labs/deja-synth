"use client";

import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";

const APP_URL = "/dashboard";

/* ───── CountUp (animated number) ───── */
function CountUp({ target, suffix = "", prefix = "", duration = 1.5 }: { target: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);
  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

/* ───── Animations ───── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ───── Logo ───── */
function DejaLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-[22px]", md: "text-[28px]", lg: "text-[52px]" };
  return (
    <span className={`font-display ${sizes[size]} leading-none tracking-tight`}>
      <span className="text-deja-cream">Déjà</span>
      <span className="text-deja-amber">.</span>
      <span className="text-deja-cream">Market</span>
    </span>
  );
}

/* ───── Section Label (slide-in) ───── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-4 mb-16 font-mono text-[9px] tracking-[0.4em] uppercase text-deja-amber opacity-60"
    >
      <motion.span
        initial={{ width: 0 }}
        whileInView={{ width: 24 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="h-px bg-deja-amber opacity-50 block"
      />
      {children}
    </motion.div>
  );
}

/* ───── HowItWorks Illustration ───── */
function StepIllustration({ type }: { type: "bars" | "avatars" | "pulse" }) {
  if (type === "bars") {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="mb-7 opacity-70">
        <rect x="4" y="20" width="8" height="12" rx="1" fill="#C8843A" opacity="0.4" />
        <rect x="14" y="12" width="8" height="20" rx="1" fill="#C8843A" opacity="0.65" />
        <rect x="24" y="6" width="8" height="26" rx="1" fill="#C8843A" opacity="0.9" />
      </svg>
    );
  }
  if (type === "avatars") {
    return (
      <div className="flex -space-x-2.5 mb-7">
        {["A", "K", "N"].map((letter, i) => (
          <div
            key={letter}
            className="w-9 h-9 rounded-full bg-deja-brown-mid border border-deja-amber/30 flex items-center justify-center font-display text-[11px] text-deja-amber"
            style={{ opacity: 1 - i * 0.2, zIndex: 3 - i }}
          >
            {letter}
          </div>
        ))}
      </div>
    );
  }
  // "pulse"
  return (
    <div className="flex items-center gap-2 mb-7">
      <span className="signal-dot" />
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-deja-amber opacity-60">Live</span>
    </div>
  );
}

/* ───── Feature Illustration ───── */
function FeatureIllustration({ type }: { type: "bars" | "avatars" | "pulse" | "button" }) {
  if (type === "bars") {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-5 opacity-70">
        <rect x="3" y="18" width="7" height="11" rx="1" fill="#C8843A" opacity="0.4" />
        <rect x="12" y="10" width="7" height="19" rx="1" fill="#C8843A" opacity="0.65" />
        <rect x="21" y="4" width="7" height="25" rx="1" fill="#C8843A" opacity="0.9" />
      </svg>
    );
  }
  if (type === "avatars") {
    return (
      <div className="flex -space-x-2 mb-5">
        {["#C8843A", "#E4A95A", "#8B6347"].map((color, i) => (
          <div
            key={color}
            className="w-8 h-8 rounded-full border border-deja-amber/30"
            style={{ backgroundColor: color, opacity: 1 - i * 0.2, zIndex: 3 - i }}
          />
        ))}
      </div>
    );
  }
  if (type === "pulse") {
    return (
      <div className="flex items-center gap-2 mb-5">
        <span className="signal-dot" />
        <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-deja-amber opacity-50">Live</span>
      </div>
    );
  }
  // "button"
  return (
    <div className="mb-5">
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-deja-amber/20 border border-deja-amber/30 rounded-sm">
        <span className="font-mono text-[8px] tracking-[0.15em] uppercase text-deja-amber">Execute</span>
        <span className="text-deja-amber text-[10px]">&rarr;</span>
      </div>
    </div>
  );
}

/* ───── Navbar ───── */
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className="fixed top-0 z-50 w-full" style={{ background: 'linear-gradient(to bottom, rgba(20,16,9,0.95), transparent)' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-7">
        <a href="#top" className="no-underline">
          <DejaLogo />
        </a>
        <ul className="hidden items-center gap-10 md:flex list-none">
          <li><a href="#how" className="font-mono text-[12px] tracking-[0.18em] uppercase text-deja-cream opacity-70 no-underline transition-all duration-300 hover:opacity-100 hover:text-deja-amber">How it works</a></li>
          <li><a href="#markets" className="font-mono text-[12px] tracking-[0.18em] uppercase text-deja-cream opacity-70 no-underline transition-all duration-300 hover:opacity-100 hover:text-deja-amber">Markets</a></li>
          <li><a href="#traders" className="font-mono text-[12px] tracking-[0.18em] uppercase text-deja-cream opacity-70 no-underline transition-all duration-300 hover:opacity-100 hover:text-deja-amber">Copy trade</a></li>
          <li><a href="#features" className="font-mono text-[12px] tracking-[0.18em] uppercase text-deja-cream opacity-70 no-underline transition-all duration-300 hover:opacity-100 hover:text-deja-amber">Features</a></li>
          <li>
            <a href="/dashboard" className="font-mono text-[10px] tracking-[0.2em] uppercase bg-deja-amber text-deja-brown-dark font-medium rounded-sm px-5 py-2.5 no-underline transition-all duration-300 hover:shadow-[0_0_20px_rgba(200,132,58,0.3)]">
              Dashboard
            </a>
          </li>
        </ul>
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-deja-cream opacity-50 hover:opacity-100 transition"
          aria-label="Menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            }
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:hidden border-t border-deja-amber/10"
          >
            <div className="flex flex-col gap-1 p-4 bg-deja-charcoal/95">
              <a href="#how" onClick={() => setMobileOpen(false)} className="px-4 py-3 font-mono text-[10px] tracking-[0.25em] uppercase text-deja-cream opacity-60 no-underline">How it works</a>
              <a href="#markets" onClick={() => setMobileOpen(false)} className="px-4 py-3 font-mono text-[10px] tracking-[0.25em] uppercase text-deja-cream opacity-60 no-underline">Markets</a>
              <a href="#traders" onClick={() => setMobileOpen(false)} className="px-4 py-3 font-mono text-[10px] tracking-[0.25em] uppercase text-deja-cream opacity-60 no-underline">Copy trade</a>
              <a href="#features" onClick={() => setMobileOpen(false)} className="px-4 py-3 font-mono text-[10px] tracking-[0.25em] uppercase text-deja-cream opacity-60 no-underline">Features</a>
              <a href="/dashboard" className="px-4 py-3 font-mono text-[10px] tracking-[0.25em] uppercase text-deja-amber no-underline bg-deja-amber text-deja-brown-dark font-medium rounded-sm px-6">Dashboard</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ───── Hero ───── */
function Hero() {
  return (
    <section id="top" className="relative min-h-screen flex flex-col justify-center px-8 sm:px-16 pt-32 pb-20 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute w-[800px] h-[800px] rounded-full top-[-200px] right-[-200px]"
        style={{ background: 'radial-gradient(circle, rgba(200,132,58,0.12) 0%, transparent 70%)', animation: 'drift1 12s ease-in-out infinite alternate' }} />
      <div className="pointer-events-none absolute w-[600px] h-[600px] rounded-full bottom-[-100px] left-[10%]"
        style={{ background: 'radial-gradient(circle, rgba(196,150,122,0.07) 0%, transparent 70%)', animation: 'drift2 15s ease-in-out infinite alternate' }} />

      {/* Background video — Wall Street 1980, ghostly B&W layer */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block"
        style={{
          maskImage: 'linear-gradient(to right, transparent 20%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.8) 70%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 20%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.8) 70%, transparent 100%)',
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-[0.25] grayscale"
        >
          <source src="/videos/hero-wallstreet.webm" type="video/webm" />
          <source src="/videos/hero-wallstreet.mp4" type="video/mp4" />
        </video>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="flex items-center gap-4 mb-10 font-mono text-[10px] tracking-[0.4em] uppercase text-deja-amber opacity-80"
      >
        <span className="w-8 h-px bg-deja-amber opacity-60" />
        Prediction markets, refined
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
        className="font-display text-[clamp(64px,9vw,140px)] leading-[0.92] tracking-[-0.025em] text-deja-cream max-w-[900px]"
      >
        The future<br />feels <em className="italic text-deja-amber">familiar.</em>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        className="font-heading italic text-[clamp(18px,2.5vw,32px)] text-deja-dusty-rose mt-6 mb-16 max-w-[640px] leading-relaxed"
      >
        The most beautiful way to trade prediction markets.<br />
        Copy the sharpest minds. Feel at home.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.65 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
      >
        <motion.a
          href="/dashboard/markets"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="relative overflow-hidden inline-block bg-deja-amber text-deja-brown-dark font-mono text-[11px] tracking-[0.25em] uppercase px-9 py-5 no-underline transition-all duration-300 group"
        >
          <span className="relative z-10">Explore Markets &rarr;</span>
          <span className="absolute inset-0 bg-deja-amber-light transform -translate-x-full group-hover:translate-x-0 transition-transform duration-400" />
        </motion.a>
        <motion.a
          href="/dashboard"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="font-mono text-[11px] tracking-[0.25em] uppercase text-deja-cream opacity-60 no-underline flex items-center gap-2.5 transition-all duration-300 hover:opacity-100 hover:text-deja-amber border border-deja-amber/30 px-7 py-4"
        >
          Open Dashboard
        </motion.a>
        <a
          href="#how"
          className="font-mono text-[11px] tracking-[0.25em] uppercase text-deja-cream opacity-40 no-underline flex items-center gap-2.5 transition-all duration-300 hover:opacity-100 hover:text-deja-amber"
        >
          See how it works &rarr;
        </a>
      </motion.div>

      {/* Hero stats — right side (with CountUp) */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.8 }}
        className="hidden lg:flex absolute right-16 bottom-20 flex-col gap-8"
      >
        <div className="text-right">
          <span className="block font-display text-4xl text-deja-amber-light leading-none" style={{ textShadow: '0 0 40px rgba(228,169,90,0.4)' }}>
            $<CountUp target={3} suffix=".7B" duration={1.2} />
          </span>
          <span className="block font-mono text-[9px] tracking-[0.25em] uppercase text-deja-cream opacity-45 mt-1">
            Monthly market volume
          </span>
        </div>
        <div className="text-right">
          <span className="block font-display text-4xl text-deja-amber-light leading-none" style={{ textShadow: '0 0 40px rgba(228,169,90,0.4)' }}>
            Live
          </span>
          <span className="block font-mono text-[9px] tracking-[0.25em] uppercase text-deja-cream opacity-45 mt-1">
            Trading now
          </span>
        </div>
        <div className="text-right">
          <span className="block font-display text-4xl text-deja-amber-light leading-none" style={{ textShadow: '0 0 40px rgba(228,169,90,0.4)' }}>
            More
          </span>
          <span className="block font-mono text-[9px] tracking-[0.25em] uppercase text-deja-cream opacity-45 mt-1">
            Platforms coming soon
          </span>
        </div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        whileHover={{ y: 4 }}
        className="hidden sm:flex absolute bottom-8 left-16 items-center gap-3 font-mono text-[9px] tracking-[0.3em] uppercase text-deja-cream opacity-25 cursor-pointer"
      >
        <div className="w-10 h-px bg-deja-cream opacity-40 relative overflow-hidden">
          <span className="absolute top-0 left-[-100%] w-full h-full bg-deja-amber" style={{ animation: 'scrollPulse 2s ease-in-out infinite' }} />
        </div>
        Scroll to explore
      </motion.div>

      <style jsx>{`
        @keyframes drift1 {
          0% { transform: translate(0,0) scale(1); }
          100% { transform: translate(-60px, 80px) scale(1.15); }
        }
        @keyframes drift2 {
          0% { transform: translate(0,0) scale(1); }
          100% { transform: translate(80px,-60px) scale(1.2); }
        }
        @keyframes scrollPulse {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
    </section>
  );
}

/* ───── Social Proof ───── */
function SocialProof() {
  const stats = [
    { target: 500, suffix: "+", label: "Markets scanned" },
    { target: 65, suffix: "+", label: "Traders tracked" },
    { target: 80, suffix: "+", label: "Min conviction" },
    { raw: "10m", label: "Scan interval" },
  ];

  return (
    <section className="px-8 sm:px-16 py-16 border-t border-deja-amber/10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5">
        {stats.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 0.15}>
            <div className="px-6 py-8 bg-deja-brown-dark/20 text-center">
              <span className="block font-display text-[36px] text-deja-amber-light leading-none mb-2" style={{ textShadow: '0 0 30px rgba(228,169,90,0.3)' }}>
                {"raw" in stat ? stat.raw : <CountUp target={stat.target} suffix={stat.suffix} />}
              </span>
              <span className="block font-mono text-[9px] tracking-[0.25em] uppercase text-deja-cream opacity-45">
                {stat.label}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───── How It Works ───── */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: <>Every market.<br />Beautifully.</>,
      body: "Every prediction market in a single, warm interface designed to feel nothing like a trading terminal. Browse, discover, and act \u2014 without the friction. More platforms are on the roadmap.",
      illustration: "bars" as const,
    },
    {
      num: "02",
      title: <>Discover.<br />Shadow. Copy.</>,
      body: "Find the sharpest traders through our discovery tool. Open any trader\u2019s shadow page to see their full history and live positions. Turn on autocopy and every trade they make, you make.",
      illustration: "avatars" as const,
    },
    {
      num: "03",
      title: <>AI surfaces<br />the signal.</>,
      body: "On the roadmap: AI-powered analysis that highlights mispriced positions, unusual consensus shifts, and trades worth acting on \u2014 before the crowd catches on. Coming soon after launch.",
      illustration: "pulse" as const,
    },
  ];

  return (
    <section id="how" className="px-8 sm:px-16 py-32 border-t border-deja-amber/10" style={{ background: 'linear-gradient(to bottom, rgba(44,31,20,0.3), transparent)' }}>
      <SectionLabel>How it works</SectionLabel>

      <Reveal>
        <h2 className="font-display text-[clamp(40px,5vw,72px)] leading-none tracking-[-0.02em] text-deja-cream max-w-[600px] mb-20">
          Prediction markets,<br />made <em className="italic text-deja-amber">human.</em>
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5">
        {steps.map((step, i) => (
          <Reveal key={step.num} delay={i * 0.15}>
            <div className="group relative px-11 py-14 bg-[#1a120a] border border-deja-amber/20 rounded-lg shadow-[0_4px_40px_rgba(200,132,58,0.06)] transition-all duration-400 hover:bg-deja-brown-dark/50 hover:shadow-[0_8px_40px_rgba(200,132,58,0.1)]">
              {/* Hover accent line */}
              <span className="absolute top-0 left-0 right-0 h-px bg-deja-amber transform scale-x-0 origin-left transition-transform duration-400 group-hover:scale-x-100" />

              <span className="block font-mono text-[11px] text-deja-amber opacity-50 tracking-[0.2em] mb-8">{step.num}</span>

              <StepIllustration type={step.illustration} />

              <h3 className="font-display text-[28px] text-deja-cream leading-tight mb-4">{step.title}</h3>
              <p className="text-[15px] text-deja-cream opacity-65 leading-[1.9]">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───── Features ───── */
function Features() {
  const features = [
    { title: "AI Conviction Scoring", desc: "Every market gets an AI-generated conviction score based on trader consensus, volume patterns, and historical accuracy.", illustration: "bars" as const },
    { title: "65+ Classified Traders", desc: "We track and rank the top Polymarket traders so you don\u2019t have to. See their history, accuracy, and live positions.", illustration: "avatars" as const },
    { title: "Real-Time Copy Signals", desc: "Get notified the moment a top trader enters a position. Autocopy instantly or review and act on your own terms.", illustration: "pulse" as const },
    { title: "One-Click Execution", desc: "No more switching between tabs. See a trade, click once, done. Built for speed without sacrificing control.", illustration: "button" as const },
  ];

  return (
    <section id="features" className="px-8 sm:px-16 py-32 border-t border-deja-amber/10">
      <SectionLabel>Features</SectionLabel>

      <Reveal>
        <h2 className="font-display text-[clamp(36px,4vw,60px)] leading-[1.05] tracking-[-0.02em] text-deja-cream max-w-[600px] mb-16">
          Built for <em className="italic text-deja-amber">conviction.</em>
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.15}>
            <div className="group px-10 py-12 bg-[#1a120a] border border-deja-amber/20 rounded-lg transition-all duration-400 hover:bg-deja-brown-dark/50 hover:shadow-[0_8px_40px_rgba(200,132,58,0.1)]">
              <FeatureIllustration type={f.illustration} />
              <h3 className="font-display text-[22px] text-deja-cream leading-tight mb-3">{f.title}</h3>
              <p className="text-[15px] text-deja-cream opacity-60 leading-[1.8]">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───── Markets ───── */
function Markets() {
  const marketCards = [
    { source: "Polymarket \u00b7 Politics", title: "Will the Fed cut rates before Q3 2025?", odds: "68%", featured: true },
    { source: "Polymarket \u00b7 Crypto", title: "Bitcoin above $120k by end of year?", odds: "54%" },
    { source: "Polymarket \u00b7 Tech", title: "GPT-5 released before June 2025?", odds: "41%" },
    { source: "Polymarket \u00b7 Sports", title: "Norway wins most gold medals at 2026 Winter Olympics?", odds: "73%" },
  ];

  return (
    <section id="markets" className="px-8 sm:px-16 py-32 border-t border-deja-amber/10 overflow-hidden">
      <SectionLabel>Markets</SectionLabel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <Reveal>
          <div>
            <h2 className="font-display text-[clamp(36px,4vw,60px)] leading-[1.05] tracking-[-0.02em] text-deja-cream mb-6">
              Starting with<br />Polymarket.<br /><em className="italic text-deja-dusty-rose">Built for more.</em>
            </h2>
            <p className="text-[15px] text-deja-cream opacity-65 leading-[1.9] max-w-[420px] mb-10">
              Déjà launches on Polymarket — the world&apos;s largest prediction market with billions in monthly volume. Kalshi, Manifold and others are on the roadmap. The interface is already built for them.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 border border-deja-amber text-deja-amber">Polymarket &#10003;</span>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 border border-deja-amber/25 text-deja-cream opacity-40">Kalshi &mdash; soon</span>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 border border-deja-amber/25 text-deja-cream opacity-40">Manifold &mdash; soon</span>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 border border-deja-amber/25 text-deja-cream opacity-40">More coming</span>
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-0.5">
          {marketCards.map((card, i) => (
            <Reveal key={card.title} delay={0.2 + i * 0.1}>
              <div
                className={`flex items-center justify-between px-7 py-6 bg-deja-brown-dark/40 border-l-2 transition-all duration-300 cursor-pointer hover:bg-deja-brown-dark/70 hover:border-l-deja-amber ${
                  card.featured ? 'border-l-deja-amber' : 'border-l-transparent'
                }`}
              >
                <div>
                  <span className="block font-mono text-[8px] tracking-[0.3em] uppercase text-deja-amber opacity-60 mb-1.5">{card.source}</span>
                  <span className="block font-heading text-[15px] text-deja-cream leading-snug max-w-[280px]">{card.title}</span>
                </div>
                <div className="text-right shrink-0 ml-5">
                  <span className="block font-display text-[28px] text-deja-amber-light leading-none" style={{ textShadow: '0 0 20px rgba(228,169,90,0.3)' }}>
                    {card.odds}
                  </span>
                  <span className="block font-mono text-[8px] tracking-[0.2em] uppercase text-deja-cream opacity-30 mt-1">Yes</span>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.6}>
            <div className="flex items-center justify-center px-7 py-6 border-l border-dashed border-deja-amber/15 opacity-40">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-deja-amber">+ thousands more markets</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───── Copy Trading ───── */
function CopyTrading() {
  const traders = [
    { avatar: "A", name: "Ariel_foresight", streak: "9/10 correct \u00b7 14 day streak", pnl: "+$4,210" },
    { avatar: "K", name: "kaleidoscope_k", streak: "7/10 correct \u00b7 8 day streak", pnl: "+$2,844" },
    { avatar: "N", name: "NorthernOracle", streak: "6/10 correct \u00b7 5 day streak", pnl: "+$1,620" },
    { avatar: "R", name: "retrograde_r", streak: "5/10 correct \u00b7 3 day streak", pnl: "+$890" },
  ];

  return (
    <section id="traders" className="px-8 sm:px-16 py-32 border-t border-deja-amber/10" style={{ background: 'linear-gradient(135deg, rgba(44,31,20,0.4) 0%, transparent 60%)' }}>
      <SectionLabel>Core feature &middot; Live now</SectionLabel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        {/* Trader feed */}
        <div>
          <Reveal>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-deja-amber opacity-70 mb-4">Top traders &middot; This week</div>
          </Reveal>
          <div className="flex flex-col gap-0.5">
            {traders.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.12}>
                <div className="flex items-center gap-4 px-6 py-5 bg-black/60 border border-deja-amber/15 rounded transition-all duration-300 cursor-pointer hover:border-deja-amber/25">
                  <div className="w-10 h-10 rounded-full bg-deja-brown-mid flex items-center justify-center font-display text-base text-deja-amber border border-deja-amber/20 shrink-0">
                    {t.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[13px] font-body font-normal text-deja-cream">{t.name}</span>
                    <span className="block font-mono text-[10px] tracking-[0.15em] text-deja-amber opacity-70 mt-0.5">{t.streak}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono text-[14px] text-deja-sage">{t.pnl}</span>
                    <span className="block font-mono text-[9px] tracking-[0.2em] text-deja-cream opacity-45 mt-0.5">This week</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.5}>
            <a href="/dashboard/traders" className="block w-full mt-3 font-mono text-[9px] tracking-[0.25em] uppercase text-deja-amber border border-deja-amber/30 py-3 bg-transparent transition-all duration-300 cursor-pointer hover:bg-deja-amber hover:text-deja-brown-dark hover:border-deja-amber text-center no-underline">
              Explore top traders &rarr;
            </a>
          </Reveal>
        </div>

        {/* Copy text */}
        <Reveal delay={0.2}>
          <div>
            <h2 className="font-display text-[clamp(36px,4vw,60px)] leading-[1.05] tracking-[-0.02em] text-deja-cream mb-6">
              Find who<br />sees it first.<br /><em className="italic text-deja-amber">Then follow.</em>
            </h2>
            <p className="text-[15px] text-deja-cream opacity-65 leading-[1.9] max-w-[400px] mb-8">
              Déjà&apos;s trader discovery tool surfaces the best performers across prediction markets — ranked by accuracy, streak, and returns. Find someone you trust, open their shadow page, and autocopy every trade they make automatically.
            </p>
            <ul className="flex flex-col gap-3.5 list-none p-0 m-0">
              {[
                "Discover top traders by track record",
                "Deep-dive any trader\u2019s full position history",
                "Autocopy their trades with your own stake size",
                "Set risk limits \u2014 stop-loss and take-profit built in",
                "Pause or exit any copied position at any time",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3.5 text-[14px] text-deja-cream opacity-65">
                  <span className="w-1.5 h-1.5 bg-deja-amber rounded-full shrink-0" style={{ boxShadow: '0 0 8px rgba(200,132,58,0.6)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───── Dashboard Preview ───── */
function DashboardPreview() {
  return (
    <section className="px-8 sm:px-16 py-32 border-t border-deja-amber/10 overflow-hidden">
      <SectionLabel>The dashboard</SectionLabel>

      <Reveal>
        <h2 className="font-display text-[clamp(36px,4vw,60px)] leading-[1.05] tracking-[-0.02em] text-deja-cream max-w-[600px] mb-16">
          See it in <em className="italic text-deja-amber">action.</em>
        </h2>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="max-w-4xl mx-auto" style={{ perspective: '1200px' }}>
          <motion.div
            initial={{ opacity: 0, rotateX: 12, rotateY: -5, y: 40 }}
            whileInView={{ opacity: 1, rotateX: 8, rotateY: -3, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#0a0806] border border-deja-amber/20 rounded-lg overflow-hidden"
            style={{ boxShadow: '0 40px 80px rgba(200,132,58,0.12), 0 0 0 1px rgba(200,132,58,0.1)' }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0f0b08] border-b border-deja-amber/10">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-deja-amber/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-deja-amber/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-deja-amber/15" />
              </div>
              <div className="flex-1 text-center font-mono text-[9px] tracking-[0.2em] uppercase text-deja-cream opacity-30">
                deja.market/dashboard
              </div>
            </div>

            {/* Dashboard content mockup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
              <Reveal delay={0.4}>
                <div className="bg-deja-brown-dark/40 border border-deja-amber/10 rounded-md p-5">
                  <span className="block font-mono text-[8px] tracking-[0.3em] uppercase text-deja-amber opacity-60 mb-3">Top Pick</span>
                  <span className="block font-heading text-[15px] text-deja-cream mb-2">Will the Fed cut rates before Q3?</span>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[28px] text-deja-amber-light">68%</span>
                    <span className="font-mono text-[9px] text-deja-sage">+12.4% today</span>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.55}>
                <div className="bg-deja-brown-dark/40 border border-deja-amber/10 rounded-md p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="signal-dot" />
                    <span className="font-mono text-[8px] tracking-[0.3em] uppercase text-deja-amber opacity-60">Live Copy Signals</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {["Ariel_foresight bought YES @ 0.68", "kaleidoscope_k sold NO @ 0.32", "NorthernOracle bought YES @ 0.71"].map((signal, i) => (
                      <Reveal key={signal} delay={0.7 + i * 0.1}>
                        <div className="font-mono text-[10px] text-deja-cream opacity-50 py-1 border-b border-deja-amber/5">
                          {signal}
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </motion.div>
        </div>
      </Reveal>
    </section>
  );
}

/* ───── FAQ ───── */
function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = [
    { q: "What prediction markets does Deja support?", a: "We launch with full Polymarket support. Kalshi, Manifold, and other platforms are on the roadmap and the interface is already designed for them." },
    { q: "How does copy trading work?", a: "Find a trader you trust through our discovery tool, open their shadow page, and toggle autocopy. Every position they enter, you enter automatically with your own stake size. You can set stop-loss and take-profit limits." },
    { q: "Is there a minimum to start?", a: "No minimum. You trade with your own wallet and set your own position sizes. Deja never holds your funds." },
    { q: "What about the AI features?", a: "AI-powered conviction scoring and signal detection are on the roadmap for post-launch. The copy trading and market browsing features are live now." },
    { q: "How do I get access?", a: "The dashboard is live. Click \u2018Dashboard\u2019 in the nav to start exploring markets and traders right now." },
  ];

  return (
    <section className="px-8 sm:px-16 py-32 border-t border-deja-amber/10">
      <SectionLabel>FAQ</SectionLabel>

      <Reveal>
        <h2 className="font-display text-[clamp(36px,4vw,60px)] leading-[1.05] tracking-[-0.02em] text-deja-cream max-w-[500px] mb-16">
          Common <em className="italic text-deja-amber">questions.</em>
        </h2>
      </Reveal>

      <div className="max-w-[700px] flex flex-col">
        {items.map((item, i) => (
          <Reveal key={item.q} delay={i * 0.08}>
            <div className="border-b border-deja-amber/10">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between py-6 text-left bg-transparent border-none cursor-pointer group"
              >
                <span className="font-heading text-[16px] text-deja-cream opacity-80 group-hover:opacity-100 transition-opacity">{item.q}</span>
                <span className="text-deja-amber opacity-40 text-[18px] ml-4 shrink-0 transition-transform duration-300" style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="text-[15px] text-deja-cream opacity-60 leading-[1.8] pb-6">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───── Final CTA ───── */
function FinalCTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (email && email.includes("@")) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <section className="relative px-8 sm:px-16 py-32 border-t border-deja-amber/10 min-h-[60vh] flex items-center justify-center text-center overflow-hidden" style={{ background: 'linear-gradient(to top, rgba(200,132,58,0.08), transparent 60%)' }}>
      {/* Ambient glow */}
      <div className="absolute w-[700px] h-[700px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,132,58,0.1) 0%, transparent 70%)', animation: 'pulse 4s ease-in-out infinite' }} />

      <div className="relative z-10">
        <Reveal>
          <h2 className="font-display text-[clamp(48px,7vw,100px)] leading-[0.95] tracking-[-0.025em] text-deja-cream mb-6">
            Ready to<br /><em className="italic text-deja-amber">trade smarter?</em>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="font-heading italic text-[20px] text-deja-dusty-rose mb-14">
            The dashboard is live. Start exploring now.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <motion.a
              href="/dashboard"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="relative overflow-hidden inline-block bg-deja-amber text-deja-brown-dark font-mono text-[11px] tracking-[0.25em] uppercase px-9 py-5 no-underline transition-all duration-300 group"
            >
              <span className="relative z-10">Open Dashboard &rarr;</span>
              <span className="absolute inset-0 bg-deja-amber-light transform -translate-x-full group-hover:translate-x-0 transition-transform duration-400" />
            </motion.a>
            <motion.a
              href="/dashboard/markets"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="font-mono text-[11px] tracking-[0.25em] uppercase text-deja-cream opacity-60 no-underline border border-deja-amber/30 px-7 py-4 transition-all duration-300 hover:opacity-100 hover:text-deja-amber"
            >
              Explore Markets
            </motion.a>
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="max-w-[420px] mx-auto">
            <span className="block font-mono text-[9px] tracking-[0.3em] uppercase text-deja-cream opacity-40 mb-4">Stay in the loop</span>
            <div className="flex gap-0">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-deja-brown-dark/60 border border-deja-amber/25 border-r-0 px-6 py-3 font-body text-[13px] font-light text-deja-cream outline-none transition-all duration-300 focus:border-deja-amber/60 placeholder:text-deja-cream/30"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button
                onClick={handleSubmit}
                className="font-mono text-[9px] tracking-[0.2em] uppercase bg-deja-amber/20 text-deja-amber border border-deja-amber/25 border-l-0 px-5 py-3 cursor-pointer transition-all duration-300 hover:bg-deja-amber hover:text-deja-brown-dark whitespace-nowrap"
              >
                {submitted ? "Done \u2726" : "Subscribe"}
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%,-50%) scale(1.1); opacity: 0.7; }
        }
      `}</style>
    </section>
  );
}

/* ───── Footer ───── */
function Footer() {
  const links = [
    { label: "About", href: "#" },
    { label: "Twitter", href: "https://twitter.com/dejatrading" },
    { label: "Contact", href: "mailto:hello@deja.trade" },
  ];

  return (
    <footer className="px-8 sm:px-16 py-10 border-t border-deja-amber/[0.08] flex flex-col sm:flex-row items-center justify-between gap-5">
      <DejaLogo size="sm" />
      <ul className="flex gap-8 list-none p-0 m-0">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="font-mono text-[10px] tracking-[0.25em] uppercase text-deja-cream opacity-40 no-underline transition-all duration-300 hover:opacity-80 hover:text-deja-amber">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <span className="font-mono text-[10px] tracking-[0.15em] text-deja-cream opacity-35">
        &copy; {new Date().getFullYear()} Miyamoto Labs &middot; deja.trade
      </span>
    </footer>
  );
}

/* ───── Page ───── */
export default function Home() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('deja-ref-code', ref.toUpperCase());
    }
  }, []);

  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <Hero />
      <SocialProof />
      <HowItWorks />
      <Features />
      <Markets />
      <CopyTrading />
      <DashboardPreview />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
