export type StoreAvail = { 
  storeCode: string; 
  storeName: string; 
  inStock: boolean; 
  price: number | null;
};

export type NormalizedVariant = { 
  price: number | null; 
  inStock: boolean; 
  isPreorder?: boolean;
  isInStoreOnly?: boolean;
  isUnavailable?: boolean;
  storeAvails?: StoreAvail[];
};

export type NormalizedProduct = { 
  retailer: string; 
  productUrl: string; 
  productTitle: string; 
  sku?: string; 
  variants: NormalizedVariant[];
};

export type Adapter = (
  url: string, 
  opts?: { postcode?: string }
) => Promise<NormalizedProduct>;

import { checkGenericDom } from "./genericDom";
import { checkKmart } from "./kmart";
import { checkBigW } from "./bigw";
import { checkEB } from "./ebgames";
import { checkCollectibleMadness } from "./collectiblemadness";

export const adapters: Record<string, Adapter> = {
  kmart: checkKmart,
  bigw: checkBigW,
  ebgames: checkEB,
  collectiblemadness: checkCollectibleMadness,
  genericDom: checkGenericDom
};