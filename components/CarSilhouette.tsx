import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { BodyType } from '@/types/firestore';

const BODY    = 'rgba(201,162,39,0.18)';
const BORDER  = 'rgba(201,162,39,0.55)';
const GLASS   = 'rgba(201,162,39,0.08)';
const WHEEL   = '#0A1628';
const W_BORDER = 'rgba(201,162,39,0.7)';

const BW = 1.5;

function Wheel({ x, y }: { x: number; y: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: WHEEL,
        borderWidth: 2.5,
        borderColor: W_BORDER,
      }}
    />
  );
}

function Shadow({ opacity }: { opacity: number }) {
  return (
    <View
      style={{
        width: 160,
        height: 10,
        borderRadius: 80,
        backgroundColor: `rgba(201,162,39,${opacity})`,
        alignSelf: 'center',
        marginTop: 4,
      }}
    />
  );
}

function Sedan() {
  return (
    <View style={s.canvas}>
      {/* chassis */}
      <View style={[s.body, { left: 4, top: 40, width: 192, height: 30, borderRadius: 8 }]} />
      {/* cabin */}
      <View style={[s.glass, { left: 46, top: 16, width: 104, height: 26,
        borderTopLeftRadius: 16, borderTopRightRadius: 14,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} />
      <Wheel x={20} y={54} />
      <Wheel x={152} y={54} />
    </View>
  );
}

function SUV() {
  return (
    <View style={s.canvas}>
      {/* chassis */}
      <View style={[s.body, { left: 4, top: 36, width: 192, height: 34, borderRadius: 8 }]} />
      {/* cabin — wide, flat top */}
      <View style={[s.glass, { left: 20, top: 10, width: 152, height: 28,
        borderTopLeftRadius: 10, borderTopRightRadius: 10,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} />
      <Wheel x={20} y={54} />
      <Wheel x={152} y={54} />
    </View>
  );
}

function Truck() {
  return (
    <View style={s.canvas}>
      {/* cab */}
      <View style={[s.body, { left: 4, top: 26, width: 84, height: 44, borderRadius: 8 }]} />
      {/* cab glass */}
      <View style={[s.glass, { left: 12, top: 10, width: 68, height: 18,
        borderTopLeftRadius: 10, borderTopRightRadius: 8,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} />
      {/* bed */}
      <View style={[s.body, { left: 92, top: 48, width: 104, height: 22, borderRadius: 4 }]} />
      {/* bed rails */}
      <View style={{ position: 'absolute', left: 92, top: 44, width: 104, height: 6,
        backgroundColor: BORDER, borderRadius: 3, borderWidth: 0 }} />
      <Wheel x={20} y={54} />
      <Wheel x={155} y={54} />
    </View>
  );
}

function Coupe() {
  return (
    <View style={s.canvas}>
      {/* chassis — lower, longer */}
      <View style={[s.body, { left: 4, top: 44, width: 192, height: 26, borderRadius: 8 }]} />
      {/* cabin — narrow, sloped */}
      <View style={[s.glass, { left: 58, top: 14, width: 86, height: 32,
        borderTopLeftRadius: 22, borderTopRightRadius: 14,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} />
      <Wheel x={20} y={54} />
      <Wheel x={152} y={54} />
    </View>
  );
}

function Minivan() {
  return (
    <View style={s.canvas}>
      {/* one tall boxy body */}
      <View style={[s.body, { left: 4, top: 18, width: 192, height: 52, borderRadius: 10,
        borderTopLeftRadius: 6, borderTopRightRadius: 10 }]} />
      {/* sliding window strip */}
      <View style={[s.glass, { left: 80, top: 22, width: 108, height: 26,
        borderRadius: 4 }]} />
      {/* front glass */}
      <View style={[s.glass, { left: 12, top: 22, width: 56, height: 26,
        borderTopLeftRadius: 4, borderRadius: 4 }]} />
      <Wheel x={20} y={54} />
      <Wheel x={152} y={54} />
    </View>
  );
}

function Convertible() {
  return (
    <View style={s.canvas}>
      {/* chassis */}
      <View style={[s.body, { left: 4, top: 44, width: 192, height: 26, borderRadius: 8 }]} />
      {/* tiny windshield only */}
      <View style={[s.glass, { left: 66, top: 32, width: 68, height: 14,
        borderTopLeftRadius: 10, borderTopRightRadius: 8,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} />
      {/* door trim line */}
      <View style={{ position: 'absolute', left: 30, top: 44, width: 140, height: 1.5,
        backgroundColor: BORDER }} />
      <Wheel x={20} y={54} />
      <Wheel x={152} y={54} />
    </View>
  );
}

const SHAPES: Record<BodyType, () => React.ReactElement> = {
  sedan:       Sedan,
  suv:         SUV,
  truck:       Truck,
  coupe:       Coupe,
  minivan:     Minivan,
  convertible: Convertible,
};

type Props = {
  bodyType: BodyType;
  animate?: boolean;
};

export function CarSilhouette({ bodyType, animate = true }: Props) {
  const float = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.14);

  useEffect(() => {
    if (!animate) return;
    float.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    shadowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.06, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.14, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [animate]);

  const carStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadowOpacity.value * 6,
    transform: [{ scaleX: 1 + (float.value / -7) * 0.08 }],
  }));

  const Shape = SHAPES[bodyType] ?? Sedan;

  return (
    <View style={s.root}>
      <Animated.View entering={FadeInRight.springify().damping(18)} style={carStyle}>
        <Shape />
      </Animated.View>
      <Animated.View style={[s.shadowWrap, shadowStyle]}>
        <Shadow opacity={0.14} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: 'center' },
  canvas: { width: 200, height: 84, position: 'relative' },
  body: {
    position: 'absolute',
    backgroundColor: BODY,
    borderWidth: BW,
    borderColor: BORDER,
  },
  glass: {
    position: 'absolute',
    backgroundColor: GLASS,
    borderWidth: BW,
    borderColor: BORDER,
  },
  shadowWrap: { marginTop: 0 },
});
