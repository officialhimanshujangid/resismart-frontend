import React from "react";
import Link from "next/link";
import Image from "next/image";

interface ResiSmartLogoProps {
  variant?: "full" | "compact";
  href?: string;
  className?: string;
}

/**
 * ResiSmartLogo — Single source of truth for the Resismart brand logo.
 * Uses /public/resismartlogo.png.
 * Import this anywhere you need the logo.
 */
export function ResiSmartLogo({
  variant = "full",
  href,
  className = "",
}: ResiSmartLogoProps) {
  const width = variant === "compact" ? 150 : 210;
  const height = variant === "compact" ? 38 : 52;

  const logo = (
    <div className={`inline-flex items-center select-none ${className}`}>
      <Image
        src="/resismartlogo.png"
        alt="Resismart"
        width={width}
        height={height}
        className="object-contain"
        priority
      />
    </div>
  );

  if (!href) return logo;

  return (
    <Link
      href={href}
      className="inline-flex items-center outline-none rounded-lg transition-opacity duration-200 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-500/50"
    >
      {logo}
    </Link>
  );
}