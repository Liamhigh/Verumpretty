# Deployment Guide

This guide provides safe and reliable procedures for deploying the Verum Omnis Forensic Engine.

## Table of Contents

- [Quick Deployment](#quick-deployment)
- [Safe CI Trigger Procedure](#safe-ci-trigger-procedure)
- [Understanding the Workflows](#understanding-the-workflows)
- [Verifying Deployments](#verifying-deployments)
- [Troubleshooting](#troubleshooting)

## Quick Deployment

The project uses GitHub Actions for automatic deployment. Any push to the `main` branch triggers:

1. **Web Build & Firebase Hosting Deploy** - Builds and deploys the PWA to Firebase Hosting
2. **Android APK Build** - Builds a debug APK and uploads it as a workflow artifact

## Safe CI Trigger Procedure

If you need to manually trigger CI (e.g., to rebuild artifacts or retry a failed deployment), follow this **safer** procedure instead of force-pushing:

### ⚠️ Risks of Unsafe Procedures

**DO NOT** simply run `git reset --hard origin/main` without safeguards:
- ❌ Discards all uncommitted local changes permanently
- ❌ Removes any local commits that differ from `origin/main`
- ❌ Can delete work if `origin/main` is stale (not fetched recently)
- ❌ No warning or confirmation before data loss

### ✅ Recommended Safe Procedure

This procedure ensures you don't accidentally lose work:

```bash
# 1. Fetch latest remote refs (ensures origin/main is current)
git fetch origin --prune

# 2. Switch to main branch
git switch main || git checkout main

# 3. OPTIONAL: Stash local changes if you want to keep them
git stash push -m "WIP before sync with origin"

# 4. Force-match local main to origin/main
# (This is safe now because we fetched first and optionally stashed)
git reset --hard origin/main

# 5. Ensure we're up-to-date (fast-forward only, no merge commits)
git pull --ff-only origin main

# 6. Create a trigger file (using a name NOT in .gitignore)
echo "Deploy: $(date -u '+%Y-%m-%d %H:%M:%SZ')" > ci-deploy-trigger.txt

# 7. Stage the trigger file
git add ci-deploy-trigger.txt

# 8. Commit (use --no-verify to skip pre-commit hooks if needed)
git commit -m "ci: trigger deploy + APK build"

# 9. Push to trigger CI
git push origin main
```

### Alternative: Using the Deployment Script

For convenience, you can use the provided deployment script:

```bash
./deploy-trigger.sh
```

This script automates the safe procedure above and includes interactive confirmations.

### If You Want to Clean Untracked Files

**⚠️ DESTRUCTIVE**: Only run this if you're absolutely sure you want to delete all untracked files:

```bash
git clean -fdx
```

This removes:
- All untracked files
- All ignored files (node_modules, dist, etc.)
- All untracked directories

## Understanding the Workflows

### Production Workflow (`production.yml`)

Triggers on: `push` to `main` branch

**Jobs:**

1. **build_and_deploy_web**
   - Builds the React/Vite web application
   - Deploys to Firebase Hosting (live channel)
   - Uses secrets:
     - `VITE_API_KEY` - Google Gemini API key
     - `FIREBASE_SERVICE_ACCOUNT_VERUM_OMNIS_ENGINE` - Firebase service account

2. **build_android_apk** (runs after web deploy)
   - Builds web assets
   - Syncs with Capacitor
   - Builds Android debug APK using Gradle
   - Uploads APK as workflow artifact named `verum-omnis-debug`

### Firebase Hosting Workflow (`firebase-hosting.yml`)

Triggers on: `push` to `main` branch

**Note:** This workflow appears to be redundant with the production workflow. Consider removing it or using it for preview deployments only.

## Verifying Deployments

After pushing a commit that triggers CI, follow these steps to verify success:

### 1. Check GitHub Actions

1. Navigate to your repository on GitHub
2. Click the **Actions** tab
3. Find the workflow run triggered by your recent push
4. Monitor the workflow progress:
   - ✅ Green checkmarks indicate success
   - ❌ Red X's indicate failures
   - 🟡 Yellow circles indicate in-progress

### 2. Review Build Logs

Click on any job to see detailed logs:
- Look for the **Build Web Project** step
- Check the **Sync Capacitor** step
- Verify the **Build Android APK** step completed
- Confirm the **Upload APK Artifact** step succeeded

### 3. Download APK Artifact

Once the workflow completes successfully:

1. Scroll to the bottom of the workflow run page
2. Find the **Artifacts** section
3. Download `verum-omnis-debug` artifact
4. Extract the ZIP file to get `app-debug.apk`
5. Install on an Android device or emulator for testing

### 4. Verify Firebase Hosting Deployment

1. Visit your Firebase Console: https://console.firebase.google.com
2. Select project: `verum-omnis-engine`
3. Navigate to **Hosting**
4. Check the deployment history for the latest deployment
5. Click the domain to visit the live site

### 5. Test the Live Application

1. Visit your production URL
2. Test key functionality:
   - Upload a document for analysis
   - Verify AI processing works
   - Download a PDF report
   - Test on mobile devices
   - Verify PWA installation works

## Troubleshooting

### CI Doesn't Start After Push

**Possible Causes:**

1. **Workflow not on main branch**
   ```bash
   # Verify workflow files exist on main
   git show main:.github/workflows/production.yml
   ```

2. **Branch filter mismatch**
   - Check that `branches: [main]` matches your branch name
   - Some repos use `master` instead of `main`

3. **Missing required secrets**
   - Go to Settings → Secrets and variables → Actions
   - Verify these secrets exist:
     - `VITE_API_KEY`
     - `FIREBASE_SERVICE_ACCOUNT_VERUM_OMNIS_ENGINE`
     - `GITHUB_TOKEN` (automatically provided)

### Build Fails

**Common Issues:**

1. **Missing dependencies**
   ```bash
   # Try cleaning and reinstalling locally
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

2. **API Key not set**
   - Verify `VITE_API_KEY` secret is configured
   - Check that the build step includes the env var

3. **Android build fails**
   - Check Java version (should be 17)
   - Verify Capacitor sync completed
   - Review Gradle error messages

### Deployment Fails

1. **Firebase credentials expired**
   - Regenerate Firebase service account key
   - Update the secret in GitHub

2. **Insufficient permissions**
   - Verify the service account has "Firebase Hosting Admin" role

3. **Project ID mismatch**
   - Ensure `projectId` in workflow matches Firebase project
   - Check `firebase.json` configuration

### APK Not Uploaded

1. **Build output path changed**
   - Verify path: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Check Gradle build variant

2. **Artifact retention expired**
   - Artifacts are kept for 90 days by default
   - Download within retention period

## Security Best Practices

### Secrets Management

- ✅ Never commit API keys or credentials to the repository
- ✅ Use GitHub Secrets for sensitive values
- ✅ Rotate service account keys periodically
- ✅ Use minimal permissions for service accounts

### Code Review

- ✅ Require pull request reviews before merging to main
- ✅ Enable branch protection rules
- ✅ Use CODEOWNERS for critical files

### Monitoring

- ✅ Set up Firebase alerts for quota limits
- ✅ Monitor GitHub Actions usage
- ✅ Review deployment logs regularly

## Advanced Topics

### Building Signed Release APK/AAB

The current workflow builds debug APKs only. For production release:

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore release.keystore \
     -alias verum-omnis -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add keystore secrets to GitHub:
   - `ANDROID_KEYSTORE_FILE` (base64 encoded keystore)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

3. Update workflow to build release AAB and sign it

### Firebase App Distribution

To distribute APKs to testers via Firebase:

1. Install Firebase App Distribution plugin in the workflow
2. Add Firebase App Distribution service account
3. Configure testers/groups in Firebase Console

### Play Store Deployment

For automatic Play Store deployment:

1. Set up Play Console API access
2. Create a service account with Play Console permissions
3. Add service account JSON to GitHub Secrets
4. Use `r0adkll/upload-google-play` action

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Firebase Hosting Deployment](https://firebase.google.com/docs/hosting)
- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Vite Build Documentation](https://vitejs.dev/guide/build.html)
