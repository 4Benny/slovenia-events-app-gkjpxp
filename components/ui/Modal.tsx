
import React from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import * as Brand from "@/constants/Colors";

interface ModalAction {
  text: string;
  onPress: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface ModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  type?: "alert" | "confirm";
  confirmText?: string;
  cancelText?: string;
  actions?: ModalAction[];
}

export function Modal({ 
  visible, 
  title, 
  message, 
  onClose, 
  onConfirm,
  type = "alert",
  confirmText = "OK",
  cancelText = "Prekliči",
  actions 
}: ModalProps) {
  const theme = useTheme();

  // If actions are provided, use them
  if (actions) {
    return (
      <RNModal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: Brand.textSecondary }]}>
              {message}
            </Text>
            <View style={styles.actions}>
              {actions.map((action, index) => {
                const isDestructive = action.style === "destructive";
                const isCancel = action.style === "cancel";
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isDestructive && styles.destructiveButton,
                      isCancel && styles.cancelButton,
                      !isDestructive && !isCancel && { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={action.onPress}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isDestructive && styles.destructiveButtonText,
                        isCancel && { color: theme.colors.text },
                      ]}
                    >
                      {action.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </RNModal>
    );
  }

  // For confirm type, show cancel and confirm buttons
  if (type === "confirm") {
    return (
      <RNModal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: Brand.textSecondary }]}>
              {message}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  console.log("[Modal] Cancel button pressed");
                  onClose();
                }}
              >
                <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.destructiveButton]}
                onPress={() => {
                  console.log("[Modal] Confirm button pressed");
                  if (onConfirm) {
                    onConfirm();
                  }
                }}
              >
                <Text style={[styles.buttonText, styles.destructiveButtonText]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>
    );
  }

  // Default alert type with single OK button
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: Brand.textSecondary }]}>
            {message}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: Brand.borderRadiusCard,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: Brand.borderRadiusInput,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: Brand.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
  },
  destructiveButton: {
    backgroundColor: Brand.dangerRed,
  },
  destructiveButtonText: {
    color: Brand.textPrimary,
  },
});
