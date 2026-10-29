import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  children?: ReactNode;
}

export default function SectionHeading({ eyebrow, title, description, align = "center", children }: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-[700px] text-center" : "max-w-[600px] text-left"}>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#25aea8]">{eyebrow}</p>
      <h2 className="text-balance text-[clamp(30px,4vw,46px)] font-bold leading-[1.08] tracking-[-0.055em] text-[#183d63]">{title}</h2>
      {description && <p className="mx-auto mt-4 max-w-[620px] text-pretty text-[15px] leading-7 text-[#667c91]">{description}</p>}
      {children}
    </div>
  );
}
