import { Request, Response } from "express";
import {
  locationSearchService,
  LocationSearchError,
} from "../services/locationSearchService";

export const locationV2Controller = {
  async search(req: Request, res: Response) {
    try {
      const query = String(req.query.q || "");
      const payload = await locationSearchService.search(query);
      res.status(200).json(payload);
    } catch (error) {
      if (error instanceof LocationSearchError) {
        res.status(error.statusCode).json({
          statusCode: error.statusCode,
          error: error.error,
          message: error.message,
          details: error.details || {},
        });
        return;
      }

      res.status(500).json({
        statusCode: 500,
        error: "INTERNAL_ERROR",
        message: "Erro interno ao buscar sugestoes de endereco.",
        details: {},
      });
    }
  },
};
