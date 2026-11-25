#!/bin/sh
# Copies the built ladder and its source into the repo clone.
set -e
D=/home/claude/procedural/orders
rm -rf "$D"; mkdir -p "$D/source/2kb" "$D/source/0.2kb"
cp -r site/. "$D/"
cp -r src tools package.json "$D/source/"
cp b/forest.glsl b/main.js "$D/source/2kb/"
cp a/index.html "$D/source/0.2kb/forest.html"
[ -f README.md ] && cp README.md ROADMAP.md "$D/"
[ -d dialogue ] && cp -r dialogue "$D/"
cp DATA.md "$D/"
rm -f "$D/source/tools/notes.pyc"; find "$D" -name __pycache__ -prune -exec rm -rf {} +
# the continuous world, built beside the ladder until it replaces the 2 MB rung
mkdir -p "$D/continuous" "$D/source/continuous"
cp cont/out/index.html "$D/continuous/index.html"
cp cont/*.js cont/page.html "$D/source/continuous/"
