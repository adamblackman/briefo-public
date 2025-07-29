import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { X } from 'lucide-react-native';

interface EditProfileModalProps {
  visible: boolean;
  label: string;
  initialValue: string;
  onClose: () => void;
  onSave: (newValue: string) => Promise<void>;
  fieldKey: 'name' | 'username' | 'bio'; 
  inputProps?: any; // To pass specific TextInput props like multiline for bio
}

export default function EditProfileModal({
  visible,
  label,
  initialValue,
  onClose,
  onSave,
  fieldKey,
  inputProps = {},
}: EditProfileModalProps) {
  const { colors } = useTheme();
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setIsSaving(false);
      setError(null);
    }
  }, [visible, initialValue]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(value);
      onClose(); // Close modal on successful save
    } catch (e: any) {
      setError(e.message || 'Failed to save. Please try again.');
    }
    setIsSaving(false);
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={[styles.modalView, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
          
          <TextInput
            style={[
              styles.input,
              { 
                borderColor: colors.border, 
                color: colors.text,
                backgroundColor: colors.backgroundSecondary 
              },
              inputProps.multiline && styles.multilineInput // Apply specific style for multiline
            ]}
            value={value}
            onChangeText={(text) => {
              if (fieldKey === 'username') {
                setValue(text.toLowerCase());
              } else {
                setValue(text);
              }
            }}
            placeholder={`Enter new ${fieldKey.toLowerCase()}`}
            placeholderTextColor={colors.textSecondary}
            autoFocus
            {...inputProps}
            maxLength={fieldKey === 'bio' ? 80 : undefined}
          />

          {fieldKey === 'bio' && (
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>
              {value.length}/80
            </Text>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: colors.accent }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#333333" />
              ) : (
                <Text style={[styles.buttonText, { color: '#333333' }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginBottom: 15,
  },
  multilineInput: {
    minHeight: 100, // Set a min height for multiline input
    textAlignVertical: 'top', // Align text to top for multiline
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  cancelButton: {
    borderWidth: 1,
    marginRight: 10,
  },
  saveButton: {
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
}); 