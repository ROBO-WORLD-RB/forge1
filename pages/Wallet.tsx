import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet as WalletIcon, Loader2, ArrowLeft, Banknote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getWorkerWalletSummary,
  requestWithdrawalStub,
} from '../services/walletService';
import { formatCurrency } from '../services/paystackService';
import type { EscrowHold, Wallet, WalletLedgerEntry } from '../types/database';
import type { PaymentCurrency } from '../types/payment';
import PageHelmet from '../components/PageHelmet';
import Button from '../components/Button';

const entryLabels: Record<string, string> = {
  escrow_hold: 'Escrow hold (pending)',
  escrow_release: 'Released to available',
  escrow_refund: 'Hold refunded',
  adjustment: 'Adjustment',
  withdrawal_request: 'Withdrawal request',
};

const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [holds, setHolds] = useState<EscrowHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const result = await getWorkerWalletSummary(user.id);
      if (cancelled) return;
      if (result.error) {
        setError(result.error.message || 'Could not load wallet');
      } else if (result.data) {
        setWallets(result.data.wallets);
        setLedger(result.data.ledger);
        setHolds(result.data.holds.filter((h) => h.worker_user_id === user.id));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleWithdrawStub = async (currency: PaymentCurrency) => {
    if (!user?.id) return;
    const result = await requestWithdrawalStub(user.id, currency, 0);
    setWithdrawMsg(result.data?.message || 'Withdrawals coming soon.');
  };

  return (
    <>
      <PageHelmet title="Wallet & Earnings" path="/wallet" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-4 md:pt-6 overflow-x-hidden">
        <div className="max-w-3xl mx-auto py-6">
          <Link
            to="/dashboard/worker"
            className="inline-flex items-center gap-1 text-sm text-forge-orange font-medium hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Worker Hub
          </Link>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-forge-orange mb-1">
              Worker OS
            </p>
            <h1 className="text-2xl font-bold text-forge-navy flex items-center gap-2">
              <WalletIcon className="w-7 h-7 text-forge-orange" />
              Wallet & Earnings
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Pending = funds held until the customer job is completed. Available = released to you.
              Bank withdrawals are not enabled yet.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-16 bg-white rounded-xl">
              <Loader2 className="w-8 h-8 text-forge-orange animate-spin mb-3" />
              <p className="text-gray-500 text-sm">Loading wallet…</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
          ) : (
            <div className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-4">
                {wallets.map((w) => (
                  <div
                    key={w.id}
                    className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">
                      {w.currency} wallet
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-600">Available</span>
                        <span className="text-xl font-bold text-forge-navy">
                          {formatCurrency(
                            Number(w.available_balance),
                            w.currency as PaymentCurrency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-600">Pending (escrow)</span>
                        <span className="text-lg font-semibold text-amber-700">
                          {formatCurrency(
                            Number(w.pending_balance),
                            w.currency as PaymentCurrency
                          )}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full mt-4"
                      onClick={() => handleWithdrawStub(w.currency as PaymentCurrency)}
                    >
                      <Banknote className="w-4 h-4 mr-1.5" />
                      Withdraw — coming soon
                    </Button>
                  </div>
                ))}
              </div>

              {withdrawMsg && (
                <div className="bg-amber-50 border border-amber-100 text-amber-900 text-sm p-4 rounded-xl">
                  {withdrawMsg}
                </div>
              )}

              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Active / recent holds
                </h2>
                {holds.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-sm text-gray-500">
                    No escrow holds yet. Paid bookings will show pending earnings here.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {holds.slice(0, 10).map((h) => (
                      <li
                        key={h.id}
                        className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex justify-between gap-2 text-sm"
                      >
                        <span>
                          {formatCurrency(Number(h.amount), h.currency as PaymentCurrency)} · booking
                          #{h.booking_id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-medium text-gray-600 capitalize">
                          {h.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Ledger
                </h2>
                {ledger.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-sm text-gray-500">
                    No ledger entries yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {ledger.map((e) => (
                      <li
                        key={e.id}
                        className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-forge-navy">
                            {entryLabels[e.entry_type] || e.entry_type}
                          </span>
                          <span
                            className={
                              e.direction === 'credit' ? 'text-green-700' : 'text-gray-700'
                            }
                          >
                            {e.direction === 'credit' ? '+' : '−'}
                            {formatCurrency(Number(e.amount), e.currency as PaymentCurrency)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(e.created_at).toLocaleString()}
                          {e.description ? ` · ${e.description}` : ''}
                        </p>
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

export default WalletPage;
