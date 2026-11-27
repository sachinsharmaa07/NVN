// The filters the staff queue reads from the URL ("" or missing means no filter). Shared by the page and
// QueueFilters, kept apart so the component file only exports components (fast refresh).
export const QUEUE_FILTER_KEYS = ["status", "sla", "category", "queue"];
