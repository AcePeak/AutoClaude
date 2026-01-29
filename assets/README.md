# AutoClaude Assets

Place the following icon files here:

- `icon.ico` - Windows icon (256x256, ICO format)
- `icon.icns` - macOS icon (ICNS format)
- `icon.png` - Linux/generic icon (256x256, PNG format)

## Creating Icons

You can use tools like:
- [Iconifier](https://iconifier.net/) - Online converter
- [ImageMagick](https://imagemagick.org/) - Command line tool

### From a PNG source:

```bash
# Windows ICO (requires ImageMagick)
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# macOS ICNS (on macOS)
iconutil -c icns icon.iconset

# Or use the PNG directly for Linux
cp icon.png icon.png
```
