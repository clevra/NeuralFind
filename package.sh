#!/bin/bash

# Create a clean dist directory
rm -rf dist
mkdir dist

# Copy only the files needed for the browser
cp manifest.json dist/
cp icon.jpg dist/
cp background.bundle.js dist/
cp content.js dist/
cp popup.html dist/
cp popup.js dist/
cp THIRD-PARTY-LICENSES.txt dist/
cp PRIVACY_POLICY.md dist/
cp -r wasm dist/

# Create the zip file for the Firefox Add-on store
cd dist
zip -r ../iq-fox-addon.zip *
cd ..

echo "Packaging complete! You can upload iq-fox-addon.zip to Firefox."
