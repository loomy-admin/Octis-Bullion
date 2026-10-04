import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface PurityAttributes {
  id: string;
  metalId: string;
  label: string;
  fineness: number | string;
  displayInfo?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PurityCreationAttributes = Optional<
  PurityAttributes,
  "id" | "displayInfo" | "isActive" | "sortOrder" | "createdAt" | "updatedAt"
>;

export class Purity extends Model<PurityAttributes, PurityCreationAttributes> implements PurityAttributes {
  declare id: string;
  declare metalId: string;
  declare label: string;
  declare fineness: number | string;
  declare displayInfo: string | null;
  declare isActive: boolean;
  declare sortOrder: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Purity.init(
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
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fineness: {
      type: DataTypes.DECIMAL(6, 4),
      allowNull: false,
    },
    displayInfo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "purity",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["metalId", "label"],
      },
      { fields: ["metalId"] },
    ],
  }
);
