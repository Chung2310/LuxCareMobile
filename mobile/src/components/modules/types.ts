import { Ionicons } from "@expo/vector-icons";

export interface ServiceItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route: string;
  moduleId: string;
  badge?: string;
  isNew?: boolean;
  status?: "active" | "coming_soon";
}

export interface ServiceModule {
  id: string;
  title: string;
  shortTitle: string;
  items: ServiceItem[];
}
