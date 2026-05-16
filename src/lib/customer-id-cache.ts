import prisma from "@/lib/prisma";
import {
  extractCustomerIdFromAccountSource,
  extractCustomerIdFromCustDetail,
} from "@/lib/cust-detail";
import {
  fetchCustInfoByAccount,
  getCustDetailFromResponse,
} from "@/lib/prepaid-api";

const PHONE_PREFIX = "phone:";
const ACCOUNT_PREFIX = "account:";

export function phoneLookupKey(phoneNumber: string): string {
  return `${PHONE_PREFIX}${phoneNumber.trim()}`;
}

export function accountLookupKey(accountNumber: string): string {
  return `${ACCOUNT_PREFIX}${accountNumber.trim()}`;
}

export async function getCachedCustomerIdByPhone(
  phoneNumber: string,
): Promise<string | undefined> {
  const row = await prisma.customerLookup.findUnique({
    where: { lookupKey: phoneLookupKey(phoneNumber) },
    select: { customerId: true },
  });
  return row?.customerId;
}

export async function getCachedCustomerIdByAccount(
  accountNumber: string,
): Promise<string | undefined> {
  const row = await prisma.customerLookup.findUnique({
    where: { lookupKey: accountLookupKey(accountNumber) },
    select: { customerId: true },
  });
  return row?.customerId;
}

export type CachedAccountSummary = {
  accountNumber: string;
};

/** Account numbers previously linked to a customer id in CustomerLookup. */
export async function getCachedAccountsByCustomerId(
  customerId: string,
): Promise<CachedAccountSummary[]> {
  const rows = await prisma.customerLookup.findMany({
    where: {
      customerId,
      lookupKey: { startsWith: ACCOUNT_PREFIX },
    },
    select: { lookupKey: true },
  });

  const seen = new Set<string>();
  const accounts: CachedAccountSummary[] = [];
  for (const row of rows) {
    const accountNumber = row.lookupKey.slice(ACCOUNT_PREFIX.length).trim();
    if (!accountNumber || seen.has(accountNumber)) continue;
    seen.add(accountNumber);
    accounts.push({ accountNumber });
  }
  return accounts;
}

export async function cacheCustomerIdMappings(params: {
  customerId: string;
  phoneNumber?: string | null;
  accountNumbers?: string[];
}): Promise<void> {
  const customerId = params.customerId.trim();
  if (!customerId) return;

  const keys = new Set<string>();
  if (params.phoneNumber?.trim()) {
    keys.add(phoneLookupKey(params.phoneNumber));
  }
  for (const accountNumber of params.accountNumbers ?? []) {
    if (accountNumber.trim()) {
      keys.add(accountLookupKey(accountNumber));
    }
  }
  if (keys.size === 0) return;

  await prisma.$transaction(
    [...keys].map((lookupKey) =>
      prisma.customerLookup.upsert({
        where: { lookupKey },
        create: { lookupKey, customerId },
        update: { customerId },
      }),
    ),
  );
}

async function resolveCustomerIdFromApis(params: {
  accounts: { accountNumber: string }[];
  rawAccounts: Record<string, unknown>[];
  accountsEnvelope?: Record<string, unknown>;
}): Promise<string | undefined> {
  if (params.accountsEnvelope) {
    const fromEnvelope = extractCustomerIdFromAccountSource(
      params.accountsEnvelope,
    );
    if (fromEnvelope) return fromEnvelope;
  }

  for (const acc of params.rawAccounts) {
    const fromAccount = extractCustomerIdFromAccountSource(acc);
    if (fromAccount) return fromAccount;
  }

  const firstAccount = params.accounts.find((a) => a.accountNumber);
  if (!firstAccount?.accountNumber) return undefined;

  try {
    const customerInfo = await fetchCustInfoByAccount(firstAccount.accountNumber);
    const detail = getCustDetailFromResponse(customerInfo);
    return extractCustomerIdFromCustDetail(detail);
  } catch {
    return undefined;
  }
}

/**
 * Returns a cached customer id when possible; otherwise resolves via external APIs
 * and persists mappings for the phone and all known account numbers.
 */
export async function resolveCustomerIdWithCache(params: {
  phoneNumber: string;
  accounts: { accountNumber: string }[];
  rawAccounts?: Record<string, unknown>[];
  accountsEnvelope?: Record<string, unknown>;
}): Promise<string | undefined> {
  const accountNumbers = params.accounts
    .map((a) => a.accountNumber)
    .filter(Boolean);

  const cachedByPhone = await getCachedCustomerIdByPhone(params.phoneNumber);
  if (cachedByPhone) {
    await cacheCustomerIdMappings({
      customerId: cachedByPhone,
      phoneNumber: params.phoneNumber,
      accountNumbers,
    });
    return cachedByPhone;
  }

  for (const accountNumber of accountNumbers) {
    const cachedByAccount = await getCachedCustomerIdByAccount(accountNumber);
    if (cachedByAccount) {
      await cacheCustomerIdMappings({
        customerId: cachedByAccount,
        phoneNumber: params.phoneNumber,
        accountNumbers,
      });
      return cachedByAccount;
    }
  }

  const customerId = await resolveCustomerIdFromApis({
    accounts: params.accounts,
    rawAccounts: params.rawAccounts ?? [],
    accountsEnvelope: params.accountsEnvelope,
  });

  if (customerId) {
    await cacheCustomerIdMappings({
      customerId,
      phoneNumber: params.phoneNumber,
      accountNumbers,
    });
  }

  return customerId;
}
