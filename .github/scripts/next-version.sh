#!/usr/bin/env bash
# Works out the next release version for a commit on main, from the pull requests merged
# since the last release. See "Releases" in README.md for the rules.
#
#   next-version.sh <commit>
#
# Prints key=value lines for $GITHUB_OUTPUT: tag (empty when there is nothing to release),
# bump and previous. Needs the full git history with tags, and gh with GH_TOKEN and
# GITHUB_REPOSITORY to look up the pull requests.
set -euo pipefail

# Bump for one pull request. A release:* label wins over the branch name.
#   bump_for <branch> [labels, one per line]
bump_for() {
	local branch labels
	branch=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
	labels=$(printf '%s' "${2:-}" | tr '[:upper:]' '[:lower:]')
	for level in skip major minor patch; do
		if grep -qx "release:$level" <<<"$labels"; then
			echo "$level"
			return
		fi
	done
	case "$branch" in
		major/* | breaking/*) echo major ;;
		feat/* | feature/* | minor/*) echo minor ;;
		*) echo patch ;;
	esac
}

# Highest of several bumps (one per line). Only skip in the list means skip.
max_bump() {
	local all
	all=$(cat)
	for level in major minor patch skip; do
		if grep -qx "$level" <<<"$all"; then
			echo "$level"
			return
		fi
	done
	echo patch
}

# bump_version 1.2.3 minor -> 1.3.0
bump_version() {
	local major minor patch
	IFS=. read -r major minor patch <<<"$1"
	case "$2" in
		major) echo "$((major + 1)).0.0" ;;
		minor) echo "$major.$((minor + 1)).0" ;;
		*) echo "$major.$minor.$((patch + 1))" ;;
	esac
}

# Branch and labels of the pull request a commit on main came from. Falls back to the
# branch in a "Merge pull request #1 from owner/branch" message, then to nothing.
pr_for_commit() {
	local commit=$1 pr
	pr=$(gh api "repos/$GITHUB_REPOSITORY/commits/$commit/pulls" \
		--jq '[.[] | select(.merged_at != null)][0] // empty | [.head.ref, (.labels | map(.name) | join("\n"))] | join("\n")' \
		2>/dev/null || true)
	if [ -n "$pr" ]; then
		echo "$pr"
		return
	fi
	git log -1 --format=%s "$commit" | sed -nE 's#^Merge pull request \#[0-9]+ from [^/]+/(.+)$#\1#p'
}

main() {
	local head=$1 previous range bumps bump
	previous=$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --merged "$head" | grep -vF -- - | sort -V | tail -n 1 || true)

	if [ -n "$previous" ] && [ "$(git rev-parse "$previous^{commit}")" = "$(git rev-parse "$head^{commit}")" ]; then
		echo "Already released as $previous." >&2
		printf 'tag=\nbump=skip\nprevious=%s\n' "$previous"
		return
	fi

	# Everything since the last release, so a run that was cancelled while waiting for another
	# one still counts. The first release only looks at the newest commit.
	if [ -n "$previous" ]; then
		range=$(git rev-list --first-parent "$previous..$head")
	else
		range=$head
	fi

	bumps=$(for commit in $range; do
		local pr branch labels
		pr=$(pr_for_commit "$commit")
		branch=$(head -n 1 <<<"$pr")
		labels=$(tail -n +2 <<<"$pr")
		level=$(bump_for "$branch" "$labels")
		echo "${commit::7} ${branch:-(direct push)}: $level" >&2
		echo "$level"
	done)
	bump=$(max_bump <<<"$bumps")

	if [ "$bump" = skip ]; then
		echo "Every change since ${previous:-the start} is marked release:skip." >&2
		printf 'tag=\nbump=skip\nprevious=%s\n' "$previous"
		return
	fi

	local base=${previous:-v0.0.0} next
	next=v$(bump_version "${base#v}" "$bump")
	echo "${previous:-no release yet} -> $next ($bump)" >&2
	printf 'tag=%s\nbump=%s\nprevious=%s\n' "$next" "$bump" "$previous"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
	main "${1:?usage: next-version.sh <commit>}"
fi
