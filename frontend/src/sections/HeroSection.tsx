import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FlaskConical,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { BrandMark } from "../components/SiteHeader";

const stats = [
  { label: "Appointments", value: "8", icon: CalendarCheck2, note: "on today's schedule", tone: "text-[#0c4b80] bg-[#e7f2ef]" },
  { label: "Reports Awaiting Review", value: "3", icon: FileCheck2, note: "awaiting review", tone: "text-[#25aea8] bg-[#e8f4fb]" },
  { label: "Follow-Ups Due", value: "5", icon: Clock3, note: "today and tomorrow", tone: "text-[#9c6b1c] bg-[#fbf1de]" },
  { label: "Overdue Tasks", value: "2", icon: Activity, note: "need your attention", tone: "text-[#bd5c48] bg-[#faece8]" },
];

const attentionItems = [
  { name: "Maya Chen", detail: "CBC panel · 2 days overdue", initials: "MC", badge: "Overdue", badgeClass: "bg-[#fff0ec] text-[#b94e3d]", dot: "bg-[#d66a55]", icon: FlaskConical },
  { name: "Daniel Brooks", detail: "Discharge follow-up · due today", initials: "DB", badge: "Due today", badgeClass: "bg-[#fff6e7] text-[#95611c]", dot: "bg-[#d39b42]", icon: UserRound },
  { name: "Priya Shah", detail: "Pathology report · reviewed 9:12 AM", initials: "PS", badge: "Reviewed", badgeClass: "bg-[#eaf5f1] text-[#327566]", dot: "bg-[#59a38b]", icon: CheckCircle2 },
];

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[650px] animate-rise-delay">
      <div className="absolute -inset-5 rounded-[36px] bg-[#cfe3df]/45 blur-2xl" aria-hidden="true" />
      <div className="panel-shadow relative overflow-hidden rounded-[24px] border border-[#dfe8f1] bg-white sm:rounded-[30px]">
        <div className="flex items-center justify-between border-b border-[#eaf0f6] px-4 py-4 sm:px-6 sm:py-[18px]">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark compact />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold tracking-[-0.02em] text-[#183d63] sm:text-sm">CareTrack workspace</p>
              <p className="mt-0.5 text-[10px] text-[#8497a9] sm:text-[11px]">Clinical follow-up overview</p>
            </div>
          </div>
          <span className="rounded-full border border-[#e0ece8] bg-[#f5faff] px-2.5 py-1.5 text-[9px] font-semibold text-[#71817d] sm:text-[10px]">SAMPLE DATA</span>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b9996]">Tuesday · Today</p>
              <h2 className="mt-1 text-[18px] font-bold tracking-[-0.04em] text-[#183d63] sm:text-[21px]">Today's Overview</h2>
            </div>
            <div className="hidden items-center gap-1.5 rounded-lg border border-[#e7efec] px-2.5 py-2 text-[10px] font-medium text-[#627371] sm:flex"><CalendarCheck2 className="size-3.5 text-[#0c4b80]" /> Oct 27, 2026</div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {stats.map(({ label, value, icon: Icon, note, tone }) => (
              <div key={label} className="rounded-[14px] border border-[#e4edf4] bg-[#ffffff] p-3 sm:rounded-[17px] sm:p-3.5">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[9px] font-semibold leading-4 text-[#788ca0] sm:text-[10px]">{label}</span>
                  <span className={`grid size-7 place-items-center rounded-[9px] ${tone}`}><Icon className="size-[14px]" strokeWidth={1.8} /></span>
                </div>
                <p className="mt-1.5 text-[24px] font-bold leading-none tracking-[-0.05em] text-[#183d63] sm:text-[28px]">{value}</p>
                <p className="mt-1.5 text-[9px] text-[#8a9996] sm:text-[10px]">{note}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-[17px] border border-[#e4edf4]">
            <div className="flex items-center justify-between border-b border-[#eaf0f6] bg-[#f8fbff] px-3.5 py-3 sm:px-4">
              <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[#d66a55]" /><h3 className="text-[11px] font-bold text-[#314746] sm:text-xs">Needs Attention</h3></div>
              <span className="rounded-full bg-[#fff0ec] px-2 py-1 text-[9px] font-bold text-[#b94e3d]">3 items</span>
            </div>
            <div className="divide-y divide-[#eaf0f6]">
              {attentionItems.map(({ name, detail, initials, badge, badgeClass, dot, icon: Icon }) => (
                <div key={name} className="flex items-center gap-2.5 px-3.5 py-3 sm:gap-3 sm:px-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eff4f2] text-[9px] font-bold text-[#58706c]">{initials}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><Icon className="size-3.5 shrink-0 text-[#82928e]" /><p className="truncate text-[10px] font-semibold text-[#344847] sm:text-[11px]">{name}</p></div>
                    <p className="mt-0.5 truncate text-[9px] text-[#8295a8] sm:text-[10px]">{detail}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[8px] font-bold sm:text-[9px] ${badgeClass}`}><span className={`size-1 rounded-full ${dot}`} />{badge}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] bg-[#edf5fb] px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#0c4b80]"><Check className="size-4" /></span><div className="min-w-0"><p className="text-[10px] font-bold text-[#45627f]">A clearer care pathway</p><p className="mt-0.5 text-[9px] text-[#7b8a87]">Every next step, easy to see</p></div></div>
            <div className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#0c4b80]"><span className="hidden sm:inline">View workflow</span><ArrowRight className="size-3.5" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HeroSectionProps {
  onGetStarted?: () => void;
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section id="home" className="hero-glow relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-[76px] lg:pb-24 lg:pt-[88px]">
      <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[570px] opacity-60" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10 xl:px-10">
        <div className="animate-rise max-w-[590px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cce4e5] bg-white/80 px-3.5 py-2 text-[11px] font-semibold text-[#39737f] shadow-sm backdrop-blur">
            <span className="grid size-5 place-items-center rounded-full bg-[#e5f5f4] text-[#0c4b80]"><ShieldCheck className="size-3.5" /></span>
            One place for appointments, reports &amp; follow-ups.
          </div>
          <h1 className="text-balance text-[clamp(42px,5.2vw,68px)] font-bold leading-[0.99] tracking-[-0.065em] text-[#183d63]">Never Miss a Patient Follow-Up Again.</h1>
          <p className="mt-6 max-w-[520px] text-pretty text-[16px] leading-7 text-[#667c91] sm:text-[17px] sm:leading-[1.8]">CareTrack brings doctor appointments, lab tests, reports, and post-discharge follow-ups into one simple clinical workflow—so every next step is easier to see and act on.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {onGetStarted ? (
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 rounded-full bg-[#c94e08] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(201,78,8,.42)] transition hover:-translate-y-0.5 hover:bg-[#b84600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25aea8]"
              >
                Get Started <ArrowRight className="size-4" />
              </button>
            ) : (
              <a href="#contact" className="inline-flex items-center gap-2 rounded-full bg-[#c94e08] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(201,78,8,.42)] transition hover:-translate-y-0.5 hover:bg-[#b84600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25aea8]">Get Started <ArrowRight className="size-4" /></a>
            )}
            <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-[#d9e5ef] bg-white/75 px-5 py-3.5 text-sm font-semibold text-[#456c86] transition hover:border-[#a9cce1] hover:bg-white">See How It Works <ArrowRight className="size-4" /></a>
          </div>
          <div className="mt-8 flex items-center gap-3 text-xs text-[#74899d]">
            <span className="flex -space-x-2"><span className="grid size-7 place-items-center rounded-full border-2 border-[#eef5fb] bg-[#dcecf7] text-[9px] font-bold text-[#416b88]">A</span><span className="grid size-7 place-items-center rounded-full border-2 border-[#eef5fb] bg-[#e8e4d8] text-[9px] font-bold text-[#766548]">C</span><span className="grid size-7 place-items-center rounded-full border-2 border-[#eef5fb] bg-[#dceaf5] text-[9px] font-bold text-[#45708b]">R</span></span>
            <span>Designed for the details that keep care moving.</span>
          </div>
        </div>
        <DashboardPreview />
      </div>
    </section>
  );
}
