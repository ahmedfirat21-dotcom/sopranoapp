/**
 * SopranoChat — LinkifiedText (v109)
 * ═══════════════════════════════════════════════════════════════════
 * Mesaj içinde URL'leri otomatik algılar, mavi/teal renkli + tıklanabilir
 * şekilde render eder. Linking.openURL ile tarayıcıda açılır.
 *
 * Tam OpenGraph preview kartı post-launch'a ertelendi (edge function gerekiyor).
 */

import React from 'react';
import { Text, Linking, type TextStyle } from 'react-native';

const URL_REGEX = /(https?:\/\/[^\s<>"]+)/gi;

interface Props {
  text: string;
  style?: TextStyle | TextStyle[];
  linkColor?: string;
}

export default function LinkifiedText({ text, style, linkColor = '#5EEAD4' }: Props) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // ★ Regex 'g' flag, lastIndex sıfırla — split sonrası test() güvenilir olsun
          URL_REGEX.lastIndex = 0;
          return (
            <Text
              key={i}
              style={{ color: linkColor, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL(part).catch(() => {})}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
