import { useQuery } from "@tanstack/react-query";
import { reportService } from "../api/report.service";

export const reportKeys = {
  all: ["reports"] as const,
  list: (params: { year?: number; month?: number; categoryId?: string }) => ["reports", "list", params] as const,
};

export function useReports(params: { year?: number; month?: number; categoryId?: string }) {
  return useQuery({
    queryKey: reportKeys.list(params),
    queryFn: () => reportService.getReports(params),
  });
}
