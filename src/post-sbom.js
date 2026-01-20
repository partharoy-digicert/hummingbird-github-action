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
 * @returns {Promise<object>} Repository data with id and node_id
 */
async function getRepositoryData() {
  try {
    const repoFullName = process.env.GITHUB_REPOSITORY
    const token = process.env.GITHUB_TOKEN

    if (!repoFullName) {
      core.warning('GITHUB_REPOSITORY not available')
      return { id: 'NA', node_id: 'NA' }
    }

    let output = ''
    // Use github.token if GITHUB_TOKEN is not available
    const authToken = token || process.env.ACTIONS_RUNTIME_TOKEN

    const curlCommand = authToken
      ? `curl -s -H "Authorization: Bearer ${authToken}" \
         -H "Accept: application/vnd.github.v3+json" \
         https://api.github.com/repos/${repoFullName}`
      : `curl -s -H "Accept: application/vnd.github.v3+json" \
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
    return {
      id: repoData.id?.toString() || 'NA',
      node_id: repoData.node_id || 'NA'
    }
  } catch (error) {
    core.warning(`Unable to get repository data: ${error}`)
    return { id: 'NA', node_id: 'NA' }
  }
}

/**
 * Get organization node ID from GitHub API
 * @returns {Promise<object>} Organization data with id and node_id
 */
async function getOrganizationData() {
  try {
    const repoFullName = process.env.GITHUB_REPOSITORY
    const token = process.env.GITHUB_TOKEN

    if (!repoFullName) {
      core.warning('GITHUB_REPOSITORY not available')
      return { id: 'NA', node_id: 'NA' }
    }

    const owner = repoFullName.split('/')[0]
    let output = ''
    const authToken = token || process.env.ACTIONS_RUNTIME_TOKEN

    const curlCommand = authToken
      ? `curl -s -H "Authorization: Bearer ${authToken}" \
         -H "Accept: application/vnd.github.v3+json" \
         https://api.github.com/users/${owner}`
      : `curl -s -H "Accept: application/vnd.github.v3+json" \
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
    return {
      id: orgData.id?.toString() || 'NA',
      node_id: orgData.node_id || 'NA'
    }
  } catch (error) {
    core.warning(`Unable to get organization data: ${error}`)
    return { id: 'NA', node_id: 'NA' }
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
    const repoData = await getRepositoryData()
    const orgData = await getOrganizationData()

    core.info(`Git commit: ${commitSha}`)
    core.info(`Git branch: ${refBranch}`)
    core.info(`Release ID: ${extReleaseId}`)
    core.info(`Repository: ${organizationName}/${repositoryName}`)
    core.info(`Repository ID: ${repoData.id}`)
    core.info(`Repository Node ID: ${repoData.node_id}`)
    core.info(`Organization ID: ${orgData.id}`)
    core.info(`Organization Node ID: ${orgData.node_id}`)

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
      -F "repository_id=${repoData.id}" \
      -F "organization_id=${orgData.id}" \
      -F "repository_node_id=${repoData.node_id}" \
      -F "organization_node_id=${orgData.node_id}" \
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
