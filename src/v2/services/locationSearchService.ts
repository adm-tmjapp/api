type LocationSuggestion = {
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
};

class LocationSearchError extends Error {
  statusCode: number;

  error: string;

  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    error: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapNominatimItem(item: any): LocationSuggestion {
  const address = item?.address || {};
  return {
    street:
      normalizeString(address.road) ||
      normalizeString(address.pedestrian) ||
      normalizeString(address.cycleway),
    number: normalizeString(address.house_number),
    district:
      normalizeString(address.suburb) ||
      normalizeString(address.neighbourhood) ||
      normalizeString(address.city_district),
    city:
      normalizeString(address.city) ||
      normalizeString(address.town) ||
      normalizeString(address.village) ||
      normalizeString(address.municipality),
    state: normalizeString(address.state_code) || normalizeString(address.state),
    zipCode: normalizeString(address.postcode),
    latitude:
      typeof item?.lat === "string" || typeof item?.lat === "number"
        ? Number(item.lat)
        : null,
    longitude:
      typeof item?.lon === "string" || typeof item?.lon === "number"
        ? Number(item.lon)
        : null,
    formattedAddress: normalizeString(item?.display_name) || "",
  };
}

export const locationSearchService = {
  async search(query: string) {
    const q = query.trim();
    if (q.length < 3) {
      throw new LocationSearchError(
        422,
        "VALIDATION_ERROR",
        "Endereco invalido.",
        { field: "q" },
      );
    }

    const url = new URL(
      process.env.LOCATION_SEARCH_PROVIDER_URL ||
        "https://nominatim.openstreetmap.org/search",
    );
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", process.env.LOCATION_SEARCH_LIMIT || "8");
    url.searchParams.set("countrycodes", process.env.LOCATION_SEARCH_COUNTRY || "br");

    const response = await (globalThis as any).fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": process.env.LOCATION_SEARCH_USER_AGENT || "TMJApp/1.0",
      },
    });

    if (!response.ok) {
      throw new LocationSearchError(
        502,
        "LOCATION_PROVIDER_ERROR",
        "Erro ao buscar sugestoes de endereco.",
      );
    }

    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : [];

    return {
      data: items
        .map(mapNominatimItem)
        .filter((item) => item.formattedAddress),
    };
  },
};

export { LocationSearchError };
