import { Op, fn, col, where } from "sequelize";
import { sequelize, runTransaction } from "./sequelize";
import { User } from "./models/User";
import { Session } from "./models/Session";
import { Account } from "./models/Account";
import { Verification } from "./models/Verification";
import { Metal } from "./models/Metal";
import { Purity } from "./models/Purity";
import { Counterparty } from "./models/Counterparty";
import { OpeningStock } from "./models/OpeningStock";
import { StockMovement } from "./models/StockMovement";
import { Purchase } from "./models/Purchase";
import { Sale } from "./models/Sale";
import { StockAdjustment } from "./models/StockAdjustment";
import { AuditLog } from "./models/AuditLog";
import { AppSetting } from "./models/AppSetting";
import { Payment } from "./models/Payment";
import { MetalRate } from "./models/MetalRate";
import { RateBlock } from "./models/RateBlock";
import { MetalDenomination } from "./models/MetalDenomination";
import { CashClosing } from "./models/CashClosing";
import { PartySettlement } from "./models/PartySettlement";

export * from "./types";

let associationsInitialized = false;

export function initAssociations() {
  if (associationsInitialized) return;

  // User relations
  User.hasMany(Session, { foreignKey: "userId", as: "sessions", onDelete: "CASCADE" });
  Session.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(Account, { foreignKey: "userId", as: "accounts", onDelete: "CASCADE" });
  Account.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(Purchase, { foreignKey: "createdById", as: "purchases" });
  Purchase.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(Sale, { foreignKey: "createdById", as: "sales" });
  Sale.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(StockAdjustment, { foreignKey: "createdById", as: "adjustments" });
  StockAdjustment.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(StockMovement, { foreignKey: "createdById", as: "stockMovements" });
  StockMovement.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(AuditLog, { foreignKey: "actorId", as: "auditLogs" });
  AuditLog.belongsTo(User, { foreignKey: "actorId", as: "actor" });

  User.hasMany(OpeningStock, { foreignKey: "createdById", as: "openingStocks" });
  OpeningStock.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  // Metal relations
  Metal.hasMany(Purity, { foreignKey: "metalId", as: "purities" });
  Purity.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(Purchase, { foreignKey: "metalId", as: "purchases" });
  Purchase.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(Sale, { foreignKey: "metalId", as: "sales" });
  Sale.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(StockAdjustment, { foreignKey: "metalId", as: "adjustments" });
  StockAdjustment.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(StockMovement, { foreignKey: "metalId", as: "stockMovements" });
  StockMovement.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  Metal.hasMany(OpeningStock, { foreignKey: "metalId", as: "openingStocks" });
  OpeningStock.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });

  // Purity relations
  Purity.hasMany(Purchase, { foreignKey: "purityId", as: "purchases" });
  Purchase.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(Sale, { foreignKey: "purityId", as: "sales" });
  Sale.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(StockAdjustment, { foreignKey: "purityId", as: "adjustments" });
  StockAdjustment.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(StockMovement, { foreignKey: "purityId", as: "stockMovements" });
  StockMovement.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  Purity.hasMany(OpeningStock, { foreignKey: "purityId", as: "openingStocks" });
  OpeningStock.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  // Counterparty relations
  Counterparty.hasMany(Purchase, { foreignKey: "counterpartyId", as: "purchases" });
  Purchase.belongsTo(Counterparty, { foreignKey: "counterpartyId", as: "counterparty" });

  Counterparty.hasMany(Sale, { foreignKey: "counterpartyId", as: "sales" });
  Sale.belongsTo(Counterparty, { foreignKey: "counterpartyId", as: "counterparty" });

  // StockMovement relations
  Purchase.hasMany(StockMovement, { foreignKey: "purchaseId", as: "stockMovements" });
  StockMovement.belongsTo(Purchase, { foreignKey: "purchaseId", as: "purchase" });

  Sale.hasMany(StockMovement, { foreignKey: "saleId", as: "stockMovements" });
  StockMovement.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });

  StockAdjustment.hasMany(StockMovement, { foreignKey: "adjustmentId", as: "stockMovements" });
  StockMovement.belongsTo(StockAdjustment, { foreignKey: "adjustmentId", as: "adjustment" });

  OpeningStock.hasOne(StockMovement, { foreignKey: "openingStockId", as: "stockMovement" });
  StockMovement.belongsTo(OpeningStock, { foreignKey: "openingStockId", as: "openingStock" });

  // Payment relations
  Counterparty.hasMany(Payment, { foreignKey: "counterpartyId", as: "payments" });
  Payment.belongsTo(Counterparty, { foreignKey: "counterpartyId", as: "counterparty" });

  Purchase.hasMany(Payment, { foreignKey: "linkedPurchaseId", as: "payments" });
  Payment.belongsTo(Purchase, { foreignKey: "linkedPurchaseId", as: "purchase" });

  Sale.hasMany(Payment, { foreignKey: "linkedSaleId", as: "payments" });
  Payment.belongsTo(Sale, { foreignKey: "linkedSaleId", as: "sale" });

  User.hasMany(Payment, { foreignKey: "createdById", as: "payments" });
  Payment.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  Purchase.belongsTo(User, { foreignKey: "fixedById", as: "fixedBy" });
  Sale.belongsTo(User, { foreignKey: "fixedById", as: "fixedBy" });

  // MetalRate relations
  Metal.hasMany(MetalRate, { foreignKey: "metalId", as: "rates" });
  MetalRate.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });
  Purity.hasMany(MetalRate, { foreignKey: "purityId", as: "rates" });
  MetalRate.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });
  MetalRate.belongsTo(User, { foreignKey: "updatedById", as: "updatedBy" });

  // RateBlock relations
  Counterparty.hasMany(RateBlock, { foreignKey: "counterpartyId", as: "rateBlocks" });
  RateBlock.belongsTo(Counterparty, { foreignKey: "counterpartyId", as: "counterparty" });
  RateBlock.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });
  RateBlock.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });
  RateBlock.belongsTo(Sale, { foreignKey: "fulfilledSaleId", as: "fulfilledSale" });
  RateBlock.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  // MetalDenomination relations
  Metal.hasMany(MetalDenomination, { foreignKey: "metalId", as: "denominations" });
  MetalDenomination.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });
  Purity.hasMany(MetalDenomination, { foreignKey: "purityId", as: "denominations" });
  MetalDenomination.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });

  // CashClosing relations
  User.hasMany(CashClosing, { foreignKey: "closedById", as: "cashClosings" });
  CashClosing.belongsTo(User, { foreignKey: "closedById", as: "closedBy" });

  // PartySettlement relations
  Counterparty.hasMany(PartySettlement, { foreignKey: "counterpartyId", as: "settlements" });
  PartySettlement.belongsTo(Counterparty, { foreignKey: "counterpartyId", as: "counterparty" });
  PartySettlement.belongsTo(Metal, { foreignKey: "metalId", as: "metal" });
  PartySettlement.belongsTo(Purity, { foreignKey: "purityId", as: "purity" });
  PartySettlement.belongsTo(Payment, { foreignKey: "linkedPaymentId", as: "payment" });
  PartySettlement.belongsTo(StockMovement, { foreignKey: "linkedStockMovementId", as: "stockMovement" });
  PartySettlement.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  associationsInitialized = true;
}

// Ensure associations are registered on module load
initAssociations();

/**
 * Standard MySQL database table synchronization without CLI migrations.
 */
export async function syncDatabase(options?: { alter?: boolean; force?: boolean }) {
  initAssociations();
  await sequelize.authenticate();
  await sequelize.sync({ alter: options?.alter ?? true, force: options?.force ?? false });
}

export {
  sequelize,
  runTransaction,
  Op,
  fn,
  col,
  where,
  User,
  Session,
  Account,
  Verification,
  Metal,
  Purity,
  Counterparty,
  OpeningStock,
  StockMovement,
  Purchase,
  Sale,
  StockAdjustment,
  AuditLog,
  AppSetting,
  Payment,
  MetalRate,
  RateBlock,
  MetalDenomination,
  CashClosing,
  PartySettlement,
};

export default sequelize;
