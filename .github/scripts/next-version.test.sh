#!/usr/bin/env bash
# Tests for next-version.sh against a throwaway repository. Pull requests are read from the
# merge commit messages, as gh is replaced by a stub that finds nothing.
set -euo pipefail
script=$(cd "$(dirname "$0")" && pwd)/next-version.sh
# shellcheck source=next-version.sh
source "$script"

failures=0
expect() {
	if [ "$2" = "$3" ]; then
		echo "ok   $1"
	else
		echo "FAIL $1: expected '$3', got '$2'"
		failures=$((failures + 1))
	fi
}

expect 'fix branch' "$(bump_for fix/login)" patch
expect 'feat branch' "$(bump_for feat/emoji)" minor
expect 'feature branch' "$(bump_for Feature/Emoji)" minor
expect 'major branch' "$(bump_for major/new-api)" major
expect 'breaking branch' "$(bump_for breaking/drop-node-20)" major
expect 'other branch' "$(bump_for claude/project-thread-abc)" patch
expect 'label wins' "$(bump_for fix/x $'bug\nrelease:minor')" minor
expect 'skip label' "$(bump_for feat/x release:skip)" skip
expect 'max bump' "$(printf 'patch\nminor\nskip\n' | max_bump)" minor
expect 'only skip' "$(printf 'skip\nskip\n' | max_bump)" skip
expect 'bump patch' "$(bump_version 0.1.9 patch)" 0.1.10
expect 'bump minor' "$(bump_version 0.1.9 minor)" 0.2.0
expect 'bump major' "$(bump_version 0.1.9 major)" 1.0.0

repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
cd "$repo"
git init -q -b main
git config user.email test@example.com
git config user.name test
gh() { return 1; }
export GITHUB_REPOSITORY=test/test

merge() {
	git checkout -q -b "$1" main
	git commit -q --allow-empty -m "change on $1"
	git checkout -q main
	git merge -q --no-ff -m "Merge pull request #1 from owner/$1" "$1"
}

git commit -q --allow-empty -m init
merge feat/first
expect 'first release' "$(main HEAD | grep '^tag=')" tag=v0.1.0
git tag v0.1.0
expect 'already released' "$(main HEAD | grep '^tag=')" tag=

merge fix/a
merge feat/b
merge fix/c
expect 'highest since last release' "$(main HEAD | grep '^tag=')" tag=v0.2.0
git tag v0.2.0-beta.1
expect 'ignores pre-releases' "$(main HEAD | grep '^previous=')" previous=v0.1.0
git tag v0.2.0

git commit -q --allow-empty -m 'direct push'
expect 'direct push' "$(main HEAD | grep '^tag=')" tag=v0.2.1
merge breaking/x
expect 'major' "$(main HEAD | grep '^tag=')" tag=v1.0.0

[ "$failures" = 0 ] || exit 1
