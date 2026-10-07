type AsaasTransferOptions = {
  apiKey?: string;
  baseUrl?: string;
};

export type AsaasTransferResult = {
  id: string;
  status: string | null;
  transactionReceiptUrl: string | null;
  raw: Record<string, unknown>;
};

export class AsaasTransferError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }
  if (!response.ok) {
    throw new AsaasTransferError(
      `Asaas transfer request failed with status ${response.status}`,
      response.status,
      data,
    );
  }
  return data;
}

export class AsaasTransferProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: AsaasTransferOptions = {}) {
    this.apiKey = options.apiKey || String(process.env.ASAAS_API_KEY || "").trim();
    this.baseUrl = (
      options.baseUrl || process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3"
    ).replace(/\/$/, "");
    if (!this.apiKey) throw new Error("ASAAS_API_KEY não configurada.");
  }

  async createPixTransfer(input: {
    value: number;
    pixAddressKey: string;
    pixAddressKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
    externalReference: string;
  }): Promise<AsaasTransferResult> {
    const response = await fetch(`${this.baseUrl}/transfers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TMJApp/1.0.0 (Node.js; production)",
        access_token: this.apiKey,
      },
      body: JSON.stringify({
        value: input.value,
        pixAddressKey: input.pixAddressKey,
        pixAddressKeyType: input.pixAddressKeyType,
        description: `Saque de motorista ${input.externalReference}`,
        externalReference: input.externalReference,
      }),
    });
    const raw = await parseResponse(response);
    const id = String(raw.id || "").trim();
    if (!id) throw new Error("Asaas não retornou o ID da transferência.");
    return {
      id,
      status: raw.status ? String(raw.status) : null,
      transactionReceiptUrl: raw.transactionReceiptUrl
        ? String(raw.transactionReceiptUrl)
        : null,
      raw,
    };
  }
}

