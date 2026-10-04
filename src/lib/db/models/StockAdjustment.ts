import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface StockAdjustmentAttributes {
  id: string;
  date: Date;
  metalId: string;
  purityId: string;
  direction: "INCREASE" | "DECREASE";
  weightGrams: number | string;
  reason: string;
  notes?: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  cancelReason?: string | null;
  cancelledAt?: Date | null;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
  metal?: import("./Metal").MetalAttributes;
  purity?: import("./Purity").PurityAttributes;
  createdBy?: import("./User").UserAttributes;
}

export type StockAdjustmentCreationAttributes = Optional<
  StockAdjustmentAttributes,
  "id" | "notes" | "status" | "cancelReason" | "cancelledAt" | "createdAt" | "updatedAt"
>;

export class StockAdjustment extends Model<StockAdjustmentAttributes, StockAdjustmentCreationAttributes> implements StockAdjustmentAttributes {
  declare id: string;
  declare date: Date;
  declare metalId: string;
  declare purityId: string;
  declare direction: "INCREASE" | "DECREASE";
  declare weightGrams: number | string;
  declare reason: string;
  declare notes: string | null;
  declare status: "DRAFT" | "POSTED" | "CANCELLED";
  declare cancelReason: string | null;
  declare cancelledAt: Date | null;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

StockAdjustment.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    date: {
      type: DataTypes.DATE,
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
    direction: {
      type: DataTypes.ENUM("INCREASE", "DECREASE"),
      allowNull: false,
    },
    weightGrams: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "POSTED", "CANCELLED"),
      defaultValue: "POSTED",
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
    tableName: "stock_adjustment",
    timestamps: true,
    indexes: [
      { fields: ["date"] },
      { fields: ["metalId", "purityId"] },
      { fields: ["status"] },
    ],
  }
);
