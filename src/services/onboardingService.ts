import { IUser } from "../models/User";
import DriverDocument from "../models/DriverDocument";
import Vehicle from "../models/Vehicle";
import VehiclePhoto from "../models/VehiclePhoto";

export class OnboardingService {
  static async buildDriverOnboarding(user: IUser) {
    const userData =
      user && typeof (user as any).toObject === "function"
        ? (user as any).toObject()
        : user;

    /* ============================
     * PROFILE PHOTO
     ============================ */
    const profilePhotoCompleted = !!userData?.profilePhoto;

    /* ============================
     * EMAIL / PHONE
     ============================ */
    const emailCompleted = !!userData?.emailVerified;
    const phoneCompleted = !!userData?.phoneVerified;

    /* ============================
     * DOCUMENTS
     ============================ */
    const [cnhFront, cnhBack, selfie, criminalRecord] = await Promise.all([
      DriverDocument.findOne({
        user: userData._id,
        type: "CNH",
        side: "FRONT",
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .exec(),
      DriverDocument.findOne({
        user: userData._id,
        type: "CNH",
        side: "BACK",
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .exec(),
      DriverDocument.findOne({
        user: userData._id,
        type: "SELFIE",
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .exec(),
      DriverDocument.findOne({
        user: userData._id,
        type: "CRIMINAL_RECORD",
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .exec(),
    ]);

    const requiredDocuments = [cnhFront, cnhBack, selfie];
    const documentsCompleted = requiredDocuments.every(
      (doc) => !!doc && doc.status === "APPROVED",
    );
    const documentsUnderReview = requiredDocuments.some(
      (doc) => !!doc && doc.status === "PENDING",
    );

    const criminalRecordCompleted =
      !!criminalRecord && criminalRecord.status === "APPROVED";
    const criminalRecordUnderReview =
      !!criminalRecord && criminalRecord.status === "PENDING";

    /* ============================
     * VEHICLE
     ============================ */
    const vehicle = await Vehicle.findOne({ userId: userData._id });

    const vehicleCompleted = !!vehicle && vehicle.status === "APPROVED";
    const vehicleUnderReview = !!vehicle && vehicle.status === "PENDING";

    /* ============================
     * VEHICLE PHOTOS
     ============================ */
    const vehiclePhotos = await VehiclePhoto.find({ user: userData._id });

    const vehiclePhotosCompleted =
      vehiclePhotos.length > 0 &&
      vehiclePhotos.every((photo) => photo.status === "APPROVED");

    const vehiclePhotosUnderReview = vehiclePhotos.some(
      (photo) => photo.status === "PENDING"
    );

    /* ============================
     * STEPS MAP
     ============================ */
    const steps = {
      profilePhoto: {
        completed: profilePhotoCompleted,
        underReview: false,
      },
      email: {
        completed: emailCompleted,
      },
      phone: {
        completed: phoneCompleted,
      },
      documents: {
        completed: documentsCompleted,
        underReview: documentsUnderReview,
      },
      criminalRecord: {
        completed: criminalRecordCompleted,
        underReview: criminalRecordUnderReview,
      },
      vehicle: {
        completed: vehicleCompleted,
        underReview: vehicleUnderReview,
      },
      vehiclePhotos: {
        completed: vehiclePhotosCompleted,
        underReview: vehiclePhotosUnderReview,
      },
    };

    /* ============================
     * FINAL STATUS
     ============================ */
    const isCompleted =
      steps.profilePhoto.completed &&
      steps.email.completed &&
      steps.phone.completed &&
      steps.documents.completed &&
      steps.criminalRecord.completed &&
      steps.vehicle.completed &&
      steps.vehiclePhotos.completed;

    const isUnderReview =
      steps.documents.underReview ||
      steps.criminalRecord.underReview ||
      steps.vehicle.underReview ||
      steps.vehiclePhotos.underReview;

    const canDrive = isCompleted && !isUnderReview;

    return {
      isCompleted,
      isUnderReview,
      canDrive,
      steps,
    };
  }
}
