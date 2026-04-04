import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";

export function PanelCard({
  children,
  className = "",
  ...props
}: PropsWithChildren<{ className?: string } & ComponentPropsWithoutRef<"section">>) {
  return (
    <section className={`panel-card ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
