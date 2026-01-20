import * as core from '@actions/core'
import * as exec from '@actions/exec'

/**
 * Validate API token with the backend
 *
 * @param {string} apiKey - API key to validate
 * @param {string} validationEndpoint - Validation endpoint URL
 * @returns {Promise<boolean>} True if valid, throws error if invalid
 */
export async function validateToken(apiKey, validationEndpoint) {
  try {
    core.info('🔐 Validating API token...')

    const payload = JSON.stringify({ apiKey })
    const curlCommand = `curl -X POST "${validationEndpoint}" \
      -H "Content-Type: application/json" \
      -H "ngrok-skip-browser-warning: true" \
      -d '${payload}' \
      -w "%{http_code}" \
      -s`

    let output = ''
    let statusCode = ''
    const options = {
      listeners: {
        stdout: (data) => {
          output += data.toString()
        }
      },
      silent: true
    }

    await exec.exec('bash', ['-c', curlCommand], options)

    // Extract status code (last 3 characters)
    statusCode = output.slice(-3)
    const responseBody = output.slice(0, -3)

    core.debug(`Validation response: ${responseBody}`)
    core.debug(`Status code: ${statusCode}`)

    if (statusCode === '200') {
      core.info('✅ Token validation successful')
      return true
    } else {
      throw new Error(
        `Token validation failed with status ${statusCode}: ${responseBody}`
      )
    }
  } catch (error) {
    core.error(
      `❌ Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    throw error
  }
}
