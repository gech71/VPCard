
export type CardDetails = {
  id: string;
  fullNumber: string;
  maskedNumber: string;
  expiryDate: string;
  cardholderName: string;
  status: 'Active' | 'Inactive' | 'Frozen';
  type: 'Visa' | 'Mastercard' | 'Unknown' | string;
  balance: number;
  accountNumber: string;
  currency: string;
  cardTypeNetwork: string;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
};

export type Limit = {
  current: number;
  max: number;
};

export const cardDetails: CardDetails[] = [];

export const transactions: Transaction[] = [];

export const posLimit: Limit = {
  current: 0,
  max: 0,
};

export const atmLimit: Limit = {
  current: 0,
  max: 0,
};
