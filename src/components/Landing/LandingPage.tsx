import React, { useEffect, useRef, useCallback } from 'react';
import {
  ScanLine,
  GitCompareArrows,
  FileText,
  Zap,
  Droplets,
  Wind,
  Flame,
  Gauge,
  Check,
  X,
  ArrowRight,
  ChevronDown,
  Layers,
  Shield,
  Wifi,
  WifiOff,
  Tablet,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface LandingPageProps {
  onLaunchApp: () => void;
  onTryDemo: () => void;
  onStartTrial: (tier: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Fade-in on scroll hook                                             */
/* ------------------------------------------------------------------ */

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('opacity-100', 'translate-y-0');
          el.classList.remove('opacity-0', 'translate-y-8');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function FadeSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable tiny components                                           */
/* ------------------------------------------------------------------ */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-400 tracking-wide uppercase">
      {children}
    </span>
  );
}

function SectionHeading({
  badge,
  title,
  subtitle,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-16">
      {badge && <Badge>{badge}</Badge>}
      <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-gray-400 leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION 1 — Hero                                                   */
/* ------------------------------------------------------------------ */

function Hero({
  onLaunchApp,
  onTryDemo,
}: {
  onLaunchApp: () => void;
  onTryDemo: () => void;
}) {
  const scrollDown = useCallback(() => {
    document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12)_0%,transparent_70%)]" />

      <div className="relative z-10 max-w-4xl text-center">
        <Badge>Construction Intelligence</Badge>

        <h1 className="mt-8 text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
          Your blueprints say one thing.{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
            Reality says another.
          </span>
        </h1>

        <p className="mt-6 text-xl sm:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Survai detects the difference&nbsp;&mdash; automatically.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onLaunchApp}
            className="group flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition-all"
          >
            Launch App
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={onTryDemo}
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-8 py-3.5 text-base font-semibold text-gray-300 hover:border-indigo-500/50 hover:text-white transition-all"
          >
            Watch Demo
          </button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Tablet className="h-4 w-4" />
          No download required. Works on iPad, tablet, and desktop.
        </p>
      </div>

      <button
        onClick={scrollDown}
        className="absolute bottom-10 text-gray-600 hover:text-gray-400 transition-colors animate-bounce"
        aria-label="Scroll down"
      >
        <ChevronDown className="h-6 w-6" />
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION 2 — The Problem                                            */
/* ------------------------------------------------------------------ */

function ProblemSection() {
  return (
    <section id="problem" className="py-24 sm:py-32 px-6">
      <FadeSection className="max-w-4xl mx-auto text-center space-y-8">
        <SectionHeading badge="The Problem" title="Rework is eating your margins." />

        <div className="grid sm:grid-cols-3 gap-8 text-left">
          {[
            {
              stat: '$31B',
              label: 'per year',
              text: 'Construction rework costs $31 billion per year in the US alone.',
            },
            {
              stat: 'Weeks',
              label: 'too late',
              text: 'Most deviations are caught at inspection — weeks after installation.',
            },
            {
              stat: '0',
              label: 'excuses',
              text: 'Your team deserves better tools than tape measures and spreadsheets.',
            },
          ].map((item) => (
            <div
              key={item.stat}
              className="rounded-xl bg-gray-900/80 border border-gray-800 p-6"
            >
              <p className="text-3xl font-extrabold text-indigo-400">{item.stat}</p>
              <p className="text-sm text-gray-500 mb-3">{item.label}</p>
              <p className="text-gray-300 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </FadeSection>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION 3 — How It Works                                           */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const steps = [
    {
      icon: <ScanLine className="h-8 w-8" />,
      title: 'Scan',
      description:
        'Walk the site with your iPad. KIRI Engine captures the space in minutes.',
    },
    {
      icon: <GitCompareArrows className="h-8 w-8" />,
      title: 'Compare',
      description:
        "Upload your DWG blueprints. Survai's ML identifies every pipe, outlet, and vent — then compares plan vs reality.",
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: 'Report',
      description:
        'Color-coded deviations. Punch list PDF. DXF export for AutoCAD. Done.',
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6 bg-gray-900/50">
      <FadeSection className="max-w-5xl mx-auto">
        <SectionHeading
          badge="How It Works"
          title="Three steps. Zero guesswork."
          subtitle="From site scan to actionable punch list in under an hour."
        />

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.title} className="relative text-center group">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t border-dashed border-gray-700" />
              )}
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-6 mx-auto">
                {step.icon}
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">
                Step {i + 1}
              </p>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-gray-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </FadeSection>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION 4 — What We Detect                                         */
/* ------------------------------------------------------------------ */

function DetectionSection() {
  const categories = [
    {
      icon: <Zap className="h-6 w-6" />,
      name: 'Electrical',
      items: 'Outlets, switches, panels, circuit breakers',
    },
    {
      icon: <Droplets className="h-6 w-6" />,
      name: 'Plumbing',
      items: 'Valves (10 types), pumps, pipes, fixtures',
    },
    {
      icon: <Wind className="h-6 w-6" />,
      name: 'HVAC',
      items: 'Vents, ducts, compressors, heat exchangers',
    },
    {
      icon: <Flame className="h-6 w-6" />,
      name: 'Fire Protection',
      items: 'Sprinkler heads, alarms, smoke detectors',
    },
    {
      icon: <Gauge className="h-6 w-6" />,
      name: 'Instruments',
      items: 'Pressure, level, flow, temperature gauges',
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6">
      <FadeSection className="max-w-5xl mx-auto">
        <SectionHeading
          badge="Detection"
          title="56 MEP component types."
          subtitle="Classified by type, size, and material — automatically."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="rounded-xl bg-gray-900/80 border border-gray-800 p-6 hover:border-indigo-500/30 transition-colors"
            >
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-indigo-600/10 text-indigo-400 mb-4">
                {cat.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{cat.name}</h3>
              <p className="text-sm text-gray-400">{cat.items}</p>
            </div>
          ))}

          {/* Callout card */}
          <div className="rounded-xl bg-indigo-600/5 border border-indigo-500/20 p-6 flex flex-col justify-center">
            <Layers className="h-6 w-6 text-indigo-400 mb-3" />
            <p className="text-gray-300 text-sm leading-relaxed">
              <span className="font-semibold text-white">
                The plan says 4-inch copper.
              </span>{' '}
              Reality shows 3-inch PVC.{' '}
              <span className="text-indigo-400 font-medium">
                Only Survai catches this.
              </span>
            </p>
          </div>
        </div>
      </FadeSection>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION 5 — Comparison Table                                       */
/* ------------------------------------------------------------------ */

function ComparisonSection() {
  type CellValue = boolean | string;

  interface Row {
    feature: string;
    survai: CellValue;
    avvir: CellValue;
    openspace: CellValue;
    edgewise: CellValue;
  }

  const rows: Row[] = [
    {
      feature: 'ML MEP Classification',
      survai: true,
      avvir: false,
      openspace: false,
      edgewise: false,
    },
    {
      feature: 'iPad-native CAD',
      survai: true,
      avvir: false,
      openspace: false,
      edgewise: false,
    },
    {
      feature: 'Blueprint Deviation',
      survai: true,
      avvir: true,
      openspace: 'Limited',
      edgewise: false,
    },
    {
      feature: 'DXF Import/Export',
      survai: true,
      avvir: false,
      openspace: false,
      edgewise: 'Revit only',
    },
    {
      feature: 'No hardware required',
      survai: true,
      avvir: false,
      openspace: false,
      edgewise: false,
    },
    {
      feature: 'Offline mode',
      survai: true,
      avvir: false,
      openspace: false,
      edgewise: false,
    },
    {
      feature: 'Starting price',
      survai: '$49/mo',
      avvir: '$50K+/yr',
      openspace: '$15K+/yr',
      edgewise: '$8K+/yr',
    },
  ];

  const competitors = [
    { key: 'survai' as const, name: 'Survai', highlight: true },
    { key: 'avvir' as const, name: 'Avvir', highlight: false },
    { key: 'openspace' as const, name: 'OpenSpace', highlight: false },
    { key: 'edgewise' as const, name: 'EdgeWise', highlight: false },
  ];

  function renderCell(value: CellValue, isSurvai: boolean) {
    if (typeof value === 'string') {
      return (
        <span className={isSurvai ? 'font-semibold text-indigo-400' : 'text-gray-400 text-sm'}>
          {value}
        </span>
      );
    }
    return value ? (
      <Check className={`h-5 w-5 mx-auto ${isSurvai ? 'text-emerald-400' : 'text-emerald-600'}`} />
    ) : (
      <X className="h-5 w-5 mx-auto text-gray-700" />
    );
  }

  return (
    <section className="py-24 sm:py-32 px-6 bg-gray-900/50">
      <FadeSection className="max-w-5xl mx-auto">
        <SectionHeading
          badge="Compare"
          title="Enterprise capability. Startup price."
        />

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-4 pr-4 text-gray-500 font-medium">Feature</th>
                {competitors.map((c) => (
                  <th
                    key={c.key}
                    className={`py-4 px-3 text-center font-semibold ${
                      c.highlight ? 'text-indigo-400' : 'text-gray-500'
                    }`}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-b border-gray-800/50">
                  <td className="py-3.5 pr-4 text-gray-300">{row.feature}</td>
                  {competitors.map((c) => (
                    <td key={c.key} className="py-3.5 px-3 text-center">
                      {renderCell(row[c.key], c.highlight)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeSection>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION 6 — Pricing                                                */
/* ------------------------------------------------------------------ */

function PricingSection({ onStartTrial }: { onStartTrial: (tier: string) => void }) {
  const plans = [
    {
      name: 'Starter',
      price: 49,
      unit: '/mo',
      features: ['1 user', '5 projects', 'DXF import/export', 'Deviation reports', 'Email support'],
      highlighted: false,
    },
    {
      name: 'Pro',
      price: 99,
      unit: '/mo',
      features: [
        '1 user',
        'Unlimited projects',
        'ML classification',
        'Punch list PDF',
        'Priority support',
        'Offline mode',
      ],
      highlighted: true,
    },
    {
      name: 'Team',
      price: 79,
      unit: '/seat/mo',
      features: [
        'Unlimited users',
        'Unlimited projects',
        'Everything in Pro',
        'Admin dashboard',
        'SSO integration',
        'Dedicated onboarding',
      ],
      highlighted: false,
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6">
      <FadeSection className="max-w-5xl mx-auto">
        <SectionHeading
          badge="Pricing"
          title="Start small. Scale when ready."
          subtitle="Start with a 3-month pilot — $588 total for a 4-person team."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.highlighted
                  ? 'bg-indigo-600/5 border-indigo-500/40 shadow-lg shadow-indigo-600/10'
                  : 'bg-gray-900/80 border-gray-800'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                <span className="text-gray-500">{plan.unit}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onStartTrial(plan.name)}
                className={`mt-8 w-full rounded-lg py-3 text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/25'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                Start Free Trial
              </button>
            </div>
          ))}
        </div>
      </FadeSection>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION 7 — Footer                                                 */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-gray-800 py-12 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-500" />
          <span>
            Built by{' '}
            <a
              href="https://netrunsystems.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Netrun Systems
            </a>
          </span>
        </div>
        <div className="flex items-center gap-1">
          Questions?{' '}
          <a
            href="mailto:sales@netrunsystems.com"
            className="text-indigo-400 hover:text-indigo-300 transition-colors ml-1"
          >
            sales@netrunsystems.com
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-gray-300 transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-gray-300 transition-colors">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onTryDemo,
  onStartTrial,
}) => {
  return (
    <div className="min-h-screen bg-gray-950 text-white antialiased scroll-smooth">
      {/* Sticky nav hint */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Survai</span>
            <span className="text-xs text-gray-500 ml-1 hidden sm:inline">Construction</span>
          </div>
          <button
            onClick={onLaunchApp}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all"
          >
            Launch App
          </button>
        </div>
      </nav>

      <Hero onLaunchApp={onLaunchApp} onTryDemo={onTryDemo} />
      <ProblemSection />
      <HowItWorks />
      <DetectionSection />
      <ComparisonSection />
      <PricingSection onStartTrial={onStartTrial} />
      <Footer />
    </div>
  );
};
