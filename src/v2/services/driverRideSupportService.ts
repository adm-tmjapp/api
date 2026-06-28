import mongoose from "mongoose";
import Ride from "../../models/Ride";
import RideSupportTicket, {
  RideSupportIssueCode,
  RideSupportTicketStatus,
} from "../../models/RideSupportTicket";
import UploadAsset from "../../models/UploadAsset";

type ServiceErrorCode =
  | "INVALID_RIDE_ID"
  | "RIDE_NOT_FOUND"
  | "INVALID_ISSUE_CODE"
  | "INVALID_ATTACHMENTS"
  | "VALIDATION_ERROR";

export class DriverRideSupportServiceError extends Error {
  status: number;

  code: ServiceErrorCode;

  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ServiceErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const SUPPORT_OPTIONS: Array<{
  code: RideSupportIssueCode;
  label: string;
  enabled: boolean;
}> = [
  { code: "FORGOTTEN_OBJECT", label: "Objeto esquecido pelo passageiro", enabled: true },
  { code: "PAYMENT_ISSUE", label: "Problema com o valor recebido", enabled: true },
  { code: "SECURITY_INCIDENT", label: "Reportar incidente de segurança", enabled: true },
  { code: "PASSENGER_ABSENT", label: "O passageiro não estava no local", enabled: true },
  { code: "OTHER", label: "Outros problemas", enabled: true },
];

async function ensureRideBelongsToDriver(rideId: string, driverUserId: string) {
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new DriverRideSupportServiceError(400, "INVALID_RIDE_ID", "Ride ID inválido.");
  }

  const ride = await Ride.findOne({
    _id: rideId,
    "driver.id": driverUserId,
  }).lean();

  if (!ride) {
    throw new DriverRideSupportServiceError(404, "RIDE_NOT_FOUND", "Corrida não encontrada.");
  }

  return ride;
}

async function ensureAttachmentsExist(attachments?: string[]) {
  if (!attachments || attachments.length === 0) return;

  const ids = attachments.filter(Boolean);
  const found = await UploadAsset.countDocuments({
    _id: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)) },
  });

  if (found !== ids.length) {
    throw new DriverRideSupportServiceError(
      422,
      "INVALID_ATTACHMENTS",
      "Um ou mais attachments são inválidos.",
    );
  }
}

function ensureIssueCode(issueCode: string): RideSupportIssueCode {
  const option = SUPPORT_OPTIONS.find((item) => item.code === issueCode);
  if (!option) {
    throw new DriverRideSupportServiceError(
      422,
      "INVALID_ISSUE_CODE",
      "Código de suporte inválido.",
    );
  }

  return option.code;
}

