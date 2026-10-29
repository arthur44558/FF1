import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, MessageSquareText, X } from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [submitted, setSubmitted] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    messageRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#123536]/45 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="relative w-full max-w-[480px] rounded-[26px] border border-white/70 bg-white p-6 shadow-2xl sm:p-8">
        <button onClick={onClose} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full text-[#6c7d7b] transition hover:bg-[#f1f6f5] hover:text-[#183d63]" aria-label="Close feedback dialog">
          <X className="size-4" />
        </button>
        {submitted ? (
          <div className="py-8 text-center" role="status">
            <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[#e5f5f4] text-[#0c4b80]"><CheckCircle2 className="size-7" /></span>
            <h2 id="feedback-title" className="text-2xl font-bold tracking-[-0.04em] text-[#183d63]">Thank you for sharing.</h2>
            <p className="mx-auto mt-2 max-w-[320px] text-sm leading-6 text-[#667c91]">Your feedback has been noted in this homepage demo.</p>
            <button onClick={onClose} className="mt-6 rounded-full bg-[#0c4b80] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#083b67]">Back to CareTrack</button>
          </div>
        ) : (
          <>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#e5f5f4] text-[#0c4b80]"><MessageSquareText className="size-5" /></span>
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#25aea8]">Your perspective matters</p>
            <h2 id="feedback-title" className="mt-2 text-[27px] font-bold tracking-[-0.05em] text-[#183d63]">Help us make follow-up better.</h2>
            <p className="mt-2 text-sm leading-6 text-[#667c91]">Tell us what would make CareTrack more helpful for your care team.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#45627f]">What is this about?</span>
                <select defaultValue="General feedback" className="w-full rounded-xl border border-[#d9e5ef] bg-[#f8fbff] px-3.5 py-3 text-sm text-[#45627f] outline-none focus:border-[#0c4b80] focus:ring-2 focus:ring-[#0c4b80]/10">
                  <option>General feedback</option>
                  <option>Feature idea</option>
                  <option>Something is unclear</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#45627f]">Your feedback</span>
                <textarea ref={messageRef} required rows={4} placeholder="Share a thought or suggestion…" className="w-full resize-none rounded-xl border border-[#d9e5ef] bg-[#f8fbff] px-3.5 py-3 text-sm leading-6 text-[#183d63] outline-none placeholder:text-[#9baaa8] focus:border-[#0c4b80] focus:ring-2 focus:ring-[#0c4b80]/10" />
              </label>
              <button type="submit" className="flex w-full items-center justify-center rounded-full bg-[#0c4b80] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#083b67] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25aea8]">Send feedback</button>
              <p className="text-center text-[11px] text-[#8a9997]">Demo interaction — feedback is not sent to a service.</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
