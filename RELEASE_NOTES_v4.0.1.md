# CACAYO Member System v4.0.1

## Fixes

### PIN keypad
- Numbers 0–9 now use an explicit dark text color.
- Larger touch targets and clearer typography.
- Clear and backspace buttons remain visually distinct.

### Member search
Search now supports:
- Member name, for example `Caca`
- Full international phone, for example `628123456789`
- Phone without country code, for example `8123456789`
- Local phone format, for example `08123456789`

The Member List frontend uses the same phone normalization.
A failed name search no longer prefills an invalid phone number.
