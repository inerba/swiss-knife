import { colorCss } from './color';

export function ColorSwatch({ value, className = '' }: { value: string; className?: string }) {
  return <span className={`colors-swatch ${className}`} aria-hidden="true">
    <span style={{ backgroundColor: colorCss(value) }} />
  </span>;
}
