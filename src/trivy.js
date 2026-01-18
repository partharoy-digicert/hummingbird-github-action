import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import { join } from 'path'

/**
 * Install Trivy with caching support
 *
 * @param {string} version - Version of Trivy to install
 * @returns {Promise<string>} Path to Trivy executable
 */
export async function installTrivy(version = 'latest') {
  const toolName = 'trivy'

  // Check if Trivy is already cached
  let cachedPath = tc.find(toolName, version)

  if (cachedPath) {
    core.info(`✅ Using cached Trivy from: ${cachedPath}`)
    core.addPath(cachedPath)
    return join(cachedPath, 'trivy')
  }

  core.info('📥 Downloading Trivy...')

  // Determine platform and architecture
  const platform = process.platform === 'darwin' ? 'macOS' : 'Linux'
  const arch = process.arch === 'x64' ? '64bit' : 'ARM64'

  // Get latest version if not specified
  let trivyVersion = version
  if (version === 'latest') {
    const versionOutput = await exec.getExecOutput(
      'curl',
      ['-s', 'https://api.github.com/repos/aquasecurity/trivy/releases/latest'],
      { silent: true }
    )
    const releaseData = JSON.parse(versionOutput.stdout)
    trivyVersion = releaseData.tag_name.replace('v', '')
  }

  // Download Trivy
  const downloadUrl = `https://github.com/aquasecurity/trivy/releases/download/v${trivyVersion}/trivy_${trivyVersion}_${platform}-${arch}.tar.gz`
  core.info(`Downloading from: ${downloadUrl}`)

  const downloadPath = await tc.downloadTool(downloadUrl)
  const extractedPath = await tc.extractTar(downloadPath)

  // Cache the tool
  const cachedToolPath = await tc.cacheDir(
    extractedPath,
    toolName,
    trivyVersion
  )
  core.info(`✅ Trivy cached at: ${cachedToolPath}`)

  core.addPath(cachedToolPath)
  return join(cachedToolPath, 'trivy')
}
