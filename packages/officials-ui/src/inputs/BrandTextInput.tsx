'use client'

import { createElement, useId, useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BrandTextInputProps {
  label: string
  value: string
  onChangeText: (next: string) => void
  /** `text` (default), `email`, or `password`. Drives HTML input type + RN
   *  keyboardType / secureTextEntry / autoCapitalize. */
  type?: 'email' | 'password' | 'text'
  placeholder?: string
  error?: string
  disabled?: boolean
  /** Autocomplete hint forwarded to the underlying input on both platforms.
   *  Slice 80 (S78 leftover): typed as the subset valid in BOTH RN
   *  TextInput's literal union AND the web attribute — kills the last
   *  `as never` in the package. Widen the union if a new consumer needs
   *  another value (must exist in RN's TextInputProps['autoComplete']). */
  autoComplete?: 'email' | 'current-password' | 'new-password' | 'username' | 'name' | 'off'
  /** Slice 51: HTML `required` attribute on web (triggers browser "please fill
   *  in" tooltip on unfocused-blank submit). Forwarded to RN TextInput on
   *  native via `aria-required` (ornamental — no native tooltip equivalent). */
  required?: boolean
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
export function BrandTextInput({
  label,
  value,
  onChangeText,
  type = 'text',
  placeholder,
  error,
  disabled,
  autoComplete,
  required,
  testID,
}: BrandTextInputProps): React.JSX.Element {
  const reactId = useId()
  // useId() returns a value containing ':' which is invalid in CSS class names; sanitize.
  const safeId = reactId.replace(/:/g, '_')
  const className = `brand-text-input-${safeId}`
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
.${className} .brand-text-input__field {
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
.${className} .brand-text-input__field:focus {
  border-color: ${semantic.accent.primary};
  border-width: 1.5px;
  padding: 0 13.5px;
}
.${className} .brand-text-input__field[aria-invalid="true"] {
  border-color: ${semantic.alert.danger.fg};
}
.${className} .brand-text-input__label {
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
.${className} .brand-text-input__field:focus ~ .brand-text-input__label,
.${className} .brand-text-input__field:not(:placeholder-shown) ~ .brand-text-input__label {
  transform: translateY(-100%) scale(0.75);
  top: 6px;
  color: ${semantic.accent.primary};
  font-weight: 700;
  letter-spacing: 0.06em;
}
.${className} .brand-text-input__field[aria-invalid="true"] ~ .brand-text-input__label,
.${className} .brand-text-input__field[aria-invalid="true"]:focus ~ .brand-text-input__label {
  color: ${semantic.alert.danger.fg};
}
.${className} .brand-text-input__error {
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS-in-JS escape hatch (slice 31/33) — `css` is template-built from brand tokens only, no user input reaches it
      createElement('style', { dangerouslySetInnerHTML: { __html: css } }),
      createElement(
        'div',
        { style: { position: 'relative' } },
        createElement('input', {
          id: inputId,
          className: 'brand-text-input__field',
          type: inputType,
          value,
          onChange: (e: { target: { value: string } }) => onChangeText(e.target.value),
          placeholder: placeholder ?? ' ',
          autoComplete,
          disabled: disabled ?? false,
          required: required ?? false,
          'aria-invalid': error ? true : false,
          'aria-describedby': error ? errorId : undefined,
        }),
        createElement('label', { htmlFor: inputId, className: 'brand-text-input__label' }, label),
      ),
      error
        ? createElement(
            'div',
            { id: errorId, className: 'brand-text-input__error', role: 'alert' },
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
        autoComplete={autoComplete}
        editable={!disabled}
        style={[styles.input, { color: semantic.text.primary }]}
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled ?? false }}
        aria-required={required ?? false}
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
