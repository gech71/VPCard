
import { transactions, atmLimit, posLimit, type CardDetails } from '@/lib/data';
import DashboardHeader from '@/components/dashboard-header';
import TransactionHistory from '@/components/transaction-history';
import LimitManager from '@/components/limit-manager';
import { Landmark, Store } from 'lucide-react';
import DashboardClient from '@/components/dashboard-client';
import { getDecryptedPhoneFromCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getCardData(): Promise<CardDetails[]> {
  try {
    const phoneNumber = await getDecryptedPhoneFromCookie();
    if (!phoneNumber) {
      console.error("Could not retrieve phone number from cookie.");
      return [];
    }

    // Step 1: Get Accounts
    const getAccountsUrl = process.env.GET_ACCOUNTS_URL;
    const getAccountsUser = process.env.GET_ACCOUNTS_USER;
    const getAccountsPass = process.env.GET_ACCOUNTS_PASS;

    if (!getAccountsUrl || !getAccountsUser || !getAccountsPass) {
      console.error("Missing environment variables for getting accounts.");
      return [];
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
      console.error(`Failed to get accounts: ${accountsResponse.statusText}`);
      return [];
    }

    const accountsData = await accountsResponse.json();
    const accountNumber = accountsData?.details?.[0]?.AccountNumber;

    if (!accountNumber) {
      console.error("No account number found in response.");
      return [];
    }

    // Step 2: Get Card List
    const cardListUrl = process.env.CARD_LIST_URL;
    const cardListApiKey = process.env.CARD_LIST_API_KEY;
    const cardListIdMsg = process.env.CARD_LIST_ID_MSG;
    const cardListInstitution = process.env.CARD_LIST_INSTITUTION;


    if (!cardListUrl || !cardListApiKey || !cardListIdMsg || !cardListInstitution) {
      console.error("Missing environment variables for getting card list.");
      return [];
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
      console.error(`Failed to get card list: ${cardListResponse.statusText}`);
      return [];
    }
    
    const cardListData = await cardListResponse.json();
    
    const cardsFromApi = cardListData?.response?.body?.cards;

    if (!cardsFromApi || !Array.isArray(cardsFromApi)) {
        console.log("No cards array in the response body.");
        return [];
    }

    // Map API response to CardDetails[]
    return cardsFromApi.map((card: any, index: number) => {
        const status = card.cardstatus;
        let cardStatus: CardDetails['status'] = 'Inactive';
        cardStatus = status;

        return {
            id: card.card || `card${index + 1}`,
            fullNumber: card.clearpan,
            maskedNumber: card.pan,
            expiryDate: card.expiry,
            cardholderName: card.name_on_card,
            status: cardStatus,
            type: card.cardtype,
            balance: 0, // Not in response, placeholder
            accountNumber: card.accountnumber,
            currency: card.cardcurrency,
            cardTypeNetwork: card.cardtypenetwork,
        };
    });

  } catch (error) {
    console.error("Error fetching card data:", error);
    return [];
  }
}

export default async function Home() {
  const cards = await getCardData();

  return (
    <div className="min-h-screen w-full">
      <DashboardHeader />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-3">
             <DashboardClient cards={cards} />
          </div>

          <div className="lg:col-span-3">
            <TransactionHistory transactions={transactions} />
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
            <LimitManager
              title="POS Limit"
              description="Set your daily Point of Sale transaction limit."
              icon={<Store className="h-6 w-6 text-primary" />}
              limitData={posLimit}
            />
            <LimitManager
              title="ATM Limit"
              description="Set your daily ATM withdrawal limit."
              icon={<Landmark className="h-6 w-6 text-primary" />}
              limitData={atmLimit}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
