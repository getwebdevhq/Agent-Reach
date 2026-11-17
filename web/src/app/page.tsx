import LeadDashboard from "@/components/LeadDashboard";
import { UK_LEADS } from "@/lib/leads";

export default function Home() {
  return <LeadDashboard ukLeads={UK_LEADS} />;
}
