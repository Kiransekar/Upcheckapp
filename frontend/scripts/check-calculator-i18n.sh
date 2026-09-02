#!/usr/bin/env bash
# Fails the build if a placeholder= prop on a calculator screen holds a string
# literal rather than a t() call. QA BUG-013: 39 hardcoded English strings
# survived a language switch, including every input placeholder.
set -e
if grep -rnE 'placeholder=\{?"' src/screens/calculators/*.tsx; then
  echo "ERROR: hardcoded placeholder on a calculator screen — use t()." >&2
  exit 1
fi
echo "calculator i18n check passed"
