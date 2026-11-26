import {
  CircleHelpIcon,
  ConstructionIcon,
  DropletsIcon,
  LightbulbIcon,
  Trash2Icon,
  WavesIcon,
} from "lucide-react";

// Decision M1-6, in the server's order: the value the API takes, its icon, and its label key.
export const CATEGORIES = [
  { value: "pothole", Icon: ConstructionIcon, label: "report.category.pothole" },
  { value: "garbage", Icon: Trash2Icon, label: "report.category.garbage" },
  { value: "streetlight", Icon: LightbulbIcon, label: "report.category.streetlight" },
  { value: "water_leak", Icon: DropletsIcon, label: "report.category.waterLeak" },
  { value: "drainage", Icon: WavesIcon, label: "report.category.drainage" },
  { value: "other", Icon: CircleHelpIcon, label: "report.category.other" },
];
