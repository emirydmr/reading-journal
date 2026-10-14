#!/bin/sh
set -eu
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--zip" ]; }; then
  echo "Usage: sh build_app.sh [--zip]" >&2
  exit 2
fi
cd "$(dirname "$0")"
project_dir="$(pwd)"
if pgrep -x "Reading Journal" >/dev/null; then
  echo "Quit the running Reading Journal app before rebuilding." >&2
  exit 1
fi
install_dir="$HOME/Applications"
install_app="$install_dir/Reading Journal.app"
staged_app="$install_dir/.Reading Journal.new.app"
if [ -e "$staged_app" ]; then
  echo "Remove the previous staged build before rebuilding: $staged_app" >&2
  exit 1
fi
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
mkdir -p "$install_dir" dist
ditto "$build_dir/dist/Reading Journal.app" "$staged_app"
codesign --verify --deep --strict "$staged_app"
if [ -e "$install_app" ]; then
  mv "$install_app" "$build_dir/previous.app"
fi
mv "$staged_app" "$install_app"
codesign --verify --deep --strict "$install_app"
if [ -L "dist/Reading Journal.app" ]; then
  rm "dist/Reading Journal.app"
elif [ -d "dist/Reading Journal.app" ]; then
  mv "dist/Reading Journal.app" "$build_dir/previous-project.app"
fi
ln -s "$install_app" "dist/Reading Journal.app"
echo "Built and verified $install_app (linked from dist/Reading Journal.app)"
if [ "${1:-}" = "--zip" ]; then
  ditto -c -k --keepParent "$install_app" "dist/Reading Journal.app.zip"
  echo "Created dist/Reading Journal.app.zip"
fi
