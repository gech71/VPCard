import { NextResponse } from "next/server";
import {
  getDecryptedPhoneFromCookie,
  getAccountsFromCookie,
  setAccountsCookie,
} from "@/lib/auth";
import { type CardDetails } from "@/lib/data";
import { fetchPssCardListByCustomerId } from "@/lib/pss-card-list";
import {
  filterCardsByAllowedBins,
  parseAllowedCardBinsFromEnv,
} from "@/lib/allowed-card-bins";
import {
  cacheCustomerIdMappings,
  getCachedAccountsByCustomerId,
  getCachedCustomerIdByPhone,
  resolveCustomerIdWithCache,
} from "@/lib/customer-id-cache";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AccountSummary = {
  accountNumber: string;
  name?: string;
  status?: string;
};

function mapPssCardsToCardDetails(cardsFromApi: unknown[]): CardDetails[] {
  if (!Array.isArray(cardsFromApi)) return [];

  return (cardsFromApi as Record<string, unknown>[]).map((card, index) => {
    const status = card.cardstatus;
    let cardStatus: CardDetails["status"] = "Inactive";
    if (status === "Active" || status === "OK") {
      cardStatus = "Active";
    } else if (status === "Cancelled" || status === "Lost") {
      cardStatus = "Inactive";
    }

    return {
      id: String(card.card ?? `card-${index + 1}`),
      fullNumber: String(card.clearpan ?? ""),
      maskedNumber: String(card.pan ?? ""),
      expiryDate: String(card.expiry ?? ""),
      cardholderName: String(card.name_on_card ?? ""),
      status: cardStatus,
      type: String(card.cardtype ?? "Unknown"),
      balance: 0,
      accountNumber: String(card.accountnumber ?? ""),
      currency: String(card.cardcurrency ?? ""),
      cardTypeNetwork: String(card.cardtypenetwork ?? ""),
      cvv: card.cvv2 != null ? String(card.cvv2) : undefined,
    };
  });
}

async function getCardData(): Promise<{
  cards: CardDetails[];
  accounts: AccountSummary[];
  phoneNumber: string | null;
  customerCardPanNumbers: string[];
}> {
  const phoneNumber = await getDecryptedPhoneFromCookie();
  if (!phoneNumber) {
    throw new Error("Could not retrieve phone number from cookie.");
  }

  const cardListUrl = process.env.CARD_LIST_URL;
  const cardListApiKey = process.env.CARD_LIST_API_KEY;
  const cardListIdMsg = process.env.CARD_LIST_ID_MSG;
  const cardListInstitution = process.env.CARD_LIST_INSTITUTION;

  if (
    !cardListUrl ||
    !cardListApiKey ||
    !cardListIdMsg ||
    !cardListInstitution
  ) {
    throw new Error("Server configuration error for card list.");
  }

  let accounts: AccountSummary[] = [];
  let rawAccounts: Record<string, unknown>[] = [];
  let accountsEnvelope: Record<string, unknown> | undefined;
  let customerId: string | undefined;

  const cachedAccounts = await getAccountsFromCookie();
  if (cachedAccounts && cachedAccounts.length > 0) {
    accounts = cachedAccounts.map((acc: Record<string, unknown>) => ({
      accountNumber: String(acc.accountNumber ?? ""),
      name: acc.name != null ? String(acc.name) : undefined,
      status: acc.status != null ? String(acc.status) : undefined,
    }));
  }

  customerId = await getCachedCustomerIdByPhone(phoneNumber);

  if (customerId && accounts.length === 0) {
    const dbAccounts = await getCachedAccountsByCustomerId(customerId);
    accounts = dbAccounts.map((a) => ({ accountNumber: a.accountNumber }));
    if (accounts.length > 0) {
      await setAccountsCookie(accounts);
    }
  }

  if (!customerId && accounts.length === 0) {
    const getAccountsUrl = process.env.GET_ACCOUNTS_URL;
    const getAccountsUser = process.env.GET_ACCOUNTS_USER;
    const getAccountsPass = process.env.GET_ACCOUNTS_PASS;

    if (!getAccountsUrl || !getAccountsUser || !getAccountsPass) {
      throw new Error("Server configuration error for accounts.");
    }

    const basicAuth = Buffer.from(
      `${getAccountsUser}:${getAccountsPass}`,
    ).toString("base64");

    const accountsResponse = await fetch(getAccountsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({ phoneNumber }),
      cache: "no-store",
    });

    if (!accountsResponse.ok) {
      throw new Error(`Failed to get accounts: ${accountsResponse.statusText}`);
    }

    const accountsData = await accountsResponse.json();
    accountsEnvelope =
      accountsData && typeof accountsData === "object"
        ? (accountsData as Record<string, unknown>)
        : undefined;
    rawAccounts = (accountsData?.details || []) as Record<string, unknown>[];

    accounts = rawAccounts.map((acc) => ({
      accountNumber: String(acc.AccountNumber ?? ""),
      name: acc.Name != null ? String(acc.Name) : undefined,
      status: acc.Status != null ? String(acc.Status) : undefined,
    }));

    if (accounts.length > 0) {
      await setAccountsCookie(accounts);
    }
  }

  if (!customerId) {
    customerId = await resolveCustomerIdWithCache({
      phoneNumber,
      accounts,
      rawAccounts,
      accountsEnvelope,
    });
  } else {
    await cacheCustomerIdMappings({
      customerId,
      phoneNumber,
      accountNumbers: accounts.map((a) => a.accountNumber),
    });
  }
  if (!customerId) {
    return { cards: [], accounts, phoneNumber, customerCardPanNumbers: [] };
  }

  const listCards = await fetchPssCardListByCustomerId({
    customerId,
    institution: cardListInstitution,
    cardListUrl,
    apiKey: cardListApiKey,
    idmsg: cardListIdMsg,
  });

  const mapped = mapPssCardsToCardDetails(listCards);
  const allowedBins = parseAllowedCardBinsFromEnv();
  const cards = filterCardsByAllowedBins(mapped, allowedBins);
  const customerCardPanNumbers = mapped
    .map((c) => String(c.fullNumber ?? "").trim())
    .filter(Boolean);

  return { cards, accounts, phoneNumber, customerCardPanNumbers };
}

export async function GET() {
  let cards: CardDetails[] = [];
  let accounts: AccountSummary[] = [];
  let phoneNumber: string | null = null;
  let customerCardPanNumbers: string[] = [];
  let fetchError: string | null = null;
  let allowSelfRequest = false;
  let defaultCheckerId: string | null = null;

  try {
    const [data, allowSelfCardRequest, defaultCheckerSetting] =
      await Promise.all([
        getCardData(),
        prisma.settings.findUnique({ where: { key: "allowSelfCardRequest" } }),
        prisma.settings.findUnique({ where: { key: "defaultCheckerId" } }),
      ]);

    cards = data.cards;
    accounts = data.accounts;
    phoneNumber = data.phoneNumber;
    customerCardPanNumbers = data.customerCardPanNumbers;
    allowSelfRequest = allowSelfCardRequest?.value === "true";
    defaultCheckerId = defaultCheckerSetting?.value || null;
  } catch (error: unknown) {
    fetchError = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json({
    cards,
    accounts,
    phoneNumber,
    customerCardPanNumbers,
    allowSelfRequest,
    defaultCheckerId,
    error: fetchError,
  });
}
