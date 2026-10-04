import { PageHeader } from "@/components/page-header";
import { ReportsNav } from "@/components/reports/reports-nav";
import { ReportFilters } from "@/components/reports/report-filters";
import { SalesRegisterView } from "./sales-register-view";
import { requireUser } from "@/lib/auth/session";
import { getSalesRegisterReport } from "@/lib/services/report-service";
import { Metal, Purity } from "@/lib/db";
import { serializeForClient } from "@/lib/utils/serialize";

export const metadata = { title: "Sales Register — Bullion Reports" };

interface PageProps {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    metalId?: string;
    purityId?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function SalesRegisterPage(props: PageProps) {
  await requireUser();
  const searchParams = await props.searchParams;

  const [metals, purities, report] = await Promise.all([
    Metal.findAll({ where: { isActive: true }, attributes: ["id", "name", "code"], raw: true }),
    Purity.findAll({ where: { isActive: true }, attributes: ["id", "label", "metalId"], raw: true }),
    getSalesRegisterReport({
      dateFrom: searchParams.dateFrom,
      dateTo: searchParams.dateTo,
      metalId: searchParams.metalId,
      purityId: searchParams.purityId,
      status: searchParams.status,
      search: searchParams.search,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Register"
        subtitle="Itemized bullion sales journal with buyer particulars, realized selling rates, and status reconciliation"
      />

      <ReportsNav />

      <ReportFilters
        metals={metals}
        purities={purities}
        showStatus={true}
        showMetalPurity={true}
        showSearch={true}
        searchPlaceholder="Search invoice #, buyer name, notes..."
      />

      <SalesRegisterView report={serializeForClient(report)} />
    </div>
  );
}
