import LeadDashboard from "@/components/LeadDashboard";
import { SYDNEY_LEADS, UK_LEADS } from "@/lib/leads";

export default function Home() {
  return <LeadDashboard sydneyLeads={SYDNEY_LEADS} ukLeads={UK_LEADS} />;
}
