import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface MetalRateAttributes {
  id: string;
  metalId: string;
  purityId: string;
  buyRate: number | string;
  sellRate: number | string;
  mcxBenchmarkRate?: number | string | null;
  usdOunceRate?: number | string | null;
  usdInrRate?: number | string | null;
  customsDutyPct?: number | string | null;
  gstPct?: number | string | null;
  marginPerGram?: number | string | null;
  landedCostPerGram?: number | string | null;
  isLive: boolean;
  updatedById: string;
  createdAt?: Date;
  updatedAt?: Date;
  metal?: import("./Metal").MetalAttributes;
  purity?: import("./Purity").PurityAttributes;
  updatedBy?: import("./User").UserAttributes;
}

export type MetalRateCreationAttributes = Optional<
  MetalRateAttributes,
  | "id"
  | "mcxBenchmarkRate"
  | "usdOunceRate"
  | "usdInrRate"
  | "customsDutyPct"
  | "gstPct"
  | "marginPerGram"
  | "landedCostPerGram"
  | "isLive"
  | "createdAt"
  | "updatedAt"
>;

export class MetalRate
  extends Model<MetalRateAttributes, MetalRateCreationAttributes>
  implements MetalRateAttributes
{
  declare id: string;
  declare metalId: string;
  declare purityId: string;
  declare buyRate: number | string;
  declare sellRate: number | string;
  declare mcxBenchmarkRate: number | string | null;
  declare usdOunceRate: number | string | null;
  declare usdInrRate: number | string | null;
  declare customsDutyPct: number | string | null;
  declare gstPct: number | string | null;
  declare marginPerGram: number | string | null;
  declare landedCostPerGram: number | string | null;
  declare isLive: boolean;
  declare updatedById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

MetalRate.init(
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
    buyRate: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    sellRate: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    mcxBenchmarkRate: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
    },
    usdOunceRate: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
    },
    usdInrRate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },
    customsDutyPct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: "15.00",
    },
    gstPct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: "3.00",
    },
    marginPerGram: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: "50.00",
    },
    landedCostPerGram: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
    },
    isLive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    updatedById: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "metal_rate",
    timestamps: true,
    indexes: [
      { fields: ["metalId", "purityId"], unique: true },
      { fields: ["isLive"] },
    ],
  }
);
