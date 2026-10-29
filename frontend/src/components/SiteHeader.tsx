import { useState } from "react";
import { CalendarDays, Menu, Plus, X } from "lucide-react";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-xl bg-[#0c4b80] text-white ${compact ? "size-9 rounded-[11px]" : "size-11"}`} aria-hidden="true">
      <CalendarDays className={compact ? "size-[19px]" : "size-[23px]"} strokeWidth={1.8} />
      <span className={`absolute grid place-items-center rounded-full bg-[#0c4b80] ring-2 ring-[#0c4b80] ${compact ? "-right-1 -top-1 size-4" : "-right-1 -top-1 size-[18px]"}`}>
        <Plus className={compact ? "size-3" : "size-[14px]"} strokeWidth={3} />
      </span>
    </span>
  );
}

interface SiteHeaderProps {
  onFeedback: () => void;
  onLogin: () => void;
  onGetStarted?: () => void;
}

export default function SiteHeader({ onFeedback, onLogin, onGetStarted }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const handleStart = onGetStarted || onLogin;

  return (
    <header className="sticky top-0 z-40 border-b border-[#e2ebf3] border-t-[3px] border-t-[#25aea8] bg-[#f7faff]/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[78px] max-w-[1320px] items-center justify-between gap-6 px-5 sm:px-8 xl:px-10">
        <a href="#home" className="flex min-w-0 items-center gap-3" aria-label="CareTrack home">
          <BrandMark />
          <span className="min-w-0">
            <span className="block text-[19px] font-bold tracking-[-0.04em] text-[#183d63]">CareTrack</span>
            <span className="hidden text-[10px] font-medium tracking-[0.01em] text-[#72869b] sm:block">Healthcare Follow-Up &amp; Tracking System</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navLinks.map((item) => (
            <a key={item.label} href={item.href} className="text-[13px] font-medium text-[#667c91] transition-colors hover:text-[#0c4b80]">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <button onClick={onFeedback} className="rounded-full border border-[#b7d3e6] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0c4b80] transition hover:border-[#0c4b80] hover:bg-[#eaf7f6]">
            Feedback
          </button>
          <button onClick={onLogin} className="rounded-full px-3.5 py-2.5 text-[13px] font-semibold text-[#516d89] transition hover:bg-[#edf4fa] hover:text-[#183d63]">
            Login
          </button>
          <button onClick={handleStart} className="rounded-full bg-[#c94e08] px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#b84600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25aea8]">
            Get Started
          </button>
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl border border-[#d9e5ef] bg-white text-[#0c4b80] lg:hidden"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <div id="mobile-navigation" className="border-t border-[#e2ebf3] bg-white px-5 pb-5 pt-3 shadow-lg lg:hidden">
          <nav className="mx-auto flex max-w-[1320px] flex-col" aria-label="Mobile navigation">
            {navLinks.map((item) => (
              <a key={item.label} href={item.href} onClick={closeMenu} className="border-b border-[#edf2f1] py-3.5 text-sm font-medium text-[#516d89]">
                {item.label}
              </a>
            ))}
            <div className="flex flex-wrap gap-2.5 pt-4">
              <button onClick={() => { closeMenu(); onFeedback(); }} className="rounded-full border border-[#b7d3e6] px-4 py-2.5 text-sm font-semibold text-[#0c4b80]">Feedback</button>
              <button onClick={() => { closeMenu(); onLogin(); }} className="rounded-full border border-[#d9e5ef] px-4 py-2.5 text-sm font-semibold text-[#516d89]">Login</button>
              <button onClick={() => { closeMenu(); handleStart(); }} className="rounded-full bg-[#c94e08] px-5 py-2.5 text-sm font-semibold text-white">Get Started</button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export { BrandMark };
