export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pagination(searchParams, defaults = {}) {
  const defaultLimit = defaults.limit ?? 10;
  const maxLimit = defaults.maxLimit ?? 100;
  const requestedPage = Number.parseInt(searchParams.get("page") || "", 10);
  const requestedLimit = Number.parseInt(
    searchParams.get("limit") || searchParams.get("size") || "",
    10,
  );

  return {
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    limit:
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, maxLimit)
        : defaultLimit,
  };
}
