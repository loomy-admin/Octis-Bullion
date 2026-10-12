import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface CashClosingAttributes {
  id: string;
  closingDate: Date;
  shift: "MORNING" | "EVENING" | "FULL_DAY";
  openingBalance: number | string;
  totalCashReceived: number | string;
  totalCashPaid: number | string;
  expectedBalance: number | string;
  physicalBalance: number | string;
  difference: number | string;
  status: "BALANCED" | "EXCESS" | "SHORTAGE";
  denominations: Record<string, number>;
  notes?: string | null;
  closedById: string;
  createdAt?: Date;
  updatedAt?: Date;
  closedBy?: import("./User").UserAttributes;
}

export type CashClosingCreationAttributes = Optional<
  CashClosingAttributes,
  | "id"
  | "shift"
  | "openingBalance"
  | "difference"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

export class CashClosing
  extends Model<CashClosingAttributes, CashClosingCreationAttributes>
  implements CashClosingAttributes
{
  declare id: string;
  declare closingDate: Date;
  declare shift: "MORNING" | "EVENING" | "FULL_DAY";
  declare openingBalance: number | string;
  declare totalCashReceived: number | string;
  declare totalCashPaid: number | string;
  declare expectedBalance: number | string;
  declare physicalBalance: number | string;
  declare difference: number | string;
  declare status: "BALANCED" | "EXCESS" | "SHORTAGE";
  declare denominations: Record<string, number>;
  declare notes: string | null;
  declare closedById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CashClosing.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    closingDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    shift: {
      type: DataTypes.ENUM("MORNING", "EVENING", "FULL_DAY"),
      defaultValue: "FULL_DAY",
    },
    openingBalance: {
      type: DataTypes.DECIMAL(16, 2),
      defaultValue: "0.00",
    },
    totalCashReceived: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
    },
    totalCashPaid: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
    },
    expectedBalance: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
    },
    physicalBalance: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
    },
    difference: {
      type: DataTypes.DECIMAL(16, 2),
      defaultValue: "0.00",
    },
    status: {
      type: DataTypes.ENUM("BALANCED", "EXCESS", "SHORTAGE"),
      allowNull: false,
    },
    denominations: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    closedById: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "cash_closing",
    timestamps: true,
    indexes: [
      { fields: ["closingDate"] },
      { fields: ["status"] },
    ],
  }
);
