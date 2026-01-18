import * as core from '@actions/core'
import { DefaultArtifactClient } from '@actions/artifact'

/**
 * Upload SBOM as workflow artifact
 *
 * @param {string} sbomPath - Path to the SBOM file
 * @param {string} artifactName - Name for the artifact
 * @returns {Promise<string|null>} Artifact ID or null on failure
 */
export async function uploadArtifact(sbomPath, artifactName = 'sbom-cdxgen') {
  try {
    core.info('📎 Uploading SBOM as workflow artifact...')
    const artifactClient = new DefaultArtifactClient()
    const files = [sbomPath]
    const rootDirectory = process.cwd()

    const uploadResult = await artifactClient.uploadArtifact(
      artifactName,
      files,
      rootDirectory,
      { continueOnError: false }
    )

    core.info(`✅ Artifact uploaded! ID: ${uploadResult.id}`)
    return uploadResult.id
  } catch (error) {
    core.warning(
      `⚠️ Failed to upload artifact: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    core.warning('Continuing with workflow execution...')
    return null
  }
}
