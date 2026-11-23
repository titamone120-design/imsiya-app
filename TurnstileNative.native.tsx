import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const SITE_KEY = '0x4AAAAAAGPQNDVYfV6vff2R';

type Props = {
  onToken: (token: string | null) => void;
};

const html = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    #turnstile { display: flex; justify-content: center; }
  </style>
</head>
<body>
  <div id="turnstile"></div>
  <script>
    function mountTurnstile() {
      if (!window.turnstile) return;
      window.turnstile.render('#turnstile', {
        sitekey: '${SITE_KEY}',
        callback: function(token) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ token: token }));
        },
        'expired-callback': function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ token: null }));
        },
        'error-callback': function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ token: null, error: true }));
        }
      });
    }
    window.addEventListener('load', mountTurnstile);
  </script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
</body>
</html>`;

export default function TurnstileNative({ onToken }: Props) {
  return (
    <View style={{ width: '100%', height: 82, marginVertical: 10, overflow: 'hidden' }}>
      <WebView
        source={{ html, baseUrl: 'https://titamone120-design.github.io' }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        originWhitelist={['*']}
        scrollEnabled={false}
        bounces={false}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            onToken(typeof payload.token === 'string' ? payload.token : null);
          } catch {
            onToken(null);
          }
        }}
        onError={() => onToken(null)}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
