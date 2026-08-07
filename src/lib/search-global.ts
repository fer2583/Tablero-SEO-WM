import "server-only";
import { dates, searchConsoleClient, searchConsoleSite, type IntegrationFilters, type SearchConsoleDimensionRow } from "@/lib/integrations";

export async function fetchSearchGlobal(filters: IntegrationFilters, segment?: string) {
  const period = dates(filters.days);
  const client = searchConsoleClient();
  const request = async (dimension: string, queryFilter?: string) => {
    const response = await client.searchanalytics.query({ siteUrl: searchConsoleSite(), requestBody: { startDate: period.start, endDate: period.end, dimensions: [dimension], dimensionFilterGroups: queryFilter ? [{ groupType: "and", filters: [{ dimension: "query", operator: "includingRegex", expression: queryFilter }] }] : undefined, rowLimit: 100 } });
    return (response.data.rows ?? []).map((row): SearchConsoleDimensionRow => ({ dimension, value: row.keys?.[0] ?? "", clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }));
  };
  const [country, device, appearance, searchType] = await Promise.all([request("country"), request("device"), request("searchAppearance"), request("searchType")]);
  const brand = await request("query", "whalemate");
  const nonBrand = await request("query", "^(?!.*whalemate).*$");
  return { country, device, searchType, appearance, brand, nonBrand, segment };
}
