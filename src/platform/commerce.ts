import type { Product } from "../data";
import type { StorefrontSettings } from "./types";

export type SettingsPatch = Partial<Pick<StorefrontSettings, "freeShippingThreshold" | "insuranceMode" | "insuranceRate">>;
export const CATALOG_MAX_BYTES = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Upload originals without resizing, recolouring or deriving a new label. */
export function catalogPhotoPath(productId: string, file: Pick<File, "size" | "type">, timestamp = Date.now()) {
  if (!/^[a-z0-9-]+$/.test(productId)) throw new Error("Invalid product identifier.");
  const extension = imageTypes[file.type];
  if (!extension) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size <= 0 || file.size > CATALOG_MAX_BYTES) throw new Error("Choose an image up to 5 MB.");
  return `${productId}-${timestamp}.${extension}`;
}

export function stockProblem(product: Product, quantity: number): string | null {
  if (product.active === false) return `${product.name} is no longer available. Remove it from your bag.`;
  if (product.stock != null && quantity > product.stock) {
    return product.stock === 0 ? `${product.name} is out of stock. Remove it from your bag to continue.`
      : `Only ${product.stock} left of ${product.name}. Reduce the quantity to continue.`;
  }
  return null;
}
