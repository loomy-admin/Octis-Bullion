import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface MetalDenominationAttributes {
  id: string;
  metalId: string;
  purityId: string;
  type: "BAR" | "COIN";
  name: string;
  weightGrams: number | string;
  premiumAmount: number | string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  metal?: import("./Metal").MetalAttributes;
  purity?: import("./Purity").PurityAttributes;
}

export type MetalDenominationCreationAttributes = Optional<
  MetalDenominationAttributes,
  "id" | "premiumAmount" | "isActive" | "createdAt" | "updatedAt"
>;

export class MetalDenomination
  extends Model<MetalDenominationAttributes, MetalDenominationCreationAttributes>
  implements MetalDenominationAttributes
{
  declare id: string;
  declare metalId: string;
  declare purityId: string;
  declare type: "BAR" | "COIN";
  declare name: string;
  declare weightGrams: number | string;
  declare premiumAmount: number | string;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

MetalDenomination.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    metalId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    purityId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("BAR", "COIN"),
      allowNull: false,
      defaultValue: "BAR",
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    weightGrams: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    premiumAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: "0.00",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "metal_denomination",
    timestamps: true,
    indexes: [
      { fields: ["metalId", "purityId"] },
      { fields: ["type"] },
      { fields: ["isActive"] },
    ],
  }
);
