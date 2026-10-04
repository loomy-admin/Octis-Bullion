import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface AuditLogAttributes {
  id: string;
  action: "CREATE" | "UPDATE" | "CANCEL" | "ACTIVATE" | "DEACTIVATE" | "POST";
  entityType: string;
  entityId: string;
  prevState?: unknown | null;
  nextState?: unknown | null;
  description?: string | null;
  actorId: string;
  metalId?: string | null;
  purityId?: string | null;
  purchaseId?: string | null;
  saleId?: string | null;
  adjustmentId?: string | null;
  createdAt?: Date;
}

export type AuditLogCreationAttributes = Optional<
  AuditLogAttributes,
  | "id"
  | "prevState"
  | "nextState"
  | "description"
  | "metalId"
  | "purityId"
  | "purchaseId"
  | "saleId"
  | "adjustmentId"
  | "createdAt"
>;

export class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  declare id: string;
  declare action: "CREATE" | "UPDATE" | "CANCEL" | "ACTIVATE" | "DEACTIVATE" | "POST";
  declare entityType: string;
  declare entityId: string;
  declare prevState: unknown | null;
  declare nextState: unknown | null;
  declare description: string | null;
  declare actorId: string;
  declare metalId: string | null;
  declare purityId: string | null;
  declare purchaseId: string | null;
  declare saleId: string | null;
  declare adjustmentId: string | null;
  declare readonly createdAt: Date;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.STRING(191),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    action: {
      type: DataTypes.ENUM("CREATE", "UPDATE", "CANCEL", "ACTIVATE", "DEACTIVATE", "POST"),
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    entityId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    prevState: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    nextState: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actorId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    metalId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    purityId: {
      type: DataTypes.STRING(191),
      allowNull: true,
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
  },
  {
    sequelize,
    tableName: "audit_log",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["entityType", "entityId"] },
      { fields: ["actorId"] },
      { fields: ["createdAt"] },
    ],
  }
);
