import { APP_VERSION } from '@/lib/version'

const REPO_OWNER = 'thecheesybit'
const REPO_NAME = 'protrack'
const GITHUB_API_LATEST = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`

/**
 * Parses and compares two semver strings (e.g. "2.13.1" vs "2.14.0" or "v2.13.2").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1, v2) {
  const clean1 = (v1 || '').replace(/^v/, '').trim()
  const clean2 = (v2 || '').replace(/^v/, '').trim()

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0)
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0)

  const len = Math.max(parts1.length, parts2.length, 3)
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

/**
 * Quiet error checker mirroring desktop Electron's `isMissingUpdateMetadata`.
 * 404 (draft release or no releases yet), offline/network failure, and 403 (GitHub API rate limit)
 * are swallowed quietly without alarming the user with a broken UI warning.
 */
export function isQuietUpdateError(err) {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('404') ||
    msg.includes('rate limit') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline')
  )
}

/**
 * Checks GitHub Releases for a newer version than current APP_VERSION.
 * Designed specifically for sideloaded APK installations where Google Play Store updates are N/A.
 */
export async function checkForAndroidUpdate() {
  try {
    const res = await fetch(GITHUB_API_LATEST, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!res.ok) {
      if (res.status === 404 || res.status === 403) {
        console.debug(`[android-updater] quiet response status: ${res.status}`)
        return { available: false, error: null }
      }
      throw new Error(`GitHub release check failed: HTTP ${res.status}`)
    }

    const data = await res.json()
    const latestTag = data.tag_name || data.name || ''
    const latestVersion = latestTag.replace(/^v/, '').trim()

    const isNewer = compareSemver(latestVersion, APP_VERSION) > 0
    if (!isNewer) {
      return { available: false, currentVersion: APP_VERSION, latestVersion }
    }

    // Find APK installer asset
    const apkAsset = (data.assets || []).find(
      (a) => a.name && a.name.toLowerCase().endsWith('.apk')
    )

    if (!apkAsset) {
      console.debug('[android-updater] newer release tag found but no .apk asset attached yet')
      return { available: false, currentVersion: APP_VERSION, latestVersion }
    }

    return {
      available: true,
      currentVersion: APP_VERSION,
      latestVersion,
      downloadUrl: apkAsset.browser_download_url,
      fileName: apkAsset.name,
      fileSize: apkAsset.size,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
    }
  } catch (err) {
    if (isQuietUpdateError(err)) {
      console.debug('[android-updater] quiet update error:', err.message)
      return { available: false, error: null }
    }
    console.warn('[android-updater] check error:', err)
    return { available: false, error: err.message }
  }
}

/**
 * Triggers download of the APK and launches the native package installer.
 * If native Capacitor Android bridge is present, calls its install intent;
 * otherwise opens the APK download URL directly in the browser.
 */
export async function installAndroidUpdate(downloadUrl) {
  if (!downloadUrl) throw new Error('Download URL required')

  // Check if native Android updater plugin is registered in window.Capacitor
  const nativeUpdater = window.Capacitor?.Plugins?.AppUpdatePlugin
  if (nativeUpdater?.downloadAndInstall) {
    return await nativeUpdater.downloadAndInstall({ url: downloadUrl })
  }

  // Web/webview fallback: open browser download
  window.open(downloadUrl, '_system')
  return { status: 'opened_browser' }
}
