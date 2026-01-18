import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { readFile } from 'fs/promises'
import { installTrivy } from './trivy.js'
import { postSbom } from './post-sbom.js'
import { uploadArtifact } from './upload-artifact.js'
import { config } from './config.js'

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    const srmToken = core.getInput('srm-token', { required: true })
    const trivyVersion = core.getInput('trivy-version') || 'latest'
    const sbomArtifact = core.getBooleanInput('sbom-artifact')
    const trackRelease = core.getBooleanInput('track-release')
    const { endpointUrl, sbomPath, artifactName } = config

    core.info('🔍 Setting up Trivy...')
    await installTrivy(trivyVersion)

    core.info('📦 Generating SBOM with Trivy...')

    // Generate SBOM using Trivy
    await exec.exec('trivy', [
      'fs',
      '--format',
      'cyclonedx',
      '--output',
      sbomPath,
      '.'
    ])

    core.info(`✅ SBOM generated at: ${sbomPath}`)
    core.setOutput('sbom-path', sbomPath)

    // Read the SBOM file
    const sbomContent = await readFile(sbomPath, 'utf-8')

    // POST SBOM to endpoint (non-blocking)
    const statusCode = await postSbom(sbomPath, endpointUrl, srmToken, trackRelease)
    core.setOutput('response-status', statusCode)

    // Upload SBOM as artifact if requested (non-blocking)
    if (sbomArtifact) {
      await uploadArtifact(sbomPath, 'sbom-cdxgen')
    }
    artifactName
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
