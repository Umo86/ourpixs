import type { InputHTMLAttributes, ReactNode, Ref } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; tone?: "light" | "dark"; id: string; ref?: Ref<HTMLInputElement> };

/** Labelled input with the app's rounded style. */
export function Field({ label, hint, tone = "light", id, className = "", ref, ...rest }: Props) {
  const input = tone === "dark"
    ? "border-[#3A3F52] bg-surface text-white placeholder:text-[#8A8FA0]"
    : "border-[#D5D8E2] bg-white text-ink placeholder:text-[#8A8D96]";
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className={`text-[13px] font-semibold ${tone === "dark" ? "text-muted-dark" : "text-text-2"}`}>{label}</label>
      <input
        id={id}
        ref={ref}
        {...rest}
        className={`min-h-12 w-full rounded-2xl border-[1.5px] px-4 py-3 text-base outline-none transition-colors focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-sky ${input}`}
      />
      {hint ? <span className={`text-xs ${tone === "dark" ? "text-[#A8ACB8]" : "text-muted"}`}>{hint}</span> : null}
    </div>
  );
}
