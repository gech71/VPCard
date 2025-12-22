import { cardDetails, transactions, atmLimit, posLimit } from '@/lib/data';
import DashboardHeader from '@/components/dashboard-header';
import CardDisplay from '@/components/card-display';
import TransactionHistory from '@/components/transaction-history';
import LimitManager from '@/components/limit-manager';
import { Landmark, Store } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen w-full">
      <DashboardHeader />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 flex flex-col gap-8">
            <CardDisplay card={cardDetails} />
          </div>
          <div className="lg:col-span-2">
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
