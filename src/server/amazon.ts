import { createHash, createHmac } from 'node:crypto';
import { slugify } from '../lib/slug';
import { getAmazonCacheByItemKey, upsertAmazonCache } from './db/amazon-cache.server';

type AmazonCredentials = {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  host: string;
  region: string;
  marketplace: string;
};

type AmazonSearchItemsResponse = {
  SearchResult?: {
    Items?: Array<{
      ASIN?: string;
      DetailPageURL?: string;
      Images?: {
        Primary?: {
          Large?: { URL?: string };
          Medium?: { URL?: string };
          Small?: { URL?: string };
        };
      };
      ItemInfo?: {
        Title?: { DisplayValue?: string };
        ByLineInfo?: {
          Brand?: { DisplayValue?: string };
        };
      };
      Offers?: {
        Listings?: Array<{
          Price?: {
            DisplayAmount?: string;
          };
        }>;
      };
    }>;
  };
  Errors?: Array<{
    Code?: string;
    Message?: string;
  }>;
};

export type AmazonProduct = {
  asin: string;
  title: string;
  detailPageUrl: string;
  imageUrl: string | null;
  price: string | null;
  brand: string | null;
};

export type AmazonProductSearchResult = {
  configured: boolean;
  cached: boolean;
  marketplace: string;
  products: AmazonProduct[];
  error?: string;
};

function resolveAmazonCredentials(): AmazonCredentials | null {
  const accessKey = (process.env.AMAZON_PAAPI_ACCESS_KEY || '').trim();
  const secretKey = (process.env.AMAZON_PAAPI_SECRET_KEY || '').trim();
  const partnerTag = (process.env.AMAZON_PAAPI_PARTNER_TAG || '').trim();
  const host = (process.env.AMAZON_PAAPI_HOST || 'webservices.amazon.com').trim();
  const region = (process.env.AMAZON_PAAPI_REGION || 'us-east-1').trim();
  const marketplace = (process.env.AMAZON_PAAPI_MARKETPLACE || 'www.amazon.com').trim();

  if (!accessKey || !secretKey || !partnerTag) {
    return null;
  }

  return { accessKey, secretKey, partnerTag, host, region, marketplace };
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signAmazonRequest(
  payload: string,
  credentials: AmazonCredentials,
  now = new Date()
): {
  endpoint: string;
  headers: Record<string, string>;
} {
  const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';
  const method = 'POST';
  const canonicalUri = '/paapi5/searchitems';
  const canonicalQueryString = '';
  const amzDate = toAmzDate(now);
  const datestamp = amzDate.slice(0, 8);
  const service = 'ProductAdvertisingAPI';

  const headers = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: credentials.host,
    'x-amz-date': amzDate,
    'x-amz-target': target,
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}\n`)
    .join('');

  const payloadHash = sha256Hex(payload);
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${datestamp}/${credentials.region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${credentials.secretKey}`, datestamp);
  const kRegion = hmac(kDate, credentials.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  return {
    endpoint: `https://${credentials.host}${canonicalUri}`,
    headers: {
      ...headers,
      Authorization: authorization,
    },
  };
}

function mapAmazonProducts(response: AmazonSearchItemsResponse): AmazonProduct[] {
  const items = response.SearchResult?.Items ?? [];
  return items
    .map((item) => {
      const asin = item.ASIN || '';
      const title = item.ItemInfo?.Title?.DisplayValue || '';
      const detailPageUrl = item.DetailPageURL || '';
      const imageUrl =
        item.Images?.Primary?.Large?.URL ||
        item.Images?.Primary?.Medium?.URL ||
        item.Images?.Primary?.Small?.URL ||
        null;
      const price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || null;
      const brand = item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || null;

      return {
        asin,
        title,
        detailPageUrl,
        imageUrl,
        price,
        brand,
      };
    })
    .filter((item) => item.title && item.detailPageUrl);
}

function buildSearchPayload(itemName: string, credentials: AmazonCredentials): string {
  return JSON.stringify({
    Keywords: itemName,
    ItemCount: 6,
    SearchIndex: 'All',
    PartnerTag: credentials.partnerTag,
    PartnerType: 'Associates',
    Marketplace: credentials.marketplace,
    Resources: [
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Offers.Listings.Price',
    ],
  });
}

export async function searchAmazonProducts(
  itemName: string,
): Promise<AmazonProductSearchResult> {
  const normalizedQuery = itemName.trim();
  const credentials = resolveAmazonCredentials();
  const marketplace = credentials?.marketplace || 'www.amazon.com';

  console.log(`Searching Amazon for ${normalizedQuery} on ${marketplace}`);

  if (!credentials) {
    return {
      configured: false,
      cached: false,
      marketplace,
      products: [],
      error: 'Amazon Product Advertising API credentials are not configured.',
    };
  }

  if (!normalizedQuery) {
    console.log('No normalized query found');
    return {
      configured: true,
      cached: false,
      marketplace,
      products: [],
    };
  }

  const itemKey = slugify(normalizedQuery) || 'item';
  console.log(`Item key: ${itemKey}`);

  try {
    const cached = await getAmazonCacheByItemKey(itemKey, marketplace);
    if (cached) {
      console.log(`Cached products: ${cached.payloadJson}`);
      const products = JSON.parse(cached.payloadJson) as AmazonProduct[];
      return {
        configured: true,
        cached: true,
        marketplace,
        products: Array.isArray(products) ? products : [],
      };
    }
  } catch {
    // fail-soft when cache table is not available
    console.log('Failed to get cached products, continuing...');
  }

  const payload = buildSearchPayload(normalizedQuery, credentials);
  console.log(`Payload: ${payload}`);
  const signed = signAmazonRequest(payload, credentials);
  console.log(`Signed: ${signed.endpoint}`);

  try {
    const response = await fetch(signed.endpoint, {
      method: 'POST',
      headers: signed.headers,
      body: payload,
    });

    if (!response.ok) {
      return {
        configured: true,
        cached: false,
        marketplace,
        products: [],
        error: `Amazon API request failed with ${response.status}.`,
      };
    }

    const parsed = (await response.json()) as AmazonSearchItemsResponse;
    const errors = parsed.Errors ?? [];
    if (errors.length > 0) {
      return {
        configured: true,
        cached: false,
        marketplace,
        products: [],
        error: errors[0]?.Message || 'Amazon API returned an error.',
      };
    }

    const products = mapAmazonProducts(parsed);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await upsertAmazonCache(
        itemKey,
        normalizedQuery,
        marketplace,
        JSON.stringify(products),
        expiresAt
      );
    } catch {
      // fail-soft when cache write fails
    }

    return {
      configured: true,
      cached: false,
      marketplace,
      products,
    };
  } catch (error) {
    return {
      configured: true,
      cached: false,
      marketplace,
      products: [],
      error: error instanceof Error ? error.message : 'Amazon API request failed.',
    };
  }
}

export const __amazonTestUtils = {
  signAmazonRequest,
  mapAmazonProducts,
};
