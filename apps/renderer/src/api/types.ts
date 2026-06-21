export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface ProductWithStock {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  salePrice: string;
  taxRatePct: string;
  quantityOnHand: string;
}

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: string;
  taxRatePct: string;
  quantity: number;
  discountValue: string;
}
