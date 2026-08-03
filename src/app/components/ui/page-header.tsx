import type { ReactNode } from "react";
import { cn } from "./utils";

interface PageHeaderProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {title && <PageTitle className="truncate">{title}</PageTitle>}
          {description && (
            <p className="mt-1 text-sm text-gray-600 truncate">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
      </div>
    </div>
  );
}

interface PageTitleProps {
  children: ReactNode;
  /** Optional smaller variant for nested / sub-page headings. */
  size?: "default" | "lg";
  className?: string;
}

/**
 * Canonical page heading. Use for any in-page H1/H2 ("My SKU List",
 * "Customer Management", "Sellers") so every page lands on the same
 * size + weight + colour. Default is `text-xl font-semibold` to match
 * the topbar title; `lg` bumps to `text-2xl` for hero / dashboard
 * style pages.
 */
export function PageTitle({
  children,
  size = "default",
  className,
}: PageTitleProps) {
  return (
    <h2
      className={cn(
        "font-semibold text-gray-900",
        size === "lg" ? "text-2xl" : "text-xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

interface SectionTitleProps {
  children: ReactNode;
  className?: string;
}

/**
 * Subsection heading inside a page (used inside Cards, dialog headers,
 * and grouped settings). Smaller than PageTitle so the visual hierarchy
 * stays clear.
 */
export function SectionTitle({ children, className }: SectionTitleProps) {
  return (
    <h3
      className={cn(
        "text-base font-semibold text-gray-900",
        className,
      )}
    >
      {children}
    </h3>
  );
}
