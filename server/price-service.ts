// Price service for fetching real-time cryptocurrency prices
// BTC and ETH prices are fetched from CoinGecko API
// AMC prices are managed by admin

interface CoinGeckoPrice {
  usd: number;
  usd_24h_change: number;
}

interface CoinGeckoResponse {
  [coinId: string]: CoinGeckoPrice;
}

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";
const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
};

// Cache prices to avoid rate limiting (update every 60 seconds)
let priceCache: {
  BTC?: { price: number; change24h: number; timestamp: number };
  ETH?: { price: number; change24h: number; timestamp: number };
} = {};

const CACHE_DURATION = 60 * 1000; // 60 seconds

export async function fetchRealTimePrices(): Promise<{
  BTC?: { price: number; change24h: number };
  ETH?: { price: number; change24h: number };
}> {
  try {
    const coinIds = [COINGECKO_IDS.BTC, COINGECKO_IDS.ETH].join(",");
    const url = `${COINGECKO_API_URL}?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`;
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: CoinGeckoResponse = await response.json();
    
    const now = Date.now();
    const prices: {
      BTC?: { price: number; change24h: number };
      ETH?: { price: number; change24h: number };
    } = {};

    if (data[COINGECKO_IDS.BTC]) {
      prices.BTC = {
        price: data[COINGECKO_IDS.BTC].usd,
        change24h: data[COINGECKO_IDS.BTC].usd_24h_change || 0,
      };
      priceCache.BTC = { ...prices.BTC, timestamp: now };
    }

    if (data[COINGECKO_IDS.ETH]) {
      prices.ETH = {
        price: data[COINGECKO_IDS.ETH].usd,
        change24h: data[COINGECKO_IDS.ETH].usd_24h_change || 0,
      };
      priceCache.ETH = { ...prices.ETH, timestamp: now };
    }

    return prices;
  } catch (error) {
    console.error("Error fetching real-time prices:", error);
    
    // Return cached prices if available and not too old
    const now = Date.now();
    const cached: {
      BTC?: { price: number; change24h: number };
      ETH?: { price: number; change24h: number };
    } = {};

    if (priceCache.BTC && (now - priceCache.BTC.timestamp) < CACHE_DURATION * 2) {
      cached.BTC = { price: priceCache.BTC.price, change24h: priceCache.BTC.change24h };
    }

    if (priceCache.ETH && (now - priceCache.ETH.timestamp) < CACHE_DURATION * 2) {
      cached.ETH = { price: priceCache.ETH.price, change24h: priceCache.ETH.change24h };
    }

    return cached;
  }
}

export async function getCachedOrFetchPrices(): Promise<{
  BTC?: { price: number; change24h: number };
  ETH?: { price: number; change24h: number };
}> {
  const now = Date.now();
  
  // Check if we have fresh cached prices
  const btcCache = priceCache.BTC;
  const ethCache = priceCache.ETH;
  
  const btcFresh = btcCache && (now - btcCache.timestamp) < CACHE_DURATION;
  const ethFresh = ethCache && (now - ethCache.timestamp) < CACHE_DURATION;
  
  if (btcFresh && ethFresh) {
    return {
      BTC: { price: btcCache.price, change24h: btcCache.change24h },
      ETH: { price: ethCache.price, change24h: ethCache.change24h },
    };
  }
  
  // Fetch new prices
  return await fetchRealTimePrices();
}

