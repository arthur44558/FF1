import {
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FlaskConical,
  HeartPulse,
  MessageCircleMore,
  Stethoscope,
} from "lucide-react";
import SectionHeading from "../components/SectionHeading";

const stages = [
  { number: "01", title: "Schedule", description: "Set the next appointment", icon: CalendarCheck2 },
  { number: "02", title: "Track", description: "Keep tests in view", icon: FlaskConical },
  { number: "03", title: "Follow Up", description: "Review and check in", icon: MessageCircleMore },
  { number: "04", title: "Complete", description: "Close the care loop", icon: CheckCircle2 },
];

const carePath = [
  { label: "Appointment", icon: Stethoscope },
  { label: "Test", icon: FlaskConical },
  { label: "Report", icon: FileCheck2 },
  { label: "Review", icon: ClipboardCheck },
  { label: "Follow-Up", icon: MessageCircleMore },
  { label: "Completed", icon: Check },
];

const timeline = [
  { time: "09:00 AM", label: "Appointment scheduled", note: "Primary care · Dr. Rivera", icon: CalendarCheck2, state: "done" },
  { time: "10:30 AM", label: "Lab test expected", note: "Complete blood count", icon: FlaskConical, state: "done" },
  { time: "01:15 PM", label: "Report ready for review", note: "Results added to the care record", icon: FileCheck2, state: "active" },
  { time: "Next step", label: "Patient follow-up due", note: "Check in after review", icon: MessageCircleMore, state: "upcoming" },
];

const benefits = [
  { title: "Stay Organized", description: "Keep the details and next actions connected to the care journey.", icon: CalendarCheck2 },
  { title: "Reduce Missed Tasks", description: "See upcoming and overdue follow-ups before the day gets away.", icon: CheckCircle2 },
  { title: "Save Staff Time", description: "Spend less time chasing status across separate lists and handoffs.", icon: HeartPulse },
  { title: "Improve Visibility", description: "Give the team a shared view of what is done and what comes next.", icon: ClipboardCheck },
];

