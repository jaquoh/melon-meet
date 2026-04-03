import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";

export function PanelCard({
  children,
  className = "",
  ...props
}: PropsWithChildren<{ className?: string } & ComponentPropsWithoutRef<"section">>) {
  return (
    <section
      className={`rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
