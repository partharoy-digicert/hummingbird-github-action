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

/**
 * Get repository name from git remote or environment
 * @returns {string} Repository name or 'NA' if not available
 */
function getRepositoryName() {
  try {
    // Try GitHub environment variable first
    const repoFullName = process.env.GITHUB_REPOSITORY || ''
    if (repoFullName) {
      // Extract repo name from "owner/repo"
      const parts = repoFullName.split('/')
      return parts[1] || 'NA'
    }
    return 'NA'
  } catch (error) {
    core.warning('Unable to get repository name, using NA')
    return 'NA'
  }
}

/**
 * Get organization name from git remote or environment
 * @returns {string} Organization name or 'NA' if not available
 */
function getOrganizationName() {
  try {
    // Try GitHub environment variable first
    const repoFullName = process.env.GITHUB_REPOSITORY || ''
    if (repoFullName) {
      // Extract owner from "owner/repo"
      const parts = repoFullName.split('/')
      return parts[0] || 'NA'
    }
    return 'NA'
  } catch (error) {
    core.warning('Unable to get organization name, using NA')
    return 'NA'
  }
}

/**
 * Get repository node ID from GitHub API
 * @returns {Promise<string>} Repository node ID or 'NA' if not available
 */
async function getRepositoryNodeId() {
  try {
    const repoFullName = process.env.GITHUB_REPOSITORY
    const token = process.env.GITHUB_TOKEN

    if (!repoFullName || !token) {
      core.warning('GITHUB_REPOSITORY or GITHUB_TOKEN not available')
      return 'NA'
    }

    let output = ''
    const curlCommand = `curl -s -H "Authorization: Bearer ${token}" \
      -H "Accept: application/vnd.github.v3+json" \
      https://api.github.com/repos/${repoFullName}`

    await exec.exec('bash', ['-c', curlCommand], {
      listeners: {
        stdout: (data) => {
          output += data.toString()
        }
      },
      silent: true
    })

    const repoData = JSON.parse(output)
    return repoData.node_id || 'NA'
  } catch (error) {
    core.warning('Unable to get repository node ID, using NA')
    return 'NA'
  }
}

/**
 * Get organization node ID from GitHub API
 * @returns {Promise<string>} Organization node ID or 'NA' if not available
 */
async function getOrganizationNodeId() {
  try {
    const repoFullName = process.env.GITHUB_REPOSITORY
    const token = process.env.GITHUB_TOKEN

    if (!repoFullName || !token) {
      core.warning('GITHUB_REPOSITORY or GITHUB_TOKEN not available')
      return 'NA'
    }

    const owner = repoFullName.split('/')[0]
    let output = ''
    const curlCommand = `curl -s -H "Authorization: Bearer ${token}" \
      -H "Accept: application/vnd.github.v3+json" \
      https://api.github.com/users/${owner}`

    await exec.exec('bash', ['-c', curlCommand], {
      listeners: {
        stdout: (data) => {
          output += data.toString()
        }
      },
      silent: true
    })

    const orgData = JSON.parse(output)
    return orgData.node_id || 'NA'
  } catch (error) {
    core.warning('Unable to get organization node ID, using NA')
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

    // Get repository information
    const repositoryName = getRepositoryName()
    const organizationName = getOrganizationName()
    const repositoryNodeId = await getRepositoryNodeId()
    const organizationNodeId = await getOrganizationNodeId()

    core.info(`Git commit: ${commitSha}`)
    core.info(`Git branch: ${refBranch}`)
    core.info(`Release ID: ${extReleaseId}`)
    core.info(`Repository: ${organizationName}/${repositoryName}`)
    core.info(`Repository Node ID: ${repositoryNodeId}`)
    core.info(`Organization Node ID: ${organizationNodeId}`)

    const curlCommand = `curl -X POST "${endpointUrl}" \
      -H "Authorization: Bearer ${srmToken}" \
      -H "ngrok-skip-browser-warning: true" \
      -F "file=@${sbomPath}" \
      -F "commit_sha=${commitSha}" \
      -F "ref_branch=${refBranch}" \
      -F "ext_release_id=${extReleaseId}" \
      -F "track_release=${trackRelease}" \
      -F "repository_name=${repositoryName}" \
      -F "organization_name=${organizationName}" \
      -F "repository_node_id=${repositoryNodeId}" \
      -F "organization_node_id=${organizationNodeId}" \
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
