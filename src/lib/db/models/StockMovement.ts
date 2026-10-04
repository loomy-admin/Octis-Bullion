import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface StockMovementAttributes {
  id: string;
  metalId: string;
  purityId: string;
  movementType:
    | "OPENING"
    | "PURCHASE"
    | "PURCHASE_CANCEL"
    | "SALE"
    | "SALE_CANCEL"
    | "ADJUSTMENT_INCREASE"
    | "ADJUSTMENT_DECREASE";
  weightGrams: number | string;
  purchaseId?: string | null;
  saleId?: string | null;
  adjustmentId?: string | null;
  openingStockId?: string | null;
  createdById: string;
  reference?: string | null;
  createdAt?: Date;
  metal?: import("./Metal").MetalAttributes;
  purity?: import("./Purity").PurityAttributes;
  createdBy?: import("./User").UserAttributes;
  purchase?: import("./Purchase").PurchaseAttributes | null;
  sale?: import("./Sale").SaleAttributes | null;
  adjustment?: import("./StockAdjustment").StockAdjustmentAttributes | null;
  openingStock?: import("./OpeningStock").OpeningStockAttributes | null;
}

export type StockMovementCreationAttributes = Optional<
  StockMovementAttributes,
  | "id"
  | "purchaseId"
  | "saleId"
  | "adjustmentId"
  | "openingStockId"
  | "reference"
  | "createdAt"
>;

export class StockMovement extends Model<StockMovementAttributes, StockMovementCreationAttributes> implements StockMovementAttributes {
  declare id: string;
  declare metalId: string;
  declare purityId: string;
  declare movementType:
    | "OPENING"
    | "PURCHASE"
    | "PURCHASE_CANCEL"
    | "SALE"
    | "SALE_CANCEL"
    | "ADJUSTMENT_INCREASE"
    | "ADJUSTMENT_DECREASE";
  declare weightGrams: number | string;
  declare purchaseId: string | null;
  declare saleId: string | null;
  declare adjustmentId: string | null;
  declare openingStockId: string | null;
  declare createdById: string;
  declare reference: string | null;
  declare readonly createdAt: Date;
}

StockMovement.init(
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
    movementType: {
      type: DataTypes.ENUM(
        "OPENING",
        "PURCHASE",
        "PURCHASE_CANCEL",
        "SALE",
        "SALE_CANCEL",
        "ADJUSTMENT_INCREASE",
        "ADJUSTMENT_DECREASE"
      ),
      allowNull: false,
    },
    weightGrams: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    purchaseId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    saleId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    adjustmentId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    openingStockId: {
      type: DataTypes.STRING(191),
      allowNull: true,
      unique: true,
    },
    createdById: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "stock_movement",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["metalId", "purityId"] },
      { fields: ["movementType"] },
      { fields: ["createdAt"] },
      { fields: ["purchaseId"] },
      { fields: ["saleId"] },
      { fields: ["adjustmentId"] },
    ],
  }
);
