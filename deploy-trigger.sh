#!/bin/bash

###############################################################################
# Safe CI/CD Trigger Script
# 
# This script safely synchronizes your local main branch with origin/main
# and pushes a trigger commit to restart CI workflows.
#
# Safety features:
# - Fetches remote refs before any destructive operations
# - Offers to stash local changes
# - Confirms before discarding local commits
# - Uses fast-forward-only pull to avoid merge commits
# - Creates a trigger file not in .gitignore
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to ask for confirmation
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [[ $default == "y" ]]; then
        prompt="$prompt [Y/n] "
    else
        prompt="$prompt [y/N] "
    fi
    
    read -p "$prompt" -r
    REPLY=${REPLY:-$default}
    
    [[ $REPLY =~ ^[Yy]$ ]]
}

###############################################################################
# Main Script
###############################################################################

echo ""
print_info "Safe CI/CD Trigger Script"
echo "=================================="
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository!"
    exit 1
fi

# Step 1: Fetch latest remote refs
print_info "Step 1/6: Fetching latest remote refs..."
if git fetch origin --prune; then
    print_success "Remote refs fetched successfully"
else
    print_error "Failed to fetch remote refs"
    exit 1
fi

# Step 2: Switch to main branch
print_info "Step 2/6: Switching to main branch..."
current_branch=$(git rev-parse --abbrev-ref HEAD)

if [[ "$current_branch" != "main" ]]; then
    if git switch main 2>/dev/null || git checkout main; then
        print_success "Switched to main branch"
    else
        print_error "Failed to switch to main branch"
        exit 1
    fi
else
    print_success "Already on main branch"
fi

# Step 3: Check for local changes
print_info "Step 3/6: Checking for local changes..."

has_staged=$(git diff --cached --quiet && echo "no" || echo "yes")
has_unstaged=$(git diff --quiet && echo "no" || echo "yes")
has_untracked=$(git ls-files --others --exclude-standard | head -1)

if [[ "$has_staged" == "yes" ]] || [[ "$has_unstaged" == "yes" ]] || [[ -n "$has_untracked" ]]; then
    print_warning "You have local changes:"
    
    if [[ "$has_staged" == "yes" ]]; then
        echo "  - Staged changes detected"
    fi
    if [[ "$has_unstaged" == "yes" ]]; then
        echo "  - Unstaged changes detected"
    fi
    if [[ -n "$has_untracked" ]]; then
        echo "  - Untracked files detected"
    fi
    
    echo ""
    if confirm "Do you want to stash these changes?" "y"; then
        stash_message="WIP before CI trigger at $(date -u '+%Y-%m-%d %H:%M:%SZ')"
        if git stash push -u -m "$stash_message"; then
            print_success "Changes stashed as: $stash_message"
            print_info "You can restore them later with: git stash pop"
        else
            print_error "Failed to stash changes"
            exit 1
        fi
    else
        print_warning "Proceeding without stashing. Local changes will be lost!"
        if ! confirm "Are you absolutely sure you want to continue?" "n"; then
            print_info "Aborted by user"
            exit 0
        fi
    fi
else
    print_success "No local changes detected"
fi

# Step 4: Check for local commits ahead of origin/main
print_info "Step 4/6: Checking for local commits..."

commits_ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")

if [[ "$commits_ahead" -gt 0 ]]; then
    print_warning "You have $commits_ahead local commit(s) not in origin/main:"
    git log --oneline origin/main..HEAD | head -5
    echo ""
    if ! confirm "These commits will be LOST. Continue?" "n"; then
        print_info "Aborted by user"
        exit 0
    fi
fi

# Step 5: Reset to origin/main
print_info "Step 5/6: Resetting local main to match origin/main..."

if git reset --hard origin/main; then
    print_success "Reset to origin/main successful"
else
    print_error "Failed to reset to origin/main"
    exit 1
fi

# Verify we're up-to-date with fast-forward-only pull
if git pull --ff-only origin main; then
    print_success "Verified up-to-date with origin/main"
else
    print_error "Failed to verify sync (this shouldn't happen after reset)"
    exit 1
fi

# Step 6: Create trigger commit
print_info "Step 6/6: Creating CI trigger commit..."

# Create trigger file with timestamp
trigger_file="ci-deploy-trigger.txt"
timestamp=$(date -u '+%Y-%m-%d %H:%M:%SZ')
echo "Deploy triggered at: $timestamp" > "$trigger_file"

# Stage the file
if git add "$trigger_file"; then
    print_success "Trigger file staged: $trigger_file"
else
    print_error "Failed to stage trigger file"
    exit 1
fi

# Commit
commit_message="ci: trigger deploy + APK build"
if git commit -m "$commit_message"; then
    print_success "Commit created: $commit_message"
else
    print_error "Failed to create commit"
    exit 1
fi

# Push
print_info "Pushing to origin/main..."
echo ""

if git push origin main; then
    echo ""
    print_success "============================================"
    print_success "Successfully triggered CI/CD!"
    print_success "============================================"
    echo ""
    print_info "Next steps:"
    echo "  1. Go to GitHub Actions: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
    echo "  2. Monitor the workflow run for 'Production Build & Deploy'"
    echo "  3. Download the APK artifact once the build completes"
    echo "  4. Verify Firebase Hosting deployment"
    echo ""
    print_info "See DEPLOYMENT.md for detailed verification steps"
else
    print_error "Failed to push to origin/main"
    print_error "Check your permissions and network connection"
    exit 1
fi
