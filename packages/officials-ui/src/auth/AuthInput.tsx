// Back-compat shim for the slice-31 export name. The component lives at
// inputs/BrandTextInput.tsx (slice 39) and is now generic enough for non-auth
// callers. Existing auth pages import { AuthInput } from this path; both names
// stay valid.

export {
  BrandTextInput as AuthInput,
  type BrandTextInputProps as AuthInputProps,
} from '../inputs/BrandTextInput.tsx'
