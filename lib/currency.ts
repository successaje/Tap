"use client";

const RATES_KEY = "tap:rates";
const RATES_AGE_KEY = "tap:rates-age";
const MAX_AGE = 1000 * 60 * 30; // 30 minutes

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150.5,
  NGN: 1145.0,
  ARS: 880.0,
  BRL: 5.15,
};

export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "NGN", label: "Nigerian Naira", symbol: "₦" },
  { code: "ARS", label: "Argentine Peso", symbol: "$" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$" },
];

/**
 * Fetches and caches exchange rates from CoinGecko.
 * Base is USDC, which roughly equals USD.
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  if (typeof window === "undefined") return FALLBACK_RATES;

  try {
    const age = Number(window.localStorage.getItem(RATES_AGE_KEY) || 0);
    const cached = window.localStorage.getItem(RATES_KEY);
    if (cached && Date.now() - age < MAX_AGE) {
      return JSON.parse(cached);
    }

    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur,gbp,jpy,ngn,ars,brl"
    );
    const data = await res.json();
    const rates: Record<string, number> = {
      // Our amounts are USD-denominated, so USD is always an exact identity —
      // never the ~0.9998 USDC/USD quote, which would turn $42.50 into $42.49.
      USD: 1,
      EUR: data["usd-coin"].eur || FALLBACK_RATES.EUR,
      GBP: data["usd-coin"].gbp || FALLBACK_RATES.GBP,
      JPY: data["usd-coin"].jpy || FALLBACK_RATES.JPY,
      NGN: data["usd-coin"].ngn || FALLBACK_RATES.NGN,
      ARS: data["usd-coin"].ars || FALLBACK_RATES.ARS,
      BRL: data["usd-coin"].brl || FALLBACK_RATES.BRL,
    };

    window.localStorage.setItem(RATES_KEY, JSON.stringify(rates));
    window.localStorage.setItem(RATES_AGE_KEY, Date.now().toString());
    return rates;
  } catch (err) {
    console.warn("Failed to fetch rates, using fallback", err);
    return FALLBACK_RATES;
  }
}

export function formatCurrency(
  amountUsd: number,
  targetCurrency: string,
  rates: Record<string, number> = FALLBACK_RATES
): string {
  // USD is the base unit of our amounts — never convert it, so round numbers
  // stay round ($42.50 not $42.49).
  const rate = targetCurrency === "USD" ? 1 : rates[targetCurrency] || 1;
  const converted = amountUsd * rate;
  
  // NGN, ARS, JPY typically don't show cents in general casual display
  const hideDecimals = ["JPY", "NGN", "ARS"].includes(targetCurrency);
  const maxFraction = hideDecimals ? 0 : 2;

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: targetCurrency,
    minimumFractionDigits: hideDecimals ? 0 : 2,
    maximumFractionDigits: maxFraction,
  }).format(converted);
}
