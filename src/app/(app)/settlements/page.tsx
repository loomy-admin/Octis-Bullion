import { requireUser } from "@/lib/auth/session";
import { Counterparty, Metal, Purity } from "@/lib/db";
import { listPartySettlements } from "@/lib/services/settlement-service";
import { serializeForClient } from "@/lib/utils/serialize";
import { SettlementsClient } from "./settlements-client";

export const metadata = {
  title: "Metal + Cash Dual Settlement | Bullion Trading",
  description: "Simultaneous bullion metal and money settlement desk",
};

export default async function SettlementsPage() {
  const user = await requireUser();

  const [counterparties, metals, settlementsRes] = await Promise.all([
    Counterparty.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
      attributes: ["id", "name", "type", "phone"],
    }),
    Metal.findAll({
      where: { isActive: true },
      include: [
        {
          model: Purity,
          as: "purities",
          where: { isActive: true },
          attributes: ["id", "name", "label", "purityPercentage"],
          required: false,
        },
      ],
      order: [["name", "ASC"]],
    }),
    listPartySettlements({ limit: 50 }),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Metal + Cash Dual Settlement
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Simultaneously settle open bullion metal positions and cash ledgers for clients and suppliers.
          </p>
        </div>
      </div>

      <SettlementsClient
        initialSettlements={serializeForClient(settlementsRes.settlements) as any}
        initialTotalCount={settlementsRes.totalCount}
        counterparties={serializeForClient(counterparties) as any}
        metals={serializeForClient(metals) as any}
        userRole={user.role}
      />
    </div>
  );
}
