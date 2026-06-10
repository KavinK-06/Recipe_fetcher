// Razorpay one-time checkout, rendered inside a WebView via the hosted
// checkout.js script (the standard Orders flow — takes order_id + key_id).
//
// ⚠️ REQUIRES: `npx expo install react-native-webview` (not bundled by default).
// ⚠️ The webhook (razorpay-webhook) is the source of truth for granting the
//    entitlement; this WebView only collects the payment + tells us to refetch.
//    Needs a real device pass — Razorpay checkout behaviour in a WebView can be
//    origin-sensitive, so `baseUrl` is set to an https origin below.

import React from 'react';
import { Modal, View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/colors';
import type { CreateOrderResult } from '../lib/api/billing';

interface Props {
  order: CreateOrderResult;
  description: string;
  prefillEmail?: string;
  onSuccess: () => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}

function buildHtml(order: CreateOrderResult, description: string, prefillEmail?: string): string {
  // JSON.stringify keeps the injected values safely quoted/escaped.
  const options = {
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    order_id: order.orderId,
    name: 'Saveur',
    description,
    theme: { color: Colors.burgundy },
    prefill: prefillEmail ? { email: prefillEmail } : undefined,
  };

  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="background:${Colors.noir};margin:0">
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      function post(msg) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }
      try {
        var options = ${JSON.stringify(options)};
        options.handler = function (response) { post({ type: 'success', response: response }); };
        options.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
          post({ type: 'failed', error: response && response.error ? response.error.description : 'payment_failed' });
        });
        rzp.open();
      } catch (e) {
        post({ type: 'error', message: String(e) });
      }
    </script>
  </body>
</html>`;
}

export default function RazorpayCheckoutWebView({
  order,
  description,
  prefillEmail,
  onSuccess,
  onDismiss,
  onError,
}: Props) {
  const html = buildHtml(order, description, prefillEmail);

  return (
    <Modal visible animationType="slide" onRequestClose={onDismiss} transparent={false}>
      <View style={styles.container}>
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://saveur.app' }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.saffron} size="large" />
            </View>
          )}
          onMessage={(event) => {
            let msg: { type?: string; message?: string; error?: string } = {};
            try {
              msg = JSON.parse(event.nativeEvent.data);
            } catch {
              return;
            }
            switch (msg.type) {
              case 'success':
                onSuccess();
                break;
              case 'dismiss':
                onDismiss();
                break;
              case 'failed':
                onError(msg.error ?? 'Payment failed');
                break;
              case 'error':
                onError(msg.message ?? 'Checkout error');
                break;
            }
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.noir },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.noir,
  },
});
