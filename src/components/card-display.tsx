"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import type { CardDetails } from "@/lib/data";

type CardDisplayProps = {
  card: CardDetails;
};

/** ISO/IEC 7813 — PAN grouped in four digits. */
function formatPanForDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value;
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
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

  const panDisplay = formatPanForDisplay(
    isRevealed ? card.fullNumber : card.maskedNumber,
  );
  const cardholderName = (card.cardholderName || "CARDHOLDER").toUpperCase();
  const validThru = formatValidThru(card.expiryDate);
  const showCvc = Boolean(card.cvv);

  return (
    <Card className="mx-auto flex h-full w-full max-w-md flex-col shadow-md">
      <CardContent className="flex flex-grow flex-col justify-between gap-6 p-0">
        <div
          className="relative aspect-[1.586] w-full overflow-hidden rounded-xl shadow-lg"
          role="img"
          aria-label={`${card.cardTypeNetwork || card.type} virtual prepaid card ending in ${card.maskedNumber.slice(-4)}`}
        >
          <Image
            src="/Virtual-Card.jpeg"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 448px"
          />

          {/* Lower card face: PAN → Valid Thru/CVC → cardholder */}
          <div className="absolute inset-0 flex flex-col justify-end px-4 pb-4 sm:px-6 sm:pb-5">
            <div className="flex w-full max-w-[calc(100%-0.5rem)] flex-col items-start pr-12 sm:pr-16">
              {/* 1. PAN */}
              <div className="flex w-full min-w-0 items-center gap-2 pr-1">
                <p
                  className="min-w-0 flex-1 font-mono text-base font-bold leading-tight tabular-nums tracking-[0.18em] text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.65)] sm:text-xl sm:tracking-[0.22em] md:text-2xl md:tracking-[0.24em]"
                  style={{ wordSpacing: "0.3em" }}
                  aria-label={
                    isRevealed
                      ? "Primary account number"
                      : "Masked primary account number"
                  }
                >
                  {panDisplay}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-neutral-900 hover:bg-black/10"
                  onClick={() => setIsRevealed((v) => !v)}
                  aria-label={
                    isRevealed ? "Hide card number" : "Show card number"
                  }
                  aria-pressed={isRevealed}
                >
                  {isRevealed ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {/* 2. Valid Thru + CVC (same row) */}
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-1 sm:mt-4 sm:gap-x-8">
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

              {/* 3. Cardholder */}
              <p
                className="mt-2 max-w-full truncate text-sm font-bold uppercase leading-tight tracking-[0.08em] text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] sm:mt-2.5 sm:text-[0.95rem]"
                title={cardholderName}
              >
                {cardholderName}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
