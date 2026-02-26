import { View, Text } from 'react-native';
import { APP_NAME } from '@/constants/app';
import { Colors } from '@/constants/colors';

export const HeaderRight = () => (
  <View style={{ paddingRight: 16, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
    <Text
      style={{
        color: Colors.headerText,
        fontSize: 32,
        fontFamily: 'Billabong',
        includeFontPadding: false,
        textAlignVertical: 'center',
      }}
    >
      {APP_NAME}
    </Text>
  </View>
);
