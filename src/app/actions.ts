
'use server';

import type { Transaction, Limit } from '@/lib/data';
import { z } from 'zod';

const CardNumbSchema = z.object({
  card_numb: z.string(),
});

type TransactionApiResponse = {
    'transaction date': string;
    'transaction type name': string;
    Amount: number;
    Status: 'Approval' | 'Decline' | string;
    'Reference number': string;
}

export type LimitApiResponse = {
    risk_code: string;
    transaction_type: string;
    channel: string;
    mnt_limite: number;
};


export async function getCardTransactions(prevState: any, formData: FormData) {
  const validatedFields = CardNumbSchema.safeParse({
    card_numb: formData.get('card_numb'),
  });

  if (!validatedFields.success) {
    return {
      transactions: [],
      balance: 0,
      error: 'Invalid card number provided.',
    };
  }

  const { card_numb } = validatedFields.data;

  const getTransactionsUrl = process.env.GET_TRANSACTIONS_URL;
  const apiKey = process.env.CARD_LIST_API_KEY;
  const idMsg = process.env.CARD_LIST_ID_MSG;

  if (!getTransactionsUrl || !apiKey || !idMsg) {
    console.error('Missing environment variables for getting transactions.');
    return { transactions: [], balance: 0, error: 'Server configuration error.' };
  }

  try {
    const response = await fetch(getTransactionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': apiKey,
      },
      body: JSON.stringify({
        header: {
          idmsg: idMsg,
        },
        initiator: {
          card_numb: card_numb,
          start: '1',
          end: '10', // Fetch last 10 transactions
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
        console.error(`Failed to get transactions: ${response.statusText}`);
        return { transactions: [], balance: 0, error: `API error: ${response.statusText}` };
    }

    const data = await response.json();
    const transactionsFromApi = data?.response?.body?.Transactions;

    if (!transactionsFromApi || !Array.isArray(transactionsFromApi)) {
      console.log('No transactions array in the response body.');
      return { transactions: [], balance: 0, error: null };
    }

    const formattedTransactions: Transaction[] = transactionsFromApi.map((tx: TransactionApiResponse) => {
        let status: Transaction['status'] = 'Failed';
        if (tx.Status === 'Approval') {
            status = 'Completed';
        } else if (tx.Status === 'Pending') { 
            status = 'Pending';
        }

        return {
            id: tx['Reference number'],
            date: new Date(tx['transaction date']).toLocaleDateString(),
            description: tx['transaction type name'],
            amount: tx.Status === 'Approval' ? -tx.Amount : tx.Amount,
            status: status,
        };
    });

    const balanceFromTransactions = transactionsFromApi
        .filter((tx: TransactionApiResponse) => tx.Status === 'Approval')
        .reduce((acc: number, tx: TransactionApiResponse) => acc + tx.Amount, 0);


    return { 
        transactions: formattedTransactions, 
        balance: balanceFromTransactions,
        error: null 
    };

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return { transactions: [], balance: 0, error: 'An unexpected error occurred.' };
  }
}

export async function getCardLimits(prevState: any, formData: FormData) {
    const validatedFields = CardNumbSchema.safeParse({
        card_numb: formData.get('card_numb'),
    });

    if (!validatedFields.success) {
        return {
            posLimit: { current: 0, max: 0 },
            atmLimit: { current: 0, max: 0 },
            allLimits: [],
            error: 'Invalid card number provided.',
        };
    }

    const { card_numb } = validatedFields.data;

    const getLimitsUrl = process.env.GET_LIMITS_URL;
    const apiKey = process.env.CARD_LIST_API_KEY;
    const idMsg = process.env.CARD_LIST_ID_MSG;
    const bankCode = process.env.CARD_LIST_BANK_CODE;

    if (!getLimitsUrl || !apiKey || !idMsg || !bankCode) {
        console.error('Missing environment variables for getting limits.');
        return { 
            posLimit: { current: 0, max: 0 }, 
            atmLimit: { current: 0, max: 0 },
            allLimits: [],
            error: 'Server configuration error.' 
        };
    }

    try {
        const response = await fetch(getLimitsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApiKey': apiKey,
            },
            body: JSON.stringify({
                header: { idmsg: idMsg },
                filter: { card: card_numb, bankcode: bankCode },
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`Failed to get limits: ${response.statusText}`);
            return { 
                posLimit: { current: 0, max: 0 },
                atmLimit: { current: 0, max: 0 },
                allLimits: [],
                error: `API error: ${response.statusText}` 
            };
        }

        const data = await response.json();
        const limitsFromApi: LimitApiResponse[] = data?.response?.body?.Risk;

        if (!limitsFromApi || !Array.isArray(limitsFromApi)) {
             return { 
                posLimit: { current: 0, max: 0 },
                atmLimit: { current: 0, max: 0 },
                allLimits: [],
                error: null 
            };
        }
        
        let posMax = 0;
        limitsFromApi
            .filter((limit) => limit.channel === 'POS CHANNEL')
            .forEach((limit) => {
                if (limit.mnt_limite > posMax) {
                    posMax = limit.mnt_limite;
                }
            });

        let atmMax = 0;
        limitsFromApi
            .filter((limit) => limit.channel === 'ATM CHANNEL')
            .forEach((limit) => {
                if (limit.mnt_limite > atmMax) {
                    atmMax = limit.mnt_limite;
                }
            });

        return {
            posLimit: { current: posMax, max: posMax }, // Assuming current is same as max for now
            atmLimit: { current: atmMax, max: atmMax },
            allLimits: limitsFromApi,
            error: null,
        };

    } catch (error) {
        console.error('Error fetching limits:', error);
        return { 
            posLimit: { current: 0, max: 0 },
            atmLimit: { current: 0, max: 0 },
            allLimits: [],
            error: 'An unexpected error occurred while fetching limits.' 
        };
    }
}
