/**
 * Wallet / escrow service — M4 foundations
 *
 * Balance mutations happen only via SECURITY DEFINER RPCs (or webhook service role).
 * This client module reads wallets/ledger/holds and invokes fund/release/refund RPCs.
 */

import { supabase } from './supabase';
import type {
  Currency,
  EscrowHold,
  Wallet,
  WalletLedgerEntry,
  Transaction,
} from '../types/database';
import { handleDatabaseError, DatabaseError } from './databaseErrors';
import { captureError, startTransaction } from './monitoringService';

export interface WalletServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface WorkerWalletSummary {
  wallets: Wallet[];
  ledger: WalletLedgerEntry[];
  holds: EscrowHold[];
}

export interface CustomerPaymentHistory {
  transactions: Transaction[];
  holds: EscrowHold[];
}

/** Ensure a wallet row exists for the current user + currency (read-side helper). */
export async function ensureWallet(
  userId: string,
  currency: Currency
): Promise<WalletServiceResult<Wallet>> {
  try {
    const { data, error } = await (supabase.rpc as any)('ensure_wallet', {
      p_user_id: userId,
      p_currency: currency,
    });

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as Wallet, error: null };
  } catch (err: any) {
    return { data: null, error: handleDatabaseError(err) };
  }
}

/** List wallets for a user (own row via RLS). */
export async function getWallets(
  userId: string
): Promise<WalletServiceResult<Wallet[]>> {
  const transaction = startTransaction('wallet.list', 'db');
  try {
    const { data, error } = await (supabase.from('wallets') as any)
      .select('*')
      .eq('user_id', userId)
      .order('currency', { ascending: true });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getWallets' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data || []) as Wallet[], error: null };
  } finally {
    transaction.finish();
  }
}

/** Append-only ledger for a wallet, newest first. */
export async function getWalletLedger(
  walletId: string,
  limit = 50
): Promise<WalletServiceResult<WalletLedgerEntry[]>> {
  try {
    const { data, error } = await (supabase.from('wallet_ledger_entries') as any)
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data || []) as WalletLedgerEntry[], error: null };
  } catch (err: any) {
    return { data: null, error: handleDatabaseError(err) };
  }
}

/** Escrow holds where user is customer or worker. */
export async function getEscrowHoldsForUser(
  userId: string
): Promise<WalletServiceResult<EscrowHold[]>> {
  try {
    const { data, error } = await (supabase.from('escrow_holds') as any)
      .select('*')
      .or(`customer_user_id.eq.${userId},worker_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data || []) as EscrowHold[], error: null };
  } catch (err: any) {
    return { data: null, error: handleDatabaseError(err) };
  }
}

/** Worker hub: wallets + ledger + holds. */
export async function getWorkerWalletSummary(
  userId: string
): Promise<WalletServiceResult<WorkerWalletSummary>> {
  const transaction = startTransaction('wallet.workerSummary', 'db');
  try {
    // Ensure default currency wallets exist so UI is never empty for new workers
    await ensureWallet(userId, 'GHS');
    await ensureWallet(userId, 'NGN');

    const [walletsResult, holdsResult] = await Promise.all([
      getWallets(userId),
      getEscrowHoldsForUser(userId),
    ]);

    if (walletsResult.error) {
      return { data: null, error: walletsResult.error };
    }

    const wallets = walletsResult.data || [];
    const ledgerChunks = await Promise.all(
      wallets.map((w) => getWalletLedger(w.id, 40))
    );

    const ledger = ledgerChunks
      .flatMap((r) => r.data || [])
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 50);

    return {
      data: {
        wallets,
        ledger,
        holds: holdsResult.data || [],
      },
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/** Customer payment history: Paystack transactions + escrow holds. */
export async function getCustomerPaymentHistory(
  userId: string
): Promise<WalletServiceResult<CustomerPaymentHistory>> {
  const transaction = startTransaction('wallet.customerHistory', 'db');
  try {
    const [txnResult, holdsResult] = await Promise.all([
      (supabase.from('transactions') as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      getEscrowHoldsForUser(userId),
    ]);

    if (txnResult.error) {
      return { data: null, error: handleDatabaseError(txnResult.error) };
    }

    return {
      data: {
        transactions: (txnResult.data || []) as Transaction[],
        holds: holdsResult.data || [],
      },
      error: holdsResult.error,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Create escrow hold after booking payment is linked to a booking.
 * Prefer webhook path; client calls this after createDirectBooking for race safety.
 */
export async function fundBookingEscrow(
  bookingId: string,
  providerTxnId?: string | null,
  amount?: number | null,
  currency?: Currency | null
): Promise<WalletServiceResult<EscrowHold>> {
  try {
    const { data, error } = await (supabase.rpc as any)('fund_booking_escrow', {
      p_booking_id: bookingId,
      p_provider_txn_id: providerTxnId ?? null,
      p_amount: amount ?? null,
      p_currency: currency ?? null,
    });

    if (error) {
      captureError(new Error(error.message), {
        tags: { operation: 'fundBookingEscrow' },
      });
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as EscrowHold, error: null };
  } catch (err: any) {
    return { data: null, error: handleDatabaseError(err) };
  }
}

/** Explicit release (normally handled by booking status trigger). */
export async function releaseEscrowHold(
  bookingId: string
): Promise<WalletServiceResult<EscrowHold>> {
  try {
    const { data, error } = await (supabase.rpc as any)('release_escrow_hold', {
      p_booking_id: bookingId,
    });

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as EscrowHold, error: null };
  } catch (err: any) {
    return { data: null, error: handleDatabaseError(err) };
  }
}

/** Explicit refund of platform hold (Paystack card refund may still be manual). */
export async function refundEscrowHold(
  bookingId: string
): Promise<WalletServiceResult<EscrowHold>> {
  try {
    const { data, error } = await (supabase.rpc as any)('refund_escrow_hold', {
      p_booking_id: bookingId,
    });

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as EscrowHold, error: null };
  } catch (err: any) {
    return { data: null, error: handleDatabaseError(err) };
  }
}

/** Stub withdrawal — no bank transfer / Paystack Transfer in M4. */
export async function requestWithdrawalStub(
  _userId: string,
  _currency: Currency,
  _amount: number
): Promise<WalletServiceResult<{ message: string }>> {
  return {
    data: {
      message:
        'Withdrawals coming soon. Your available and pending balances are tracked on FORGE; bank payouts are not enabled yet.',
    },
    error: null,
  };
}
