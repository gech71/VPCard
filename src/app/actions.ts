
'use server';

import type { Transaction } from '@/lib/data';
import { z } from 'zod';

const ActionInputSchema = z.object({
  card_numb: z.string(),
});

type TransactionApiResponse = {
    'transaction date': string;
    'transaction type name': string;
    Amount: number;
    Status: 'Approval' | 'Decline' | string;
    'Reference number': string;
}

export async function getCardTransactions(prevState: any, formData: FormData) {
  const validatedFields = ActionInputSchema.safeParse({
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

    let calculatedBalance = 0;
    const formattedTransactions: Transaction[] = transactionsFromApi.map((tx: TransactionApiResponse) => {
        const amount = tx.Status === 'Approval' ? tx.Amount : -tx.Amount;
        calculatedBalance += amount; // This is likely not the true balance, but summing up for now.

        let status: Transaction['status'] = 'Failed';
        if (tx.Status === 'Approval') {
            status = 'Completed';
        } else if (tx.Status === 'Pending') { // Assuming there might be a pending status
            status = 'Pending';
        }

        return {
            id: tx['Reference number'],
            date: new Date(tx['transaction date']).toLocaleDateString(),
            description: tx['transaction type name'],
            amount: tx.Status === 'Approval' ? -tx.Amount : tx.Amount, // Assuming amounts are expenses
            status: status,
        };
    });

    // The API gives a list of transactions, not a final balance.
    // For now, we are calculating a balance from the sum of transaction amounts.
    // This is likely incorrect and should be revisited if a proper balance API is available.
    const balanceFromTransactions = transactionsFromApi
        .filter((tx: TransactionApiResponse) => tx.Status === 'Approval')
        .reduce((acc, tx) => acc + tx.Amount, 0);


    return { 
        transactions: formattedTransactions, 
        balance: balanceFromTransactions, // Placeholder balance logic
        error: null 
    };

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return { transactions: [], balance: 0, error: 'An unexpected error occurred.' };
  }
}
