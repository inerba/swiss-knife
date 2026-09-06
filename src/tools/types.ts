import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  component: ComponentType;
}
