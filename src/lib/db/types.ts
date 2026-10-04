import Decimal from "decimal.js";

export { Decimal };

export const Role = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const MetalType = {
  GOLD: "GOLD",
  SILVER: "SILVER",
} as const;
export type MetalType = (typeof MetalType)[keyof typeof MetalType];

export const TransactionStatus = {
  DRAFT: "DRAFT",
  POSTED: "POSTED",
  CANCELLED: "CANCELLED",
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const AdjustmentDirection = {
  INCREASE: "INCREASE",
  DECREASE: "DECREASE",
} as const;
export type AdjustmentDirection = (typeof AdjustmentDirection)[keyof typeof AdjustmentDirection];

export const PaymentMode = {
  CASH: "CASH",
  UPI: "UPI",
  BANK_TRANSFER: "BANK_TRANSFER",
  CARD: "CARD",
  CHEQUE: "CHEQUE",
  OTHER: "OTHER",
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const CounterpartyType = {
  SUPPLIER: "SUPPLIER",
  CUSTOMER: "CUSTOMER",
  BOTH: "BOTH",
} as const;
export type CounterpartyType = (typeof CounterpartyType)[keyof typeof CounterpartyType];

export const MovementType = {
  OPENING: "OPENING",
  PURCHASE: "PURCHASE",
  PURCHASE_CANCEL: "PURCHASE_CANCEL",
  SALE: "SALE",
  SALE_CANCEL: "SALE_CANCEL",
  ADJUSTMENT_INCREASE: "ADJUSTMENT_INCREASE",
  ADJUSTMENT_DECREASE: "ADJUSTMENT_DECREASE",
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  CANCEL: "CANCEL",
  ACTIVATE: "ACTIVATE",
  DEACTIVATE: "DEACTIVATE",
  POST: "POST",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
