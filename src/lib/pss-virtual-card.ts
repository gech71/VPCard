import prisma from "@/lib/prisma";
import { defaultLegacyCardProgramCode, defaultPrepaidProgram } from "@/lib/card-programs";
import { extractPssFieldsFromCustDetail } from "@/lib/cust-detail";
import {
  fetchCustInfoByAccount,
  getCustDetailFromResponse,
} from "@/lib/prepaid-api";

export type CardRequestForPss = {
  customerId: string | null;
  accountNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  cardProgramCode: string | null;
  prepaidProgram: string | null;
  branchCode: string | null;
  genderCode: string | null;
  title: string | null;
};

export async function buildPssVirtualCardInitiator(
  cardRequest: CardRequestForPss,
  institution: string | undefined,
  customerType: "O" | "N",
) {
  const programCode =
    cardRequest.cardProgramCode || defaultLegacyCardProgramCode();

  const program = await prisma.cardProgram.findUnique({
    where: { code: programCode },
  });

  const prepaidprogram =
    cardRequest.prepaidProgram ||
    defaultPrepaidProgram(program?.prepaidProgram ?? null);

  const cardprogramcode = program?.code ?? programCode;

  let branchcode = (cardRequest.branchCode || "").trim();
  let gender = (cardRequest.genderCode || "").trim();
  let title = (cardRequest.title ?? "").trim();

  if (!branchcode || !gender || title === "") {
    try {
      const raw = await fetchCustInfoByAccount(cardRequest.accountNumber);
      const detail = getCustDetailFromResponse(raw);
      const extracted = extractPssFieldsFromCustDetail(detail);
      if (!branchcode) branchcode = extracted.branchcode;
      if (!gender) gender = extracted.gender;
      if (!title) title = extracted.title;
    } catch {
      // keep fallbacks below
    }
  }

  if (!gender) gender = "M";
  if (!branchcode) {
    branchcode = process.env.DEFAULT_BRANCH_CODE || "409";
  }

  return {
    customerid: cardRequest.customerId,
    customertype: customerType,
    accountnumber: "",
    accounttype: "N",
    currencycode: "840",
    branchcode,
    cardprogramcode,
    prepaidprogram,
    nameoncard: cardRequest.customerName,
    phonenumber: cardRequest.customerPhone || "",
    institution,
    bankaccounttype: "404",
    gender,
    title,
    email: cardRequest.customerEmail || "",
  };
}
