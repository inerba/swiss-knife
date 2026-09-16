import type { InspectRect } from '../inspect-save/types';

export interface ViewportInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface RenderedBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StateRules {
  hover: string[];
  focus: string[];
  active: string[];
}

export interface PseudoRules {
  before: string[];
  after: string[];
}

export interface CssContext {
  matched: string[];
  media: string[];
  states: StateRules;
  inherited: string[];
  pseudos: PseudoRules;
  resolved: string[];
  variables: string[];
}

export interface ContextPayload {
  element: string;
  path: string;
  url: string;
  viewport: ViewportInfo;
  box: RenderedBox;
  rect: InspectRect;
  markup: string;
  css: CssContext;
  unreadableSheets: string[];
}

export interface ContextResult extends ContextPayload {
  png?: string;
}
