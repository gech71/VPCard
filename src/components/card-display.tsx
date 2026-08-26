"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import type { CardDetails } from "@/lib/data";
import { groupCardNumber, lastFourDigits, maskPanForDisplay } from "@/lib/pan";

type CardDisplayProps = {
  card: CardDetails;
};

/** ISO/IEC 7813 — PAN grouped in four digits. */
function formatPanForDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value;
  return groupCardNumber(digits);
}

/** Display expiry as MM/YY (common on payment cards). */
function formatValidThru(expiry: string): string {
  const trimmed = expiry.trim();
  if (/^\d{2}\/\d{2}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 4) return trimmed;

  const a = parseInt(digits.slice(0, 2), 10);
  const b = parseInt(digits.slice(2, 4), 10);
  if (a >= 1 && a <= 12) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  if (b >= 1 && b <= 12) {
    return `${digits.slice(2, 4)}/${digits.slice(0, 2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

function CardField({
  label,
  value,
  className,
  "aria-label": ariaLabel,
}: {
  label: string;
  value: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={className} aria-label={ariaLabel}>
      <p className="text-[7px] font-medium uppercase leading-none tracking-[0.14em] text-neutral-800/90 sm:text-[8px]">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums leading-none text-neutral-900 sm:text-base">
        {value}
      </p>
    </div>
  );
}

export default function CardDisplay({ card }: CardDisplayProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  // Masked from the full number rather than trusting whatever masking the card
  // provider applied, so the card face always shows the same first six and last
  // four. The provider's own masked value is the fallback when no full number
  // came back.
  const maskedPan = maskPanForDisplay(card.fullNumber || card.maskedNumber);

  const panDisplay = isRevealed
    ? formatPanForDisplay(card.fullNumber)
    : groupCardNumber(maskedPan);
  const cardholderName = (card.cardholderName || "CARDHOLDER").toUpperCase();
  const validThru = formatValidThru(card.expiryDate);
  const showCvc = Boolean(card.cvv);

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        className="group relative aspect-[1.586] w-full overflow-hidden rounded-xl shadow-lg transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-xl"
        role="img"
        aria-label={`${card.cardTypeNetwork || card.type} prepaid card ending in ${lastFourDigits(
          card.fullNumber || card.maskedNumber,
        )}`}
      >
        <Image
          src="/Virtual-Card.jpeg"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 448px"
        />

        {/* Reveal affordance — visible on hover/focus so the card stays clean. */}
        <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-neutral-900/70 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {isRevealed ? (
            <>
              <EyeOff className="h-3 w-3" />
              Tap to hide
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Tap to reveal
            </>
          )}
        </span>

        <div className="absolute inset-0 flex flex-col justify-end px-3 pb-3.5 sm:px-5 sm:pb-4">
          <div className="flex w-full flex-col items-stretch pr-10 sm:pr-14">
            <button
              type="button"
              onClick={() => setIsRevealed((v) => !v)}
              className="w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-sm font-bold leading-tight tabular-nums tracking-[0.16em] text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.65)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 focus-visible:ring-offset-1 sm:text-base sm:tracking-[0.18em] md:text-lg md:tracking-[0.2em]"
              style={{ wordSpacing: "0.28em" }}
              aria-label={
                isRevealed
                  ? "Primary account number, click to hide"
                  : "Masked primary account number, click to reveal"
              }
              aria-pressed={isRevealed}
            >
              {panDisplay}
            </button>

            <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-1 sm:mt-3.5 sm:gap-x-8">
              <CardField label="Valid Thru" value={validThru} />
              {showCvc && (
                <CardField
                  label="CVC"
                  value={isRevealed ? String(card.cvv) : "***"}
                  className={isRevealed ? undefined : "select-none"}
                  aria-label={
                    isRevealed
                      ? "Card security code"
                      : "Card security code hidden"
                  }
                />
              )}
            </div>

            <p
              className="mt-2 max-w-full truncate text-sm font-bold uppercase leading-tight tracking-[0.08em] text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] sm:mt-2.5 sm:text-[0.95rem]"
              title={cardholderName}
            >
              {cardholderName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
