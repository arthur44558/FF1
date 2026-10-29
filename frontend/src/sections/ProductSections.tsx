import {
  AlarmClock,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  FileText,
  FlaskConical,
  History,
  Layers3,
  ListTodo,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import SectionHeading from "../components/SectionHeading";

const bottlenecks = [
  { title: "Missed Follow-Ups", description: "The next check-in slips past when reminders live in someone’s head or on a paper note.", icon: AlarmClock, accent: "bg-[#fff0ec] text-[#b95c49]" },
  { title: "Pending Reports", description: "Lab results arrive, but there’s no clear signal for what still needs a clinician’s review.", icon: FileClock, accent: "bg-[#fff5e6] text-[#a97829]" },
  { title: "Scattered Information", description: "Appointments, tests, and patient notes sit across different tools and handoffs.", icon: Layers3, accent: "bg-[#eaf4fb] text-[#3f80a6]" },
  { title: "Manual Tracking", description: "Staff spend valuable time chasing status instead of supporting the next step in care.", icon: ListTodo, accent: "bg-[#f0eef9] text-[#7567a4]" },
];

const features = [
  { title: "Doctor Appointments", description: "Keep upcoming visits and the context around them together.", icon: Stethoscope },
  { title: "Lab Tests", description: "Track expected tests and see when results need attention.", icon: FlaskConical },
  { title: "Medical Reports", description: "Bring incoming reports into a clear review workflow.", icon: FileText },
  { title: "Patient Follow-Ups", description: "Make the next check-in visible, assigned, and easier to complete.", icon: ClipboardCheck },
  { title: "Reminders", description: "Surface due and overdue tasks before they get lost in the day.", icon: BellRing },
  { title: "Patient History", description: "Follow the care journey with useful activity in one timeline.", icon: History },
];

const notices = [
  { priority: "Overdue follow-ups", description: "A scheduled patient check-in has passed its due date.", example: "2 follow-ups need a next step", when: "Act now", tone: "bg-[#fff0ec] text-[#b65343]", icon: Clock3 },
  { priority: "Pending reports", description: "A lab report is in and waiting for clinical review.", example: "3 reports awaiting review", when: "Review", tone: "bg-[#fff5e6] text-[#95651f]", icon: FileText },
  { priority: "Expected lab tests", description: "A planned test is approaching or still needs a result.", example: "4 tests expected this week", when: "Track", tone: "bg-[#eaf4fb] text-[#347ba1]", icon: FlaskConical },
];

export default function ProductSections() {
  return (
    <>
      <section className="border-y border-[#e3ecf4] bg-white py-[76px] sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 xl:px-10">
          <SectionHeading eyebrow="The follow-through gap" title="Healthcare Follow-Up Shouldn't Depend on Memory." description="When care continues after the appointment, small handoff gaps can turn into missed steps. CareTrack brings the work back into view." />
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
            {bottlenecks.map(({ title, description, icon: Icon, accent }, index) => (
              <article key={title} className="group rounded-[20px] border border-[#e2ebf3] bg-[#ffffff] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#c4dceb] hover:bg-white hover:shadow-lg sm:p-6" style={{ animationDelay: `${index * 60}ms` }}>
                <span className={`mb-7 grid size-11 place-items-center rounded-[14px] ${accent}`}><Icon className="size-5" strokeWidth={1.8} /></span>
                <h3 className="text-[16px] font-bold tracking-[-0.03em] text-[#244c71]">{title}</h3>
                <p className="mt-2.5 text-[13px] leading-6 text-[#74899d]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#eef5fb] py-[78px] sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 xl:px-10">
          <SectionHeading eyebrow="Everything in one place" title="One System. Every Follow-Up." description="The pieces of a care journey belong together. Give your team one clear view from the first appointment through the final follow-up." />
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <article key={title} className="group relative overflow-hidden rounded-[20px] border border-[#e2ebf3] bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[#bbd7d1] hover:shadow-[0_18px_40px_-30px_rgba(12,75,128,.24)] sm:p-6">
                <span className="mb-6 grid size-11 place-items-center rounded-[14px] bg-[#eaf6f5] text-[#0c4b80] transition group-hover:bg-[#0c4b80] group-hover:text-white"><Icon className="size-[19px]" strokeWidth={1.8} /></span>
                <h3 className="text-[16px] font-bold tracking-[-0.03em] text-[#244c71]">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#74899d]">{description}</p>
                <span className="absolute -right-3 -top-3 size-20 rounded-full border border-[#edf4fa] transition group-hover:scale-125" aria-hidden="true" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-[76px] sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 xl:px-10">
          <div className="grid items-end gap-6 lg:grid-cols-[1fr_0.6fr]">
            <SectionHeading align="left" eyebrow="Built around what needs attention" title="Always Know What Needs Attention." description="Turn the quiet signals in a busy day into a shared, actionable view—without digging through separate lists." />
            <div className="flex items-center gap-3 rounded-2xl border border-[#dce7f0] bg-[#f5faff] p-4 lg:mb-1 lg:max-w-[310px]">
              <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-white text-[#0c4b80] shadow-sm"><CheckCircle2 className="size-5" /></span>
              <p className="text-xs leading-5 text-[#667774]">Priority cues help your team see the next step at a glance.</p>
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-[22px] border border-[#e2ebf3] bg-white shadow-[0_14px_42px_-32px_rgba(24,63,63,.28)]">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#e4edf4] bg-[#f7faff] px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#8295a8] sm:grid-cols-[1fr_1.3fr_1.05fr_auto] sm:px-6">
              <span>Signal</span><span className="hidden sm:block">What it means</span><span className="hidden sm:block">Example</span><span className="text-right">Next step</span>
            </div>
            <div className="divide-y divide-[#eaf0f6]">
              {notices.map(({ priority, description, example, when, tone, icon: Icon }) => (
                <div key={priority} className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 sm:grid-cols-[1fr_1.3fr_1.05fr_auto] sm:px-6 sm:py-[18px]">
                  <div className="flex min-w-0 items-center gap-2.5"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-4" /></span><span className="text-[12px] font-bold text-[#334a48] sm:text-[13px]">{priority}</span></div>
                  <p className="hidden text-[12px] leading-5 text-[#768a9e] sm:block">{description}</p>
                  <p className="hidden text-[11px] font-medium text-[#5d706d] sm:block">{example}</p>
                  <span className={`justify-self-end rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{when}</span>
                  <p className="col-span-2 -mt-2 pl-[46px] text-[11px] leading-5 text-[#8295a8] sm:hidden">{description} <span className="font-semibold text-[#61726f]">{example}</span></p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-[#eaf0f6] bg-[#f8fbff] px-4 py-3 text-[10px] text-[#8497a9] sm:px-6"><UsersRound className="size-3.5 text-[#78918c]" /> A shared overview for the people moving care forward <CalendarCheck2 className="ml-auto size-3.5 text-[#78918c]" /></div>
          </div>
        </div>
      </section>
    </>
  );
}
