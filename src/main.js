import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as artifact from '@actions/artifact'
import { readFile } from 'fs/promises'

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    const srmToken = core.getInput('srm-token', { required: true })
    const endpointUrl = core.getInput('endpoint-url')
    const trivyVersion = core.getInput('trivy-version')
    const sbomArtifact = core.getBooleanInput('sbom-artifact')
    const sbomPath = 'sbom-cdxgen.cyclonedx.json'

    core.info('🔍 Installing Trivy...')

    // Install Trivy
    const trivyInstallScript = `
      if ! command -v trivy &> /dev/null; then
        echo "Installing Trivy..."
        wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
        echo "deb https://aquasecurity.github.io/trivy-repo/deb \$(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
        sudo apt-get update && sudo apt-get install -y trivy
      fi
    `
    await exec.exec('bash', ['-c', trivyInstallScript])

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

    core.info(`📤 Posting SBOM to ${endpointUrl}...`)

    // POST SBOM to endpoint
    const curlCommand = `curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${srmToken}" -d @${sbomPath} -w "%{http_code}" -s -o /dev/null ${endpointUrl}`

    let statusCode = ''
    const options = {
      listeners: {
        stdout: (data) => {
          statusCode += data.toString()
        }
      },
      silent: true
    }

    await exec.exec('bash', ['-c', curlCommand], options)

    core.info(`✅ SBOM posted successfully! Status: ${statusCode}`)

    // Upload SBOM as artifact if requested
    if (sbomArtifact) {
      core.info('📎 Uploading SBOM as workflow artifact...')
      const artifactClient = artifact.create()
      const artifactName = 'sbom-cdxgen'
      const files = [sbomPath]
      const rootDirectory = process.cwd()

      const uploadResult = await artifactClient.uploadArtifact(
        artifactName,
        files,
        rootDirectory,
        { continueOnError: false }
      )

      core.info(`✅ Artifact uploaded! ID: ${uploadResult.artifactId}`)
    }
    core.setOutput('response-status', statusCode)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
