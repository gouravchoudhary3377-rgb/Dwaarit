/**
 * Flynkit Launch Animation — Pure React Native (no WebView)
 * Works on iOS, Android, and Web.
 * Ported from the HTML canvas animation using Animated + react-native-svg.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Ellipse, Circle, Rect, G } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

// ---- Grocery item colours ----
const GROCERIES = [
  { color: '#E03030', shape: 'round',  size: 28 }, // tomato
  { color: '#E84040', shape: 'round',  size: 26 }, // apple
  { color: '#F5C842', shape: 'oval',   size: 32 }, // banana
  { color: '#F77C2A', shape: 'tall',   size: 22 }, // carrot
  { color: '#3DB34A', shape: 'round',  size: 28 }, // broccoli
  { color: '#5CC85A', shape: 'round',  size: 30 }, // lettuce
  { color: '#F4F4F4', shape: 'tall',   size: 22 }, // milk
  { color: '#F5A623', shape: 'tall',   size: 20 }, // juice
  { color: '#D4A35A', shape: 'oval',   size: 30 }, // bread
];

// Spread positions inside the cart (relative to cart centre)
const TARGETS = [
  [-30, -8], [10, -4], [-8, 0],
  [-38, -6], [26, -2], [34, 4],
  [-16, -10], [4, -6], [22, 2],
];

const SPARKLE_POS = [
  [-68, -90], [62, -100], [78, -34], [-82, -42],
  [0, -115], [-54, -125], [58, -125],
];

function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Cart drawn with SVG
function CartIcon({ size = 120 }: { size?: number }) {
  const s = size / 120;
  return (
    <Svg width={size} height={size * 0.7} viewBox="-70 -40 140 80">
      {/* Body */}
      <Path
        d="M-40,-10 L-32,18 L38,18 L43,-10 Z"
        fill="rgba(255,235,215,0.95)"
        stroke="#d08050"
        strokeWidth="2"
      />
      {/* Top rail */}
      <Path d="M-44,-10 L47,-10" stroke="#d08050" strokeWidth="2.5" strokeLinecap="round" />
      {/* Handle */}
      <Path d="M-52,-20 C-52,-10,-44,-10,-44,-10" stroke="#d08050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <Path d="M-58,-26 L-46,-26" stroke="#d08050" strokeWidth="3" strokeLinecap="round" />
      {/* Wheels */}
      <Circle cx={-20} cy={26} r={6} fill="#d08050" />
      <Circle cx={-20} cy={26} r={3} fill="#FFF0E0" />
      <Circle cx={22} cy={26} r={6} fill="#d08050" />
      <Circle cx={22} cy={26} r={3} fill="#FFF0E0" />
    </Svg>
  );
}

// Single sparkle
function Sparkle({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size * 2} height={size * 2} viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}>
      <Path d={`M0,0 L${size},0 M0,0 L${-size},0 M0,0 L0,${size} M0,0 L0,${-size}`}
        stroke="#FF7F66" strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={0} cy={0} r={size * 0.18} fill="#FF9980" />
    </Svg>
  );
}

