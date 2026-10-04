import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface OpeningStockAttributes {
  id: string;
  metalId: string;
  purityId: string;
  weightGrams: number | string;
  notes?: string | null;
  effectiveDate: Date;
  createdById: string;
  createdAt?: Date;
}

export type OpeningStockCreationAttributes = Optional<
  OpeningStockAttributes,
  "id" | "notes" | "createdAt"
>;

export class OpeningStock extends Model<OpeningStockAttributes, OpeningStockCreationAttributes> implements OpeningStockAttributes {
  declare id: string;
  declare metalId: string;
  declare purityId: string;
  declare weightGrams: number | string;
  declare notes: string | null;
  declare effectiveDate: Date;
  declare createdById: string;
  declare readonly createdAt: Date;
}

OpeningStock.init(
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
    weightGrams: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    effectiveDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdById: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "opening_stock",
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["metalId", "purityId"],
      },
    ],
  }
);
