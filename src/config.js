/**
 * Configuration settings for the SBOM action
 */
export const config = {
  // API endpoint for posting SBOM
  endpointUrl:
    'https://reblown-concurrently-trisha.ngrok-free.dev/releasemonitor/api/v1/github-actions/send',

  // Token validation endpoint
  validationEndpoint:
    'https://reblown-concurrently-trisha.ngrok-free.dev/releasemonitor/api/v1/github-actions/validate',

  // Artifact name for uploaded SBOM
  artifactName: 'sbom-cdxgen',

  // SBOM file output path
  sbomPath: 'sbom-cdxgen.cyclonedx.json'
}
