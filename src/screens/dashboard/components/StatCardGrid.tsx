import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Platform, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {ActivityIndicator, Button, Card, Text, useTheme} from 'react-native-paper';
import {Icon} from 'react-native-elements';

type StatCardBase = {
  key: string;
  title: string;
  value: number;
  icon: string;
  color: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  showSkeleton: boolean;
};

export type StatCardItem = StatCardBase;

const ShimmerPlaceholder = ({style}: {style?: StyleProp<ViewStyle>}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      shimmer.setValue(0);
    };
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  return (
    <View style={[styles.skeletonBase, style]}>
      <Animated.View style={[styles.shimmerOverlay, {transform: [{translateX}]}]} />
    </View>
  );
};

const SkeletonCard = React.memo(() => (
  <Card style={styles.card}>
    <Card.Content style={styles.cardContent}>
      <View style={styles.iconContainer}>
        <ShimmerPlaceholder style={styles.skeletonIcon} />
      </View>
      <View style={styles.textContainer}>
        <ShimmerPlaceholder style={styles.skeletonTitle} />
        <ShimmerPlaceholder style={styles.skeletonValue} />
      </View>
    </Card.Content>
  </Card>
));

SkeletonCard.displayName = 'SkeletonCard';

const StatCard = React.memo(({card}: {card: StatCardItem}) => {
  const theme = useTheme();

  if (card.showSkeleton) {
    return <SkeletonCard />;
  }

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.iconContainer}>
          <Icon name={card.icon} type="material" color={card.color} size={32} />
        </View>
        <View style={styles.textContainer}>
          <Text variant="headlineSmall" style={styles.value}>
            {Number.isFinite(card.value) ? card.value : '—'}
          </Text>
          <Text variant="bodyMedium" style={styles.title}>
            {card.title}
          </Text>
        </View>
        {card.loading && (
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.cardSpinner} />
        )}
      </Card.Content>
      {card.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{card.error}</Text>
          <Button mode="text" onPress={card.onRetry} compact>
            Retry
          </Button>
        </View>
      )}
    </Card>
  );
});

StatCard.displayName = 'StatCard';

interface StatCardGridProps {
  cards: StatCardItem[];
}

const StatCardGrid: React.FC<StatCardGridProps> = ({cards}) => {
  const items = useMemo(() => cards, [cards]);

  return (
    <View style={styles.grid}>
      {items.map(card => (
        <StatCard key={card.key} card={card} />
      ))}
    </View>
  );
};

export const StatCardGridFallback = ({count}: {count: number}) => (
  <View style={styles.grid}>
    {Array.from({length: count}).map((_, index) => (
      <SkeletonCard key={`skeleton-${index}`} />
    ))}
  </View>
);

export default React.memo(StatCardGrid);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: {width: 0, height: 2},
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
      },
      default: {},
    }),
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  value: {
    fontWeight: 'bold',
    color: '#333',
  },
  title: {
    color: '#666',
  },
  cardSpinner: {
    marginLeft: 8,
  },
  errorContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 4,
  },
  skeletonBase: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
  },
  skeletonIcon: {
    width: 32,
    height: 32,
  },
  skeletonTitle: {
    width: '80%',
    height: 16,
    marginBottom: 8,
  },
  skeletonValue: {
    width: 60,
    height: 22,
  },
});
