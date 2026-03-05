import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { APP_NAME } from '@/constants/app';
import { Colors } from '@/constants/colors';

export const HeaderRight = React.memo(() => (
  <View style={styles.container}>
    <Text style={styles.title}>{' '}{APP_NAME}</Text>
  </View>
));

const styles = StyleSheet.create({
  container: {
    paddingRight: 16,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: '100%',
    overflow: 'visible',
  },
  title: {
    color: Colors.headerText,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: 'Billabong',
    includeFontPadding: false,
    textAlignVertical: 'center',
    paddingLeft: 8,
  },
});
