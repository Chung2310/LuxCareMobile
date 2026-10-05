export type AiSharingScope = "personal" | "company";
export interface AiSharingRecipient { name: string; privacyUrl: string }
export interface AiSharingDisclosure {
  scope: AiSharingScope;
  version: string;
  disclosureKey: string;
  model: string;
  recipients: AiSharingRecipient[];
  dataTypes: string[];
  purpose: string;
  privacyUrl: string;
  accepted: boolean;
  acceptedAt: string | null;
}
