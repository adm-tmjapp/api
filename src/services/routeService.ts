import haversine from "haversine-distance";
import Product from "../models/Product";
import Tarifa from "../models/Tarifa";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RouteDetails {
  distance_km: number;
  duration_min: number;
}

/**
 * Calcula a distância e a duração entre dois pontos geográficos.
 * @param origin Coordenadas do ponto de origem.
 * @param destination Coordenadas do ponto de destino.
 * @returns Um objeto contendo a distância em quilômetros e a duração em minutos.
 */
export function calculateDistanceAndDuration(
  origin: Coordinates,
  destination: Coordinates
): RouteDetails {
  const distanceMeters = haversine(origin, destination);
  const distanceKm = distanceMeters / 1000;

  // Supondo uma velocidade média de 30 km/h para calcular a duração
  const averageSpeedKmh = 30;
  const durationHours = distanceKm / averageSpeedKmh;
  const durationMinutes = durationHours * 60;

  return {
    distance_km: parseFloat(distanceKm.toFixed(2)),
    duration_min: parseFloat(durationMinutes.toFixed(2)),
  };
}

export const getAvailableProducts = async (distanceKm: number) => {
  try {
    // Buscar todos os produtos, sem filtro de distância
    const products = await Product.find({}).populate("taxaId");

    // Adicionar valores dos produtos (preço baseado na tarifa associada)
    const productsWithPrices = products
      .map((product: any) => {
        const tarifa = product.taxaId;
        if (!tarifa) {
          return {
            id: product._id,
            name: product.name,
            price: null,
            description: product.description || "Descrição não disponível",
            fare_breakdown: null,
            warning: "Produto sem tarifa associada. Não pode ser selecionado.",
          };
        }
        // Validação dos campos
        const valorBase = tarifa.valorBase || 0;
        const valorKm = tarifa.valorKm || 0;
        const custoFixo = tarifa.custoFixo || 0;
        const taxaIntermediacao = tarifa.taxaIntermediacao || 0;
        const subtotal = valorBase + distanceKm * valorKm;
        const valorTaxa = (taxaIntermediacao / 100) * subtotal;
        const price = subtotal + custoFixo + valorTaxa;
        return {
          id: product._id,
          name: product.name,
          price: parseFloat(price.toFixed(2)),
          description: product.description || "Descrição não disponível",
          fare_breakdown: {
            valorBase,
            valorKm,
            custoFixo,
            taxaIntermediacao,
            subtotal: parseFloat(subtotal.toFixed(2)),
            valorTaxa: parseFloat(valorTaxa.toFixed(2)),
          },
        };
      })
      .sort((a: any, b: any) => (a.price ?? Infinity) - (b.price ?? Infinity));

    return productsWithPrices;
  } catch (error) {
    console.error("Erro ao buscar produtos disponíveis:", error);
    throw new Error("Erro ao buscar produtos disponíveis");
  }
};
