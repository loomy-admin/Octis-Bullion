import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface RateBlockAttributes {
  id: string;
  blockNumber: string;
  counterpartyId: string;
  metalId: string;
  purityId: string;
  blockedWeightGrams: number | string;
  blockedRatePerGram: number | string;
  totalBlockedAmount: number | string;
  advanceAmount: number | string;
  validUntil: Date;
  status: "ACTIVE" | "FULFILLED" | "EXPIRED" | "CANCELLED";
  fulfilledSaleId?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
  counterparty?: import("./Counterparty").CounterpartyAttributes;
  metal?: import("./Metal").MetalAttributes;
  purity?: import("./Purity").PurityAttributes;
  fulfilledSale?: import("./Sale").SaleAttributes | null;
  createdBy?: import("./User").UserAttributes;
}

export type RateBlockCreationAttributes = Optional<
  RateBlockAttributes,
  | "id"
  | "totalBlockedAmount"
  | "advanceAmount"
  | "status"
  | "fulfilledSaleId"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

export class RateBlock
  extends Model<RateBlockAttributes, RateBlockCreationAttributes>
  implements RateBlockAttributes
{
  declare id: string;
  declare blockNumber: string;
  declare counterpartyId: string;
  declare metalId: string;
  declare purityId: string;
  declare blockedWeightGrams: number | string;
  declare blockedRatePerGram: number | string;
  declare totalBlockedAmount: number | string;
  declare advanceAmount: number | string;
  declare validUntil: Date;
  declare status: "ACTIVE" | "FULFILLED" | "EXPIRED" | "CANCELLED";
  declare fulfilledSaleId: string | null;
  declare notes: string | null;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RateBlock.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    blockNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    counterpartyId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    metalId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    purityId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    blockedWeightGrams: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    blockedRatePerGram: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    totalBlockedAmount: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
    },
    advanceAmount: {
      type: DataTypes.DECIMAL(16, 2),
      defaultValue: "0.00",
    },
    validUntil: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "FULFILLED", "EXPIRED", "CANCELLED"),
      defaultValue: "ACTIVE",
    },
    fulfilledSaleId: {
      type: DataTypes.STRING(191),
      allowNull: true,
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
    tableName: "rate_block",
    timestamps: true,
    indexes: [
      { fields: ["counterpartyId"] },
      { fields: ["status"] },
      { fields: ["validUntil"] },
    ],
  }
);