async function createTicket(data: {
  rideId: string;
  driverUserId: string;
  issueCode: RideSupportIssueCode;
  subject?: string;
  description?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
  status?: RideSupportTicketStatus;
  message?: string;
}) {
  await ensureAttachmentsExist(data.attachments);

  const ticket = await RideSupportTicket.create({
    rideId: data.rideId,
    driverUserId: data.driverUserId,
    issueCode: data.issueCode,
    subject: data.subject?.trim() || undefined,
    description: data.description?.trim() || undefined,
    attachments: data.attachments || [],
    metadata: data.metadata || undefined,
    status: data.status || "OPEN",
    message: data.message || "Solicitação registrada com sucesso.",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return ticket;
}

export const driverRideSupportService = {
  async getSupportOptions(rideId: string, driverUserId: string) {
    await ensureRideBelongsToDriver(rideId, driverUserId);

    return {
      options: SUPPORT_OPTIONS,
    };
  },

  async createGenericSupportTicket(
    rideId: string,
    driverUserId: string,
    input: {
      issueCode: string;
      subject?: string;
      description?: string;
      attachments?: string[];
    },
  ) {
    await ensureRideBelongsToDriver(rideId, driverUserId);
    const issueCode = ensureIssueCode(input.issueCode);

    const ticket = await createTicket({
      rideId,
      driverUserId,
      issueCode,
      subject: input.subject,
      description: input.description,
      attachments: input.attachments,
    });

    return {
      ticketId: String(ticket._id),
      status: ticket.status,
      createdAt: ticket.createdAt,
      message: ticket.message,
    };
  },

  async createPaymentIssue(
    rideId: string,
    driverUserId: string,
    input: {
      expectedAmount: number;
      receivedAmount: number;
      description?: string;
      attachments?: string[];
    },
  ) {
    await ensureRideBelongsToDriver(rideId, driverUserId);

    if (
      !Number.isFinite(Number(input.expectedAmount)) ||
      !Number.isFinite(Number(input.receivedAmount))
    ) {
      throw new DriverRideSupportServiceError(
        422,
        "VALIDATION_ERROR",
        "expectedAmount e receivedAmount devem ser numéricos.",
      );
    }

    const ticket = await createTicket({
      rideId,
      driverUserId,
      issueCode: "PAYMENT_ISSUE",
      subject: "Problema com valor da corrida",
      description: input.description,
      attachments: input.attachments,
      metadata: {
        expectedAmount: Number(input.expectedAmount),
        receivedAmount: Number(input.receivedAmount),
      },
    });

    return {
      ticketId: String(ticket._id),
      status: ticket.status,
      createdAt: ticket.createdAt,
    };
  },

  async createForgottenObject(
    rideId: string,
    driverUserId: string,
    input: {
      description: string;
      attachments?: string[];
    },
  ) {
    await ensureRideBelongsToDriver(rideId, driverUserId);

    if (!input.description?.trim()) {
      throw new DriverRideSupportServiceError(
        422,
        "VALIDATION_ERROR",
        "description é obrigatório.",
      );
    }

    const ticket = await createTicket({
      rideId,
      driverUserId,
      issueCode: "FORGOTTEN_OBJECT",
      subject: "Objeto esquecido",
      description: input.description,
      attachments: input.attachments,
    });

    return {
      ticketId: String(ticket._id),
      status: ticket.status,
      createdAt: ticket.createdAt,
    };
  },

  async createPassengerAbsent(
    rideId: string,
    driverUserId: string,
    input: {
      waitedMoreThan5Minutes: boolean;
      calledPassenger: boolean;
      messagedPassenger: boolean;
      atBoardingPoint: boolean;
      driverLat: number;
      driverLng: number;
      gpsEvidenceId?: string;
    },
  ) {
    await ensureRideBelongsToDriver(rideId, driverUserId);

    const ticket = await createTicket({
      rideId,
      driverUserId,
      issueCode: "PASSENGER_ABSENT",
      subject: "Solicitação de cancelamento sem taxa",
      status: "UNDER_REVIEW",
      message: "Solicitação registrada com sucesso.",
      metadata: {
        waitedMoreThan5Minutes: Boolean(input.waitedMoreThan5Minutes),
        calledPassenger: Boolean(input.calledPassenger),
        messagedPassenger: Boolean(input.messagedPassenger),
        atBoardingPoint: Boolean(input.atBoardingPoint),
        driverLat: Number(input.driverLat),
        driverLng: Number(input.driverLng),
        gpsEvidenceId: input.gpsEvidenceId || null,
        penaltyWaiverRequested: true,
      },
    });

    return {
      requestId: String(ticket._id),
      status: ticket.status,
      createdAt: ticket.createdAt,
      penaltyWaiverRequested: true,
    };
  },

  getSupportContact() {
    return {
      channel: String(process.env.SUPPORT_CONTACT_CHANNEL || "whatsapp").toLowerCase(),
      phone: process.env.SUPPORT_CONTACT_PHONE || null,
      whatsApp: process.env.SUPPORT_CONTACT_WHATSAPP || process.env.SUPPORT_CONTACT_PHONE || null,
      chatUrl: process.env.SUPPORT_CONTACT_URL || null,
      availability: process.env.SUPPORT_CONTACT_AVAILABILITY || "24x7",
    };
  },
};

