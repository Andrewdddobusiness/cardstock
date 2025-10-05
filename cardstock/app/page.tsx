import Image from "next/image";
import Link from "next/link";

const FEATURED_CARDS = [
  {
    title: "Paldea Evolved",
    rarity: "Collector Booster",
    type: "Electric",
    accent: "from-cyan-400 via-sky-300 to-blue-500",
    ring: "bg-cyan-200/60",
    rotation: "sm:rotate-[-6deg]",
  },
  {
    title: "Obsidian Flames",
    rarity: "Elite Trainer Box",
    type: "Fire",
    accent: "from-orange-400 via-rose-300 to-red-500",
    ring: "bg-rose-200/60",
    rotation: "sm:-translate-y-3",
  },
  {
    title: "Scarlet & Violet",
    rarity: "Booster Display",
    type: "Psychic",
    accent: "from-fuchsia-400 via-purple-300 to-violet-500",
    ring: "bg-fuchsia-200/60",
    rotation: "sm:rotate-6",
  },
];

const CORE_FEATURES = [
  {
    headline: "Live Stock Radar",
    copy: "Cross-check inventory across Kmart, BIG W, EB Games, and more with a single glance.",
  },
  {
    headline: "Drop Alerts",
    copy: "Receive instant notifications the moment booster boxes reappear in-store or online.",
  },
  {
    headline: "Sydney-first Insights",
    copy: "Location-tuned availability heatmaps so you never drive to an empty shelf again.",
  },
];

const COVERAGE = [
  { store: "EB Games", focus: "Flagship + metro", status: "Same-day refresh" },
  { store: "BIG W", focus: "High-demand hubs", status: "Morning & closing scans" },
  { store: "Kmart", focus: "Sydney basin", status: "Hourly online sync" },
  { store: "Target", focus: "Pilot stores", status: "Beta feed" },
];

const FLOW = [
  {
    title: "Connect your hunt",
    detail: "Tell us what sets you are chasing and we auto-curate a personalised watchlist.",
  },
  {
    title: "Track in real time",
    detail: "CardStock surfaces stock swings, store-level availability, and restock patterns.",
  },
  {
    title: "Secure the drop",
    detail: "Set smart alerts and head straight to the retailer with confidence your box is waiting.",
  },
];

const COMMUNITY_CARDS = [
  [
    {
      title: "Charizard ex",
      set: "Obsidian Flames",
      rarity: "Ultra Rare",
      type: "Fire",
      accent: "from-orange-400 via-amber-300 to-rose-400",
    },
    {
      title: "Pikachu VMAX",
      set: "Celebrations",
      rarity: "Secret Rare",
      type: "Lightning",
      accent: "from-yellow-300 via-amber-200 to-amber-400",
    },
    {
      title: "Mewtwo VSTAR",
      set: "Crown Zenith",
      rarity: "Ultra Rare",
      type: "Psychic",
      accent: "from-purple-400 via-fuchsia-300 to-purple-500",
    },
    {
      title: "Umbreon Gold Star",
      set: "Evolving Skies",
      rarity: "Secret Rare",
      type: "Darkness",
      accent: "from-slate-600 via-slate-500 to-indigo-500",
    },
    {
      title: "Rayquaza VMAX",
      set: "Astral Radiance",
      rarity: "Chase",
      type: "Dragon",
      accent: "from-emerald-400 via-teal-300 to-sky-400",
    },
    {
      title: "Gardevoir ex",
      set: "Scarlet & Violet",
      rarity: "Double Rare",
      type: "Fairy",
      accent: "from-pink-300 via-rose-200 to-purple-300",
    },
  ],
  [
    {
      title: "Blastoise ex",
      set: "Celebrations",
      rarity: "Ultra Rare",
      type: "Water",
      accent: "from-sky-400 via-cyan-300 to-blue-500",
    },
    {
      title: "Snorlax VMAX",
      set: "Lost Origin",
      rarity: "Alt Art",
      type: "Colorless",
      accent: "from-slate-300 via-zinc-200 to-slate-400",
    },
    {
      title: "Sylveon V",
      set: "Evolving Skies",
      rarity: "Secret Rare",
      type: "Fairy",
      accent: "from-rose-300 via-pink-200 to-violet-300",
    },
    {
      title: "Lucario VSTAR",
      set: "Brilliant Stars",
      rarity: "Promo",
      type: "Fighting",
      accent: "from-amber-400 via-orange-300 to-red-400",
    },
    {
      title: "Miraidon ex",
      set: "Scarlet & Violet",
      rarity: "Illustration",
      type: "Electric",
      accent: "from-indigo-400 via-purple-300 to-blue-400",
    },
    {
      title: "Giratina VSTAR",
      set: "Lost Origin",
      rarity: "Alternate",
      type: "Dragon",
      accent: "from-amber-500 via-rose-400 to-indigo-500",
    },
  ],
];

