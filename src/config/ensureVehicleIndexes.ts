import Vehicle from "../models/Vehicle";

export async function ensureVehicleIndexes() {
  try {
    const indexes = await Vehicle.collection.indexes();
    const renavamIndex = indexes.find((index) => index.name === "renavam_1");

    const renavamIsCompatible =
      !!renavamIndex &&
      renavamIndex.unique === true &&
      (renavamIndex.sparse === true ||
        !!renavamIndex.partialFilterExpression);

    if (!renavamIsCompatible && renavamIndex) {
      await Vehicle.collection.dropIndex("renavam_1");
    }

    if (!renavamIsCompatible) {
      await Vehicle.collection.createIndex(
        { renavam: 1 },
        {
          name: "renavam_1",
          unique: true,
          sparse: true,
          background: true,
        },
      );
    }
  } catch (error: any) {
    // NamespaceNotFound can happen before the first insert; it's safe to ignore.
    if (error?.codeName === "NamespaceNotFound") {
      return;
    }

    console.error("❌ Erro ao garantir índice de renavam:", error);
    throw error;
  }
}
