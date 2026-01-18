import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as crypto from 'crypto'

/**
 * Get current git commit SHA
 * @returns {Promise<string>} Commit SHA or 'NA' if not available
 */
async function getCommitSha() {
  try {
    let commitSha = ''
    await exec.exec('git', ['rev-parse', 'HEAD'], {
      listeners: {
        stdout: (data) => {
          commitSha += data.toString().trim()
        }
      },
      silent: true
    })
    return commitSha || 'NA'
  } catch (error) {
    core.warning('Unable to get git commit SHA, using NA')
    return 'NA'
  }
}

/**
 * Get current git branch name
 * @returns {Promise<string>} Branch name or 'NA' if not available
 */
async function getRefBranch() {
  try {
    let branch = ''
    await exec.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      listeners: {
        stdout: (data) => {
          branch += data.toString().trim()
        }
      },
      silent: true
    })
    return branch || 'NA'
  } catch (error) {
    core.warning('Unable to get git branch, using NA')
    return 'NA'
  }
}

/**
 * Get current git tag
 * @returns {Promise<string>} Tag name or 'NA' if not available
 */
async function getReleaseTag() {
  try {
    let tag = ''
    await exec.exec('git', ['describe', '--tags', '--exact-match'], {
      listeners: {
        stdout: (data) => {
          tag += data.toString().trim()
        }
      },
      silent: true
    })
    return tag || 'NA'
  } catch (error) {
    core.warning('Unable to get git tag, using NA')
    return 'NA'
  }
}

/** * POST SBOM to specified endpoint
 *
 * @param {string} sbomPath - Path to the SBOM file
 * @param {string} endpointUrl - Endpoint URL to post the SBOM
 * @param {string} srmToken - Authentication token
 * @returns {Promise<string>} HTTP status code
 */
export async function postSbom(sbomPath, endpointUrl, srmToken, trackRelease) {
  try {
    core.info(`📤 Posting SBOM to ${endpointUrl}...`)

    // Get git information
    const commitSha = await getCommitSha()
    const refBranch = await getRefBranch()
    const extReleaseId = trackRelease ? await getReleaseTag() : 'NA'

    core.info(`Git commit: ${commitSha}`)
    core.info(`Git branch: ${refBranch}`)
    core.info(`Release ID: ${extReleaseId}`)

    const curlCommand = `curl -X POST "${endpointUrl}" \
      -H "Authorization: Bearer ${srmToken}" \
      -H "ngrok-skip-browser-warning: true" \
      -F "file=@${sbomPath}" \
      -F "commit_sha=${commitSha}" \
      -F "ref_branch=${refBranch}" \
      -F "ext_release_id=${extReleaseId}" \
      -F "track_release=${trackRelease}" \
      -F "sbomType=CDX_JSON" \
      -w "%{http_code}" \
      -s -o /dev/null`

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
    return statusCode
  } catch (error) {
    core.warning(
      `⚠️ Failed to POST SBOM to endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    core.warning('Continuing with workflow execution...')
    return 'error'
  }
}
