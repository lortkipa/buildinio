# buildinio brand

The logo shows two nodes joined by a connector: logic without writing code.

## Files

| File | Use |
|---|---|
| `logo.svg` | Main logo (symbol + wordmark) on light backgrounds |
| `logo-dark.svg` | Main logo on dark backgrounds |
| `mark.svg` | Symbol only, on light backgrounds |
| `mark-dark.svg` | Symbol only, on dark backgrounds |
| `app-icon.svg` / `app-icon-512.png` | App icon with rounded corners |
| `app-icon-square.svg` / `apple-touch-icon.png` | Full-bleed square icon (iOS and Android round the corners themselves) |
| `favicon.svg` | Browser favicon; switches to a white symbol in dark mode |
| `favicon-32.png` | PNG fallback favicon |

The wordmark is outlined, so no font needs to be installed.

## Colors

| Name | Hex | Use |
|---|---|---|
| Ink | `#1C1C1F` | Wordmark, square node, connector |
| Signal red | `#EF4444` | Round node (the only accent) |
| White | `#FFFFFF` | Ink replacement on dark backgrounds |

## Type

Wordmark: Onest Bold, tracking −0.02em, lowercase.

## Rules

- Keep clear space around the logo equal to the height of the square node.
- Don't recolor the round node, rotate the symbol, or add effects (shadows, gradients, outlines).
- Smallest size: symbol 16px; full logo 20px tall.

## Favicon snippet

```html
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
```
