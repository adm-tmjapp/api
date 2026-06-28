import AWS from "aws-sdk";
import mongoose from "mongoose";
import SmsMessageLog from "../models/SmsMessageLog";

const sns = new AWS.SNS({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export class SmsService {
  private static normalizePhone(phone: string) {
    const digits = phone.replace(/\D/g, "");

    if (digits.startsWith("55") && digits.length >= 12) {
      return `+${digits}`;
    }

    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }

    throw new Error("Telefone inválido para envio de SMS");
  }

  private static async logSms(data: {
    userId?: string;
    phone: string;
    status: "SENT" | "FAILED";
    messageId?: string;
    errorMessage?: string;
  }) {
    await SmsMessageLog.create({
      userId: data.userId ? new mongoose.Types.ObjectId(data.userId) : undefined,
      phone: data.phone,
      provider: "AWS_SNS",
      type: "OTP",
      status: data.status,
      messageId: data.messageId,
      errorMessage: data.errorMessage,
    });
  }

  static async sendCode(phone: string, code: string, userId?: string) {
    const normalizedPhone = this.normalizePhone(phone);

    try {
      const response = await sns
        .publish({
          PhoneNumber: normalizedPhone,
          Message: `Seu código de verificação TMJ é: ${code}`,
          MessageAttributes: {
            "AWS.SNS.SMS.SMSType": {
              DataType: "String",
              StringValue: "Transactional",
            },
          },
        })
        .promise();

      await this.logSms({
        userId,
        phone: normalizedPhone,
        status: "SENT",
        messageId: response.MessageId,
      });

      return {
        provider: "AWS_SNS",
        phone: normalizedPhone,
        messageId: response.MessageId,
      };
    } catch (error: any) {
      console.error("Erro ao enviar SMS:", error);

      await this.logSms({
        userId,
        phone: normalizedPhone,
        status: "FAILED",
        errorMessage: error.message,
      });

      throw new Error("Falha ao enviar SMS");
    }
  }

  static async getMonthlyUsage(month?: string) {
    const now = new Date();
    const [yearPart, monthPart] = (month || "").split("-");
    const year = yearPart ? Number(yearPart) : now.getUTCFullYear();
    const monthIndex = monthPart ? Number(monthPart) - 1 : now.getUTCMonth();

    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));

    const [totalSent, totalFailed, totalMessages] = await Promise.all([
      SmsMessageLog.countDocuments({
        status: "SENT",
        createdAt: { $gte: start, $lt: end },
      }).exec(),
      SmsMessageLog.countDocuments({
        status: "FAILED",
        createdAt: { $gte: start, $lt: end },
      }).exec(),
      SmsMessageLog.countDocuments({
        createdAt: { $gte: start, $lt: end },
      }).exec(),
    ]);

    const threshold = Number(process.env.SMS_MONTHLY_ALERT_THRESHOLD || 1000);

    return {
      provider: "AWS_SNS",
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalMessages,
      totalSent,
      totalFailed,
      threshold,
      alert: totalSent >= threshold,
    };
  }
}
