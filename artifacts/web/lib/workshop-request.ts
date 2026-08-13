import { apiFetch } from "./api-client";

export type WorkshopCatalogService = { id: string; name: string; description: string | null };
export type WorkshopAvailability = {
  configured: boolean;
  timezone: string;
  days: Array<{ date: string; times: string[]; available: boolean }>;
};
export type WorkshopRequestDraft = {
  customerName: string; customerPhone: string; customerEmail: string; preferredContactMethod: "whatsapp" | "phone" | "email";
  bicycleId: string; bikeBrand: string; bikeModel: string; bikeType: string; bikeColor: string; bikeWheelSize: string; bikeYear: string;
  bikeBrakeType: string; bikeSuspensionType: string; bikeDrivetrain: string; bikeGeneralCondition: string; bikeSerialNumber: string;
  bikeFrameNumber: string; bikeNotes: string; bikeAccessories: string; catalogServiceId: string; serviceName: string;
  problemDescription: string; symptoms: string; visibleDamage: string; additionalComments: string; requestedDate: string;
  requestedTime: string; desiredDeliveryDate: string; urgency: "normal" | "soon" | "urgent";
};

export const EMPTY_WORKSHOP_REQUEST: WorkshopRequestDraft = {
  customerName: "", customerPhone: "", customerEmail: "", preferredContactMethod: "whatsapp", bicycleId: "",
  bikeBrand: "", bikeModel: "", bikeType: "", bikeColor: "", bikeWheelSize: "", bikeYear: "", bikeBrakeType: "",
  bikeSuspensionType: "", bikeDrivetrain: "", bikeGeneralCondition: "", bikeSerialNumber: "", bikeFrameNumber: "",
  bikeNotes: "", bikeAccessories: "", catalogServiceId: "", serviceName: "", problemDescription: "", symptoms: "",
  visibleDamage: "", additionalComments: "", requestedDate: "", requestedTime: "", desiredDeliveryDate: "", urgency: "normal",
};
export const getWorkshopCatalog = () => apiFetch<WorkshopCatalogService[]>("/api/public/workshop/catalog");
export const getWorkshopAvailability = () => apiFetch<WorkshopAvailability>("/api/public/workshop/availability");

export function publicWorkshopPayload(draft: WorkshopRequestDraft) {
  const nullable = (value: string) => value.trim() || null;
  return {
    customerName: draft.customerName, customerPhone: draft.customerPhone, customerEmail: nullable(draft.customerEmail),
    preferredContactMethod: draft.preferredContactMethod, bikeBrand: nullable(draft.bikeBrand), bikeModel: nullable(draft.bikeModel),
    bikeType: nullable(draft.bikeType), bikeColor: nullable(draft.bikeColor), bikeWheelSize: nullable(draft.bikeWheelSize),
    bikeYear: draft.bikeYear ? Number(draft.bikeYear) : null, bikeBrakeType: nullable(draft.bikeBrakeType),
    bikeSuspensionType: nullable(draft.bikeSuspensionType), bikeDrivetrain: nullable(draft.bikeDrivetrain),
    bikeGeneralCondition: nullable(draft.bikeGeneralCondition), bikeSerialNumber: nullable(draft.bikeSerialNumber),
    bikeFrameNumber: nullable(draft.bikeFrameNumber), bikeNotes: nullable(draft.bikeNotes), bikeAccessories: nullable(draft.bikeAccessories),
    catalogServiceId: nullable(draft.catalogServiceId), serviceName: nullable(draft.serviceName), problemDescription: draft.problemDescription,
    symptoms: nullable(draft.symptoms), visibleDamage: nullable(draft.visibleDamage), additionalComments: nullable(draft.additionalComments),
    requestedDate: nullable(draft.requestedDate), requestedTime: nullable(draft.requestedTime), desiredDeliveryDate: nullable(draft.desiredDeliveryDate), urgency: draft.urgency,
  };
}
