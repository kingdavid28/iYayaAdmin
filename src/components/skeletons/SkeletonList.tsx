import React, {useMemo} from 'react';
import {FlatList, StyleSheet, View, ViewStyle, ListRenderItemInfo} from 'react-native';

export interface SkeletonListProps {
  itemCount?: number;
  renderItem: (index: number) => React.ReactElement;
  contentContainerStyle?: ViewStyle | ViewStyle[];
  keyPrefix?: string;
  horizontal?: boolean;
}

const SkeletonList: React.FC<SkeletonListProps> = ({
  itemCount = 4,
  renderItem,
  contentContainerStyle,
  keyPrefix = 'skeleton-item',
  horizontal = false,
}) => {
  const data = useMemo(() => Array.from({length: itemCount}).map((_, index) => index), [itemCount]);

  const render = ({index}: ListRenderItemInfo<number>) => (
    <View style={styles.itemContainer}>{renderItem(index)}</View>
  );

  return (
    <FlatList
      data={data}
      keyExtractor={index => `${keyPrefix}-${index}`}
      renderItem={render}
      contentContainerStyle={[styles.container, contentContainerStyle]}
      horizontal={horizontal}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  );
};

export default SkeletonList;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    gap: 16,
  },
  itemContainer: {
    width: '100%',
  },
});
