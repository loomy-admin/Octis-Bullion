import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface PartySettlementAttributes {
  id: string;
  settlementNumber: string;
  counterpartyId: string;
  date: Date;
  metalId: string;
  purityId: string;
  metalSettledGrams: string | number;
  metalDirection: "DELIVER_TO_PARTY" | "RECEIVE_FROM_PARTY";
  cashSettledAmount: string | number;
  cashDirection: "PAY_TO_PARTY" | "RECEIVE_FROM_PARTY";
  paymentMode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "RTGS_NEFT" | "OTHER";
  referenceNumber?: string | null;
  preMetalBalanceGrams: string | number;
  postMetalBalanceGrams: string | number;
  preCashBalance: string | number;
  postCashBalance: string | number;
  linkedPaymentId?: string | null;
  linkedStockMovementId?: string | null;
  status: "POSTED" | "CANCELLED";
  notes?: string | null;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PartySettlementCreationAttributes = Optional<
  PartySettlementAttributes,
  | "id"
  | "referenceNumber"
  | "linkedPaymentId"
  | "linkedStockMovementId"
  | "status"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

export class PartySettlement
  extends Model<PartySettlementAttributes, PartySettlementCreationAttributes>
  implements PartySettlementAttributes
{
  declare id: string;
  declare settlementNumber: string;
  declare counterpartyId: string;
  declare date: Date;
  declare metalId: string;
  declare purityId: string;
  declare metalSettledGrams: string;
  declare metalDirection: "DELIVER_TO_PARTY" | "RECEIVE_FROM_PARTY";
  declare cashSettledAmount: string;
  declare cashDirection: "PAY_TO_PARTY" | "RECEIVE_FROM_PARTY";
  declare paymentMode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "RTGS_NEFT" | "OTHER";
  declare referenceNumber: string | null;
  declare preMetalBalanceGrams: string;
  declare postMetalBalanceGrams: string;
  declare preCashBalance: string;
  declare postCashBalance: string;
  declare linkedPaymentId: string | null;
  declare linkedStockMovementId: string | null;
  declare status: "POSTED" | "CANCELLED";
  declare notes: string | null;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PartySettlement.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    settlementNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    counterpartyId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    metalId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    purityId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    metalSettledGrams: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    metalDirection: {
      type: DataTypes.ENUM("DELIVER_TO_PARTY", "RECEIVE_FROM_PARTY"),
      allowNull: false,
    },
    cashSettledAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    cashDirection: {
      type: DataTypes.ENUM("PAY_TO_PARTY", "RECEIVE_FROM_PARTY"),
      allowNull: false,
    },
    paymentMode: {
      type: DataTypes.ENUM("CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "RTGS_NEFT", "OTHER"),
      allowNull: false,
      defaultValue: "CASH",
    },
    referenceNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    preMetalBalanceGrams: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    postMetalBalanceGrams: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    preCashBalance: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    postCashBalance: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    linkedPaymentId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    linkedStockMovementId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("POSTED", "CANCELLED"),
      allowNull: false,
      defaultValue: "POSTED",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "party_settlements",
    timestamps: true,
    indexes: [
      { fields: ["counterpartyId"] },
      { fields: ["date"] },
      { fields: ["status"] },
      { fields: ["settlementNumber"], unique: true },
    ],
  }
);
