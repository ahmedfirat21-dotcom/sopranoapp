import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const coinSource = require('../assets/soprano_coin.png');

type Props = {
  size?: number;
};

/** Soprano Coin özel ikonu — tüm coin gösterimlerinde kullanılır */
const SopranoCoin = React.memo(function SopranoCoin({ size = 20 }: Props) {
  return (
    <Image
      source={coinSource}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="contain"
    />
  );
});

export default SopranoCoin;
