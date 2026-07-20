import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Loader2, Shield, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCustomerPaymentHistory } from '../services/walletService';
import { formatCurrency } from '../services/paystackService';
import type { EscrowHold, Transaction } from '../types/database';
import type { PaymentCurrency } from '../types/payment';
import PageHelmet from '../components/PageHelmet';

const holdLabel: Record<string, string> = {
  held: 'Held in escrow',
  released: 'Released to worker',
  refunded: 'Refunded (platform hold cleared)',
  cancelled: 'Cancelled',
};

const PaymentHistory: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holds, setHolds] = useState<EscrowHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const result = await getCustomerPaymentHistory(user.id);
      if (cancelled) return;
      if (result.error) {
        setError(result.error.message || 'Could not load payment history');
      } else if (result.data) {
        setTransactions(result.data.transactions);
        setHolds(result.data.holds);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <>
      <PageHelmet title="Payment History" path="/payments" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
        <div className="max-w-3xl mx-auto py-6">
          <Link
            to="/dashboard/customer"
            className="inline-flex items-center gap-1 text-sm text-forge-orange font-medium hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Customer Hub
          </Link>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-forge-orange mb-1">
              Customer OS
            </p>
            <h1 className="text-2xl font-bold text-forge-navy">Payment History</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Card charges and escrow holds for your bookings. Funds release to the worker when a job
              is marked completed.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-16 bg-white rounded-xl">
              <Loader2 className="w-8 h-8 text-forge-orange animate-spin mb-3" />
              <p className="text-gray-500 text-sm">Loading payments…</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
          ) : (
            <div className="space-y-8">
              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-forge-navy" /> Escrow holds
                </h2>
                {holds.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-500">
                    No escrow holds yet. When you pay for a booking, the amount is held until the job
                    is completed.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {holds.map((h) => (
                      <li
                        key={h.id}
                        className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium text-forge-navy">
                            {formatCurrency(Number(h.amount), h.currency as PaymentCurrency)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Booking #{h.booking_id.slice(0, 8)} · {holdLabel[h.status] || h.status}
                          </p>
                          {h.status === 'refunded' && (
                            <p className="text-xs text-amber-700 mt-1">
                              Platform hold cleared. Card refund via Paystack may be processed
                              manually if needed.
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                            h.status === 'held'
                              ? 'bg-amber-100 text-amber-800'
                              : h.status === 'released'
                              ? 'bg-green-100 text-green-800'
                              : h.status === 'refunded'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {h.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-forge-orange" /> Transactions
                </h2>
                {transactions.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-500">
                    No transactions yet.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {transactions.map((t) => (
                      <li
                        key={t.id}
                        className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium text-forge-navy capitalize">{t.type}</p>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {formatCurrency(Number(t.amount), t.currency as PaymentCurrency)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(t.created_at).toLocaleString()}
                            {t.provider_txn_id ? ` · Ref ${t.provider_txn_id.slice(0, 12)}…` : ''}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                            t.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : t.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PaymentHistory;
