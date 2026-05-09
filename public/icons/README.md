# Icon Override Folder

Drop official vendor icon archives into this folder to replace the bundled
hand-crafted glyphs that ship with netrun-cad-web. Layout:

```
public/icons/
├── manifest.json       # Lists every icon override
├── aws/                # AWS official SVGs (one file per service)
│   ├── lambda.svg
│   ├── s3.svg
│   └── ...
├── azure/              # Azure official SVGs
│   └── ...
└── gcp/                # GCP official SVGs
    └── ...
```

## manifest.json

```json
{
  "icons": [
    { "id": "aws.lambda",  "vendor": "aws",   "label": "Lambda",         "file": "aws/lambda.svg",       "color": "#FF9900" },
    { "id": "aws.s3",      "vendor": "aws",   "label": "S3",             "file": "aws/s3.svg",           "color": "#FF9900" },
    { "id": "azure.vm",    "vendor": "azure", "label": "Virtual Machine", "file": "azure/vm.svg",        "color": "#0078D4" },
    { "id": "gcp.bigquery","vendor": "gcp",   "label": "BigQuery",       "file": "gcp/bigquery.svg",     "color": "#4285F4" }
  ]
}
```

Each entry's `id` must match an existing entry in `src/engine/icons/{aws,azure,gcp}.ts`
to override (e.g. `aws.lambda` overrides the bundled `aws.lambda` glyph). Adding
a brand-new id introduces a new icon that becomes available for use via
`FlowchartShape.iconRef = "your-id"`.

## Sourcing official icons

- **AWS**: <https://aws.amazon.com/architecture/icons/> — free download as ZIP
  (PowerPoint + SVG + PNG). Use the SVG / "Architecture Service Icons".
- **Azure**: <https://learn.microsoft.com/azure/architecture/icons/> — free SVG
  bundle from Microsoft.
- **GCP**: <https://cloud.google.com/icons> — free download. Use "All Solid"
  or the labeled set.

License notes are inside each archive — read them. As of 2026, all three
allow reuse for architecture diagrams in commercial documents and tools.

## File format

Each `.svg` should be a single 24×24 viewBox SVG with one or more `<path>`
elements. The loader concatenates path data into one path. Other elements
(gradients, multi-color fills, strokes) are dropped — the loader renders the
icon in a single solid color (taken from the manifest `color` field or the
shape's `iconColor`).

For full-fidelity multi-color icons, manually convert each SVG into an
`IconData` entry inside `src/engine/icons/{vendor}.ts` and add `underPath`
+ `underColor` for two-tone glyphs.
