import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, ViewStyle} from 'react-native';

export interface SkeletonProps {
  style?: ViewStyle | ViewStyle[];
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({style, width = '100%', height = 16, borderRadius = 8}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );

    animation.start();
    return () => {
      animation.stop();
      shimmer.setValue(0);
    };
  }, [shimmer]);

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#eceff1', '#f5f5f5', '#eceff1'],
  });

  return (
    <Animated.View
      style={[
        styles.base,
        {width, height, borderRadius, backgroundColor},
        style,
      ]}
    />
  );
};

export const SkeletonCircle: React.FC<{size?: number; style?: ViewStyle | ViewStyle[]}> = ({size = 48, style}) => (
  <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />
);

export const SkeletonBlock: React.FC<SkeletonProps> = props => (
  <Skeleton {...props} borderRadius={props.borderRadius ?? 12} />
);

export type SkeletonStackItem =
  | {
      type: 'block';
      width?: number | `${number}%`;
      height?: number;
      borderRadius?: number;
      style?: ViewStyle | ViewStyle[];
    }
  | {
      type: 'circle';
      size?: number;
      style?: ViewStyle | ViewStyle[];
    };

export interface SkeletonStackProps {
  items: SkeletonStackItem[];
  gap?: number;
  direction?: 'row' | 'column';
  style?: ViewStyle | ViewStyle[];
  align?: 'flex-start' | 'center' | 'flex-end';
}

export const SkeletonStack: React.FC<SkeletonStackProps> = ({
  items,
  gap = 8,
  direction = 'column',
  style,
  align = 'flex-start',
}) => (
  <Animated.View style={[styles.stack, {gap, flexDirection: direction, alignItems: align}, style]}>
    {items.map((item, index) =>
      item.type === 'circle' ? (
        <SkeletonCircle key={`stack-circle-${index}`} size={item.size} style={item.style} />
      ) : (
        <SkeletonBlock
          key={`stack-block-${index}`}
          width={item.width}
          height={item.height}
          borderRadius={item.borderRadius}
          style={item.style}
        />
      ),
    )}
  </Animated.View>
);

export default Skeleton;

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#eceff1',
  },
  stack: {
    width: '100%',
  },
});
