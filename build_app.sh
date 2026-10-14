#!/bin/sh
set -eu
cd "$(dirname "$0")"
project_dir="$(pwd)"
build_python="${READING_JOURNAL_PYTHON:-python3.10}"
"$build_python" -m venv .venv-build-310
.venv-build-310/bin/python -m pip install --upgrade pip
.venv-build-310/bin/python -m pip install -r packaging/requirements-build.txt
build_dir="$(mktemp -d "${TMPDIR:-/tmp/}reading-journal-build.XXXXXX")"
.venv-build-310/bin/python -m PyInstaller --noconfirm --clean --onedir --windowed \
  --name "Reading Journal" \
  --osx-bundle-identifier "local.readingjournal.app" \
  --icon "$project_dir/assets/icons/ReadingJournal.icns" \
  --distpath "$build_dir/dist" \
  --workpath "$build_dir/work" \
  --specpath "$build_dir" \
  --add-data "$project_dir/src/reading_journal/web:web" \
  --add-data "$project_dir/src/reading_journal/config.json:." \
  src/reading_journal/app.py
codesign --verify --deep --strict "$build_dir/dist/Reading Journal.app"
mkdir -p dist
ditto -c -k --keepParent "$build_dir/dist/Reading Journal.app" "dist/Reading Journal.app.zip"
verify_dir="$(mktemp -d "${TMPDIR:-/tmp/}reading-journal-verify.XXXXXX")"
ditto -x -k "dist/Reading Journal.app.zip" "$verify_dir"
codesign --verify --deep --strict "$verify_dir/Reading Journal.app"
echo "Built and verified dist/Reading Journal.app.zip"
