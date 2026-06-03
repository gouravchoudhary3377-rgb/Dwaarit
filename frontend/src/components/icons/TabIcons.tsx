// Custom abstract geometric SVG icons for Flynkit's bottom nav.
// Per design_guidelines: NO generic houses, bags, receipts or person silhouettes.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number };

// Nested arches forming an abstract doorway (Flynkit).
export function HomeIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M5 27V17a11 11 0 0122 0v10"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Path
        d="M11 27V19a5 5 0 0110 0v8"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Circle cx="16" cy="23" r="1.4" fill={color} />
    </Svg>
  );
}

// Sweeping arc with geometric cargo block (basket-weave abstraction).
export function CartIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M5 9h3l3 14h13"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="10.5" y="12" width="15" height="8" rx="2.5" stroke={color} strokeWidth={2.4} />
      <Path d="M14 12v8M18 12v8M22 12v8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx="13" cy="26" r="1.6" fill={color} />
      <Circle cx="22" cy="26" r="1.6" fill={color} />
    </Svg>
  );
}

// Four squared tiles forming an abstract category grid.
export function CategoriesIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="5" y="5" width="9" height="9" rx="2" stroke={color} strokeWidth={2.4} />
      <Rect x="18" y="5" width="9" height="9" rx="2" stroke={color} strokeWidth={2.4} />
      <Rect x="5" y="18" width="9" height="9" rx="2" stroke={color} strokeWidth={2.4} />
      <Circle cx="22.5" cy="22.5" r="4.5" stroke={color} strokeWidth={2.4} />
    </Svg>
  );
}

// Staggered timeline dots+lines for order tracking.
export function OrdersIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="8" cy="8" r="2.4" fill={color} />
      <Circle cx="8" cy="16" r="2.4" stroke={color} strokeWidth={2} />
      <Circle cx="8" cy="24" r="2.4" stroke={color} strokeWidth={2} />
      <Path d="M14 8h14M14 16h11M14 24h8" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

// Floating identity orbit — concentric asymmetric arcs.
export function ProfileIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="16" cy="13" r="4.4" stroke={color} strokeWidth={2.4} />
      <Path
        d="M6.5 26c1.5-4.5 5.5-7.2 9.5-7.2s8 2.7 9.5 7.2"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Circle cx="24" cy="8" r="1.6" fill={color} />
    </Svg>
  );
}

// Stylized 'D' wordmark for splash + login.
export function DwaaritMark({ color = '#FF5A00', size = 56 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path
        d="M14 10h22a18 18 0 010 36H14V10z"
        stroke={color}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <Path d="M22 22h12a6 6 0 010 12H22V22z" fill={color} />
      <Circle cx="50" cy="54" r="4" fill={color} />
    </Svg>
  );
}
