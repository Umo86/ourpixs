import type { ElementType, ReactNode } from "react";

type Props = {
  as?: ElementType;
  /** "default" = 1360px marketing width, "narrow" = 980px reading width */
  size?: "default" | "narrow";
  className?: string;
  children: ReactNode;
  id?: string;
};

export function Container({ as: Tag = "div", size = "default", className = "", children, id }: Props) {
  const max = size === "narrow" ? "max-w-[980px]" : "max-w-[1360px]";
  return (
    <Tag id={id} className={`mx-auto w-full ${max} px-5 sm:px-8 ${className}`}>
      {children}
    </Tag>
  );
}
