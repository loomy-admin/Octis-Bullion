import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface MetalAttributes {
  id: string;
  code: string;
  name: string;
  type: "GOLD" | "SILVER";
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  purities?: import("./Purity").PurityAttributes[];
}

export type MetalCreationAttributes = Optional<
  MetalAttributes,
  "id" | "isActive" | "createdAt" | "updatedAt"
>;

export class Metal extends Model<MetalAttributes, MetalCreationAttributes> implements MetalAttributes {
  declare id: string;
  declare code: string;
  declare name: string;
  declare type: "GOLD" | "SILVER";
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Metal.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.ENUM("GOLD", "SILVER"),
      allowNull: false,
      unique: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: "metal",
    timestamps: true,
  }
);
