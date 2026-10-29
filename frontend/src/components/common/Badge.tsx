import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | "default"
    | "normal"
    | "moderate"
    | "severe"
    | "active"
    | "completed"
    | "cancelled"
    | "superseded"
    | "attention"
    | "info"
    | "outline";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
}) => {
  let style = "bg-gray-100 text-gray-800 border-gray-200";

  switch (variant) {
    case "normal":
      style = "bg-[#eaf5f4] text-[#1e6b66] border-[#bfe2df]";
      break;
    case "moderate":
      style = "bg-[#fff7e6] text-[#975a16] border-[#fcd38d]";
      break;
    case "severe":
      style = "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]";
      break;
    case "active":
      style = "bg-[#ebf8ff] text-[#006494] border-[#bae6fd]";
      break;
    case "completed":
      style = "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]";
      break;
    case "cancelled":
    case "superseded":
      style = "bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]";
      break;
    case "attention":
      style = "bg-[#fff1f2] text-[#be123c] border-[#fecdd3]";
      break;
    case "info":
      style = "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]";
      break;
    case "outline":
      style = "bg-white text-[#45627f] border-[#d8e0e7]";
      break;
  }

  const sizeStyle = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${sizeStyle} ${style}`}
    >
      {children}
    </span>
  );
};
