import { ArrowRight, HeartHandshake, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { BrandMark } from "../components/SiteHeader";
import SectionHeading from "../components/SectionHeading";

interface AboutFooterProps {
  onFeedback: () => void;
  onGetStarted?: () => void;
}

const footerGroups = [
  { title: "Product", links: [{ label: "Doctor Appointments", href: "#features" }, { label: "Lab Tests", href: "#features" }, { label: "Patient Follow-Ups", href: "#features" }, { label: "How It Works", href: "#how-it-works" }] },
  { title: "Company", links: [{ label: "About CareTrack", href: "#about" }, { label: "Our Approach", href: "#about" }, { label: "Contact", href: "#contact" }] },
  { title: "Support", links: [{ label: "Share Feedback", action: true }, { label: "Workflow guidance" }, { label: "Get in Touch", href: "#contact" }] },
  { title: "Legal", links: [{ label: "Privacy" }, { label: "Terms of Use" }, { label: "Accessibility" }] },
];

export default function AboutFooter({ onFeedback, onGetStarted }: AboutFooterProps) {
  return (
    <>
      <section id="about" className="bg-white py-[76px] sm:py-24">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 xl:px-10">
          <div className="relative min-h-[260px] overflow-hidden rounded-[25px] bg-[#eaf4fb] p-6 sm:min-h-[320px] sm:p-8">
            <div className="absolute -bottom-20 -left-12 size-64 rounded-full border border-[#b6d3cb]/70" aria-hidden="true" />
            <div className="absolute -bottom-12 -left-4 size-48 rounded-full border border-[#b6d3cb]/70" aria-hidden="true" />
            <div className="absolute -right-14 -top-14 size-52 rounded-full bg-[#dcecf7]" aria-hidden="true" />
            <div className="relative flex h-full min-h-[210px] flex-col justify-between sm:min-h-[256px]">
              <span className="grid size-14 place-items-center rounded-[18px] bg-[#0c4b80] text-white shadow-lg"><HeartHandshake className="size-7" strokeWidth={1.6} /></span>
              <div>
                <p className="max-w-[370px] text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[#2b5876] sm:text-[32px]">Better visibility for the work that happens between visits.</p>
                <div className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-[#4d736e]"><ShieldCheck className="size-4" /> Built around clinical follow-through</div>
              </div>
            </div>
          </div>
          <div>
            <SectionHeading align="left" eyebrow="About CareTrack" title="Healthcare Operations, Simplified." description="CareTrack brings the moving parts of clinical follow-up into a calmer, more connected workflow. By making appointments, reports, and next steps easier to see, teams can stay focused on reliable follow-through, patient safety, and operational clarity." />
            <a href="#contact" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#0c4b80] transition hover:gap-3">See how it can work for your team <ArrowRight className="size-4" /></a>
          </div>
        </div>
      </section>

      <section id="contact" className="px-5 pb-14 sm:px-8 sm:pb-16 xl:px-10">
        <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[27px] bg-[#0b487c] px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
          <div className="absolute -right-12 -top-28 size-[350px] rounded-full border border-white/[0.09]" aria-hidden="true" />
          <div className="absolute -right-2 -top-20 size-[240px] rounded-full border border-white/[0.09]" aria-hidden="true" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[640px]">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9d9d2]">A better next step starts here</p>
              <h2 className="text-balance text-[clamp(30px,4vw,44px)] font-bold leading-[1.05] tracking-[-0.055em]">Make Every Follow-Up Count.</h2>
              <p className="mt-3 max-w-[510px] text-sm leading-6 text-[#d3e3df]">Bring appointments, reports, and follow-ups into clearer view for the people who make care happen.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              {onGetStarted ? (
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-2 rounded-full bg-[#c94e08] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#b84600]"
                >
                  Get Started <ArrowRight className="size-4" />
                </button>
              ) : (
                <a href="#home" className="inline-flex items-center gap-2 rounded-full bg-[#c94e08] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#b84600]">Get Started <ArrowRight className="size-4" /></a>
              )}
              <button onClick={onFeedback} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><MessageSquareText className="size-4" /> Share Feedback</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e2ebf3] bg-[#f7faff]">
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 sm:py-14 xl:px-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:gap-8">
            <div className="max-w-[270px]">
              <a href="#home" className="inline-flex items-center gap-3" aria-label="CareTrack home"><BrandMark compact /><span className="text-[18px] font-bold tracking-[-0.04em] text-[#183d63]">CareTrack</span></a>
              <p className="mt-4 text-[12px] leading-6 text-[#768a9e]">Healthcare follow-up and tracking, brought into one clear workflow.</p>
              <button onClick={onFeedback} className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-[#0c4b80] hover:text-[#25aea8]"><Mail className="size-3.5" /> We value your perspective</button>
            </div>
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.13em] text-[#416b88]">{group.title}</h3>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>{"action" in link ? <button onClick={onFeedback} className="text-left text-[12px] text-[#788da1] transition hover:text-[#0c4b80]">{link.label}</button> : "href" in link ? <a href={link.href} className="text-[12px] text-[#788da1] transition hover:text-[#0c4b80]">{link.label}</a> : <span className="text-[12px] text-[#788da1]">{link.label}</span>}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-[#e5edf4] pt-5 text-[10px] text-[#8497a9] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 CareTrack. All rights reserved.</p>
            <p className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-[#6a938a]" /> Thoughtful follow-through for connected care.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
