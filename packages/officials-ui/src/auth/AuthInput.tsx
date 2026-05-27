'use client'

import { createElement, useId, useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface AuthInputProps {
  label: string
  value: string
  onChangeText: (next: string) => void
  /** `text` (default), `email`, or `password`. Drives HTML input type + RN
   *  keyboardType / secureTextEntry / autoCapitalize. */
  type?: 'email' | 'password' | 'text'
  placeholder?: string
  error?: string
  disabled?: boolean
  /** Web HTML autocomplete attribute (e.g. 'email', 'current-password',
   *  'new-password'). Forwarded as-is to the underlying input on both
   *  platforms (RN's autoComplete accepts the same web values). */
  autoComplete?: string
  testID?: string
}

/**
 * Material-3-style outlined input with floating label.
 *
 * Web: `createElement('div'/'label'/'input')` escape hatch (slice 14 +
 * slice 25 BioHeader pattern). A scoped `<style>` block drives the
 * CSS floating-label transition via `:focus` + `:not(:placeholder-shown)`
 * selectors; the input is rendered with `placeholder=" "` (single space)
 * so the `:not(:placeholder-shown)` selector matches whenever the user
 * has typed anything. Real HTML semantics enable autofill + browser
 * autocomplete + native `<label htmlFor>` linkage.
 *
 * Native: static "always compact" label (no animation library in v1).
 * Focus + error states drive border + label color shifts via
 * `useState`-tracked `focused`.
 *
 * Accessibility: `aria-invalid` is passed as a direct DOM attribute
 * (Gotcha #22 — RNW 0.19 does not auto-translate `accessibilityState`),
 * and `aria-describedby` links the error text element when present.
 */
export function AuthInput({
  label,
  value,
  onChangeText,
  type = 'text',
  placeholder,
  error,
  disabled,
  autoComplete,
  testID,
}: AuthInputProps): React.JSX.Element {
  const reactId = useId()
  // useId() returns a value containing ':' which is invalid in CSS class names; sanitize.
  const safeId = reactId.replace(/:/g, '_')
  const className = `auth-input-${safeId}`
  const inputId = `input-${safeId}`
  const errorId = `${inputId}-error`

  const [focused, setFocused] = useState(false)
  const { semantic } = useBrandTokens()

  // Build the CSS template only when className or active brand semantics
  // change. Without useMemo, every keystroke re-renders the component and
  // recomputes the whole template string — wasteful given the string is
  // stable across keystrokes (it depends only on the active mode + the
  // useId-derived className).
  const css = useMemo(
    () =>
      `
.${className} { position: relative; }
.${className}.disabled { opacity: 0.5; pointer-events: none; }
.${className} .auth-input__field {
  display: block;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid ${semantic.border.default};
  border-radius: 10px;
  height: 48px;
  padding: 0 14px;
  font-size: 14px;
  color: ${semantic.text.primary};
  background-color: transparent;
  outline: none;
  transition: border-color 150ms ease-out, border-width 150ms ease-out;
  font-family: inherit;
}
.${className} .auth-input__field:focus {
  border-color: ${semantic.accent.primary};
  border-width: 1.5px;
  padding: 0 13.5px;
}
.${className} .auth-input__field[aria-invalid="true"] {
  border-color: ${semantic.alert.danger.fg};
}
.${className} .auth-input__label {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: ${semantic.text.muted};
  pointer-events: none;
  transition: transform 150ms ease-out, color 150ms ease-out, font-size 150ms ease-out;
  background-color: ${semantic.bg.elevated};
  padding: 0 4px;
  font-weight: 400;
  letter-spacing: 0;
}
.${className} .auth-input__field:focus ~ .auth-input__label,
.${className} .auth-input__field:not(:placeholder-shown) ~ .auth-input__label {
  transform: translateY(-100%) scale(0.75);
  top: 6px;
  color: ${semantic.accent.primary};
  font-weight: 700;
  letter-spacing: 0.06em;
}
.${className} .auth-input__field[aria-invalid="true"] ~ .auth-input__label,
.${className} .auth-input__field[aria-invalid="true"]:focus ~ .auth-input__label {
  color: ${semantic.alert.danger.fg};
}
.${className} .auth-input__error {
  font-size: 11px;
  color: ${semantic.alert.danger.fg};
  margin-top: 4px;
}
`.trim(),
    [className, semantic],
  )

  if (Platform.OS === 'web') {
    const inputType = type === 'password' ? 'password' : type === 'email' ? 'email' : 'text'

    return createElement(
      'div',
      {
        className: `${className}${disabled ? ' disabled' : ''}`,
        'data-testid': testID,
      },
      createElement('style', { dangerouslySetInnerHTML: { __html: css } }),
      createElement(
        'div',
        { style: { position: 'relative' } },
        createElement('input', {
          id: inputId,
          className: 'auth-input__field',
          type: inputType,
          value,
          onChange: (e: { target: { value: string } }) => onChangeText(e.target.value),
          placeholder: placeholder ?? ' ',
          autoComplete,
          disabled: disabled ?? false,
          'aria-invalid': error ? true : false,
          'aria-describedby': error ? errorId : undefined,
        }),
        createElement(
          'label',
          { htmlFor: inputId, className: 'auth-input__label' },
          label,
        ),
      ),
      error
        ? createElement(
            'div',
            { id: errorId, className: 'auth-input__error', role: 'alert' },
            error,
          )
        : null,
    )
  }

  // Native: static "always compact" label.
  // StyleSheet holds layout-only properties; color overrides come inline from
  // useBrandTokens() so the component is mode-aware without recreating the
  // StyleSheet per render.
  const boxStyles = [
    styles.box,
    { borderColor: semantic.border.default, backgroundColor: semantic.bg.elevated },
    focused ? { borderColor: semantic.accent.primary } : null,
    error ? { borderColor: semantic.alert.danger.fg } : null,
    disabled ? styles.boxDisabled : null,
  ]
  const labelStyles = [
    styles.label,
    { color: semantic.text.muted },
    focused ? { color: semantic.accent.primary } : null,
    error ? { color: semantic.alert.danger.fg } : null,
  ]
  return (
    <View style={boxStyles}>
      <Text style={labelStyles}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder ?? ''}
        placeholderTextColor={semantic.text.muted}
        secureTextEntry={type === 'password'}
        keyboardType={type === 'email' ? 'email-address' : 'default'}
        autoCapitalize={type === 'email' || type === 'password' ? 'none' : 'sentences'}
        // RN's TextInput autoComplete is a literal-string union (no plain
        // `string` overlap); the values we pass ('email', 'current-password',
        // 'new-password') are all valid members so this cast is safe.
        autoComplete={autoComplete as never}
        editable={!disabled}
        style={[styles.input, { color: semantic.text.primary }]}
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled ?? false }}
        testID={testID}
      />
      {error ? (
        <Text style={[styles.errorText, { color: semantic.alert.danger.fg }]}>{error}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  boxDisabled: { opacity: 0.5 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  input: {
    fontSize: 14,
    padding: 0,
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
  },
})
