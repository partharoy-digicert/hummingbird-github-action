/**
 * Configuration settings for the SBOM action
 */
export const config = {
  // API endpoint for posting SBOM
  endpointUrl:
    'https://reblown-concurrently-trisha.ngrok-free.dev/api/v1/sbom/upload',

  // Artifact name for uploaded SBOM
  artifactName: 'sbom-cdxgen',

  // SBOM file output path
  sbomPath: 'sbom-cdxgen.cyclonedx.json'
}
