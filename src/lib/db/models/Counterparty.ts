import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface CounterpartyAttributes {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type: "SUPPLIER" | "CUSTOMER" | "BOTH";
  isActive: boolean;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CounterpartyCreationAttributes = Optional<
  CounterpartyAttributes,
  "id" | "phone" | "email" | "address" | "isActive" | "notes" | "createdAt" | "updatedAt"
>;

export class Counterparty extends Model<CounterpartyAttributes, CounterpartyCreationAttributes> implements CounterpartyAttributes {
  declare id: string;
  declare name: string;
  declare phone: string | null;
  declare email: string | null;
  declare address: string | null;
  declare type: "SUPPLIER" | "CUSTOMER" | "BOTH";
  declare isActive: boolean;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Counterparty.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("SUPPLIER", "CUSTOMER", "BOTH"),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "counterparty",
    timestamps: true,
    indexes: [
      { fields: ["type"] },
      { fields: ["isActive"] },
    ],
  }
);
