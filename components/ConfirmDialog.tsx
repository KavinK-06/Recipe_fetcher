import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  /** Icon shown in the badge above the title. Defaults to a trash can. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tints the confirm button + icon badge red and uses a warning icon treatment. */
  destructive?: boolean;
  /** Shows a spinner in the confirm button and blocks input while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Themed replacement for the native `Alert.alert` confirm dialog. A centered card
 * that matches the app's noir/burgundy chrome (mirrors RecipeActionsSheet styling)
 * so destructive confirms read as part of the product, not a system pop-up.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  icon = 'trash-outline',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const accent = destructive ? Colors.paprika : Colors.saffron;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onCancel}
        />

        <View style={styles.card}>
          <View
            style={[
              styles.iconBadge,
              { borderColor: accent, backgroundColor: `${accent}22` },
            ]}
          >
            <Ionicons name={icon} size={26} color={accent} />
          </View>

          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={busy}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: accent },
                busy && styles.buttonBusy,
              ]}
              onPress={onConfirm}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={Colors.parchment} />
              ) : (
                <Text style={styles.confirmLabel}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#000000B0',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.noir,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 24,
    color: Colors.parchment,
    textAlign: 'center',
  },
  message: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.mutedText,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBusy: {
    opacity: 0.7,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  cancelLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    color: Colors.parchment,
  },
  confirmLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.parchment,
  },
});