export default function SplashScreen() {
  // ---- Animated values ----
  const cartScale   = useRef(new Animated.Value(0)).current;
  const cartOpacity = useRef(new Animated.Value(1)).current;
  const cartY       = useRef(new Animated.Value(0)).current;

  // Each grocery item: y drop + opacity
  const itemAnims = useRef(
    GROCERIES.map(() => ({
      y:   new Animated.Value(-100),
      op:  new Animated.Value(0),
    }))
  ).current;

  // Sparkles
  const sparkleOp = useRef(
    SPARKLE_POS.map(() => new Animated.Value(0))
  ).current;
  const sparkleScale = useRef(
    SPARKLE_POS.map(() => new Animated.Value(0.6))
  ).current;

  // Logo
  const logoOp    = useRef(new Animated.Value(0)).current;
  const logoY     = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // 1. Cart pops in (0–600ms)
    Animated.spring(cartScale, {
      toValue: 1,
      tension: 120,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // 2. Groceries drop in one by one (500–2400ms)
    const itemDelays = GROCERIES.map((_, i) =>
      Animated.parallel([
        Animated.timing(itemAnims[i].op, {
          toValue: 1, duration: 180,
          delay: 500 + i * 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(itemAnims[i].y, {
          toValue: 0,
          tension: 80,
          friction: 6,
          delay: 500 + i * 200,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(itemDelays).start();

    // 3. Sparkles pulse in (2200–3000ms)
    const sparkleAnims = SPARKLE_POS.map((_, i) =>
      Animated.sequence([
        Animated.delay(2200 + i * 80),
        Animated.parallel([
          Animated.timing(sparkleOp[i], {
            toValue: 1, duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(sparkleScale[i], {
            toValue: 1, tension: 120, friction: 6,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(sparkleOp[i], {
          toValue: 0, duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(sparkleAnims).start();

    // 4. Cart rises and fades (2800–3400ms)
    Animated.sequence([
      Animated.delay(2800),
      Animated.parallel([
        Animated.timing(cartOpacity, {
          toValue: 0, duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cartY, {
          toValue: -40, duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 5. Logo fades in (3200ms)
    Animated.sequence([
      Animated.delay(3200),
      Animated.parallel([
        Animated.timing(logoOp, {
          toValue: 1, duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0, duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 6. Navigate after animation (4600ms)
    const timer = setTimeout(() => router.replace('/welcome'), 4600);
    return () => clearTimeout(timer);
  }, []);

  const cx = W / 2;
  const cy = H / 2 - 30;

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Cart + groceries */}
      <Animated.View
        style={[
          styles.cartWrap,
          {
            left: cx - 60,
            top:  cy - 42,
            transform: [
              { scale: cartScale },
              { translateY: cartY },
            ],
            opacity: cartOpacity,
          },
        ]}
      >
        <CartIcon size={120} />

        {/* Grocery items inside/above cart */}
        {GROCERIES.map((item, i) => {
          const [dx, dy] = TARGETS[i];
          const isOval = item.shape === 'oval';
          const isTall = item.shape === 'tall';
          const w = isOval ? item.size * 1.6 : isTall ? item.size * 0.7 : item.size;
          const h = isTall ? item.size * 1.4 : item.size;
          return (
            <Animated.View
              key={i}
              style={[
                styles.grocery,
                {
                  width: w,
                  height: h,
                  borderRadius: h / 2,
                  backgroundColor: item.color,
                  left: 60 + dx - w / 2,
                  top:  42 + dy - h / 2,
                  opacity: itemAnims[i].op,
                  transform: [{ translateY: itemAnims[i].y }],
                  borderWidth: 1.2,
                  borderColor: 'rgba(0,0,0,0.1)',
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Sparkles */}
      {SPARKLE_POS.map(([sx, sy], i) => (
        <Animated.View
          key={i}
          style={[
            styles.sparkle,
            {
              left: cx + sx - 14,
              top:  cy + sy - 14,
              opacity: sparkleOp[i],
              transform: [{ scale: sparkleScale[i] }],
            },
          ]}
        >
          <Sparkle size={14} />
        </Animated.View>
      ))}

      {/* Logo overlay */}
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOp, transform: [{ translateY: logoY }] },
        ]}
      >
        <Text style={styles.logoText}>FLYNKIT</Text>
        <Text style={styles.tagline}>
          FROM STORE{"\n"}TO DOOR IN{" "}
          <Text style={styles.highlight}>MINUTES.</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDE8D4',
  },

  cartWrap: {
    position: 'absolute',
    width: 120,
    height: 84,
  },

  grocery: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },

  sparkle: {
    position: 'absolute',
    width: 28,
    height: 28,
  },

  logoWrap: {
    position: 'absolute',
    bottom: H * 0.12,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  highlight: {
    color: '#FF7F66',
  },
});