export default function WorkflowSection() {
  return (
    <>
      <section id="how-it-works" className="border-y border-[#e3ecf4] bg-[#eff5fb] py-[78px] sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 xl:px-10">
          <SectionHeading eyebrow="How CareTrack works" title="A Clear Path from Visit to Follow-Up." description="One connected workflow helps your team move from the first appointment to the next right step." />
          <div className="relative mt-12 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
            <div className="absolute left-[12%] right-[12%] top-[27px] hidden h-px bg-[#d3e3df] lg:block" aria-hidden="true" />
            {stages.map(({ number, title, description, icon: Icon }) => (
              <article key={number} className="relative rounded-[20px] border border-[#e2ebf3] bg-white p-5 shadow-[0_10px_26px_-26px_rgba(35,82,78,.4)] sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="relative z-10 grid size-[54px] place-items-center rounded-[17px] border border-[#dce7f0] bg-white text-[#0c4b80] shadow-sm"><Icon className="size-[22px]" strokeWidth={1.8} /></span>
                  <span className="text-[11px] font-bold tracking-[0.14em] text-[#9aaba7]">{number}</span>
                </div>
                <h3 className="mt-5 text-[18px] font-bold tracking-[-0.04em] text-[#244c71]">{title}</h3>
                <p className="mt-1.5 text-[13px] text-[#788da1]">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[20px] border border-[#d8e5f0] bg-white p-4 sm:p-5">
            <p className="mb-4 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#81918e]">One continuous clinical flow</p>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3">
              {carePath.map(({ label, icon: Icon }, index) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`flex items-center gap-2 rounded-full px-2.5 py-2 text-[10px] font-semibold sm:px-3 sm:text-[11px] ${index === 5 ? "bg-[#e5f5f4] text-[#0c4b80]" : "bg-[#eff5fb] text-[#526764]"}`}><Icon className="size-3.5" />{label}</span>
                  {index < carePath.length - 1 && <ArrowRight className="hidden size-3.5 text-[#adbfbb] md:block" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-[78px] sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 xl:px-10">
          <SectionHeading eyebrow="Feature showcase" title="From Appointment to Follow-Up — Nothing Gets Lost." description="Connect the small but important moments into one continuous clinical workflow." />

          <div className="mt-12 grid overflow-hidden rounded-[26px] border border-[#dce7f0] bg-[#f7faff] lg:mt-14 lg:grid-cols-[1.04fr_0.96fr]">
            <div className="p-5 sm:p-8 lg:p-10">
              <div className="mb-6 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#25aea8]">Patient-care timeline</p><h3 className="mt-1.5 text-[19px] font-bold tracking-[-0.04em] text-[#244c71]">Every step, connected</h3></div>
                <span className="grid size-10 place-items-center rounded-[13px] border border-[#d9e5ef] bg-white text-[#0c4b80]"><HeartPulse className="size-5" /></span>
              </div>
              <div className="rounded-[19px] border border-[#e3edf4] bg-white p-4 sm:p-5">
                {timeline.map(({ time, label, note, icon: Icon, state }, index) => (
                  <div key={label} className="relative flex gap-3.5 pb-5 last:pb-0">
                    {index < timeline.length - 1 && <span className="absolute bottom-0 left-[16px] top-[35px] w-px bg-[#d9e5ef]" aria-hidden="true" />}
                    <span className={`relative z-10 grid size-[33px] shrink-0 place-items-center rounded-full ${state === "done" ? "bg-[#e5f5f4] text-[#0c4b80]" : state === "active" ? "bg-[#e9f4fb] text-[#25aea8]" : "border border-dashed border-[#cddbd7] bg-white text-[#91a09d]"}`}>
                      <Icon className="size-[15px]" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><p className="text-[12px] font-bold text-[#3c5250]">{label}</p><span className="text-[10px] font-medium text-[#8b9996]">{time}</span></div>
                      <p className="mt-1 text-[10px] leading-5 text-[#7b8986]">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden bg-[#0b487c] p-6 text-white sm:p-9 lg:p-10">
              <div className="absolute -right-20 -top-20 size-64 rounded-full border border-white/10" aria-hidden="true" />
              <div className="absolute -right-8 -top-8 size-40 rounded-full border border-white/10" aria-hidden="true" />
              <div className="relative flex h-full flex-col justify-center">
                <span className="mb-6 grid size-11 place-items-center rounded-[14px] border border-white/15 bg-white/10 text-[#c9e5de]"><HeartPulse className="size-5" /></span>
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#b7d6d0]">One continuous workflow</p>
                <h3 className="mt-3 max-w-[430px] text-[29px] font-semibold leading-[1.12] tracking-[-0.045em] sm:text-[35px]">Care doesn’t stop at the appointment. Neither should the workflow.</h3>
                <p className="mt-5 max-w-[430px] text-[13px] leading-7 text-[#d2e2df]">CareTrack connects appointments, test expectations, reports, review, and follow-up in a single timeline—so the next step stays visible to the people responsible for it.</p>
                <div className="mt-7 flex items-center gap-3 rounded-[15px] border border-white/10 bg-white/[0.07] p-3.5">
                  <span className="grid size-9 place-items-center rounded-full bg-[#d0e7e0] text-[#24565a]"><Check className="size-4" /></span>
                  <div><p className="text-[11px] font-semibold text-white">From first visit to follow-through</p><p className="mt-0.5 text-[10px] text-[#bdd4d0]">Keep the care context moving forward.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e3ecf4] bg-[#eff5fb] py-[74px] sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 xl:px-10">
          <SectionHeading eyebrow="Better follow-up, better care" title="Designed for Better Follow-Up. Built for Better Care." description="Give care teams a calmer, clearer way to coordinate the details that matter after the visit." />
          <div className="mt-11 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-[19px] border border-[#e2ebf3] bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg sm:p-6">
                <span className="grid size-10 place-items-center rounded-[13px] bg-[#eaf6f5] text-[#0c4b80]"><Icon className="size-[18px]" strokeWidth={1.8} /></span>
                <h3 className="mt-5 text-[15px] font-bold tracking-[-0.025em] text-[#244c71]">{title}</h3>
                <p className="mt-2 text-[12px] leading-6 text-[#788da1]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
