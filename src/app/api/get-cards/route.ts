
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDecryptedPhoneFromCookie } from '@/lib/auth';
import { type CardDetails } from '@/lib/data';

export const dynamic = 'force-dynamic';

async function getCardData(): Promise<CardDetails[]> {
  try {
    const phoneNumber = await getDecryptedPhoneFromCookie();
    if (!phoneNumber) {
      throw new Error("Could not retrieve phone number from cookie.");
    }

    const getAccountsUrl = process.env.GET_ACCOUNTS_URL;
    const getAccountsUser = process.env.GET_ACCOUNTS_USER;
    const getAccountsPass = process.env.GET_ACCOUNTS_PASS;

    if (!getAccountsUrl || !getAccountsUser || !getAccountsPass) {
      console.error("Missing environment variables for getting accounts.");
      throw new Error("Server configuration error for accounts.");
    }
    
    const basicAuth = Buffer.from(`${getAccountsUser}:${getAccountsPass}`).toString('base64');
    
    const accountsResponse = await fetch(getAccountsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({ phoneNumber }),
      cache: 'no-store',
    });

    if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
      console.error(`Failed to get accounts: ${accountsResponse.statusText}`, errorText);
      throw new Error(`Failed to get accounts: ${accountsResponse.statusText}`);
    }

    const accountsData = await accountsResponse.json();
    const accountNumber = accountsData?.details?.[0]?.AccountNumber;

    if (!accountNumber) {
      console.error("No account number found in response.");
      return []; // Not an error, user might just not have an account
    }

    const cardListUrl = process.env.CARD_LIST_URL;
    const cardListApiKey = process.env.CARD_LIST_API_KEY;
    const cardListIdMsg = process.env.CARD_LIST_ID_MSG;
    const cardListInstitution = process.env.CARD_LIST_INSTITUTION;


    if (!cardListUrl || !cardListApiKey || !cardListIdMsg || !cardListInstitution) {
      console.error("Missing environment variables for getting card list.");
      throw new Error("Server configuration error for card list.");
    }

    const cardListResponse = await fetch(cardListUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': cardListApiKey,
      },
      body: JSON.stringify({
        header: {
          idmsg: cardListIdMsg
        },
        filter: {
          account: accountNumber,
          card: "",
          pan: "",
          customer: "",
          name_on_card: "",
          institution: cardListInstitution,
          start: "1",
          end: "10"
        }
      }),
      cache: 'no-store',
    });

    if (!cardListResponse.ok) {
       const errorText = await cardListResponse.text();
      console.error(`Failed to get card list: ${cardListResponse.statusText}`, errorText);
      throw new Error(`Failed to get card list: ${cardListResponse.statusText}`);
    }
    
    const cardListData = await cardListResponse.json();
    
    const cardsFromApi = cardListData?.response?.body?.cards;

    if (!cardsFromApi || !Array.isArray(cardsFromApi)) {
        console.log("No cards array in the response body.");
        return [];
    }

    return cardsFromApi.map((card: any, index: number) => {
        const status = card.cardstatus;
        let cardStatus: CardDetails['status'] = 'Inactive';
        if (status === 'Active' || status === 'OK') {
            cardStatus = 'Active';
        } else if (status === 'Cancelled' || status === 'Lost') {
            cardStatus = 'Inactive';
        }

        return {
            id: card.card || `card${index + 1}`,
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

  } catch (error) {
    console.error("Error fetching card data:", error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error("An unknown error occurred while fetching card data.");
  }
}


export async function GET(request: NextRequest) {
    try {
        const cards = await getCardData();
        return NextResponse.json({ cards });
    } catch(error: any) {
        return NextResponse.json({ message: error.message || 'Failed to fetch cards.' }, { status: 500 });
    }
}
