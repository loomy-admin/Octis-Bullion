import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface CashDenominationBreakdown {
  500?: number;
  200?: number;
  100?: number;
  50?: number;
  20?: number;
  10?: number;
  coins?: number;
}

export interface PaymentAttributes {
  id: string;
  paymentNumber: string;
  type: "PAYMENT_MADE" | "PAYMENT_RECEIVED";
  counterpartyId: string;
  partyName: string;
  date: Date;
  amount: number | string;
  paymentMode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "RTGS_NEFT" | "OTHER";
  referenceNumber?: string | null;
  linkedPurchaseId?: string | null;
  linkedSaleId?: string | null;
  cashDenominations?: CashDenominationBreakdown | null;
  status: "POSTED" | "CANCELLED";
  cancelReason?: string | null;
  cancelledAt?: Date | null;
  cancelledById?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  counterparty?: import("./Counterparty").CounterpartyAttributes;
  purchase?: import("./Purchase").PurchaseAttributes | null;
  sale?: import("./Sale").SaleAttributes | null;
  createdBy?: import("./User").UserAttributes;
}

export type PaymentCreationAttributes = Optional<
  PaymentAttributes,
  | "id"
  | "referenceNumber"
  | "linkedPurchaseId"
  | "linkedSaleId"
  | "cashDenominations"
  | "status"
  | "cancelReason"
  | "cancelledAt"
  | "cancelledById"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

export class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  declare id: string;
  declare paymentNumber: string;
  declare type: "PAYMENT_MADE" | "PAYMENT_RECEIVED";
  declare counterpartyId: string;
  declare partyName: string;
  declare date: Date;
  declare amount: number | string;
  declare paymentMode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "RTGS_NEFT" | "OTHER";
  declare referenceNumber: string | null;
  declare linkedPurchaseId: string | null;
  declare linkedSaleId: string | null;
  declare cashDenominations: CashDenominationBreakdown | null;
  declare status: "POSTED" | "CANCELLED";
  declare cancelReason: string | null;
  declare cancelledAt: Date | null;
  declare cancelledById: string | null;
  declare notes: string | null;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Payment.init(
  {
    id: {
      type: DataTypes.STRING(191),
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    paymentNumber: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      field: "payment_number",
    },
    type: {
      type: DataTypes.ENUM("PAYMENT_MADE", "PAYMENT_RECEIVED"),
      allowNull: false,
    },
    counterpartyId: {
      type: DataTypes.STRING(191),
      allowNull: false,
      field: "counterparty_id",
      references: {
        model: "counterparty",
        key: "id",
      },
    },
    partyName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "party_name",
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    paymentMode: {
      type: DataTypes.ENUM("CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "RTGS_NEFT", "OTHER"),
      allowNull: false,
      defaultValue: "CASH",
      field: "payment_mode",
    },
    referenceNumber: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: "reference_number",
    },
    linkedPurchaseId: {
      type: DataTypes.STRING(191),
      allowNull: true,
      field: "linked_purchase_id",
      references: {
        model: "purchase",
        key: "id",
      },
    },
    linkedSaleId: {
      type: DataTypes.STRING(191),
      allowNull: true,
      field: "linked_sale_id",
      references: {
        model: "sale",
        key: "id",
      },
    },
    cashDenominations: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "cash_denominations",
    },
    status: {
      type: DataTypes.ENUM("POSTED", "CANCELLED"),
      allowNull: false,
      defaultValue: "POSTED",
    },
    cancelReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "cancel_reason",
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "cancelled_at",
    },
    cancelledById: {
      type: DataTypes.STRING(191),
      allowNull: true,
      field: "cancelled_by_id",
      references: {
        model: "user",
        key: "id",
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.STRING(191),
      allowNull: false,
      field: "created_by_id",
      references: {
        model: "user",
        key: "id",
      },
    },
  },
  {
    sequelize,
    tableName: "payment",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["payment_number"], unique: true },
      { fields: ["counterparty_id"] },
      { fields: ["date"] },
      { fields: ["type"] },
      { fields: ["status"] },
      { fields: ["linked_purchase_id"] },
      { fields: ["linked_sale_id"] },
    ],
  }
);
