import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDecryptedPhoneFromCookie } from "@/lib/auth";
import { type CardDetails } from "@/lib/data";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

function getPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const dynamic = "force-dynamic";

async function getCardData(selectedAccountNumber?: string | null): Promise<{
  cards: CardDetails[];
  accounts: any[];
}> {
  try {
    const phoneNumber = await getDecryptedPhoneFromCookie();
    if (!phoneNumber) {
      throw new Error("Could not retrieve phone number from cookie.");
    }

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
      const errorText = await accountsResponse.text();
      throw new Error(`Failed to get accounts: ${accountsResponse.statusText}`);
    }

    const accountsData = await accountsResponse.json();
    const rawAccounts = accountsData?.details || [];

    if (rawAccounts.length === 0) {
      return { cards: [], accounts: [] };
    }

    const accounts = rawAccounts.map((acc: any) => ({
      accountNumber: acc.AccountNumber?.toString(),
      name: acc.Name,
      status: acc.Status,
    }));

    // If no account is selected, just return the list of accounts
    if (!selectedAccountNumber) {
      return { cards: [], accounts };
    }

    // Verify the selected account belongs to the user
    const targetAccount = accounts.find(
      (a: any) => a.accountNumber === selectedAccountNumber,
    );
    if (!targetAccount) {
      return { cards: [], accounts };
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

    let allCards: CardDetails[] = [];

    try {
      const cardListResponse = await fetch(cardListUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ApiKey: cardListApiKey,
        },
        body: JSON.stringify({
          header: {
            idmsg: cardListIdMsg,
          },
          filter: {
            account: targetAccount.accountNumber,
            card: "",
            pan: "",
            customer: "",
            name_on_card: "",
            institution: cardListInstitution,
            start: "1",
            end: "10",
          },
        }),
        cache: "no-store",
      });

      if (cardListResponse.ok) {
        const cardListData = await cardListResponse.json();
        const cardsFromApi = cardListData?.response?.body?.cards;

        if (cardsFromApi && Array.isArray(cardsFromApi)) {
          allCards = cardsFromApi.map((card: any, index: number) => {
            const status = card.cardstatus;
            let cardStatus: CardDetails["status"] = "Inactive";
            if (status === "Active" || status === "OK") {
              cardStatus = "Active";
            } else if (status === "Cancelled" || status === "Lost") {
              cardStatus = "Inactive";
            }

            return {
              id: card.card || `card-${targetAccount.accountNumber}-${index + 1}`,
              fullNumber: card.clearpan,
              maskedNumber: card.pan,
              expiryDate: card.expiry,
              cardholderName: card.name_on_card,
              status: cardStatus,
              type: card.cardtype,
              balance: 0,
              accountNumber: card.accountnumber,
              currency: card.cardcurrency,
              cardTypeNetwork: card.cardtypenetwork,
            };
          });
        }
      }
    } catch (err) {
      console.error(
        `Failed to fetch cards for account ${targetAccount.accountNumber}:`,
        err,
      );
    }

    return { cards: allCards, accounts };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unknown error occurred while fetching card data.");
  }
}

async function getSettings() {
  const prisma = getPrismaClient();
  try {
    const allowSelfCardRequest = await prisma.settings.findUnique({
      where: { key: "allowSelfCardRequest" },
    });

    const defaultCheckerId = await prisma.settings.findUnique({
      where: { key: "defaultCheckerId" },
    });

    return {
      allowSelfCardRequest: allowSelfCardRequest?.value === "true",
      defaultCheckerId: defaultCheckerId?.value || null,
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountNumber = searchParams.get("accountNumber");

  let cards: CardDetails[] = [];
  let accounts: any[] = [];
  let fetchError = null;

  try {
    const data = await getCardData(accountNumber);
    cards = data.cards;
    accounts = data.accounts;
  } catch (error: any) {
    console.error("Card fetch error:", error);
    fetchError = error.message;
  }

  try {
    const settings = await getSettings();

    return NextResponse.json({
      cards,
      accounts,
      allowSelfRequest: settings.allowSelfCardRequest,
      defaultCheckerId: settings.defaultCheckerId,
      error: fetchError,
    });
  } catch (error: any) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { message: "Failed to fetch necessary data." },
      { status: 500 },
    );
  }
}

