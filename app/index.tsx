import { Redirect } from 'expo-router';
import { View, Image, StyleSheet, StatusBar } from 'react-native';
import { useEffect } from 'react';

export default function Home() {
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Image 
        source={require('@/assets/images/splash.png')}
        style={styles.splash}
        resizeMode="cover"
      />
      <Redirect href="/(tabs)" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splash: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  }
});