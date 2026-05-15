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

export default function CardDisplay({ card }: CardDisplayProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const panDisplay = formatPanForDisplay(
    isRevealed ? card.fullNumber : card.maskedNumber,
  );
  const cardholderName = (card.cardholderName || "CARDHOLDER").toUpperCase();
  const validThru = formatValidThru(card.expiryDate);

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

          <div className="absolute inset-0 flex flex-col justify-end px-4 pb-4 pt-16 sm:px-6 sm:pb-5">
            <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
              <p
                className="font-mono text-[15px] font-semibold leading-tight tracking-[0.18em] text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] sm:text-xl sm:tracking-[0.22em]"
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
                aria-label={isRevealed ? "Hide card number" : "Show card number"}
                aria-pressed={isRevealed}
              >
                {isRevealed ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </Button>
            </div>

            <div className="flex items-end justify-between gap-3 pr-14 sm:pr-20">
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-medium uppercase leading-none tracking-[0.12em] text-neutral-800/90 sm:text-[9px]">
                  Cardholder
                </p>
                <p className="truncate text-xs font-bold uppercase tracking-wide text-neutral-900 sm:text-sm">
                  {cardholderName}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[8px] font-medium uppercase leading-none tracking-[0.12em] text-neutral-800/90 sm:text-[9px]">
                  Valid Thru
                </p>
                <p className="font-mono text-sm font-bold tabular-nums text-neutral-900 sm:text-base">
                  {validThru}
                </p>
              </div>

              {card.cvv && isRevealed && (
                <div
                  className="shrink-0 text-right"
                  aria-label="Card security code"
                >
                  <p className="text-[8px] font-medium uppercase leading-none tracking-[0.12em] text-neutral-800/90 sm:text-[9px]">
                    CVC
                  </p>
                  <p className="font-mono text-sm font-bold tabular-nums text-neutral-900 sm:text-base">
                    {card.cvv}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
