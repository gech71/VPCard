export type CardDetails = {
  fullNumber: string;
  maskedNumber: string;
  expiryDate: string;
  cardholderName: string;
  status: 'Active' | 'Inactive' | 'Frozen';
  type: 'Visa' | 'Mastercard';
  balance: number;
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

export const cardDetails: CardDetails = {
  fullNumber: '4242 4242 4242 4242',
  maskedNumber: '**** **** **** 4242',
  expiryDate: '12/26',
  cardholderName: 'Jane Doe',
  status: 'Active',
  type: 'Visa',
  balance: 2548.75,
};

export const transactions: Transaction[] = [
  { id: 'txn1', date: '2024-07-22', description: 'Amazon Purchase', amount: -75.50, status: 'Completed' },
  { id: 'txn2', date: '2024-07-21', description: 'Starbucks', amount: -5.25, status: 'Completed' },
  { id: 'txn3', date: '2024-07-20', description: 'Salary Deposit', amount: 1500.00, status: 'Completed' },
  { id: 'txn4', date: '2024-07-19', description: 'Uber Eats', amount: -25.00, status: 'Pending' },
  { id: 'txn5', date: '2024-07-18', description: 'Netflix Subscription', amount: -15.99, status: 'Completed' },
  { id: 'txn6', date: '2024-07-17', description: 'Gas Station', amount: -45.30, status: 'Completed' },
  { id: 'txn7', date: '2024-07-16', description: 'Online Store Refund', amount: 50.00, status: 'Completed' },
  { id: 'txn8', date: '2024-07-15', description: 'Grocery Store', amount: -120.10, status: 'Failed' },
];

export const posLimit: Limit = {
  current: 1000,
  max: 5000,
};

export const atmLimit: Limit = {
  current: 300,
  max: 1000,
};
