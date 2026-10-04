import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface SaleAttributes {
  id: string;
  invoiceNumber: string;
  date: Date;
  counterpartyId?: string | null;
  buyerName: string;
  buyerContact?: string | null;
  metalId: string;
  purityId: string;
  weightGrams: number | string;
  ratePerGram: number | string;
  totalAmount: number | string;
  paymentMode: "CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "OTHER";
  notes?: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  cancelReason?: string | null;
  cancelledAt?: Date | null;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
  metal?: import("./Metal").MetalAttributes;
  purity?: import("./Purity").PurityAttributes;
  counterparty?: import("./Counterparty").CounterpartyAttributes | null;
  createdBy?: import("./User").UserAttributes;
}

export type SaleCreationAttributes = Optional<
  SaleAttributes,
  | "id"
  | "counterpartyId"
  | "buyerContact"
  | "paymentMode"
  | "notes"
  | "status"
  | "cancelReason"
  | "cancelledAt"
  | "createdAt"
  | "updatedAt"
>;

export class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
  declare id: string;
  declare invoiceNumber: string;
  declare date: Date;
  declare counterpartyId: string | null;
  declare buyerName: string;
  declare buyerContact: string | null;
  declare metalId: string;
  declare purityId: string;
  declare weightGrams: number | string;
  declare ratePerGram: number | string;
  declare totalAmount: number | string;
  declare paymentMode: "CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "OTHER";
  declare notes: string | null;
  declare status: "DRAFT" | "POSTED" | "CANCELLED";
  declare cancelReason: string | null;
  declare cancelledAt: Date | null;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Sale.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    invoiceNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    counterpartyId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    buyerName: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    buyerContact: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    metalId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    purityId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    weightGrams: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    ratePerGram: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
    },
    paymentMode: {
      type: DataTypes.ENUM("CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"),
      defaultValue: "CASH",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "POSTED", "CANCELLED"),
      defaultValue: "DRAFT",
    },
    cancelReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "sale",
    timestamps: true,
    indexes: [
      { fields: ["date"] },
      { fields: ["metalId", "purityId"] },
      { fields: ["status"] },
      { fields: ["counterpartyId"] },
    ],
  }
);
