import { View, Text } from 'react-native';
import { APP_NAME } from '@/constants/app';
import Constants from 'expo-constants';

const version = Constants.expoConfig?.version;

export const HeaderRight = () => (
  <View style={{ paddingRight: 16, alignItems: 'flex-end' }}>
    <Text
      style={{
        color: '#fff',
        fontSize: 32,
        fontFamily: 'Billabong',
      }}
    >
      {APP_NAME}
    </Text>
  </View>
);
