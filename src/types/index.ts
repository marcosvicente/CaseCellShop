export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export type CheckoutItem = {
  productId: string;
  quantity: number;
};

export type CheckoutRequest = {
  items: CheckoutItem[];
};

export type OrderStatus = "processing" | "completed" | "failed";

export type Order = {
  orderId: string;
  status: OrderStatus;
  items: CheckoutItem[];
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
};

export type CheckoutResponse = {
  orderId: string;
  status: OrderStatus;
};

export type ApiError = {
  error: string;
  message: string;
  requestId?: string;
};