const CURRENT_YEAR = new Date().getFullYear();

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-[-8rem] flex justify-center blur-3xl">
        <div className="h-64 w-[38rem] bg-gradient-to-br from-sky-200 via-indigo-100 to-rose-200 opacity-80" />
      </div>

      <div className="relative px-6 pb-24 pt-10 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <nav className="flex items-center justify-between rounded-full border border-neutral-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="CardStock" width={36} height={36} className="h-9 w-9" />
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">CardStock</p>
                <p className="text-base font-semibold text-neutral-900">Sydney Pokémon Radar</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium">
              <Link href="/login" className="rounded-full border border-neutral-300 px-4 py-2 transition hover:border-neutral-400 hover:text-neutral-900">
                Login
              </Link>
              <Link href="/register" className="rounded-full bg-neutral-900 px-5 py-2 text-white transition hover:bg-neutral-800">
                Get Started
              </Link>
            </div>
          </nav>

        <section className="mt-20 grid items-center gap-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.4em] text-neutral-500 shadow-sm">
              <span className="font-semibold text-neutral-900">New</span>
              <span>Full Sydney coverage</span>
            </div>
            <div className="space-y-5">
              <h1 className="text-4xl font-semibold leading-[1.05] text-neutral-900 sm:text-5xl">
                A professional command center for Pokémon card chasers in Sydney.
              </h1>
              <p className="max-w-xl text-lg text-neutral-600">
                Monitor high-demand booster boxes, elite trainer kits, and exclusive sets across Australia&apos;s biggest retailers.
                CardStock keeps you informed, fast, and first in line.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/register" className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110">
                Create my watchlist
              </Link>
              <Link href="/login" className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400">
                Explore dashboard
              </Link>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">15 retailers · hourly refresh</p>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-slate-100 via-white to-slate-100" />
            <div className="relative flex h-full w-full max-w-md flex-col items-center gap-4 rounded-[2.5rem] border border-neutral-200 bg-white px-8 py-10 shadow-xl shadow-indigo-100/50">
              <div className="flex w-full justify-between text-xs uppercase tracking-[0.35em] text-neutral-400">
                <span>Live Watchlist</span>
                <span>07:45</span>
              </div>
              <div className="relative flex w-full justify-center">
                {FEATURED_CARDS.map((card, index) => (
                  <div
                    key={card.title}
                    className={`relative -ml-12 first:ml-0 h-44 w-32 origin-bottom rounded-3xl border border-white/70 bg-gradient-to-br ${card.accent} p-4 text-white shadow-lg shadow-neutral-400/30 transition duration-500 ${card.rotation}`}
                    style={{ zIndex: FEATURED_CARDS.length - index }}
                  >
                    <div className={`absolute inset-1 rounded-[1.4rem] ${card.ring}`} />
                    <div className="relative flex h-full flex-col justify-between">
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-widest text-white/70">{card.rarity}</p>
                        <h3 className="mt-2 text-base font-semibold leading-tight">{card.title}</h3>
                      </div>
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.4em] text-white/60">Type</p>
                        <p className="text-sm font-semibold">{card.type}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 w-full space-y-4 text-left">
                <div className="flex items-center justify-between rounded-2xl bg-neutral-900 px-6 py-4 text-white">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">Next restock</p>
                    <p className="text-lg font-semibold">Parramatta EB Games</p>
                  </div>
                  <span className="text-sm font-semibold">ETA 28 mins</span>
                </div>
                <div className="grid gap-3 text-sm text-neutral-600">
                  <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-5 py-3">
                    <span className="font-medium text-neutral-800">BIG W Auburn</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">In stock</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-5 py-3">
                    <span className="font-medium text-neutral-800">Kmart Broadway</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-600">Low stock</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-5 py-3">
                    <span className="font-medium text-neutral-800">Target Rhodes</span>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600">Watchlist</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map((feature) => (
            <article key={feature.headline} className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="absolute inset-x-8 top-8 h-1 bg-gradient-to-r from-sky-400/50 to-indigo-400/60 group-hover:from-sky-500 group-hover:to-indigo-500" />
              <h3 className="mt-8 text-xl font-semibold text-neutral-900">{feature.headline}</h3>
              <p className="mt-4 text-sm text-neutral-600">{feature.copy}</p>
            </article>
          ))}
        </section>

        <section className="mt-24 rounded-[2.5rem] border border-neutral-200 bg-neutral-50/60 p-10">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-6">
              <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Retail network</p>
              <h2 className="text-3xl font-semibold text-neutral-900">Every major Sydney retailer, one live feed.</h2>
              <p className="text-sm text-neutral-600">
                CardStock merges store scanners, online catalogues, and community pulses to surface availability with professional confidence.
                No screenshots, no guesswork, just verified signals that help you secure every drop.
              </p>
            </div>
            <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
              {COVERAGE.map((row) => (
                <div key={row.store} className="rounded-3xl border border-white bg-white/70 p-6 shadow-sm backdrop-blur">
                  <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">{row.status}</p>
                  <h3 className="mt-2 text-xl font-semibold text-neutral-900">{row.store}</h3>
                  <p className="mt-3 text-sm text-neutral-600">{row.focus}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        </div>

        <section className="mt-28 -mx-6 sm:-mx-10">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-gradient-to-b from-white via-slate-50 to-white px-6 py-16 shadow-sm sm:px-12">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-sky-100/70 via-white/0 to-transparent blur-3xl" />
            <div className="pointer-events-none absolute inset-y-10 left-[-10rem] hidden w-56 rounded-full bg-gradient-to-br from-indigo-100 via-slate-100 to-pink-100 blur-3xl md:block" />
            <div className="pointer-events-none absolute inset-y-14 right-[-9rem] hidden w-48 rounded-full bg-gradient-to-tr from-cyan-100 via-slate-100 to-amber-100 blur-3xl md:block" />

            <div className="relative flex flex-wrap justify-center gap-6 pb-14">
              {COMMUNITY_CARDS[0].map((card) => (
                <div
                  key={card.title}
                  className={`group relative h-28 w-24 rounded-[1.9rem] bg-gradient-to-br ${card.accent} p-[2px] shadow-lg shadow-indigo-100/60 transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:h-32 sm:w-28`}
                >
                  <div className="flex h-full w-full flex-col justify-between rounded-[1.6rem] bg-white/15 p-3 text-white backdrop-blur-[2px]">
                    <span className="text-[0.55rem] uppercase tracking-[0.35em] text-white/70">{card.set}</span>
                    <div>
                      <p className="text-sm font-semibold leading-tight sm:text-base">{card.title}</p>
                      <p className="mt-1 text-[0.58rem] uppercase tracking-[0.35em] text-white/60">{card.rarity}</p>
                    </div>
                    <span className="self-start rounded-full bg-white/20 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-white">
                      {card.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">Trainer network</p>
              <h2 className="mt-4 text-3xl font-semibold text-neutral-900 sm:text-[2.6rem]">
                Your next chase card is already on the table.
              </h2>
              <p className="mt-4 text-sm text-neutral-600">
                Full-art pulls, graded grails, and sealed breaks shared daily by the CardStock community. Trade, swap, and secure the cards you live for.
              </p>
            </div>

            <div className="relative mt-12 flex flex-wrap justify-center gap-6">
              {COMMUNITY_CARDS[1].map((card) => (
                <div
                  key={card.title}
                  className={`group relative h-28 w-24 rounded-[1.9rem] bg-gradient-to-br ${card.accent} p-[2px] shadow-lg shadow-rose-100/50 transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:h-32 sm:w-28`}
                >
                  <div className="flex h-full w-full flex-col justify-between rounded-[1.6rem] bg-white/15 p-3 text-white backdrop-blur-[2px]">
                    <span className="text-[0.55rem] uppercase tracking-[0.35em] text-white/70">{card.set}</span>
                    <div>
                      <p className="text-sm font-semibold leading-tight sm:text-base">{card.title}</p>
                      <p className="mt-1 text-[0.58rem] uppercase tracking-[0.35em] text-white/60">{card.rarity}</p>
                    </div>
                    <span className="self-start rounded-full bg-white/20 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-white">
                      {card.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl">
          <section className="mt-24 grid gap-10 rounded-[2.5rem] border border-neutral-200 bg-white p-10 shadow-sm lg:grid-cols-[0.4fr_0.6fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Workflow</p>
              <h2 className="text-3xl font-semibold text-neutral-900">From hunt to hand secured.</h2>
              <p className="text-sm text-neutral-600">Designed with collectors, store associates, and resellers to remove friction at every stage.</p>
            </div>
            <div className="space-y-6">
              {FLOW.map((item, index) => (
                <div key={item.title} className="flex gap-6">
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 font-semibold text-neutral-800">
                    {(index + 1).toString().padStart(2, "0")}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-neutral-900">{item.title}</h3>
                    <p className="text-sm text-neutral-600">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-24 flex flex-col items-center gap-6 rounded-[2.5rem] border border-neutral-200 bg-gradient-to-br from-white via-slate-50 to-white p-10 text-center shadow-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Ready when you are</p>
            <h2 className="max-w-3xl text-3xl font-semibold text-neutral-900 sm:text-4xl">
              Join Sydney&apos;s most informed Pokémon collectors and never miss another launch.
            </h2>
            <p className="max-w-2xl text-sm text-neutral-600">
              Instant setup · Custom alerts · Exportable insights for your collecting group.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/register" className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800">
                Start tracking today
              </Link>
              <Link href="/login" className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400">
                View demo account
              </Link>
            </div>
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">No card data sold · Cancel anytime</p>
          </section>

          <footer className="mt-20 flex flex-col gap-4 border-t border-neutral-200 pt-8 text-xs uppercase tracking-[0.3em] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
            <span>© {CURRENT_YEAR} CardStock. Built in Sydney.</span>
            <div className="flex gap-4">
              <Link href="/login" className="transition hover:text-neutral-600">
                Dashboard
              </Link>
              <Link href="/register" className="transition hover:text-neutral-600">
                Join
              </Link>
              <a href="mailto:hello@cardstock.app" className="transition hover:text-neutral-600">
                Contact
              </a>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
